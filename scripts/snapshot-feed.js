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
    tabs: ["推荐", "此刻"]
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    if (arg === "--limit") args.limit = Number(argv[++index] || args.limit);
    if (arg === "--tabs") args.tabs = String(argv[++index] || "").split(",").map((item) => item.trim()).filter(Boolean);
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
