import { expect, test, type Page } from "@playwright/test";

import {
  ERRAND_CREATOR_LOGIN,
  ERRAND_MERCHANT_TID,
  ERRAND_ORDER_ID,
  ERRAND_ORDINARY_LOGIN,
  ERRAND_PLACE_ID,
  ERRAND_POOL_TITLE,
  ERRAND_RUNNER_B_LOGIN,
  ERRAND_RUNNER_C_LOGIN,
  PRIVATE_DROPOFF_SENTINEL,
  PRIVATE_NOTE_SENTINEL,
  PRIVATE_SENTINELS,
  RUNNER_POOL_KEYS,
  expectNoPrivateSentinel,
  holdNextResponse,
  installErrandLocationRunnerApi,
  loginErrandActor,
  logoutErrandActor,
  openProfileWithoutReload,
} from "./errand-location-runner-fixture";

const OLD_RUNNER_C_POOL_TITLE = "OLD_RUNNER_C_POOL_DTO";
const OLD_RUNNER_B_ACTIVE_TITLE = "OLD_RUNNER_B_ACTIVE_DTO";

async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { status: response.status, payload };
    },
    { path, method, body },
  );
}

async function expectBodyHasNoPrivateData(page: Page) {
  const body = await page.locator("body").innerText();
  for (const sentinel of PRIVATE_SENTINELS) expect(body).not.toContain(sentinel);
}

