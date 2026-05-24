import { expect, test, type Page } from "@playwright/test";

// PR #945 moved the inbox tabs into ChannelFilterBar State-B chips (teleported).
const LABEL_TO_CATEGORY_KEY: Record<string, string> = {
  频道: "channel",
  回复: "replies",
  系统: "system",
  订单: "orders",
};

async function openMessagesTab(page: Page, label: string) {
  const key = LABEL_TO_CATEGORY_KEY[label] ?? label;
  const chip = page.locator(`[data-filter-value="${key}"]`);
  if ((await chip.count()) === 0) {
    await page.locator('[data-testid="filter-state-toggle"]').click();
  }
  await expect(chip).toBeVisible();
  // force: skip stability check during the 300ms slide-in transition
  await chip.click({ force: true });
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
      // Logged-in fixture: PR #945's ChannelFilterBar hides the State-A/B
      // toggle for guests, so a guest fixture can no longer reach the
      // replies/system/orders chips through the UI. The notification routing
      // under test is independent of auth state.
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            identityTags: [],
            aliases: [],
          },
        },
      });
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
