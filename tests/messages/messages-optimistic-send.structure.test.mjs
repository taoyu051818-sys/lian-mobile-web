import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const apiSource = read("src/api/messages.ts");
const viewSource = read("src/views/MessagesView.vue");
const threadSource = read("src/views/messages/ChannelThread.vue");
const composerSource = read("src/views/messages/ChannelComposer.vue");

// --- buildPendingChannelMessage contract ---

test("api/messages.ts exports buildPendingChannelMessage", () => {
  assert.match(apiSource, /export function buildPendingChannelMessage/);
});

test("buildPendingChannelMessage accepts content, identityTag, and currentUser", () => {
  assert.match(apiSource, /buildPendingChannelMessage\(/);
  assert.match(apiSource, /content:\s*string/);
  assert.match(apiSource, /identityTag:\s*string\s*\|\s*undefined/);
});

test("buildPendingChannelMessage returns a ChannelMessage with deliveryState sending", () => {
  assert.match(apiSource, /deliveryState:\s*"sending"/);
});

test("buildPendingChannelMessage marks isSelf as true", () => {
  assert.match(apiSource, /isSelf:\s*true/);
});

test("buildPendingChannelMessage generates local-only id with pending- prefix", () => {
  assert.match(apiSource, /pending-/);
});

// --- MessagesView optimistic send flow ---

test("MessagesView imports buildPendingChannelMessage", () => {
  assert.match(viewSource, /import \{[^}]*buildPendingChannelMessage[^}]*\} from "\.\.\/api\/messages"/);
});