async function openRunnerCenter(page: Page) {
  await expect(page.getByTestId("profile-runner-entry")).toBeVisible();
  await page.getByTestId("profile-runner-entry").getByRole("button").click();
  await expect(page).toHaveURL(/#\/runner$/);
}

test.describe("@local-errand-location distinct-session closure", () => {
  test("creator A and assigned runner B close an order without leaking location to runner C", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const state = await installErrandLocationRunnerApi(page);

    await loginErrandActor(page, ERRAND_CREATOR_LOGIN);
    await page.goto(`/#/post/${ERRAND_MERCHANT_TID}`);
    await page.getByTestId("post-detail-merchant-errand-cta").click();
    await expect(page.getByTestId("errand-order-form")).toBeVisible();
    await expect(page.getByTestId("errand-order-dropoff-place-picker")).toBeVisible();
    await page
      .getByTestId("errand-order-dropoff-place-option")
      .filter({ hasText: PRIVATE_DROPOFF_SENTINEL })
      .click();
    await page.getByTestId("errand-order-notes-input").fill(PRIVATE_NOTE_SENTINEL);
    await page.getByTestId("errand-order-submit").click();
    await expect(page.getByTestId("errand-order-timeline-view")).toBeVisible();
    await expect(page.getByTestId("errand-order-meta-dropoff")).toContainText(
      PRIVATE_DROPOFF_SENTINEL,
    );
    expect(state.createBodies).toHaveLength(1);
    expect(state.createBodies[0]).toMatchObject({
      dropoffLocation: {
        placeId: ERRAND_PLACE_ID,
        label: PRIVATE_DROPOFF_SENTINEL,
      },
    });

    const creatorRefresh = holdNextResponse(
      state,
      "creatorA",
      "GET",
      `/api/errands/orders/${ERRAND_ORDER_ID}`,
    );
    await page.getByTestId("errand-order-timeline-refresh").click();
    await creatorRefresh.started;
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await loginErrandActor(page, ERRAND_RUNNER_C_LOGIN);
    await openRunnerCenter(page);
    await expect(page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`)).toBeVisible();
    creatorRefresh.release();
    await creatorRefresh.finished;
    await expectBodyHasNoPrivateData(page);

    const runnerCPool = await api(page, "/api/errands/orders/available");
    expect(runnerCPool.status).toBe(200);
    const runnerCItems = (runnerCPool.payload as { items: unknown[] }).items;
    expect(runnerCItems).toHaveLength(1);
    expect(Object.keys(runnerCItems[0] as object).sort()).toEqual([...RUNNER_POOL_KEYS].sort());
    expectNoPrivateSentinel(runnerCPool.payload);
    await expect(page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`)).toBeVisible();
    await expectBodyHasNoPrivateData(page);
    const runnerCDetail = await api(page, `/api/errands/orders/${ERRAND_ORDER_ID}`);
    expect(runnerCDetail.status).toBe(403);
    expectNoPrivateSentinel(runnerCDetail.payload);

    await page.getByTestId("shell-chrome-tab-active").click();
    const runnerCPoolHold = holdNextResponse(
      state,
      "runnerC",
      "GET",
      "/api/errands/orders/available",
      OLD_RUNNER_C_POOL_TITLE,
    );
    await page.getByTestId("shell-chrome-tab-available").click();
    await runnerCPoolHold.started;
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await loginErrandActor(page, ERRAND_RUNNER_B_LOGIN);
    await openRunnerCenter(page);
    await expect(page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`)).toContainText(
      ERRAND_POOL_TITLE,
    );
    runnerCPoolHold.release();
    await runnerCPoolHold.finished;
    await expect(page.locator("body")).not.toContainText(OLD_RUNNER_C_POOL_TITLE);
    await expectBodyHasNoPrivateData(page);

    const runnerBPool = await api(page, "/api/errands/orders/available");
    expect(Object.keys((runnerBPool.payload as { items: object[] }).items[0]).sort()).toEqual(
      [...RUNNER_POOL_KEYS].sort(),
    );
    expectNoPrivateSentinel(runnerBPool.payload);
    await page.getByTestId(`runner-action-accept-${ERRAND_ORDER_ID}`).click();
    await page.getByTestId("shell-chrome-tab-active").click();
    const assignedCard = page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`);
    await expect(assignedCard).toContainText(PRIVATE_DROPOFF_SENTINEL);
    await expect(assignedCard).toContainText(PRIVATE_NOTE_SENTINEL);

    const runnerBActiveHold = holdNextResponse(
      state,
      "runnerB",
      "GET",
      "/api/errands/orders/mine",
      OLD_RUNNER_B_ACTIVE_TITLE,
    );
    await page.getByTestId("shell-chrome-tab-available").click();
    await page.getByTestId("shell-chrome-tab-active").click();
    await runnerBActiveHold.started;
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await loginErrandActor(page, ERRAND_RUNNER_C_LOGIN);
    await openRunnerCenter(page);
    await expect(page.getByTestId("runner-empty-available")).toBeVisible();
    runnerBActiveHold.release();
    await runnerBActiveHold.finished;
    await expect(page.locator("body")).not.toContainText(OLD_RUNNER_B_ACTIVE_TITLE);
    await expectBodyHasNoPrivateData(page);

    // The old B response targeted the active tab while C was looking at the
    // available tab. Hold C's own active refresh so the assertion observes
    // the hidden tab state before a fresh empty response could overwrite it.
    const runnerCActiveHold = holdNextResponse(state, "runnerC", "GET", "/api/errands/orders/mine");
    await page.getByTestId("shell-chrome-tab-active").click();
    await runnerCActiveHold.started;
    await expect(page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(OLD_RUNNER_B_ACTIVE_TITLE);
    await expectBodyHasNoPrivateData(page);
    runnerCActiveHold.release();
    await runnerCActiveHold.finished;
    await expect(page.getByTestId("runner-empty-active")).toBeVisible();
    await expect(page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(OLD_RUNNER_B_ACTIVE_TITLE);
    await expectBodyHasNoPrivateData(page);

    const postAssignmentDetail = await api(page, `/api/errands/orders/${ERRAND_ORDER_ID}`);
    expect(postAssignmentDetail.status).toBe(403);
    expectNoPrivateSentinel(postAssignmentDetail.payload);
    await expect(page.getByTestId("runner-empty-active")).toBeVisible();
    await expectBodyHasNoPrivateData(page);
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await expectBodyHasNoPrivateData(page);

    await loginErrandActor(page, ERRAND_RUNNER_B_LOGIN);
    await openRunnerCenter(page);
    await page.getByTestId("shell-chrome-tab-active").click();
    await page.getByTestId(`runner-action-at-shop-${ERRAND_ORDER_ID}`).click();
    await page.getByTestId(`runner-action-pickup-${ERRAND_ORDER_ID}`).click();
    const deliverHold = holdNextResponse(
      state,
      "runnerB",
      "POST",
      `/api/errands/orders/${ERRAND_ORDER_ID}/deliver`,
    );
    await page.getByTestId(`runner-action-deliver-${ERRAND_ORDER_ID}`).click();
    await deliverHold.started;
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await loginErrandActor(page, ERRAND_ORDINARY_LOGIN);
    await expect(page.getByTestId("profile-runner-entry")).toHaveCount(0);
    deliverHold.release();
    await deliverHold.finished;
    await expectBodyHasNoPrivateData(page);

    const ordinaryDetail = await api(page, `/api/errands/orders/${ERRAND_ORDER_ID}`);
    expect(ordinaryDetail.status).toBe(403);
    expectNoPrivateSentinel(ordinaryDetail.payload);
    await logoutErrandActor(page);
    await expectBodyHasNoPrivateData(page);

    await loginErrandActor(page, ERRAND_CREATOR_LOGIN);
    await page.getByRole("tab", { name: "订单" }).click();
    await page.getByTestId("profile-errand-orders-open").click();
    await expect(page.getByTestId("errand-order-meta-dropoff")).toContainText(
      PRIVATE_DROPOFF_SENTINEL,
    );
    await page.getByTestId("errand-order-timeline-complete").click();
    await expect(page.getByTestId("errand-order-timeline-entry").last()).toContainText("已完成");

    const completedCreatorHold = holdNextResponse(
      state,
      "creatorA",
      "GET",
      `/api/errands/orders/${ERRAND_ORDER_ID}`,
    );
    await page.getByTestId("errand-order-timeline-refresh").click();
    await completedCreatorHold.started;
    await openProfileWithoutReload(page);
    await logoutErrandActor(page);
    await loginErrandActor(page, ERRAND_RUNNER_B_LOGIN);
    await openRunnerCenter(page);
    await page.getByTestId("shell-chrome-tab-active").click();
    const completedHistoryCard = page.getByTestId(`runner-order-${ERRAND_ORDER_ID}`);
    await expect(completedHistoryCard).toBeVisible();
    await expect(completedHistoryCard).toContainText("已完成");
    await expect(page.getByTestId(`runner-action-accept-${ERRAND_ORDER_ID}`)).toHaveCount(0);
    completedCreatorHold.release();
    await completedCreatorHold.finished;
    await expectBodyHasNoPrivateData(page);

    const terminalRunnerDetail = await api(page, `/api/errands/orders/${ERRAND_ORDER_ID}`);
    expect(terminalRunnerDetail.status).toBe(200);
    const terminalOrder = (terminalRunnerDetail.payload as { order: object }).order;
    expect(Object.keys(terminalOrder).sort()).toEqual([...RUNNER_POOL_KEYS].sort());
    expectNoPrivateSentinel(terminalRunnerDetail.payload);
    await expect(completedHistoryCard).toBeVisible();
    await expect(page.getByTestId(`runner-action-accept-${ERRAND_ORDER_ID}`)).toHaveCount(0);
    await expectBodyHasNoPrivateData(page);

    // A real completed notification routes the assigned runner into the
    // privacy-minimal terminal detail. It is valid safe data, not a load
    // failure, and must not invent pickup/dropoff/notes in the DOM.
    await page.goto("/#/messages");
    await page.getByTestId("filter-state-toggle").click();
    await page.getByTestId("channel-filter-chip").filter({ hasText: "订单" }).click();
    const terminalNotification = page
      .getByTestId("notification-item")
      .filter({ hasText: "订单已完成结算" });
    await expect(terminalNotification).toBeVisible();
    await terminalNotification.click();
    await expect(page.getByTestId("errand-order-timeline-view")).toBeVisible();
    await expect(page.getByTestId("errand-order-timeline-error")).toHaveCount(0);
    await expect(page.getByTestId("errand-order-meta-pickup")).toHaveCount(0);
    await expect(page.getByTestId("errand-order-meta-dropoff")).toHaveCount(0);
    await expectBodyHasNoPrivateData(page);

    expect(state.transitions).toEqual(["accept", "at-shop", "pickup", "deliver", "complete"]);
    expect(state.loginActors).toEqual([
      "creatorA",
      "runnerC",
      "runnerB",
      "runnerC",
      "runnerB",
      "ordinaryD",
      "creatorA",
      "runnerB",
    ]);
    expect(state.logoutActors).toEqual([
      "creatorA",
      "runnerC",
      "runnerB",
      "runnerC",
      "runnerB",
      "ordinaryD",
      "creatorA",
    ]);
    expect(state.unexpectedRequests).toEqual([]);
    expect(state.heldResponse).toBeNull();
  });
});
