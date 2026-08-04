import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/channel.ts"), "utf8");
const notificationsApiSource = fs.readFileSync(
  path.join(repoRoot, "src/api/notifications.ts"),
  "utf8",
);
const notificationsSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/useNotifications.ts"),
  "utf8",
);
const channelSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/useChannelMessages.ts"),
  "utf8",
);
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");

// --- ChannelReadPayload type ---

test("types/messages.ts defines ChannelReadPayload with eventIds and readerId", () => {
  assert.match(typesSource, /export interface ChannelReadPayload/);
  assert.match(typesSource, /eventIds: Array<string \| number>/);
  assert.match(typesSource, /readerId: string/);
});

// --- buildChannelReadPayload ---

test("api/channel.ts exports buildChannelReadPayload", () => {
  assert.match(
    apiSource,
    /export function buildChannelReadPayload\(messageIds: Array<string \| number>\)/,
  );
});

test("buildChannelReadPayload returns { eventIds, readerId } shape", () => {
  assert.match(apiSource, /return \{ eventIds: messageIds, readerId: ensureClientId\(\) \}/);
});

// --- markChannelMessagesRead ---

test("api/channel.ts exports markChannelMessagesRead", () => {
  assert.match(
    apiSource,
    /export async function markChannelMessagesRead\(messageIds: Array<string \| number>\)/,
  );
});

test("markChannelMessagesRead short-circuits on empty messageIds", () => {
  assert.match(apiSource, /if \(!messageIds\.length\) return/);
});

test("markChannelMessagesRead posts to /api/channel/read with the correct payload", () => {
  assert.match(apiSource, /\/api\/channel\/read/);
  assert.match(apiSource, /body: JSON\.stringify\(payload\)/);
});

// --- nextOffset ?? fix ---

test("useChannelMessages uses ?? for nextOffset fallback so 0 is preserved", () => {
  assert.match(channelSource, /response\.nextOffset \?\? channelOffset\.value/);
  assert.doesNotMatch(channelSource, /response\.nextOffset \|\| channelOffset\.value/);
});

// --- mark-read wiring in useChannelMessages ---

test("useChannelMessages imports markChannelMessagesRead from api/channel", () => {
  assert.match(channelSource, /markChannelMessagesRead/);
  assert.match(
    channelSource,
    /import \{[^}]*markChannelMessagesRead[^}]*\} from "\.\.\/\.\.\/api\/channel"/,
  );
});

test("useChannelMessages calls markChannelMessagesRead only on reset loads", () => {
  assert.match(channelSource, /if \(reset && channelItems\.value\.length\)/);
  assert.match(channelSource, /markChannelMessagesRead\(ids\)\.catch\(\(\) => \{\}\)/);
});

// --- notification read-on-open wiring ---

test("api/notifications.ts posts notification read state to the existing per-id endpoint", () => {
  assert.match(notificationsApiSource, /if \(!notificationIds\.length\) return/);
  assert.match(notificationsApiSource, /`\/api\/notifications\/\$\{normalizedId\}\/read`/);
  assert.match(notificationsApiSource, /apiSend\(notificationReadPath\(notificationId\)/);
  assert.doesNotMatch(notificationsApiSource, /apiSend\("\/api\/messages\/read"/);
});

test("api/notifications.ts treats missing read flags as already read", () => {
  assert.match(notificationsApiSource, /read:\s*raw\.read \?\? true/);
});

test("useNotifications marks unread notifications locally and explicitly rolls back a failed POST", () => {
  const localIdx = notificationsSource.indexOf("markNotificationReadLocally(item.id)");
  const postIdx = notificationsSource.indexOf(
    "markNotificationsRead([item.id]).catch((error) => {",
  );
  const rollbackIdx = notificationsSource.indexOf(
    "locallyReadNotificationIds.delete(String(item.id))",
  );
  assert.match(
    notificationsSource,
    /if \(item\.read \|\| item\.id === undefined \|\| item\.id === null\) return/,
  );
  assert.ok(localIdx >= 0, "opened unread notifications should be marked read locally");
  assert.ok(postIdx >= 0, "opened unread notifications should post read state");
  assert.ok(rollbackIdx >= 0, "failed read mutations should roll back the local read mark");
  assert.ok(localIdx < postIdx, "local read mark should not wait for the backend POST");
  assert.ok(postIdx < rollbackIdx, "rollback should run from the POST failure handler");
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
  assert.equal(undefined ?? fallback, 42);
  assert.equal(null ?? fallback, 42);
  assert.equal(0 ?? fallback, 0);
  assert.equal(false ?? fallback, false);
});
