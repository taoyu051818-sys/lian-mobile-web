import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Issue #950 — keep the notifications page truthful as backend lanes ship.
 *
 * Background: PR #714 (commit af063fa) introduced
 * `src/features/messages/notificationChannels.ts` with hardcoded `pending`
 * status + cross-repo gap-issue links (`#700` verification, `#701`
 * errand-status, `#702` event-completion, no link for admin-review). All four
 * lanes have since shipped through `/api/messages` (server `#476/#477/#445/#493`,
 * mobile `#740/#791/#792`). PR #828 (commit c52d984) deleted the engineering
 * channel-readout chrome entirely and replaced it with three discriminated
 * product-state surfaces (empty / error / auth-required).
 *
 * #950 recommends asserting "no closed gap-issue text / no stale pending"
 * rather than locking historical pending state, so the inbox can't drift
 * back to a debug surface the next time someone retypes per-channel
 * provenance into the view layer. This test is that bounded forward guard.
 *
 * It pins three rules across the readout pipeline:
 *
 *   1. The deleted `notificationChannels.ts` module stays gone — re-adding
 *      a per-channel pending/connected ledger is exactly the drift #950
 *      called out.
 *   2. No source under `src/features/messages` or `src/config/brand` carries
 *      stale closed-gap-issue references or "未接入 / 已接入 / 查看 issue /
 *      当前收件箱来源" engineering chrome strings.
 *   3. The four notification kinds whose backend lanes #950 audited
 *      (verification, order, event-*, moderation) are still routed in
 *      `NotificationList.vue` — i.e. the readout surfaces shipped truth,
 *      not a regressed catch-all.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const messagesDir = path.join(repoRoot, "src/features/messages");
const brandDir = path.join(repoRoot, "src/config/brand");

function readSourcesUnder(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.(ts|vue)$/.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      content: fs.readFileSync(path.join(dir, entry.name), "utf8"),
    }));
}

const messagesSources = readSourcesUnder(messagesDir);
const brandSources = readSourcesUnder(brandDir);
const allReadoutSources = [...messagesSources, ...brandSources];

const notificationListSource = fs.readFileSync(
  path.join(messagesDir, "NotificationList.vue"),
  "utf8",
);

test("notificationChannels.ts stays deleted — per-channel pending/connected ledger was the drift #950 called out", () => {
  // The module hardcoded `pending` for verification/errand-status/event-completion/
  // admin-review and pointed at #700/#701/#702. PR #828 deleted it. If a future
  // refactor re-adds it the inbox is back to being a debug surface.
  const reborn = path.join(messagesDir, "notificationChannels.ts");
  assert.equal(
    fs.existsSync(reborn),
    false,
    `notificationChannels.ts must stay deleted (see #950); found at ${reborn}`,
  );
});

test("messages readout sources do not link to the closed gap issues #950 audited", () => {
  // ps#476 closed mw#700, ps#477 closed mw#701, ps#445 closed mw#702, mw#706
  // was the event-completion readout that landed in mw#714. Linking to any
  // of these from the readout surface is by definition stale truth.
  const closedGapIssues = ["700", "701", "702", "706"];
  for (const { name, content } of allReadoutSources) {
    for (const issue of closedGapIssues) {
      const stalePattern = new RegExp(`issues/${issue}\\b`);
      assert.doesNotMatch(
        content,
        stalePattern,
        `${name} links to closed gap issue #${issue}; remove or replace per #950`,
      );
    }
  }
});

test("messages readout sources do not carry the engineering chrome strings #828 stripped", () => {
  // These are the strings the old per-channel readout surfaced. If any of
  // them resurface in src/ the inbox has drifted back to a debug surface.
  // (`pending` alone is too generic — useChannelMessages legitimately uses
  // `pendingId` for optimistic-send rows; we match it only adjacent to the
  // status-pill phrasing that came with the deleted readout.)
  const forbidden = [
    "未接入",
    "已接入",
    "待接入",
    "当前收件箱来源",
    "查看 issue",
    "查看对应 issue",
    "NOTIFICATION_CHANNEL_STATUS_PENDING",
    "NOTIFICATION_CHANNEL_STATUS_CONNECTED",
    "NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL",
    "NOTIFICATION_EMPTY_NEXT_STEP",
  ];
  for (const { name, content } of allReadoutSources) {
    for (const offender of forbidden) {
      assert.equal(
        content.includes(offender),
        false,
        `${name} contains stale engineering string "${offender}"; remove per #950 / #828`,
      );
    }
  }
});

test("NotificationList still routes the four kinds whose backend lanes #950 audited as shipped", () => {
  // ps#476 verification, ps#477 errand-order status, ps#445 event-*,
  // ps#493 admin moderation. The kindLabel switch is the readout's
  // structural proof that these lanes surface as first-class notification
  // kinds — not as a generic "system" catch-all that would hide whether
  // they reached the user.
  for (const kind of ['"verification"', '"order"', '"event-completed"', '"moderation"']) {
    assert.match(
      notificationListSource,
      new RegExp(`case ${kind.replace(/[-]/g, "[-]")}:`),
      `NotificationList must still route case ${kind} (#950 lanes)`,
    );
  }
  // Event family fans out into completed/reward-settled/expired in the same
  // case-fallthrough block; pin both sub-kinds so a future refactor can't
  // silently drop one and have it land in the system fallback.
  assert.match(notificationListSource, /case "event-reward-settled":/);
  assert.match(notificationListSource, /case "event-expired":/);
});

test("messageInbox routes moderation items into the system tab (ps#493 lane truth)", () => {
  // ps#493 admin moderation decisions land as `kind: "moderation"` and must
  // surface in the system tab. The default-system fallback would catch them
  // by accident, but pinning the explicit branch keeps the routing audit
  // trail in source so a future tab split can't silently misroute them.
  const inboxSource = fs.readFileSync(path.join(messagesDir, "messageInbox.ts"), "utf8");
  assert.match(inboxSource, /item\.kind === "moderation"/);
  assert.match(inboxSource, /return tab === "system"/);
});
