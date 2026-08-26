import { expect, test } from "@playwright/test";

import {
  A_REPLY_NOTIFICATION_ID,
  B_ONLY_NOTIFICATION_TITLE,
  REPLY_BODY,
  REPLY_PID,
  REPLY_NOTIFICATION_TITLE,
  TOPIC_ID,
  expectNoUnexpectedIdentityCommunityRequests,
  installIdentityCommunityApi,
  loginIdentityThroughUi,
  logoutIdentityThroughUi,
  openRepliesInbox,
} from "./identity-community-fixture";

test.describe("@local-identity-community same-browser account isolation", () => {
  test("A -> logout -> B reply -> logout -> A notification read stays actor-scoped", async ({
    page,
  }) => {
    const state = await installIdentityCommunityApi(page);

    await loginIdentityThroughUi(page, "a");
    await expect(page.locator(".shell-chrome__identity-name")).toHaveText("alice");
    await logoutIdentityThroughUi(page, "a");

    await loginIdentityThroughUi(page, "b");
    await expect(page.locator(".shell-chrome__identity-name")).toHaveText("bob");

    await page.goto(`/#/post/${TOPIC_ID}`);
    await expect(page.locator("#post-detail-title")).toContainText("Alice 的隔离测试帖");
    await page.locator(".post-reply-dock__reply-box").click();
    await page.getByLabel("回复内容").fill(REPLY_BODY);
    const replyResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/posts/${TOPIC_ID}/replies` &&
        response.request().method() === "POST",
    );
    await page.locator(".post-reply-dock__send").click();
    await expect((await replyResponse).ok()).toBe(true);
    await expect(page.locator(".post-replies__item").filter({ hasText: REPLY_BODY })).toContainText(
      "Bob",
    );
    expect(state.replyWrites).toEqual([{ account: "b", content: REPLY_BODY }]);

    await page.goto("/#/messages");
    await openRepliesInbox(page);
    await expect(
      page.getByTestId("notification-item").filter({ hasText: B_ONLY_NOTIFICATION_TITLE }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("notification-item").filter({ hasText: REPLY_NOTIFICATION_TITLE }),
    ).toHaveCount(0);

    await logoutIdentityThroughUi(page, "b");
    await loginIdentityThroughUi(page, "a");
    await page.goto("/#/messages");
    await openRepliesInbox(page);

    const replyNotification = page
      .getByTestId("notification-item")
      .filter({ hasText: REPLY_NOTIFICATION_TITLE });
    await expect(replyNotification).toHaveCount(1);
    await expect(replyNotification).toContainText("Bob");
    await expect(replyNotification).toContainText("未读");
    expect(state.notifications.a[0]?.pid).toBe(REPLY_PID);
    await expect(
      page.getByTestId("notification-item").filter({ hasText: B_ONLY_NOTIFICATION_TITLE }),
    ).toHaveCount(0);

    const readResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === `/api/notifications/${A_REPLY_NOTIFICATION_ID}/read` &&
        url.searchParams.get("source") === "nodebb" &&
        response.request().method() === "POST"
      );
    });
    await replyNotification.click();
    await expect((await readResponse).ok()).toBe(true);
    await expect(page).toHaveURL(new RegExp(`#\\/post\\/${TOPIC_ID}$`));
    await expect(page.locator("#post-detail-title")).toContainText("Alice 的隔离测试帖");

    expect(state.readWrites).toEqual([
      { account: "a", notificationId: A_REPLY_NOTIFICATION_ID, source: "nodebb" },
    ]);
    expect(state.notifications.a[0]?.read).toBe(true);
    expect(state.notifications.b[0]?.read).toBe(false);
    expect(state.activeAccount).toBe("a");
    expectNoUnexpectedIdentityCommunityRequests(state);
  });
});
