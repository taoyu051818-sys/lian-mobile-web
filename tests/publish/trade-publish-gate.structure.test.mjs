import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- types: PublishPayload exposes trade + contentType ---

test("PublishPayload carries optional trade block + TradeContentType", () => {
  const src = read("src/types/publish.ts");
  assert.match(src, /TradeContentType/);
  assert.match(src, /TradePublishInput/);
  assert.match(src, /trade\?:\s*TradePublishInput/);
  // Trade contentType is a single literal — no slug taxonomy
  assert.match(src, /export type TradeContentType\s*=\s*"trade"/);
  // presentationIntent now allows "merchant" | "trade"
  assert.match(src, /presentationIntent\?:\s*"merchant"\s*\|\s*"trade"/);
});

// --- buildPublishPayload wires trade ---

test("buildPublishPayload sets trade + contentType on the wire", () => {
  const src = read("src/api/publish.ts");
  assert.match(src, /input\.trade/);
  assert.match(src, /presentationIntent\s*=\s*"trade"/);
  assert.match(src, /contentType:\s*input\.trade\.contentType/);
});

// --- composable + control component ---

test("useTradePublishDraft owns the trade gate + payload", () => {
  const src = read("src/features/publish/useTradePublishDraft.ts");
  assert.match(src, /campus_verified/);
  assert.match(src, /verificationState\?\.campus_verified/);
  assert.match(src, /export function useTradePublishDraft/);
  assert.match(src, /TradeContentType\s*=\s*"trade"/);
  // Default state is "available"; the full TradeState set is enforced by
  // the type imported from post-extensions.
  assert.match(src, /ref<TradeState>\("available"\)/);
});

test("PublishTradeControls renders gate when not verified, form when verified", () => {
  const src = read("src/features/publish/PublishTradeControls.vue");
  assert.match(src, /v-if="!campusVerified"/);
  assert.match(src, /data-testid="publish-trade-gate"/);
  assert.match(src, /data-testid="publish-trade-gate-cta"/);
  assert.match(src, /data-testid="publish-trade-form"/);
  assert.match(src, /data-testid="publish-trade-price"/);
  assert.match(src, /data-testid="publish-trade-state"/);
  assert.match(src, /data-testid="publish-trade-category"/);
  assert.match(src, /data-testid="publish-trade-risk"/);
  assert.match(src, /goVerify/);
  // Full state-option list lives here, not in the composable.
  for (const slug of ["available", "reserved", "sold", "cancelled"]) {
    assert.match(src, new RegExp(`value:\\s*"${slug}"`));
  }
});

// --- PublishView wires the type switch + gate routing ---

test("PublishView exposes a trade type switch", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /data-testid="publish-type-trade"/);
  // Vue templates use single quotes inside attributes; allow either quote style.
  assert.match(src, /draft\.publishKind\.value\s*=\s*['"]trade['"]/);
  assert.match(src, /PUBLISH_TYPE_TRADE/);
});

test("PublishView refreshes verification when switching to trade", () => {
  const src = read("src/features/publish/PublishView.vue");
  // first switch to trade lazily fetches /api/auth/me — avoids a request on cold start
  assert.match(src, /draft\.publishKind/);
  assert.match(src, /trade\.refreshVerification/);
});

// --- usePublishSubmit gates and forwards trade payload ---

test("usePublishSubmit blocks submit when campus_verified is missing", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  assert.match(src, /publishKind/);
  assert.match(src, /PUBLISH_TRADE_GATE_BLOCK/);
  assert.match(src, /PUBLISH_TRADE_PRICE_REQUIRED/);
  assert.match(src, /tradePayload\(\)/);
  assert.match(src, /tradeVerified/);
});

// --- usePublishDraft surfaces trade ---

test("usePublishDraft includes trade kind + composable", () => {
  const src = read("src/features/publish/usePublishDraft.ts");
  assert.match(src, /useTradePublishDraft/);
  assert.match(src, /PublishKind\s*=\s*"regular"\s*\|\s*"merchant"\s*\|\s*"trade"/);
  assert.match(src, /publishKind\.value\s*===\s*"trade"/);
});
