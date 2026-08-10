import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const channelSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/useChannelMessages.ts"),
  "utf8",
);
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/channel.ts"), "utf8");
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");

test("useChannelMessages uses ?? for nextOffset fallback so 0 is preserved", () => {
  assert.match(channelSource, /response\.nextOffset \?\? channelOffset\.value/);
  assert.doesNotMatch(channelSource, /response\.nextOffset \|\| channelOffset\.value/);
});

test("useChannelMessages imports markChannelMessagesRead from the API module", () => {
  assert.match(
    channelSource,
    /import \{[^}]*markChannelMessagesRead[^}]*\} from "\.\.\/\.\.\/api\/channel"/,
  );
});

test("useChannelMessages fires markChannelMessagesRead after a reset channel load", () => {
  assert.match(channelSource, /markChannelMessagesRead\(ids\)\.catch\(\(\) => \{\}\)/);
});

test("markChannelMessagesRead is only called on reset loads, not pagination", () => {
  assert.match(channelSource, /if \(reset && channelItems\.value\.length\)/);
});

test("API module exports buildChannelReadPayload and markChannelMessagesRead", () => {
  assert.match(apiSource, /export function buildChannelReadPayload/);
  assert.match(apiSource, /export async function markChannelMessagesRead/);
  assert.match(apiSource, /return \{ eventIds:\s*messageIds,\s*readerId:\s*ensureClientId\(\) \}/);
});

test("API module posts to /api/channel/read", () => {
  assert.match(apiSource, /\/api\/channel\/read/);
});

test("types module defines ChannelReadPayload with backend eventIds and readerId", () => {
  assert.match(typesSource, /export interface ChannelReadPayload/);
  assert.match(typesSource, /eventIds:\s*Array<string \| number>/);
  assert.match(typesSource, /readerId: string/);
});
