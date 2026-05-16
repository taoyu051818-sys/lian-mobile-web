import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/messages.ts"), "utf8");
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/MessagesView.vue"), "utf8");

// --- ChannelReadPayload type ---

test("types/messages.ts defines ChannelReadPayload with messageIds and readerId", () => {
  assert.match(typesSource, /export interface ChannelReadPayload/);
  assert.match(typesSource, /messageIds: Array<string \| number>/);
  assert.match(typesSource, /readerId: string/);
});

// --- buildChannelReadPayload ---

test("api/messages.ts exports buildChannelReadPayload", () => {
  assert.match(apiSource, /export function buildChannelReadPayload\(messageIds: Array<string \| number>\)/);
});

test("buildChannelReadPayload returns { messageIds, readerId } shape", () => {
  assert.match(apiSource, /return \{ messageIds, readerId: ensureClientId\(\) \}/);
});

// --- markChannelMessagesRead ---

test("api/messages.ts exports markChannelMessagesRead", () => {
  assert.match(apiSource, /export async function markChannelMessagesRead\(messageIds: Array<string \| number>\)/);
});

test("markChannelMessagesRead short-circuits on empty messageIds", () => {
  assert.match(apiSource, /if \(!messageIds\.length\) return/);
});

test("markChannelMessagesRead posts to /api/channel/read with the correct payload", () => {
  assert.match(apiSource, /\/api\/channel\/read/);
  assert.match(apiSource, /body: JSON\.stringify\(payload\)/);
});

// --- nextOffset ?? fix ---

test("MessagesView uses ?? for nextOffset fallback so 0 is preserved", () => {
  assert.match(viewSource, /response\.nextOffset \?\? channelOffset\.value/);
  assert.doesNotMatch(viewSource, /response\.nextOffset \|\| channelOffset\.value/);
});

// --- mark-read wiring in MessagesView ---

test("MessagesView imports markChannelMessagesRead", () => {
  assert.match(viewSource, /markChannelMessagesRead/);
  assert.match(viewSource, /import \{[^}]*markChannelMessagesRead[^}]*\} from "\.\.\/api\/messages"/);
});

test("MessagesView calls markChannelMessagesRead only on reset loads", () => {
  assert.match(viewSource, /if \(reset && channelItems\.value\.length\)/);
  assert.match(viewSource, /markChannelMessagesRead\(ids\)\.catch\(\(\) => \{\}\)/);
});

// --- nextOffset=0 semantics (pure JS logic) ---

test("nullish coalescing preserves 0 where || would not", () => {
  const response = { nextOffset: 0 };
  const fallback = 30;

  assert.equal(response.nextOffset || fallback, fallback, "|| drops 0");
  assert.equal(response.nextOffset ?? fallback, 0, "?? preserves 0");
});

test("nullish coalescing falls back for undefined and null", () => {
  const fallback = 42;
  assert.equal((undefined ?? fallback), 42);
  assert.equal((null ?? fallback), 42);
  assert.equal((0 ?? fallback), 0);
  assert.equal((false ?? fallback), false);
});
