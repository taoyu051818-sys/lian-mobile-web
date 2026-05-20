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

test("TradePostExtension exposes the merged backend state vocabulary including hidden", () => {
  const src = read("src/types/post-extensions.ts");
  assert.match(
    src,
    /export type TradeState\s*=\s*"available"\s*\|\s*"reserved"\s*\|\s*"sold"\s*\|\s*"cancelled"\s*\|\s*"hidden"/,
  );
  assert.match(src, /export interface TradePostExtension\s*{/);
  for (const field of ["price", "state", "category", "verifiedAt"]) {
    assert.match(src, new RegExp(`${field}:\\s*\\w`));
  }
});

test("PostDetail surfaces optional trade block plus tradeManageable gate", () => {
  const src = read("src/types/post.ts");
  assert.match(src, /trade\?:\s*TradePostExtension/);
  assert.match(src, /tradeManageable\?:\s*boolean/);
});

// --- normalizer + client ---

test("trade detail client preserves hidden state and exposes the PATCH transition route", () => {
  const src = read("src/api/posts.ts");
  assert.match(src, /function normalizeTradeExtensionFromDetail/);
  assert.match(
    src,
    /raw === "reserved" \|\| raw === "sold" \|\| raw === "cancelled" \|\| raw === "hidden"/,
  );
  assert.match(src, /tradeManageable/);
  assert.match(src, /export async function patchTradeState/);
  assert.match(src, /\/trade-state/);
  assert.match(src, /method: "PATCH"/);
});

// --- detail block ---

test("PostDetailTradeBlock renders hidden alongside the shipped trade badges", () => {
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
  assert.match(src, /hidden:\s*"已隐藏"/);
  assert.match(src, /data-state="hidden"/);
  assert.match(src, /TRADE_RISK_HINT/);
});

// --- panel manage surface ---

test("PostDetailPanel mounts the trade-manage block as a sibling carve-out", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /import PostDetailTradeManageBlock from "\.\/PostDetailTradeManageBlock\.vue"/);
  assert.match(src, /<PostDetailTradeManageBlock/);
  assert.match(src, /@retry="emit\('retry'\)"/);
  assert.match(src, /@action-message="showActionMessage"/);
  assert.match(src, /@action-error="setActionError"/);
});

test("PostDetailTradeManageBlock owns the author-only trade transition controls", () => {
  const src = read("src/features/detail/PostDetailTradeManageBlock.vue");
  assert.match(src, /import \{ patchTradeState \} from "\.\.\/\.\.\/api\/posts"/);
  assert.match(src, /import \{ fetchAuthMe \} from "\.\.\/\.\.\/api\/profile"/);
  assert.match(src, /const TRADE_TRANSITIONS: Record<TradeState, TradeState\[]>/);
  assert.match(src, /tradeManageable/);
  assert.match(src, /data-testid="post-detail-trade-manage"/);
  assert.match(src, /data-testid="post-detail-trade-manage-action"/);
  assert.match(src, /await patchTradeState\(currentId, nextState\)/);
  assert.match(src, /emit\("retry"\)/);
});
