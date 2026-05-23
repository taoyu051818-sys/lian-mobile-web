import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");
const viewSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/MessagesView.vue"),
  "utf8",
);
const listSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/NotificationList.vue"),
  "utf8",
);
const inboxSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/messageInbox.ts"),
  "utf8",
);
const notificationBrand = fs.readFileSync(
  path.join(repoRoot, "src/config/brand/notification.ts"),
  "utf8",
);

test("MessageTabKey includes replies, system, and orders alongside channel", () => {
  assert.match(
    typesSource,
    /export type MessageTabKey = "channel" \| "replies" \| "system" \| "orders"/,
  );
});

test("NotificationTarget includes the errand-order deep-link shape", () => {
  assert.match(typesSource, /\{ kind: "errand-order"; orderId: string \}/);
});

test("MessagesView imports the inbox helper, errand-order route, and new notification tab labels", () => {
  assert.match(viewSource, /from "\.\/messageInbox"/);
  assert.match(viewSource, /useErrandOrderRoute/);
  assert.match(viewSource, /MESSAGE_TAB_REPLIES/);
  assert.match(viewSource, /MESSAGE_TAB_SYSTEM/);
  assert.match(viewSource, /MESSAGE_TAB_ORDERS/);
});

test("MessagesView filters notifications by inbox tab instead of one shared notifications tab", () => {
  assert.match(viewSource, /itemsForInboxTab/);
  assert.match(viewSource, /activeNotificationSpec/);
  assert.match(viewSource, /visibleNotificationItems/);
  assert.doesNotMatch(viewSource, /MESSAGE_TAB_NOTIFICATION/);
});

test("MessagesView passes title, hint, empty copy, and fetch state into NotificationList", () => {
  assert.match(viewSource, /:title="activeNotificationSpec\?\.title"/);
  assert.match(viewSource, /:hint="activeNotificationSpec\?\.hint"/);
  assert.match(viewSource, /:empty-title="activeNotificationSpec\?\.emptyTitle"/);
  assert.match(viewSource, /:empty-body="activeNotificationSpec\?\.emptyBody"/);
  assert.match(viewSource, /:fetch-state="notificationFetchState"/);
});

test("MessagesView routes errand-order notification targets into the existing errand-order view", () => {
  assert.match(viewSource, /const errandOrderRoute = useErrandOrderRoute\(\)/);
  assert.match(viewSource, /if \(target\.kind === "errand-order"\)/);
  assert.match(viewSource, /errandOrderRoute\.enterForOrder\(target\.orderId, "messages"\)/);
  assert.match(viewSource, /setActiveView\("errand-order"\)/);
});

test("NotificationList renders three discriminated state surfaces with stable testids (#828)", () => {
  // Empty / error / auth-required must each be addressable by a distinct
  // testid so a 5xx can never silently downgrade to "暂无通知".
  assert.match(listSource, /data-testid="messages-empty"/);
  assert.match(listSource, /data-testid="messages-error"/);
  assert.match(listSource, /data-testid="messages-auth-required"/);
});

test("NotificationList no longer renders the engineering channel readout chrome (#828)", () => {
  // The "channel readout" block (status pills + GitHub issue links) was the
  // single biggest signal that the inbox was a debugging surface. #828
  // strips it; this test pins the rule so it can't sneak back in.
  assert.doesNotMatch(listSource, /notification-channel-readout/);
  assert.doesNotMatch(listSource, /NOTIFICATION_CHANNEL_STATUS_PENDING/);
  assert.doesNotMatch(listSource, /NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL/);
  assert.doesNotMatch(listSource, /NOTIFICATION_EMPTY_NEXT_STEP/);
  assert.doesNotMatch(listSource, /notification-gap-link/);
});

test("NotificationList treats errand-order targets as clickable", () => {
  assert.match(listSource, /item\.target\?\.kind === "errand-order"/);
});

test("messageInbox no longer carries stale gapLinks now that the verification + event channels are connected", () => {
  assert.doesNotMatch(inboxSource, /认证结果通知 #700/);
  assert.doesNotMatch(inboxSource, /活动状态通知 #706/);
  assert.doesNotMatch(inboxSource, /issues\/700/);
  assert.doesNotMatch(inboxSource, /issues\/706/);
  assert.doesNotMatch(inboxSource, /issues\/702/);
});

test("brand copy exists for the three inbox empty states", () => {
  for (const key of [
    "NOTIFICATION_REPLY_EMPTY_TITLE",
    "NOTIFICATION_SYSTEM_EMPTY_TITLE",
    "NOTIFICATION_ORDER_EMPTY_TITLE",
    "NOTIFICATION_REPLY_INBOX_LABEL",
    "NOTIFICATION_SYSTEM_INBOX_LABEL",
    "NOTIFICATION_ORDER_INBOX_LABEL",
  ]) {
    assert.match(notificationBrand, new RegExp(`export const ${key}\\s*=\\s*"[^"]+"`));
  }
});
