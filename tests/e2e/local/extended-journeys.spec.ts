import { expect, test, type Page } from "@playwright/test";

import {
  LOCAL_ERRAND_ORDER_ID,
  LOCAL_EVENT_ID,
  LOCAL_HELP_ID,
  LOCAL_NOTIFICATION_TITLE,
  LOCAL_POST_TID,
  LOCAL_POST_TITLE,
  expectNoUnexpectedApiRequests,
  installLocalCoreApi,
  loginThroughUi,
} from "./core-fixture";

async function api<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}`);
      return payload;
    },
    { path, method, body },
  );
}

test.describe("@local-extended deterministic business journeys", () => {
  test("registered fixture joins and leaves an event", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    expect(await api(page, `/api/events/${LOCAL_EVENT_ID}/join`, "POST")).toMatchObject({
      joined: true,
      joinedCount: 1,
    });
    expect(state.eventJoined).toBe(true);
    expect(await api(page, `/api/events/${LOCAL_EVENT_ID}/cancel-join`, "POST")).toMatchObject({
      joined: false,
      joinedCount: 0,
    });
    expect(state.eventJoined).toBe(false);
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture resolves a help request", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    expect(await api(page, `/api/help/${LOCAL_HELP_ID}/resolve`, "POST")).toEqual({
      helpId: LOCAL_HELP_ID,
      status: "resolved",
    });
    expect(state.helpStatus).toBe("resolved");
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture creates and advances an errand order", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    const created = await api<{ orderId: string; status: string }>(
      page,
      "/api/errands/orders",
      "POST",
      {
        pickupLocation: { area: "固定取件点" },
        dropoffLocation: { area: "固定送达点" },
        mode: "pickup",
        feeAmount: 3,
      },
    );
    expect(created).toEqual({ orderId: LOCAL_ERRAND_ORDER_ID, status: "created" });

    for (const [action, status] of [
      ["accept", "accepted"],
      ["pickup", "picked_up"],
      ["deliver", "delivered"],
      ["complete", "completed"],
    ] as const) {
      expect(
        await api(page, `/api/errands/orders/${LOCAL_ERRAND_ORDER_ID}/${action}`, "POST"),
      ).toMatchObject({ orderId: LOCAL_ERRAND_ORDER_ID, status });
    }
    expect(state.errandStatus).toBe("completed");
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture reads and acknowledges a notification", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    const inbox = await api<{ items: Array<{ id: string; title: string; read: boolean }> }>(
      page,
      "/api/messages?limit=30&offset=0",
    );
    expect(inbox.items).toEqual([
      expect.objectContaining({ title: LOCAL_NOTIFICATION_TITLE, read: false }),
    ]);
    await api(page, "/api/messages/read", "POST", { eventIds: [inbox.items[0].id] });
    expect(state.notificationRead).toBe(true);
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture likes and saves a post through the detail UI", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);
    await page.goto(`/#/post/${LOCAL_POST_TID}`);
    await expect(page.locator("#post-detail-title")).toContainText(LOCAL_POST_TITLE);

    const like = page.locator(".post-reply-dock__action").filter({ hasText: "喜欢" });
    const save = page.locator(".post-reply-dock__action").filter({ hasText: "收藏" });
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    expect(state.liked).toBe(true);
    expect(state.saved).toBe(true);
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture opens profile and its saved and liked collections", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    await expect(page.locator(".profile-header__name")).toContainText("e2e-registered");
    const saved = page.getByRole("tab", { name: "收藏" });
    const liked = page.getByRole("tab", { name: "赞过" });
    await saved.click();
    await expect(saved).toHaveAttribute("aria-selected", "true");
    await liked.click();
    await expect(liked).toHaveAttribute("aria-selected", "true");
    expectNoUnexpectedApiRequests(state);
  });
});
