import { devices, expect, test, type Page } from "@playwright/test";

const MOBILE_DEVICE = devices["iPhone 13"];
const LABEL_TO_CATEGORY_KEY: Record<string, string> = {
  频道: "channel",
  回复: "replies",
  系统: "system",
  订单: "orders",
};

const UPVOTE_TID = 9_990_021;
const UPVOTE_TITLE = "[E2E] 系统点赞通知目标帖子";
const UPVOTE_BODY_HTML = "<p>这是一条用于验证系统点赞通知跳转的帖子正文。</p>";

async function openMessagesTab(page: Page, label: string) {
  const key = LABEL_TO_CATEGORY_KEY[label] ?? label;
  const chip = page.locator(`[data-filter-value="${key}"]`);
  if ((await chip.count()) === 0) {
    await page.locator('[data-testid="filter-state-toggle"]').click();
  }
  await expect(chip).toBeVisible();
  await chip.click({ force: true });
}

test.use({
  ...MOBILE_DEVICE,
});

test.describe("@registered @mobile @messages system inbox upvote notification", () => {
  test("opens system upvote notification without depending on live inbox data", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await page.route("**/api/auth/me", async (route) => {
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
    await page.route(`**/api/posts/${UPVOTE_TID}*`, async (route) => {
      await route.fulfill({
        json: {
          tid: UPVOTE_TID,
          title: UPVOTE_TITLE,
          contentHtml: UPVOTE_BODY_HTML,
          actor: { displayName: "某同学" },
          timestampISO: new Date().toISOString(),
          likeCount: 1,
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
              id: "system-upvote-proof",
              type: "post-liked",
              tid: UPVOTE_TID,
              title: "有人赞了你的帖子",
              excerpt: "打开后应该进入帖子详情。",
              actor: { displayName: "系统通知" },
              read: false,
              timestampISO: new Date().toISOString(),
            },
          ],
        },
      });
    });

    await page.goto("/#/messages");
    await openMessagesTab(page, "系统");

    const upvoteItem = page.locator('[data-testid="notification-item"][data-target-kind="detail"]', {
      hasText: "有人赞了你的帖子",
    });

    await expect(upvoteItem).toBeVisible();
    await expect(upvoteItem).toContainText("查看详情");
    await expect(upvoteItem).toHaveAttribute("data-notification-kind", "generic");

    await upvoteItem.click();
    await expect(page.locator("#post-detail-title")).toContainText(UPVOTE_TITLE);
  });
});
