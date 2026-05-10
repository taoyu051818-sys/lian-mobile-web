import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.argv[2] || "http://127.0.0.1:4301";

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ok ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  fail ${label} - ${reason}`);
}

async function fetchUrl(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return { status: res.status, text: await res.text(), ok: res.ok };
  } catch (error) {
    return { status: 0, text: "", ok: false, error: error.message };
  }
}

async function checkPage(url, label, validators) {
  const result = await fetchUrl(url);
  if (!result.ok) {
    fail(label, `HTTP ${result.status}${result.error ? ` - ${result.error}` : ""}`);
    return;
  }
  for (const [name, validate] of validators) {
    if (!validate(result.text)) {
      fail(`${label} ${name}`, "validation failed");
      return;
    }
  }
  ok(label);
}

function checkFileExists(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (fs.existsSync(fullPath)) ok(`${relativePath} exists`);
  else fail(`${relativePath} exists`, "missing");
}

console.log(`LIAN Vue frontend smoke target: ${baseUrl}`);

await checkPage(`${baseUrl}/`, "GET /", [
  ["has Vue root", (html) => html.includes('id="vue-root"')],
  ["loads src/main.ts or built asset", (html) => html.includes("/src/main.ts") || /\/assets\/[^\"']+\.js/.test(html)]
]);

for (const asset of [
  "public/assets/campus-base-map.png",
  "public/assets/road-network-preview.json"
]) {
  checkFileExists(asset);
}

console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
