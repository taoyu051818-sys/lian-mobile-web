import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const htmlSource = fs.readFileSync(
  path.join(repoRoot, "public/tools/claude-balancer-monitor.html"),
  "utf8",
);
const jsSource = fs.readFileSync(
  path.join(repoRoot, "public/tools/claude-balancer-monitor.js"),
  "utf8",
);
const cssSource = fs.readFileSync(
  path.join(repoRoot, "public/tools/claude-balancer-monitor.css"),
  "utf8",
);

test("balancer monitor page wires standalone assets", () => {
  assert.match(htmlSource, /<link rel="stylesheet" href="\/tools\/claude-balancer-monitor\.css">/);
  assert.match(htmlSource, /<script src="\/tools\/claude-balancer-monitor\.js"><\/script>/);
});

test("balancer monitor page exposes expected controls", () => {
  assert.match(htmlSource, /id="statusUrlInput"/);
  assert.match(htmlSource, /id="intervalSelect"/);
  assert.match(htmlSource, /id="startButton"/);
  assert.match(htmlSource, /id="pauseButton"/);
  assert.match(htmlSource, /id="clearButton"/);
  assert.match(htmlSource, /id="exportButton"/);
  assert.match(htmlSource, /id="pressureChart"/);
  assert.match(htmlSource, /id="remainingChart"/);
  assert.match(htmlSource, /id="parallelismChart"/);
});

test("balancer monitor script polls status and keeps history", () => {
  assert.match(jsSource, /DEFAULT_STATUS_URL = "http:\/\/127\.0\.0\.1:8787\/_status"/);
  assert.match(jsSource, /HISTORY_WINDOW_MS = 30 \* 60 \* 1000/);
  assert.match(jsSource, /fetch\(state\.statusUrl, \{ cache: "no-store" \}\)/);
  assert.match(jsSource, /state\.samples\.push\(sample\)/);
  assert.match(jsSource, /balancingMode/);
  assert.match(jsSource, /pollTtlMs/);
  assert.match(jsSource, /healthyPrimaryKeys/);
  assert.match(jsSource, /pressureSpread/);
  assert.match(jsSource, /snapshotAgeMs/);
  assert.match(jsSource, /eligibility/);
  assert.match(jsSource, /renderMultiLineChart\(els\.pressureChart/);
  assert.match(jsSource, /renderMultiLineChart\(els\.remainingChart/);
  assert.match(jsSource, /renderMultiLineChart\(els\.parallelismChart/);
});

test("balancer monitor styles include responsive layout", () => {
  assert.match(cssSource, /\.layout \{/);
  assert.match(cssSource, /grid-template-columns: 320px minmax\(0, 1fr\) 360px;/);
  assert.match(cssSource, /@media \(max-width: 1400px\)/);
});
