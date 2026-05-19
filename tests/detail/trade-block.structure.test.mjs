import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- types: TradePostExtension surfaces on PostDetail ---

test("TradePostExtension is exported with the wire shape mirrored from backend #387", () => {
  const src = read("src/types/post-extensions.ts");
  assert.match(
    src,
    /export type TradeState\s*=\s*"available"\s*\|\s*"reserved"\s*\|\s*"sold"\s*\|\s*"cancelled"/,
  );
  assert.match(src, /export interface TradePostExtension\s*{/);
  for (const field of ["price", "state", "category", "verifiedAt"]) {
    assert.match(src, new RegExp(`${field}:\\s*\\w`));
  }
});

test("PostDetail surfaces optional trade block", () => {
  const src = read("src/types/post.ts");
  assert.match(src, /trade\?:\s*TradePostExtension/);
  assert.match(src, /TradePostExtension/);
});

// --- normalizer ---

test("normalizeTradeExtension exists and gates on price + clamps state", () => {
  const src = read("src/platform/api-normalizers.ts");
  assert.match(src, /export function normalizeTradeExtension/);
  assert.match(src, /TRADE_STATES/);
  for (const slug of ["available", "reserved", "sold", "cancelled"]) {
    assert.match(src, new RegExp(`"${slug}"`));
  }
});

test("normalizePostDetail wires trade through to PostDetail", () => {
  const src = read("src/api/posts.ts");
  assert.match(src, /normalizeTradeExtension\(record\.trade\)/);
  assert.match(src, /\.\.\.\(trade \? \{ trade \} : \{\}\)/);
});

// --- detail block ---

test("PostDetailTradeBlock renders state badge, price, risk hint, contact cue", () => {
  const src = read("src/features/detail/PostDetailTradeBlock.vue");
  assert.match(src, /data-testid="post-detail-trade-block"/);
  assert.match(src, /data-testid="post-detail-trade-price"/);
  assert.match(src, /data-testid="post-detail-trade-risk"/);
  assert.match(src, /data-testid="post-detail-trade-contact"/);
  assert.match(src, /:data-state="trade\.state"/);
  for (const slug of [
    "TRADE_STATE_AVAILABLE",
    "TRADE_STATE_RESERVED",
    "TRADE_STATE_SOLD",
    "TRADE_STATE_CANCELLED",
  ]) {
    assert.match(src, new RegExp(slug));
  }
  assert.match(src, /TRADE_RISK_HINT/);
});

// --- mounting ---

test("PostDetailContent mounts the trade block under v-if=trade", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /import PostDetailTradeBlock from "\.\/PostDetailTradeBlock\.vue"/);
  assert.match(src, /<PostDetailTradeBlock\s+v-if="trade"\s+:trade="trade"\s*\/>/);
  assert.match(src, /trade\?:\s*TradePostExtension/);
});

test("PostDetailPanel forwards post.trade into PostDetailContent", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /:trade="post\?\.trade"/);
});
