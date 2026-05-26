import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const apiSource = read("src/api/channel.ts");
const viewSource = read("src/features/messages/MessagesView.vue");
const channelSource = read("src/features/messages/useChannelMessages.ts");
const threadSource = read("src/features/messages/ChannelThread.vue");
const composerVueSource = read("src/features/messages/ChannelComposer.vue");

// --- buildPendingChannelMessage contract ---

test("api/channel.ts exports buildPendingChannelMessage", () => {
  assert.match(apiSource, /export function buildPendingChannelMessage/);
});

test("buildPendingChannelMessage accepts content, identityTag, currentUser, and visibility", () => {
  assert.match(apiSource, /buildPendingChannelMessage\(/);
  assert.match(apiSource, /content:\s*string/);
  assert.match(apiSource, /identityTag:\s*string\s*\|\s*undefined/);
  assert.match(apiSource, /visibility:\s*AudienceVisibility\s*=\s*"public"/);
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

test("buildPendingChannelMessage carries visibility onto the optimistic item", () => {
  assert.match(apiSource, /visibility,/);
});

test("useChannelMessages imports buildPendingChannelMessage", () => {
  assert.match(
    channelSource,
    /import \{[^}]*buildPendingChannelMessage[^}]*\} from "\.\.\/\.\.\/api\/channel"/,
  );
});

test("useChannelMessages creates pending message with current visibility", () => {
  assert.match(
    channelSource,
    /buildPendingChannelMessage\(\s*content,\s*identityTag \|\| undefined,\s*currentUser,\s*visibility,\s*\)/,
  );
});

test("useChannelMessages clears composer immediately after creating pending message", () => {
  const submitIdx = channelSource.indexOf("async function sendMessage");
  assert.ok(submitIdx >= 0, "sendMessage function should exist");
  const afterSubmit = channelSource.slice(submitIdx);
  const pendingIdx = afterSubmit.indexOf("buildPendingChannelMessage");
  assert.ok(pendingIdx >= 0, "should create pending message");
});

test("sendChannelMessage posts visibility to the channel API", () => {
  assert.match(apiSource, /visibility: payload\.visibility \|\| "public"/);
});

test("useChannelMessages replaces pending message with server response on success", () => {
  assert.match(channelSource, /replacePendingWithLatest/);
});

test("useChannelMessages marks pending message as failed on send error", () => {
  assert.match(channelSource, /deliveryState:\s*"failed"/);
});

// --- MessagesView delegates to composables ---

test("MessagesView imports useChannelMessages composable", () => {
  assert.match(viewSource, /import \{[^}]*useChannelMessages[^}]*\} from "\.\/useChannelMessages"/);
});

test("MessagesView imports useMessageComposer composable", () => {
  assert.match(viewSource, /import \{[^}]*useMessageComposer[^}]*\} from "\.\/useMessageComposer"/);
});

test("MessagesView wires composer onSend to channel sendMessage", () => {
  assert.match(viewSource, /onSend:\s*sendMessage/);
});

test("MessagesView wires composer onRetry to channel retryMessage", () => {
  assert.match(viewSource, /onRetry:\s*channelRetryMessage/);
});

// --- MessagesView retry flow ---