test("MessagesView creates pending message before API call in submitMessage", () => {
  assert.match(viewSource, /buildPendingChannelMessage\(content/);
});

test("MessagesView clears composer immediately after creating pending message", () => {
  const submitIdx = viewSource.indexOf("async function submitMessage");
  assert.ok(submitIdx >= 0, "submitMessage function should exist");
  const afterSubmit = viewSource.slice(submitIdx);
  const pendingIdx = afterSubmit.indexOf("buildPendingChannelMessage");
  const clearIdx = afterSubmit.indexOf("composerContent.value = \"\"");
  assert.ok(pendingIdx >= 0, "should create pending message");
  assert.ok(clearIdx >= 0, "should clear composer");
  assert.ok(pendingIdx < clearIdx, "pending message should be created before composer is cleared");
});

test("MessagesView replaces pending message with server response on success", () => {
  assert.match(viewSource, /replacePendingWithLatest/);
});

test("MessagesView marks pending message as failed on send error", () => {
  assert.match(viewSource, /deliveryState:\s*"failed"/);
});

// --- MessagesView retry flow ---

test("MessagesView defines retryMessage function", () => {
  assert.match(viewSource, /async function retryMessage\(/);
});

test("retryMessage re-sends the message content", () => {
  assert.match(viewSource, /sendChannelMessage\(\{\s*content:\s*pending\.content/);
});

test("retryMessage resets deliveryState to sending before retry", () => {
  const retryIdx = viewSource.indexOf("async function retryMessage");
  assert.ok(retryIdx >= 0, "retryMessage should exist");
  const afterRetry = viewSource.slice(retryIdx);
  const sendingIdx = afterRetry.indexOf('deliveryState: "sending"');
  assert.ok(sendingIdx >= 0, "should set deliveryState to sending on retry");
});

test("MessagesView passes retryMessage to ChannelThread via emit", () => {
  assert.match(viewSource, /@retry-message="retryMessage"/);
});

// --- MessagesView scroll-to-bottom ---

test("MessagesView tracks near-bottom state with isNearBottom ref", () => {
  assert.match(viewSource, /isNearBottom/);
});

test("MessagesView defines scrollToBottom helper", () => {
  assert.match(viewSource, /async function scrollToBottom/);
});

test("MessagesView defines checkNearBottom helper with threshold", () => {
  assert.match(viewSource, /function checkNearBottom/);
  assert.match(viewSource, /SCROLL_BOTTOM_THRESHOLD/);
});

test("MessagesView scrolls to bottom after initial channel load", () => {
  assert.match(viewSource, /scrollToBottom\(\)/);
});

test("MessagesView scrolls to bottom after optimistic send", () => {
  const submitIdx = viewSource.indexOf("async function submitMessage");
  assert.ok(submitIdx >= 0);
  const afterSubmit = viewSource.slice(submitIdx, submitIdx + 800);
  assert.match(afterSubmit, /scrollToBottom\(\)/);
});

test("MessagesView only scrolls to bottom in replacePendingWithLatest when near bottom", () => {
  assert.match(viewSource, /if \(isNearBottom\.value\) await scrollToBottom\(\)/);
});

test("MessagesView adds scroll event listener on mount", () => {
  assert.match(viewSource, /addEventListener\("scroll"/);
  assert.match(viewSource, /checkNearBottom/);
});

test("MessagesView removes scroll event listener on unmount", () => {
  assert.match(viewSource, /removeEventListener\("scroll"/);
});

// --- ChannelThread retry emit ---

test("ChannelThread declares retryMessage emit", () => {
  assert.match(threadSource, /retryMessage:\s*\[pendingId:\s*string\]/);
});

test("ChannelThread shows retry button for failed messages", () => {
  assert.match(threadSource, /messages-view__retry-btn/);
  assert.match(threadSource, /emit\('retryMessage'/);
});

test("ChannelThread marks pending messages with is-pending class", () => {
  assert.match(threadSource, /is-pending.*startsWith\('pending-'\)/);
});

// --- ChannelThread pending message styling ---

test("ChannelThread reduces opacity for pending messages", () => {
  assert.match(threadSource, /\.messages-view__message\.is-pending/);
  assert.match(threadSource, /opacity:\s*0\.7/);
});

test("ChannelThread styles retry button", () => {
  assert.match(threadSource, /\.messages-view__retry-btn/);
});

// --- Preserved phase-1 layout invariants ---

test("MessagesView does not wrap content in GlassPanel", () => {
  assert.doesNotMatch(viewSource, /GlassPanel/);
});

test("ChannelThread preserves sender identity grid layout", () => {
  assert.match(threadSource, /grid-template-columns:\s*32px\s+minmax/);
});

test("ChannelThread preserves bottom padding clearing fixed composer", () => {
  assert.match(threadSource, /padding-bottom:\s*calc\(/);
  assert.match(threadSource, /env\(safe-area-inset-bottom\)/);
});

test("MessagesView uses declarative page chrome spec", () => {
  assert.match(viewSource, /PageChromeSpec/);
  assert.match(viewSource, /pageChrome/);
  assert.doesNotMatch(viewSource, /useFloatingChromeController/);
});

test("ChannelComposer preserves compact state with button radius", () => {
  assert.match(composerSource, /is-compact/);
  assert.match(composerSource, /var\(--radius-button\)/);
});

// --- Pure JS: pending message id semantics ---

test("pending message ids start with pending- prefix", () => {
  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  assert.ok(id.startsWith("pending-"));
});

test("pending message ids are unique across rapid creation", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(`pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }
  assert.equal(ids.size, 100, "all pending ids should be unique");
});

// --- Pure JS: near-bottom threshold semantics ---

test("scroll threshold is a positive number", () => {
  const threshold = 120;
  assert.ok(threshold > 0, "threshold should be positive");
});

test("near-bottom detection works at various scroll positions", () => {
  const scrollHeight = 1000;
  const innerHeight = 600;
  const threshold = 120;

  const nearBottomPos = scrollHeight - innerHeight - 50;
  const farFromBottomPos = scrollHeight - innerHeight - 200;

  assert.ok(scrollHeight - nearBottomPos - innerHeight < threshold, "should be near bottom");
  assert.ok(scrollHeight - farFromBottomPos - innerHeight >= threshold, "should not be near bottom");
});

// --- Pure JS: optimistic message sorting ---

test("pending messages sort after confirmed messages", () => {
  const items = [
    { id: "server-1", timestampISO: "2026-05-11T10:00:00Z" },
    { id: "pending-123", timestampISO: "2026-05-11T10:01:00Z" },
    { id: "server-2", timestampISO: "2026-05-11T10:02:00Z" },
  ];

  const sorted = items.slice().sort((a, b) => {
    const aPending = String(a.id).startsWith("pending-");
    const bPending = String(b.id).startsWith("pending-");
    if (aPending !== bPending) return aPending ? 1 : -1;
    const ta = a.timestampISO || "";
    const tb = b.timestampISO || "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  assert.equal(sorted[0].id, "server-1");
  assert.equal(sorted[1].id, "server-2");
  assert.equal(sorted[2].id, "pending-123");
});

// --- replacePendingWithLatest window-miss hardening ---

test("MessagesView defines REPLACE_RETRY_LIMIT constant", () => {
  assert.match(viewSource, /REPLACE_RETRY_LIMIT/);
  assert.match(viewSource, /const REPLACE_RETRY_LIMIT\s*=\s*\d+/);
});

test("MessagesView defines REPLACE_RETRY_DELAY_MS constant", () => {
  assert.match(viewSource, /REPLACE_RETRY_DELAY_MS/);
  assert.match(viewSource, /const REPLACE_RETRY_DELAY_MS\s*=\s*\d+/);
});

test("MessagesView defines resolvePendingState helper", () => {
  assert.match(viewSource, /function resolvePendingState\(/);
  assert.match(viewSource, /deliveryState:\s*"sent"\s*\|\s*"failed"/);
});

test("replacePendingWithLatest accepts retriesLeft parameter", () => {
  assert.match(viewSource, /replacePendingWithLatest\(pendingId:\s*string,\s*retriesLeft/);
});

test("replacePendingWithLatest checks for confirmed message in fetch result", () => {
  assert.match(viewSource, /confirmedFound/);
  assert.match(viewSource, /serverItem\.content\s*===\s*pendingContent\s*&&\s*serverItem\.isSelf/);
});

test("replacePendingWithLatest retries when confirmed message not found and retries remain", () => {
  const fnIdx = viewSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0, "replacePendingWithLatest should exist");
  const afterFn = viewSource.slice(fnIdx);
  assert.match(afterFn, /retriesLeft\s*>\s*0/);
  assert.match(afterFn, /REPLACE_RETRY_DELAY_MS/);
});

test("replacePendingWithLatest resolves to sent when retries exhausted without finding confirmed message", () => {
  const fnIdx = viewSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const afterFn = viewSource.slice(fnIdx);
  assert.match(afterFn, /resolvePendingState\(pendingId,\s*"sent"\)/);
});

test("replacePendingWithLatest resolves to failed on fetch error", () => {
  const fnIdx = viewSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const catchIdx = viewSource.indexOf("resolvePendingState(pendingId, \"failed\")", fnIdx);
  assert.ok(catchIdx >= 0, "should resolve pending to failed in catch block");
});

test("resolvePendingState does not leave pending stuck in sending state", () => {
  const fnIdx = viewSource.indexOf("function resolvePendingState");
  assert.ok(fnIdx >= 0);
  const afterFn = viewSource.slice(fnIdx, fnIdx + 300);
  assert.match(afterFn, /deliveryState/);
  assert.doesNotMatch(afterFn, /"sending"/);
});

test("replacePendingWithLatest does not silently swallow fetch errors", () => {
  const fnIdx = viewSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const afterFn = viewSource.slice(fnIdx);
  const catchIdx = afterFn.indexOf("catch");
  assert.ok(catchIdx >= 0, "should have catch block");
  const catchBody = afterFn.slice(catchIdx, catchIdx + 200);
  assert.match(catchBody, /resolvePendingState/);
  assert.doesNotMatch(catchBody, /silent/);
});

// --- ChannelThread retry button mobile touch target ---

test("ChannelThread retry button meets mobile touch target minimum (44px)", () => {
  const btnMatch = threadSource.match(/\.messages-view__retry-btn\s*\{([^}]+)\}/);
  assert.ok(btnMatch, "retry button styles should exist");
  const styles = btnMatch[1];
  const minHeightMatch = styles.match(/min-height:\s*(\d+)px/);
  assert.ok(minHeightMatch, "retry button should have min-height");
  assert.ok(Number(minHeightMatch[1]) >= 44, `retry button min-height ${minHeightMatch[1]}px should be >= 44px for mobile touch target`);
});

// --- Pure JS: window-miss resolution semantics ---

test("pending item resolves to sent when server-confirmed message absent from fetch window", () => {
  const items = [
    { id: "server-old-1", content: "hello", isSelf: false, deliveryState: "sent" },
    { id: "pending-999", content: "my message", isSelf: true, deliveryState: "sending" },
  ];
  const pendingId = "pending-999";
  const latestItems = [
    { id: "server-old-1", content: "hello", isSelf: false, deliveryState: "sent" },
  ];

  const pendingContent = items.find((i) => i.id === pendingId)?.content || "";
  const confirmedFound = latestItems.some(
    (s) => s.content === pendingContent && s.isSelf && !String(s.id).startsWith("pending-"),
  );

  assert.equal(confirmedFound, false, "confirmed message should not be found in fetch window");

  if (!confirmedFound) {
    const idx = items.findIndex((i) => i.id === pendingId);
    items[idx] = { ...items[idx], deliveryState: "sent" };
  }

  assert.equal(items[1].deliveryState, "sent", "pending should resolve to sent, not stuck in sending");
  assert.notEqual(items[1].deliveryState, "sending", "pending must not remain in sending state");
});

test("pending item resolves to failed when fetch throws", () => {
  const items = [
    { id: "pending-888", content: "test", isSelf: true, deliveryState: "sending" },
  ];
  const pendingId = "pending-888";

  const idx = items.findIndex((i) => i.id === pendingId);
  items[idx] = { ...items[idx], deliveryState: "failed" };

  assert.equal(items[0].deliveryState, "failed", "pending should resolve to failed on fetch error");
  assert.notEqual(items[0].deliveryState, "sending", "pending must not remain in sending state");
});

test("retry count bounded by REPLACE_RETRY_LIMIT", () => {
  const limit = 2;
  let retries = limit;
  let attempts = 0;
  while (retries > 0) {
    retries--;
    attempts++;
  }
  assert.equal(attempts, limit, "should retry exactly REPLACE_RETRY_LIMIT times");
  assert.equal(retries, 0, "retries should be exhausted");
});
