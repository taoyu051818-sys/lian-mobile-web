import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/channel.ts"), "utf8");
const channelSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/useChannelMessages.ts"),
  "utf8",
);

test("api/channel.ts exports pagination/order normalization helpers", () => {
  assert.match(apiSource, /export function mergeChannelMessagesChronologically/);
  assert.match(apiSource, /export function normalizeChannelResponse/);
});

test("normalizeChannelResponse uses ?? so nextOffset=0 is preserved", () => {
  assert.match(
    apiSource,
    /nextOffset:\s*response\.nextOffset \?\? Math\.max\(0,\s*requestedOffset\)\s*\+\s*rawItems\.length/,
  );
});

test("mergeChannelMessagesChronologically sorts by timestamp and deduplicates by id", () => {
  assert.match(apiSource, /new Map<string, ChannelMessage>/);
  assert.match(
    apiSource,
    /Array\.from\(merged\.values\(\)\)\.sort\(compareChannelMessagesChronologically\)/,
  );
});

test("fetchChannelMessages normalizes the adapter response before returning it", () => {
  assert.match(apiSource, /return normalizeChannelResponse\(response,\s*requestedOffset\)/);
});

test("useChannelMessages imports mergeChannelMessagesChronologically from the channel API module", () => {
  assert.match(channelSource, /\.\.\/\.\.\/api\/channel/);
  assert.match(channelSource, /mergeChannelMessagesChronologically/);
});

test("useChannelMessages no longer reverses response items in the view layer", () => {
  assert.doesNotMatch(channelSource, /slice\(\)\.reverse\(\)/);
});

test("useChannelMessages no longer computes nextOffset from response.items length", () => {
  assert.doesNotMatch(channelSource, /response\.items\?\.length/);
  assert.doesNotMatch(channelSource, /channelOffset\.value \+ /);
});

test("useChannelMessages merges paginated results through the shared chronological helper", () => {
  assert.match(
    channelSource,
    /mergeChannelMessagesChronologically\(channelItems\.value,\s*nextItems\)/,
  );
});

test("pure JS: explicit nextOffset=0 is preserved", () => {
  const requestedOffset = 30;
  const response = { nextOffset: 0, items: [{ id: 1 }] };
  const nextOffset = response.nextOffset ?? Math.max(0, requestedOffset) + response.items.length;
  assert.equal(nextOffset, 0);
});

test("pure JS: empty pages keep the current offset when the API omits nextOffset", () => {
  const requestedOffset = 30;
  const response = { items: [] };
  const nextOffset = response.nextOffset ?? Math.max(0, requestedOffset) + response.items.length;
  assert.equal(nextOffset, 30);
});

test("pure JS: paginated channel messages stay chronological after merge", () => {
  const existing = [
    { id: "b", timestampISO: "2026-05-10T10:00:00Z" },
    { id: "c", timestampISO: "2026-05-10T11:00:00Z" },
  ];
  const incoming = [
    { id: "a", timestampISO: "2026-05-10T09:00:00Z" },
    { id: "b", timestampISO: "2026-05-10T10:00:00Z" },
  ];
  const merged = new Map();
  for (const item of existing) merged.set(String(item.id), item);
  for (const item of incoming) merged.set(String(item.id), item);
  const ids = Array.from(merged.values())
    .sort((left, right) =>
      left.timestampISO < right.timestampISO ? -1 : left.timestampISO > right.timestampISO ? 1 : 0,
    )
    .map((item) => item.id);
  assert.deepEqual(ids, ["a", "b", "c"]);
});
