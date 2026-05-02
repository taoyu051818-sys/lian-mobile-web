#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RULES_PATH = path.join(ROOT, "data", "feed-rules.json");

function printSection(label) {
  console.log(`\n═══ ${label} ═══`);
}

function printMap(map, label) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  printSection(label);
  for (const [key, value] of entries) {
    console.log(`  ${key}: ${value}`);
  }
  if (entries.length === 0) {
    console.log("  (空)");
  }
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(RULES_PATH, "utf8");
  } catch {
    console.error("错误：无法读取 data/feed-rules.json");
    process.exit(1);
  }

  let rules;
  try {
    rules = JSON.parse(raw);
  } catch {
    console.error("错误：data/feed-rules.json 不是合法 JSON");
    process.exit(1);
  }

  // 1. tabs
  printSection("Tabs 配置");
  const tabs = Array.isArray(rules.tabs) ? rules.tabs : [];
  console.log(`  数量: ${tabs.length}`);
  for (const tab of tabs) {
    console.log(`  - ${tab}`);
  }

  // 2. tab 筛选条件
  printSection("Tab 筛选逻辑");
  console.log("  推荐: curated + ranked rest 混合模式");
  console.log("  此刻: moment 独立评分（需 momentTab feature flag）");
  console.log("  其他 tab: 按 tag 精确匹配过滤");

  // 3. feature flags
  printSection("Feature Flags");
  const features = rules.feedFeatures || {};
  const expectedFlags = ["eligibility", "enhancedScoring", "diversity", "momentTab"];
  for (const flag of expectedFlags) {
    const val = features[flag];
    const status = val === true ? "✓ 开启" : val === false ? "✗ 关闭" : "? 未设置";
    console.log(`  ${flag}: ${status}`);
  }
  for (const [key, val] of Object.entries(features)) {
    if (!expectedFlags.includes(key)) {
      console.log(`  ${key}: ${val} (非标准 flag)`);
    }
  }

  // 4-8. scoring weights
  const scoring = rules.scoring || {};

  printMap(scoring.contentTypeWeights || {}, "contentTypeWeights（推荐流）");
  printMap(scoring.momentContentTypeWeights || {}, "momentContentTypeWeights（此刻流）");
  printMap(rules.tagWeights || {}, "tagWeights");
  printMap(scoring.vibeWeights || {}, "vibeWeights");
  printMap(scoring.sceneWeights || {}, "sceneWeights");

  // 9. diversity
  printSection("Diversity 配置");
  const div = rules.diversity || {};
  console.log(`  enabled: ${div.enabled ?? "未设置"}`);
  console.log(`  maxSameContentType: ${div.maxSameContentType ?? "未设置"}`);
  console.log(`  maxSameLocationArea: ${div.maxSameLocationArea ?? "未设置"}`);
  console.log(`  maxSamePrimaryTag: ${div.maxSamePrimaryTag ?? "未设置"}`);

  // 10. feed editions
  printSection("Feed Editions / Curated 配置");
  const editions = rules.feedEditions || {};
  console.log(`  strategy: ${editions.strategy || "未设置"}`);
  console.log(`  pageSize: ${editions.pageSize || "未设置"}`);
  console.log(`  curatedSlotsPerPage: ${editions.curatedSlotsPerPage ?? "未设置"}`);
  console.log(`  rankedRestOnCuratedPages: ${editions.rankedRestOnCuratedPages ?? "未设置"}`);
  console.log(`  generatedAt: ${editions.generatedAt || "未设置"}`);
  const pages = Array.isArray(editions.pages) ? editions.pages : [];
  console.log(`  curated pages 数量: ${pages.length}`);
  for (let i = 0; i < pages.length; i++) {
    const page = Array.isArray(pages[i]) ? pages[i] : (pages[i]?.tids || []);
    console.log(`    page ${i + 1}: [${page.join(", ")}]`);
  }

  // pinned
  const pinned = Array.isArray(rules.pinnedTids) ? rules.pinnedTids : [];
  printSection("Pinned Tids");
  console.log(`  数量: ${pinned.length}`);
  console.log(`  tids: [${pinned.join(", ")}]`);

  // 11. missing or anomalous fields
  printSection("缺失字段或格式异常");
  const warnings = [];

  if (!rules.tabs || !Array.isArray(rules.tabs) || rules.tabs.length === 0) {
    warnings.push("tabs 缺失或为空");
  }
  if (!rules.tagWeights || typeof rules.tagWeights !== "object") {
    warnings.push("tagWeights 缺失");
  }
  if (!rules.scoring || typeof rules.scoring !== "object") {
    warnings.push("scoring 缺失");
  }
  if (!rules.feedFeatures || typeof rules.feedFeatures !== "object") {
    warnings.push("feedFeatures 缺失");
  }
  if (!rules.diversity || typeof rules.diversity !== "object") {
    warnings.push("diversity 缺失");
  }
  if (rules.recencyHalfLifeHours !== undefined && (typeof rules.recencyHalfLifeHours !== "number" || rules.recencyHalfLifeHours <= 0)) {
    warnings.push(`recencyHalfLifeHours 异常: ${rules.recencyHalfLifeHours}`);
  }
  if (rules.coverBonus !== undefined && typeof rules.coverBonus !== "number") {
    warnings.push(`coverBonus 类型异常: ${typeof rules.coverBonus}`);
  }

  // check scoring fields
  if (scoring.readPenalty !== undefined && scoring.readPenalty > 0) {
    warnings.push(`readPenalty 应为负数，当前: ${scoring.readPenalty}`);
  }
  if (scoring.riskPenalty !== undefined && scoring.riskPenalty > 0) {
    warnings.push(`riskPenalty 应为负数，当前: ${scoring.riskPenalty}`);
  }
  if (scoring.riskHideThreshold !== undefined && (scoring.riskHideThreshold < 0 || scoring.riskHideThreshold > 1)) {
    warnings.push(`riskHideThreshold 应在 0-1 之间，当前: ${scoring.riskHideThreshold}`);
  }

  if (warnings.length === 0) {
    console.log("  无异常");
  } else {
    for (const w of warnings) {
      console.log(`  ⚠ ${w}`);
  }
  }

  // 12. maintenance concerns
  printSection("可维护性风险");

  const concerns = [];

  // check for weight keys that don't match any tab
  const tabSet = new Set(tabs);
  const tagWeightKeys = Object.keys(rules.tagWeights || {});
  const unmatchedTags = tagWeightKeys.filter((k) => !tabSet.has(k));
  if (unmatchedTags.length > 0) {
    concerns.push(`tagWeights 中 ${unmatchedTags.length} 个 key 不匹配任何 tab: ${unmatchedTags.join(", ")}`);
  }

  // check for contentTypeWeights keys
  const ctWeightKeys = Object.keys(scoring.contentTypeWeights || {});
  const momentCtKeys = Object.keys(scoring.momentContentTypeWeights || {});
  const onlyInOne = ctWeightKeys.filter((k) => !momentCtKeys.includes(k));
  const onlyInMoment = momentCtKeys.filter((k) => !ctWeightKeys.includes(k));
  if (onlyInOne.length > 0) {
    concerns.push(`contentTypeWeights 有但 momentContentTypeWeights 没有的 key: ${onlyInOne.join(", ")}`);
  }
  if (onlyInMoment.length > 0) {
    concerns.push(`momentContentTypeWeights 有但 contentTypeWeights 没有的 key: ${onlyInMoment.join(", ")}`);
  }

  // curated pages referencing very old tids
  const allCuratedTids = pages.flat().map((p) => Array.isArray(p) ? p : (p?.tids || [])).flat().map(Number);
  if (allCuratedTids.some((tid) => tid < 50)) {
    concerns.push(`curated pages 引用了 tid < 50 的旧帖子，可能已不存在`);
  }

  // generatedAt age
  if (editions.generatedAt) {
    const ageMs = Date.now() - Date.parse(editions.generatedAt);
    const ageDays = Math.floor(ageMs / 86400000);
    if (ageDays > 7) {
      concerns.push(`feedEditions.generatedAt 已过期 ${ageDays} 天，curated 内容可能过时`);
    }
  }

  if (concerns.length === 0) {
    console.log("  无明显风险");
  } else {
    for (const c of concerns) {
      console.log(`  ⚠ ${c}`);
    }
  }

  console.log("\n═══ 审计完成 ═══");
}

main().catch((err) => {
  console.error("审计脚本异常:", err.message);
  process.exit(1);
});
