import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const outputDir = path.join(rootDir, "outputs");

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.LIAN_BASE_URL || "http://localhost:4100",
    limit: 12,
    tabs: ["精选", "此刻"],
    diff: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    if (arg === "--limit") args.limit = Number(argv[++index] || args.limit);
    if (arg === "--tabs") args.tabs = String(argv[++index] || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (arg === "--diff") args.diff = { before: argv[++index], after: argv[++index] };
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function countBy(items, getter) {
  const counts = {};
  for (const item of items) {
    const key = String(getter(item) || "未填写");
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function percent(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function table(headers, rows) {
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return lines.join("\n");
}

function countTable(title, counts) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return [`### ${title}`, "", table(["值", "数量"], rows), ""].join("\n");
}

function parseCountTable(text, heading) {
  const re = new RegExp(`### ${heading}\\s*\\n+\\| 值 \\| 数量 \\|\\s*\\n\\| --- \\| --- \\|\\s*\\n((?:\\|.+\\|\\s*\\n)*)`);
  const m = text.match(re);
  if (!m) return {};
  const counts = {};
  for (const line of m[1].trim().split("\n")) {
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) counts[cells[0]] = Number(cells[1]) || 0;
  }
  return counts;
}

function parseSnapshot(text) {
  const titleMatch = text.match(/^# LIAN Feed Snapshot (.+)$/m);
  const date = titleMatch ? titleMatch[1] : "unknown";

  const totalMatch = text.match(/\| 总卡片数 \| (\d+)/);
  const officialMatch = text.match(/\| 官方内容数 \| (\d+) \((\d+)%\)/);
  const coverMatch = text.match(/\| 有图内容数 \| (\d+) \((\d+)%\)/);

  const contentType = parseCountTable(text, "contentType 占比");
  const locationArea = parseCountTable(text, "locationArea 占比");

  const tids = new Set();
  const tidRows = [];
  const tidRe = /\| (\d+) \| (.+?) \| (\S*) \| (\S*) \| (\S*) \| (yes|no) \| (yes|no) \| (yes|no) \|/g;
  let tm;
  while ((tm = tidRe.exec(text))) {
    const tid = Number(tm[1]);
    tids.add(tid);
    tidRows.push({
      tid,
      title: tm[2],
      contentType: tm[3],
      locationArea: tm[4],
      tag: tm[5],
      hasCover: tm[6] === "yes",
      isOfficial: tm[7] === "yes",
      isTest: tm[8] === "yes"
    });
  }

  return {
    date,
    total: totalMatch ? Number(totalMatch[1]) : 0,
    official: officialMatch ? Number(officialMatch[1]) : 0,
    officialRate: officialMatch ? Number(officialMatch[2]) : 0,
    withCover: coverMatch ? Number(coverMatch[1]) : 0,
    coverRate: coverMatch ? Number(coverMatch[2]) : 0,
    contentType,
    locationArea,
    tids,
    tidRows
  };
}

function diffCounts(before, after, label) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows = [];
  for (const key of allKeys) {
    const b = before[key] || 0;
    const a = after[key] || 0;
    if (b === a) continue;
    const delta = a - b;
    const sign = delta > 0 ? "+" : "";
    rows.push([key, b, a, `${sign}${delta}`]);
  }
  if (!rows.length) return "";
  rows.sort((a, b) => Math.abs(Number(b[3])) - Math.abs(Number(a[3])));
  return [`### ${label}`, "", table(["值", "Before", "After", "变化"], rows), ""].join("\n");
}

function diffSnapshots(beforePath, afterPath) {
  return Promise.all([fs.readFile(beforePath, "utf8"), fs.readFile(afterPath, "utf8")]).then(([beforeText, afterText]) => {
    const b = parseSnapshot(beforeText);
    const a = parseSnapshot(afterText);

    const sections = [
      `# Feed Snapshot Diff`,
      "",
      `Before: \`${path.basename(beforePath)}\` (${b.date})`,
      `After:  \`${path.basename(afterPath)}\` (${a.date})`,
      "",
      "## Overall",
      "",
      table(["指标", "Before", "After", "变化"], [
        ["总卡片数", b.total, a.total, a.total - b.total],
        ["官方内容数", `${b.official} (${b.officialRate}%)`, `${a.official} (${a.officialRate}%)`, `${a.officialRate - b.officialRate}pp`],
        ["有图内容数", `${b.withCover} (${b.coverRate}%)`, `${a.withCover} (${a.coverRate}%)`, `${a.coverRate - b.coverRate}pp`]
      ]),
      ""
    ];

    const ctDiff = diffCounts(b.contentType, a.contentType, "contentType 变化");
    if (ctDiff) sections.push(ctDiff);

    const laDiff = diffCounts(b.locationArea, a.locationArea, "locationArea 变化");
    if (laDiff) sections.push(laDiff);

    // Tid changes
    const added = [...a.tids].filter((tid) => !b.tids.has(tid));
    const removed = [...b.tids].filter((tid) => !a.tids.has(tid));
    const kept = [...a.tids].filter((tid) => b.tids.has(tid));

    sections.push("## TID 变化", "");
    sections.push(table(["指标", "数量"], [
      ["新增", added.length],
      ["移除", removed.length],
      ["保留", kept.length]
    ]), "");

    if (added.length) {
      const addedRows = a.tidRows.filter((r) => added.includes(r.tid));
      sections.push("### 新增 TID", "");
      sections.push(table(["tid", "title", "contentType", "locationArea"], addedRows.map((r) => [r.tid, r.title, r.contentType, r.locationArea])), "");
    }

    if (removed.length) {
      const removedRows = b.tidRows.filter((r) => removed.includes(r.tid));
      sections.push("### 移除 TID", "");
      sections.push(table(["tid", "title", "contentType", "locationArea"], removedRows.map((r) => [r.tid, r.title, r.contentType, r.locationArea])), "");
    }

    // Position changes for kept tids
    const bOrder = b.tidRows.map((r) => r.tid);
    const aOrder = a.tidRows.map((r) => r.tid);
    const moved = kept.filter((tid) => bOrder.indexOf(tid) !== aOrder.indexOf(tid));
    if (moved.length) {
      const movedRows = moved.map((tid) => {
        const br = b.tidRows.find((r) => r.tid === tid);
        const ar = a.tidRows.find((r) => r.tid === tid);
        const bIdx = bOrder.indexOf(tid);
        const aIdx = aOrder.indexOf(tid);
        const shift = bIdx - aIdx;
        const label = shift > 0 ? `↑${shift}` : `↓${Math.abs(shift)}`;
        return [tid, br?.title || "", bIdx + 1, aIdx + 1, label];
      });
      sections.push("### 位置变化", "");
      sections.push(table(["tid", "title", "Before位置", "After位置", "变化"], movedRows), "");
    }

    return sections.join("\n");
  });
}

function summarize(items) {
  const total = items.length;
  const official = items.filter((item) => Number(item.officialScore || 0) > 0.6 || item.tags?.includes("官方通知") || item.tags?.includes("官方资讯")).length;
  const withCover = items.filter((item) => item.cover).length;
  return {
    total,
    official,
    withCover,
    officialRate: percent(official, total),
    coverRate: percent(withCover, total),
    contentType: countBy(items, (item) => item.contentType),
    locationArea: countBy(items, (item) => item.locationArea)
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.diff) {
    const output = await diffSnapshots(args.diff.before, args.diff.after);
    await fs.mkdir(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `feed-diff-${timestampForFile()}.md`);
    await fs.writeFile(outPath, `${output}\n`, "utf8");
    console.log(outPath);
    return;
  }

  const pages = [];
  for (const tab of args.tabs) {
    for (const page of [1, 2, 3]) {
      const url = new URL("/api/feed", args.baseUrl);
      url.searchParams.set("tab", tab);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(args.limit));
      const data = await fetchJson(url);
      pages.push({ tab, page, items: Array.isArray(data.items) ? data.items : [] });
    }
  }

  const allItems = pages.flatMap((page) => page.items.map((item) => ({ ...item, snapshotTab: page.tab, snapshotPage: page.page })));
  const summary = summarize(allItems);
  const now = new Date();
  const outputPath = path.join(outputDir, `feed-snapshot-${timestampForFile(now)}.md`);
  const sections = [
    `# LIAN Feed Snapshot ${now.toISOString()}`,
    "",
    `Base URL: ${args.baseUrl}`,
    `Tabs: ${args.tabs.join(", ")}`,
    `Limit: ${args.limit}`,
    "",
    "## Summary",
    "",
    table(["指标", "值"], [
      ["总卡片数", summary.total],
      ["官方内容数", `${summary.official} (${summary.officialRate})`],
      ["有图内容数", `${summary.withCover} (${summary.coverRate})`]
    ]),
    "",
    countTable("contentType 占比", summary.contentType),
    countTable("locationArea 占比", summary.locationArea),
    "## Pages",
    ""
  ];

  for (const page of pages) {
    sections.push(`### ${page.tab} page ${page.page}`, "");
    sections.push(table(
      ["tid", "title", "contentType", "locationArea", "tag", "hasCover", "isOfficial", "isTest"],
      page.items.map((item) => [
        item.tid,
        item.title,
        item.contentType || "",
        item.locationArea || "",
        item.tag || item.tags?.[0] || "",
        item.cover ? "yes" : "no",
        Number(item.officialScore || 0) > 0.6 ? "yes" : "no",
        item.tags?.includes("推荐测试") || /^\[推荐测试\]/.test(item.title || "") ? "yes" : "no"
      ])
    ));
    sections.push("");
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${sections.join("\n")}\n`, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
