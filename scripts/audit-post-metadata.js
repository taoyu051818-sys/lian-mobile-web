#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const METADATA_PATH = path.join(ROOT, "data", "post-metadata.json");

function countMap(arr) {
  const map = {};
  for (const item of arr) {
    const key = String(item || "").trim() || "(空)";
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function printMap(map, label, limit = 0) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const show = limit > 0 ? entries.slice(0, limit) : entries;
  console.log(`\n${label}（共 ${entries.length} 种）：`);
  for (const [key, count] of show) {
    console.log(`  ${key}: ${count}`);
  }
  if (limit > 0 && entries.length > limit) {
    console.log(`  ... 省略 ${entries.length - limit} 项`);
  }
}

function printList(items, label, limit = 20) {
  console.log(`\n${label}（${items.length} 条${items.length > limit ? `，显示前 ${limit}` : ""}）：`);
  for (const item of items.slice(0, limit)) {
    console.log(`  - ${item}`);
  }
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(METADATA_PATH, "utf8");
  } catch {
    console.error("错误：无法读取 data/post-metadata.json");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("错误：data/post-metadata.json 不是合法 JSON");
    process.exit(1);
  }

  const items = data.items && typeof data.items === "object" && !Array.isArray(data.items)
    ? data.items
    : (typeof data === "object" && !Array.isArray(data) ? data : null);

  if (!items) {
    console.error("错误：post-metadata.json 结构不符合预期（需要 {items: {...}} 或顶层对象）");
    process.exit(1);
  }

  const tids = Object.keys(items);
  const totalCount = tids.length;

  const contentTypes = [];
  const locationAreas = [];
  const primaryTags = [];
  const allTags = [];
  const imageCounts = [];
  let withImages = 0;
  let withoutImages = 0;
  let missingContentType = 0;
  let missingLocationArea = 0;
  let missingTags = 0;
  let missingTitle = 0;
  const anomalies = [];
  const titleMap = {};

  for (const tid of tids) {
    const entry = items[tid];
    if (!entry || typeof entry !== "object") {
      anomalies.push(`tid ${tid}: entry 不是对象`);
      continue;
    }

    // contentType
    const ct = String(entry.contentType || "").trim();
    if (ct) contentTypes.push(ct);
    else missingContentType++;

    // locationArea
    const la = String(entry.locationArea || "").trim();
    if (la) locationAreas.push(la);
    else missingLocationArea++;

    // tags
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    if (tags.length === 0) missingTags++;
    for (const tag of tags) {
      const t = String(tag || "").trim();
      if (t) allTags.push(t);
    }
    const primary = String(entry.primaryTag || entry.tag || (tags[0] || "")).trim();
    if (primary) primaryTags.push(primary);

    // imageUrls
    const urls = Array.isArray(entry.imageUrls) ? entry.imageUrls : [];
    imageCounts.push(urls.length);
    if (urls.length > 0) withImages++;
    else withoutImages++;

    // title / summary
    const title = String(entry.title || "").trim();
    const summary = String(entry.summary || "").trim();
    if (!title && !summary) missingTitle++;

    // duplicate title detection
    if (title) {
      if (!titleMap[title]) titleMap[title] = [];
      titleMap[title].push(tid);
    }

    // anomalies
    if (entry.qualityScore !== undefined && (typeof entry.qualityScore !== "number" || entry.qualityScore < 0 || entry.qualityScore > 1)) {
      anomalies.push(`tid ${tid}: qualityScore 异常 (${entry.qualityScore})`);
    }
    if (entry.riskScore !== undefined && (typeof entry.riskScore !== "number" || entry.riskScore < 0 || entry.riskScore > 1)) {
      anomalies.push(`tid ${tid}: riskScore 异常 (${entry.riskScore})`);
    }
    if (entry.visibility && !["public", "campus", "school", "linkOnly", "private"].includes(entry.visibility)) {
      anomalies.push(`tid ${tid}: visibility 异常 (${entry.visibility})`);
    }
    if (Array.isArray(entry.distribution) && entry.distribution.length === 0) {
      anomalies.push(`tid ${tid}: distribution 为空数组`);
    }
  }

  // image count distribution
  const imageDist = {};
  for (const n of imageCounts) {
    imageDist[n] = (imageDist[n] || 0) + 1;
  }

  // duplicate titles
  const duplicateTitles = Object.entries(titleMap)
    .filter(([, tids]) => tids.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  // output
  console.log("═══ 帖子资产审计报告 ═══");
  console.log(`\ntid 总数: ${totalCount}`);
  console.log(`有 imageUrls: ${withImages}`);
  console.log(`无 imageUrls: ${withoutImages}`);
  console.log(`缺少 contentType: ${missingContentType}`);
  console.log(`缺少 locationArea: ${missingLocationArea}`);
  console.log(`缺少 tags: ${missingTags}`);
  console.log(`缺少 title 和 summary: ${missingTitle}`);

  printMap(countMap(contentTypes), "contentType 分布");
  printMap(countMap(locationAreas), "locationArea 分布", 30);
  printMap(countMap(primaryTags), "primaryTag 分布", 30);
  printMap(countMap(allTags), "tags Top 30", 30);
  printMap(imageDist, "imageUrls 数量分布");

  printList(anomalies, "异常字段示例");
  printList(
    duplicateTitles.map(([title, tids]) => `"${title}" → tids: ${tids.join(", ")}`),
    "可疑重复标题"
  );

  console.log("\n═══ 审计完成 ═══");
}

main().catch((err) => {
  console.error("审计脚本异常:", err.message);
  process.exit(1);
});