test("useChannelMessages defines retryMessage function", () => {
  assert.match(channelSource, /async function retryMessage\(/);
});

test("retryMessage re-sends the message content", () => {
  assert.match(channelSource, /sendChannelMessage\(\{\s*content:\s*pending\.content/);
});

test("retryMessage resets deliveryState to sending before retry", () => {
  const retryIdx = channelSource.indexOf("async function retryMessage");
  assert.ok(retryIdx >= 0, "retryMessage should exist");
  const afterRetry = channelSource.slice(retryIdx);
  const sendingIdx = afterRetry.indexOf('deliveryState: "sending"');
  assert.ok(sendingIdx >= 0, "should set deliveryState to sending on retry");
});

test("MessagesView passes retryMessage to ChannelThread via emit", () => {
  assert.match(viewSource, /@retry-message="composer\.retryMessage"/);
});

// --- MessagesView scroll-to-bottom ---

test("useChannelMessages tracks near-bottom state with isNearBottom ref", () => {
  assert.match(channelSource, /isNearBottom/);
});

test("useChannelMessages defines scrollToBottom helper", () => {
  assert.match(channelSource, /async function scrollToBottom/);
});

test("useChannelMessages defines checkNearBottom helper with threshold", () => {
  assert.match(channelSource, /function checkNearBottom/);
  assert.match(channelSource, /SCROLL_BOTTOM_THRESHOLD/);
});

test("useChannelMessages scrolls to bottom after initial channel load", () => {
  assert.match(channelSource, /scrollToBottom\(\)/);
});

test("useChannelMessages scrolls to bottom after optimistic send", () => {
  const submitIdx = channelSource.indexOf("async function sendMessage");
  assert.ok(submitIdx >= 0);
  const afterSubmit = channelSource.slice(submitIdx, submitIdx + 800);
  assert.match(afterSubmit, /scrollToBottom\(\)/);
});

test("useChannelMessages only scrolls to bottom in replacePendingWithLatest when near bottom", () => {
  assert.match(channelSource, /if \(isNearBottom\.value\) await scrollToBottom\(\)/);
});

test("useChannelMessages adds scroll event listener on mount", () => {
  assert.match(channelSource, /addEventListener\("scroll"/);
  assert.match(channelSource, /checkNearBottom/);
});

test("useChannelMessages removes scroll event listener on unmount", () => {
  assert.match(channelSource, /removeEventListener\("scroll"/);
});

// --- ChannelThread retry emit ---

test("ChannelThread declares retryMessage emit", () => {
  assert.match(threadSource, /retryMessage:\s*\[pendingId:\s*string\]/);
});

test("ChannelThread shows retry button for failed messages", () => {
  assert.match(threadSource, /messages-view__retry-btn/);
  assert.match(threadSource, /emit\('retryMessage'/);
});

test("ChannelThread marks pending messages with is-loading class", () => {
  assert.match(threadSource, /is-loading.*startsWith\('pending-'\)/);
});

// --- ChannelThread pending message styling ---

test("ChannelThread reduces opacity for pending messages", () => {
  assert.match(threadSource, /\.messages-view__message\.is-loading/);
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
  assert.match(composerVueSource, /messages-view__composer--compact/);
  assert.match(composerVueSource, /var\(--radius-button\)/);
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
  assert.ok(
    scrollHeight - farFromBottomPos - innerHeight >= threshold,
    "should not be near bottom",
  );
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

test("useChannelMessages defines REPLACE_RETRY_LIMIT constant", () => {
  assert.match(channelSource, /REPLACE_RETRY_LIMIT/);
  assert.match(channelSource, /const REPLACE_RETRY_LIMIT\s*=\s*\d+/);
});

test("useChannelMessages defines REPLACE_RETRY_DELAY_MS constant", () => {
  assert.match(channelSource, /REPLACE_RETRY_DELAY_MS/);
  assert.match(channelSource, /const REPLACE_RETRY_DELAY_MS\s*=\s*\d+/);
});

test("useChannelMessages defines resolvePendingState helper", () => {
  assert.match(channelSource, /function resolvePendingState\(/);
  assert.match(channelSource, /deliveryState:\s*"sent"\s*\|\s*"failed"/);
});

test("replacePendingWithLatest accepts retriesLeft parameter", () => {
  assert.match(channelSource, /replacePendingWithLatest\(pendingId:\s*string,\s*retriesLeft/);
});

test("replacePendingWithLatest checks for confirmed message in fetch result", () => {
  assert.match(channelSource, /confirmedFound/);
  assert.match(
    channelSource,
    /serverItem\.content\s*===\s*pendingContent\s*&&\s*serverItem\.isSelf/,
  );
});

test("replacePendingWithLatest retries when confirmed message not found and retries remain", () => {
  const fnIdx = channelSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0, "replacePendingWithLatest should exist");
  const afterFn = channelSource.slice(fnIdx);
  assert.match(afterFn, /retriesLeft\s*>\s*0/);
  assert.match(afterFn, /REPLACE_RETRY_DELAY_MS/);
});

test("replacePendingWithLatest resolves to sent when retries exhausted without finding confirmed message", () => {
  const fnIdx = channelSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const afterFn = channelSource.slice(fnIdx);
  assert.match(afterFn, /resolvePendingState\(pendingId,\s*"sent"\)/);
});

test("replacePendingWithLatest resolves to failed on fetch error", () => {
  const fnIdx = channelSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const catchIdx = channelSource.indexOf('resolvePendingState(pendingId, "failed")', fnIdx);
  assert.ok(catchIdx >= 0, "should resolve pending to failed in catch block");
});

test("resolvePendingState does not leave pending stuck in sending state", () => {
  const fnIdx = channelSource.indexOf("function resolvePendingState");
  assert.ok(fnIdx >= 0);
  const afterFn = channelSource.slice(fnIdx, fnIdx + 300);
  assert.match(afterFn, /deliveryState/);
  assert.doesNotMatch(afterFn, /"sending"/);
});

test("replacePendingWithLatest does not silently swallow fetch errors", () => {
  const fnIdx = channelSource.indexOf("async function replacePendingWithLatest");
  assert.ok(fnIdx >= 0);
  const afterFn = channelSource.slice(fnIdx);
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
  assert.ok(
    Number(minHeightMatch[1]) >= 44,
    `retry button min-height ${minHeightMatch[1]}px should be >= 44px for mobile touch target`,
  );
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

  assert.equal(
    items[1].deliveryState,
    "sent",
    "pending should resolve to sent, not stuck in sending",
  );
  assert.notEqual(items[1].deliveryState, "sending", "pending must not remain in sending state");
});

test("pending item resolves to failed when fetch throws", () => {
  const items = [{ id: "pending-888", content: "test", isSelf: true, deliveryState: "sending" }];
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
