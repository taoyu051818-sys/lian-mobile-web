#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  if (argv.length < 4) {
    console.error("用法: node scripts/diff-feed-snapshots.js <old-snapshot.md> <new-snapshot.md>");
    process.exit(1);
  }
  return { oldPath: argv[2], newPath: argv[3] };
}

function parseSnapshotTable(text) {
  const pages = [];
  const lines = text.split(/\r?\n/);
  let currentTab = "";
  let currentPage = 0;
  let headerRow = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // detect page header: ### 推荐 page 1
    const pageMatch = line.match(/^###\s+(.+?)\s+page\s+(\d+)$/);
    if (pageMatch) {
      currentTab = pageMatch[1];
      currentPage = Number(pageMatch[2]);
      headerRow = null;
      continue;
    }

    // detect table header
    if (line.startsWith("|") && line.includes("tid") && line.includes("title")) {
      headerRow = line.split("|").map((c) => c.trim()).filter(Boolean);
      continue;
    }

    // skip separator
    if (line.match(/^\|[\s\-|]+\|$/)) continue;

    // parse table row
    if (headerRow && line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      const row = {};
      for (let j = 0; j < headerRow.length && j < cells.length; j++) {
        row[headerRow[j]] = cells[j];
      }
      if (row.tid) {
        pages.push({
          tab: currentTab,
          page: currentPage,
          tid: Number(row.tid),
          title: row.title || "",
          contentType: row.contentType || "",
          locationArea: row.locationArea || "",
          tag: row.tag || "",
          hasCover: row.hasCover === "yes",
          isTest: row.isTest === "yes"
        });
      }
    }
  }

  return pages;
}

function countMap(arr) {
  const map = {};
  for (const item of arr) {
    map[item] = (map[item] || 0) + 1;
  }
  return map;
}

