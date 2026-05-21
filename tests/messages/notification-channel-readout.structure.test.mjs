import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const listSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/NotificationList.vue"),
  "utf8",
);
const channelsSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/notificationChannels.ts"),
  "utf8",
);
const brandSource = fs.readFileSync(
  path.join(repoRoot, "src/config/brand/notification.ts"),
  "utf8",
);

test("NotificationList imports the channel inventory and brand strings", () => {
  assert.match(listSource, /from "\.\/notificationChannels"/);
  assert.match(listSource, /NOTIFICATION_CHANNELS_LABEL/);
  assert.match(listSource, /NOTIFICATION_CHANNELS_HINT/);
  assert.match(listSource, /NOTIFICATION_CHANNEL_STATUS_CONNECTED/);
  assert.match(listSource, /NOTIFICATION_CHANNEL_STATUS_PENDING/);
  assert.match(listSource, /NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL/);
});

test("NotificationList renders the readout above the items list and outside the loading/empty branches", () => {
  const readoutIdx = listSource.indexOf('data-testid="notification-channel-readout"');
  const loadingIdx = listSource.indexOf('v-if="props.loading && !props.items.length"');
  const emptyIdx = listSource.indexOf('data-testid="notification-empty-state"');
  const listIdx = listSource.indexOf('class="messages-view__list"');
  assert.ok(readoutIdx > 0, "readout testid should be present");
  assert.ok(readoutIdx < loadingIdx, "readout must come before loading branch");
  assert.ok(readoutIdx < emptyIdx, "readout must come before empty branch");
  assert.ok(readoutIdx < listIdx, "readout must come before items list");
});

test("NotificationList renders one row per channel with stable testids and data hooks", () => {
  assert.match(listSource, /data-testid="notification-channel-row"/);
  assert.match(listSource, /:data-channel-id="channel\.id"/);
  assert.match(listSource, /:data-channel-status="channel\.status"/);
});

test("NotificationList tags pending channels with TrustBadge tone='pending' and connected with 'confirmed'", () => {
  assert.match(listSource, /channel\.status === 'connected' \? 'confirmed' : 'pending'/);
});

test("NotificationList renders an issue link only when the channel has issueUrl", () => {
  assert.match(listSource, /v-if="channel\.issueUrl"/);
  assert.match(listSource, /data-testid="notification-channel-issue-link"/);
  assert.match(listSource, /target="_blank"/);
  assert.match(listSource, /rel="noopener noreferrer"/);
});

test("notificationChannels module exports the five channels we audit", () => {
  for (const id of [
    '"reply"',
    '"verification"',
    '"errand-status"',
    '"event-completion"',
    '"admin-review"',
  ]) {
    assert.match(channelsSource, new RegExp(`id:\\s*${id}`));
  }
});

test("notificationChannels marks reply as connected and the four backlog channels as pending", () => {
  const replyBlock = channelsSource.match(/id:\s*"reply"[\s\S]+?status:\s*"(connected|pending)"/);
  assert.ok(replyBlock, "reply block should exist");
  assert.equal(replyBlock?.[1], "connected", "reply must be connected");

  for (const id of ["verification", "errand-status", "event-completion", "admin-review"]) {
    const block = channelsSource.match(
      new RegExp(`id:\\s*"${id}"[\\s\\S]+?status:\\s*"(connected|pending)"`),
    );
    assert.ok(block, `${id} block should exist`);
    assert.equal(block?.[1], "pending", `${id} must be pending until backend ships`);
  }
});

test("notificationChannels links the tracked backend issues so the readout stays honest", () => {
  for (const issue of [
    "github.com/taoyu051818-sys/lian-mobile-web/issues/700",
    "github.com/taoyu051818-sys/lian-mobile-web/issues/701",
    "github.com/taoyu051818-sys/lian-mobile-web/issues/706",
  ]) {
    assert.ok(channelsSource.includes(issue), `expected channel inventory to link ${issue}`);
  }
});

test("brand strings for the readout exist and are non-empty", () => {
  for (const key of [
    "NOTIFICATION_CHANNELS_LABEL",
    "NOTIFICATION_CHANNELS_HINT",
    "NOTIFICATION_CHANNEL_STATUS_CONNECTED",
    "NOTIFICATION_CHANNEL_STATUS_PENDING",
    "NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL",
    "NOTIFICATION_CHANNEL_REPLY_TITLE",
    "NOTIFICATION_CHANNEL_VERIFICATION_TITLE",
    "NOTIFICATION_CHANNEL_ERRAND_TITLE",
    "NOTIFICATION_CHANNEL_EVENT_TITLE",
    "NOTIFICATION_CHANNEL_ADMIN_REVIEW_TITLE",
  ]) {
    assert.match(brandSource, new RegExp(`export const ${key}\\s*=\\s*"[^"\\s][^"]*"`));
  }
});
