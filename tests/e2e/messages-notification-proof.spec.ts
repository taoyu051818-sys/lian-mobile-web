import { expect, test, type Page } from "@playwright/test";

/**
 * Open a top-region shell tab by its visible label.
 *
 * The Messages chrome is rendered by `ShellChrome.vue` from the typed
 * `PageChromeSpec.top.tabs` set up by `MessagesView.vue`. After PR #722 the
 * inbox split into four tabs — `频道 / 回复 / 系统 / 订单` — so the legacy
 * `getByRole("tab").nth(1)` was both wrong (the buttons don't have
 * `role="tab"`, so it matched zero elements and clicked-into-the-void until
 * the 60s test timeout) and brittle (only ever resolved replies, never the
 * system or orders sub-tab where verification + order notifications live).
 *
 * We anchor on the structural class (`.shell-chrome__tab`) plus exact-text
 * matching against the brand strings in `src/config/brand/messages.ts`. The
 * source-side ARIA improvement landed in this PR (role="tab" + aria-selected
 * + per-id testids) gives future specs a cleaner anchor once it deploys, but
 * this selector keeps working before and after that rollout.
 */
async function openMessagesTab(page: Page, label: string) {
  const tab = page.locator(".shell-chrome__tab", { hasText: new RegExp(`^\\s*${label}\\s*$`) });
  await expect(tab).toBeVisible();
  await tab.click();
}

// Synthetic notification → detail target. Earlier revisions of this spec
// pulled a real tid/title from `GET /api/feed?tab=此刻` and asserted the
// envelope was non-empty before mocking `/api/messages`. That precondition
// turned the spec into a live-data probe: when the nat100 此刻 / 推荐 / 最新
// tabs are momentarily empty (post-deploy, low-traffic windows, or any
// backend hiccup that resets the feed) the spec exits in ~1.4s on the
// `expect(feedItem?.tid).toBeTruthy()` line and PR-gate goes red even
// though the inbox routing under test is fine. The whole point of this
// spec is the *routing* proof — not whether nat100 currently has public
// posts — so we mock both endpoints (`/api/messages` and `/api/posts/:tid`)
// and the spec runs to completion regardless of the live feed's state.
const REPLY_TID = 9_990_001;
const REPLY_TITLE = "[E2E] 路由代理用的同步帖子标题";
const REPLY_BODY_HTML = "<p>这是一条 e2e 路由代理用的同步帖子正文。</p>";

test.describe("messages notification routing proof @anonymous @messages", () => {
  test("routes reply notifications, opens verification, and keeps missing targets stable", async ({
    page,
  }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: { user: null } });
    });
    // Some shell-level prefetches trigger a feed request even on the messages
    // view; stub it so the spec stays self-contained instead of inheriting
    // whatever nat100 is currently serving.
    await page.route("**/api/feed**", async (route) => {
      await route.fulfill({
        json: {
          tabs: [{ id: "此刻", label: "此刻" }],
          items: [],
          hasMore: false,
          nextPage: null,
        },
      });
    });
    await page.route(`**/api/posts/${REPLY_TID}*`, async (route) => {
      await route.fulfill({
        json: {
          tid: REPLY_TID,
          title: REPLY_TITLE,
          contentHtml: REPLY_BODY_HTML,
          actor: { displayName: "某同学" },
          timestampISO: new Date().toISOString(),
          likeCount: 0,
          liked: false,
          replies: [],
          bookmarked: false,
        },
      });
    });
    await page.route("**/api/messages", async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: "reply-proof",
              type: "reply",
              tid: REPLY_TID,
              title: "有人回复了你的帖子",
              excerpt: "打开后应该进入帖子详情。",
              actor: { displayName: "某同学" },
              read: false,
              timestampISO: new Date().toISOString(),
            },
            {
              id: "verification-proof",
              type: "verification-approved",
              title: "校园认证已通过",
              excerpt: "打开后应该进入认证中心。",
              actor: { displayName: "系统通知" },
              read: true,
              timestampISO: new Date().toISOString(),
            },
            {
              id: "order-proof",
              type: "errand-order-status",
              title: "跑腿订单状态更新",
              excerpt: "当前阶段仍然只展示稳定摘要。",
              actor: { displayName: "系统通知" },
              read: true,
              timestampISO: new Date().toISOString(),
            },
          ],
        },
      });
    });

    await page.goto("/#/messages");

    // Replies tab — reply fixture should expose a clickable detail target.
    await openMessagesTab(page, "回复");
    const replyItem = page.locator(
      '[data-testid="notification-item"][data-notification-kind="reply"]',
    );
    await expect(replyItem).toContainText("查看回复详情");
    await replyItem.click();
    await expect(page.locator("#post-detail-title")).toContainText(REPLY_TITLE);

    // Verification fixture lives under the system inbox tab (#722 split).
    await page.goto("/#/messages");
    await openMessagesTab(page, "系统");
    const verificationItem = page.locator(
      '[data-testid="notification-item"][data-notification-kind="verification"]',
    );
    await verificationItem.click();
    await expect(page.locator(".verification-view")).toBeVisible();

    // Errand-order fallback lives under the orders inbox tab and must stay
    // non-clickable until the order target page ships (#701).
    await page.goto("/#/messages");
    await openMessagesTab(page, "订单");
    const fallbackItem = page.locator('[data-testid="notification-item"][data-target-kind="none"]');
    await expect(fallbackItem).toContainText("订单类通知会在后续版本接入目标页。");
    await expect(page).toHaveURL(/#\/messages$/);
  });
});