function diffCounts(oldMap, newMap) {
  const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
  const changes = [];
  for (const key of allKeys) {
    const o = oldMap[key] || 0;
    const n = newMap[key] || 0;
    if (o !== n) {
      const delta = n - o;
      const sign = delta > 0 ? "+" : "";
      changes.push({ key, old: o, new: n, delta, label: `${key}: ${o} → ${n} (${sign}${delta})` });
    }
  }
  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function printSection(label) {
  console.log(`\n═══ ${label} ═══`);
}

async function main() {
  const args = parseArgs(process.argv);

  let oldText, newText;
  try {
    oldText = await fs.readFile(args.oldPath, "utf8");
  } catch {
    console.error(`错误：无法读取旧快照 ${args.oldPath}`);
    process.exit(1);
  }
  try {
    newText = await fs.readFile(args.newPath, "utf8");
  } catch {
    console.error(`错误：无法读取新快照 ${args.newPath}`);
    process.exit(1);
  }

  const oldRows = parseSnapshotTable(oldText);
  const newRows = parseSnapshotTable(newText);

  if (oldRows.length === 0) {
    console.error("警告：旧快照未解析到任何帖子行");
  }
  if (newRows.length === 0) {
    console.error("警告：新快照未解析到任何帖子行");
  }

  console.log("═══ Feed 快照对比报告 ═══");
  console.log(`旧快照: ${path.basename(args.oldPath)} (${oldRows.length} 条)`);
  console.log(`新快照: ${path.basename(args.newPath)} (${newRows.length} 条)`);

  // 1. per-tab count changes
  printSection("每页帖子数量变化");
  const oldPageCounts = {};
  const newPageCounts = {};
  for (const r of oldRows) {
    const key = `${r.tab} p${r.page}`;
    oldPageCounts[key] = (oldPageCounts[key] || 0) + 1;
  }
  for (const r of newRows) {
    const key = `${r.tab} p${r.page}`;
    newPageCounts[key] = (newPageCounts[key] || 0) + 1;
  }
  const pageChanges = diffCounts(oldPageCounts, newPageCounts);
  if (pageChanges.length === 0) {
    console.log("  无变化");
  } else {
    for (const c of pageChanges) {
      console.log(`  ${c.label}`);
    }
  }

  // 2. new tids
  const oldTids = new Set(oldRows.map((r) => r.tid));
  const newTids = new Set(newRows.map((r) => r.tid));
  const addedTids = [...newTids].filter((t) => !oldTids.has(t));
  const removedTids = [...oldTids].filter((t) => !newTids.has(t));

  printSection("新增 tid");
  if (addedTids.length === 0) {
    console.log("  无");
  } else {
    console.log(`  ${addedTids.join(", ")} (${addedTids.length} 个)`);
  }

  printSection("移除 tid");
  if (removedTids.length === 0) {
    console.log("  无");
  } else {
    console.log(`  ${removedTids.join(", ")} (${removedTids.length} 个)`);
  }

  // 3. rank changes (top 20)
  printSection("排名变化 Top 20");
  const oldRankMap = {};
  const newRankMap = {};
  for (let i = 0; i < oldRows.length; i++) {
    const key = `${oldRows[i].tab}:tid:${oldRows[i].tid}`;
    if (!(key in oldRankMap)) oldRankMap[key] = i + 1;
  }
  for (let i = 0; i < newRows.length; i++) {
    const key = `${newRows[i].tab}:tid:${newRows[i].tid}`;
    if (!(key in newRankMap)) newRankMap[key] = i + 1;
  }
  const rankChanges = [];
  for (const key of Object.keys(oldRankMap)) {
    if (key in newRankMap) {
      const delta = newRankMap[key] - oldRankMap[key];
      if (delta !== 0) {
        rankChanges.push({ key, old: oldRankMap[key], new: newRankMap[key], delta });
      }
    }
  }
  rankChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (rankChanges.length === 0) {
    console.log("  无变化");
  } else {
    for (const c of rankChanges.slice(0, 20)) {
      const sign = c.delta > 0 ? "+" : "";
      const tid = c.key.split(":tid:")[1];
      const tab = c.key.split(":tid:")[0];
      console.log(`  [${tab}] tid ${tid}: #${c.old} → #${c.new} (${sign}${c.delta})`);
    }
  }

  // 4-6. distribution changes
  const oldContentType = countMap(oldRows.map((r) => r.contentType || "未填写"));
  const newContentType = countMap(newRows.map((r) => r.contentType || "未填写"));
  const oldLocationArea = countMap(oldRows.map((r) => r.locationArea || "未填写"));
  const newLocationArea = countMap(newRows.map((r) => r.locationArea || "未填写"));
  const oldTag = countMap(oldRows.map((r) => r.tag || "未填写"));
  const newTag = countMap(newRows.map((r) => r.tag || "未填写"));

  printSection("contentType 分布变化");
  for (const c of diffCounts(oldContentType, newContentType)) {
    console.log(`  ${c.label}`);
  }

  printSection("locationArea 分布变化");
  for (const c of diffCounts(oldLocationArea, newLocationArea).slice(0, 20)) {
    console.log(`  ${c.label}`);
  }

  printSection("primaryTag 分布变化");
  for (const c of diffCounts(oldTag, newTag).slice(0, 20)) {
    console.log(`  ${c.label}`);
  }

  // 7. risk assessment
  printSection("风险评估");
  const totalChangeRatio = Math.abs(newRows.length - oldRows.length) / Math.max(oldRows.length, 1);
  if (totalChangeRatio > 0.3) {
    console.log(`  ⚠ 帖子总数变化超过 30%（${oldRows.length} → ${newRows.length}），建议人工确认`);
  }
  if (removedTids.length > 5) {
    console.log(`  ⚠ 大量帖子被移除（${removedTids.length} 个），可能影响用户体验`);
  }
  if (rankChanges.length > oldRows.length * 0.5) {
    console.log(`  ⚠ 超过半数帖子排名变化，推荐流可能不稳定`);
  }
  if (totalChangeRatio <= 0.3 && removedTids.length <= 5 && rankChanges.length <= oldRows.length * 0.5) {
    console.log("  无重大风险");
  }

  console.log("\n═══ 对比完成 ═══");
}

main().catch((err) => {
  console.error("对比脚本异常:", err.message);
  process.exit(1);
});
