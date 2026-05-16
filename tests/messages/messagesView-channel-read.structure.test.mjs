import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/MessagesView.vue"), "utf8");
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/messages.ts"), "utf8");
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");

test("MessagesView uses ?? for nextOffset fallback so 0 is preserved", () => {
  assert.match(viewSource, /response\.nextOffset \?\? channelOffset\.value/);
  assert.doesNotMatch(viewSource, /response\.nextOffset \|\| channelOffset\.value/);
});

test("MessagesView imports markChannelMessagesRead from the API module", () => {
  assert.match(viewSource, /import \{[^}]*markChannelMessagesRead[^}]*\} from "\.\.\/api\/messages"/);
});

test("MessagesView fires markChannelMessagesRead after a reset channel load", () => {
  assert.match(viewSource, /markChannelMessagesRead\(ids\)\.catch\(\(\) => \{\}\)/);
});

test("markChannelMessagesRead is only called on reset loads, not pagination", () => {
  assert.match(viewSource, /if \(reset && channelItems\.value\.length\)/);
});

test("API module exports buildChannelReadPayload and markChannelMessagesRead", () => {
  assert.match(apiSource, /export function buildChannelReadPayload/);
  assert.match(apiSource, /export async function markChannelMessagesRead/);
});

test("API module posts to /api/channel/read", () => {
  assert.match(apiSource, /\/api\/channel\/read/);
});

test("types module defines ChannelReadPayload with messageIds and readerId", () => {
  assert.match(typesSource, /export interface ChannelReadPayload/);
  assert.match(typesSource, /messageIds: Array<string \| number>/);
  assert.match(typesSource, /readerId: string/);
});
