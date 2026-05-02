import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draftsPath = path.join(rootDir, "data", "ai-post-drafts.jsonl");
const recordsPath = path.join(rootDir, "data", "ai-post-records.jsonl");
const archiveDir = path.join(rootDir, "data", "archive");

const args = process.argv.slice(2);
const command = args[0] || "count";

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function countRecords() {
  const drafts = await readJsonl(draftsPath);
  const records = await readJsonl(recordsPath);

  const draftStats = {};
  for (const d of drafts) {
    draftStats[d.status || "unknown"] = (draftStats[d.status || "unknown"] || 0) + 1;
  }

  const recordStats = {};
  for (const r of records) {
    recordStats[r.status || "unknown"] = (recordStats[r.status || "unknown"] || 0) + 1;
  }

  console.log("\n═══ AI Records Summary ═══\n");
  console.log(`Drafts: ${drafts.length} total`);
  for (const [status, count] of Object.entries(draftStats)) {
    console.log(`  ${status}: ${count}`);
  }
  console.log(`\nRecords: ${records.length} total`);
  for (const [status, count] of Object.entries(recordStats)) {
    console.log(`  ${status}: ${count}`);
  }
}

async function listRecords() {
  const target = args[1] || "records";
  const filePath = target === "drafts" ? draftsPath : recordsPath;
  const items = await readJsonl(filePath);
  const limit = Number(args[2]) || 20;

  console.log(`\n═══ Latest ${Math.min(limit, items.length)} ${target} ═══\n`);
  for (const item of items.slice(-limit)) {
    const ts = item.createdAt || item.publishedAt || item.failedAt || "";
    const status = item.status || "?";
    const title = (item.title || "").slice(0, 40);
    const id = (item.id || "").slice(0, 8);
    console.log(`  [${status}] ${id} ${ts} ${title}`);
  }
}

async function archiveRecords() {
  const target = args[1] || "all";
  const files = [];

  if (target === "drafts" || target === "all") files.push(draftsPath);
  if (target === "records" || target === "all") files.push(recordsPath);

  if (!files.length) {
    console.error("Unknown target. Use: drafts, records, or all");
    process.exit(1);
  }

  await fs.mkdir(archiveDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  for (const filePath of files) {
    if (!(await fileExists(filePath))) {
      console.log(`  skip (not found): ${path.basename(filePath)}`);
      continue;
    }
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      console.log(`  skip (empty): ${path.basename(filePath)}`);
      continue;
    }
    const baseName = path.basename(filePath, ".jsonl");
    const archivePath = path.join(archiveDir, `${baseName}-${timestamp}.jsonl`);
    await fs.writeFile(archivePath, raw, "utf8");
    await fs.writeFile(filePath, "", "utf8");
    console.log(`  archived: ${path.basename(filePath)} → ${path.basename(archivePath)} (${raw.split("\n").filter(Boolean).length} records)`);
  }
}

// Main
console.log("\n═══ AI Record Archive Tool ═══");

switch (command) {
  case "count":
    await countRecords();
    break;
  case "list":
    await listRecords();
    break;
  case "archive":
    await archiveRecords();
    break;
  default:
    console.log(`
Usage:
  node scripts/archive-ai-records.js count           Show record counts by status
  node scripts/archive-ai-records.js list [target] [N] List latest N records (target: drafts|records)
  node scripts/archive-ai-records.js archive [target]  Archive and clear (target: drafts|records|all)
`);
    break;
}
