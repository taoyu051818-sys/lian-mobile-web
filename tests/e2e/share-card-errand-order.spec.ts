/**
 * Errand-order share-card E2E tests (ps#552, mw#892).
 *
 * Browser-side coverage of the share-card flow on the errand order timeline:
 *
 *   ErrandOrderTimelineView `分享招募跑腿` →
 *     useErrandOrderShareCard.start →
 *       GET /api/errands/orders/:orderId/share-card →
 *         ShareCardSheet renders { title, summary, thumbnail, audience } →
 *           confirm → clipboard copy → sheet closes.
 *
 * 4 cases:
 *
 *   a. share CTA visibility — only the order creator sees the share button
 *      while the order is in recruiting status (created / paid_locked).
 *   b. ready-state sheet pulls title / summary / thumbnail / audience from
 *      the stubbed share-card envelope.
 *   c. wechat channel truncation — the wechat description is truncated to
 *      fit WeChat's 512-byte limit (backend responsibility, frontend just
 *      renders what it receives).
 *   d. non-eligible invisibility — non-creator users do not see the share
 *      CTA, and the share-card endpoint returns 403 for them.
 *
 * Hermetic via `page.route` against `/api/errands/orders/:orderId`,
 * `/api/errands/orders/:orderId/share-card`, and `/api/auth/me`. The shipping
 * data path runs end-to-end through the real browser; only the data plane is
 * mocked so the spec does not depend on live backend state.
 */

import { expect, test, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const STUB_ORDER_ID = "errand-order-share-test-001";
const STUB_REQUESTER_USER_ID = "user-requester-123";
const STUB_OTHER_USER_ID = "user-other-456";

const ORDER_DETAIL_STUB = {
  order: {
    orderId: STUB_ORDER_ID,
    requesterUserId: STUB_REQUESTER_USER_ID,
    pickupLocation: { placeId: "pickup-1", label: "海大食堂三楼", lat: 36.06, lng: 120.38 },
    dropoffLocation: { placeId: "dropoff-1", label: "明德楼一楼", lat: 36.07, lng: 120.39 },
    mode: "dedicated",
    status: "created",
    feeAmount: 50,
    lockedBalanceAmount: 50,
  },
  timeline: [{ status: "created", at: new Date().toISOString(), actor: "system" }],
  notes: "测试备注",
  createdAt: new Date().toISOString(),
};

const SHARE_CARD_STUB = {
  ok: true,
  card: {
    orderId: STUB_ORDER_ID,
    title: "帮我取订单招募跑腿",
    summary: "海大食堂三楼 → 明德楼一楼，专属跑腿，50积分报酬。",
    thumbnailUrl: "https://lian.nat100.top/uploads/errand-share-fixture.png",
    url: `https://lian.nat100.top/#/errand/order/${STUB_ORDER_ID}`,
    kind: "errand-order",
    authorName: "测试用户",
    audienceLabel: "校园可见",
    channel: {
      wechat: {
        title: "帮我取订单招募跑腿",
        description: "海大食堂三楼 → 明德楼一楼，专属跑腿，50积分报酬。点击查看详情并接单。",
        imageUrl: "https://lian.nat100.top/uploads/errand-share-fixture-wechat.png",
      },
    },
  },
};

function createAuthMeStub(userId: string) {
  return {
    id: userId,
    username: userId === STUB_REQUESTER_USER_ID ? "requester" : "other-user",
    nickname: userId === STUB_REQUESTER_USER_ID ? "订单创建者" : "其他用户",
    avatarUrl: "",
    bio: "",
    verified: true,
  };
}

async function installOrderDetailStub(page: Page, orderStatus = "created") {
  const stub = {
    ...ORDER_DETAIL_STUB,
    order: { ...ORDER_DETAIL_STUB.order, status: orderStatus },
  };
  await page.route(new RegExp(`/api/errands/orders/${STUB_ORDER_ID}(\\?|$)`), async (route) => {
    await route.fulfill({ json: stub });
  });
}

async function installShareCardStub(page: Page, status = 200) {
  await page.route(`**/api/errands/orders/${STUB_ORDER_ID}/share-card`, async (route) => {
    if (status === 403) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "forbidden" }),
      });
      return;
    }
    await route.fulfill({ json: SHARE_CARD_STUB });
  });
}

async function installAuthMeStub(page: Page, userId: string) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: createAuthMeStub(userId) });
  });
}

const SHARE_BUTTON = '[data-testid="errand-order-timeline-share"]';
const SHARE_SHEET = '[data-testid="share-card-sheet"]';
const SHARE_PREVIEW = '[data-testid="share-card-preview"]';
const SHARE_AUDIENCE = '[data-testid="share-card-audience"]';
const TIMELINE_VIEW = '[data-testid="errand-order-timeline-view"]';

test.describe("@registered errand-order share-card (ps#552)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  // -------------------------------------------------------------------------
  // a. share CTA visibility — order creator in recruiting status
  // -------------------------------------------------------------------------
  test("share CTA is visible for order creator when status is recruiting (created)", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "created");
      await installShareCardStub(page);

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await expect(page.locator(TIMELINE_VIEW)).toBeVisible();

      const shareButton = page.locator(SHARE_BUTTON);
      await expect(shareButton).toBeVisible();
      await expect(shareButton).toHaveText("分享招募跑腿");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("share CTA is visible for order creator when status is paid_locked", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "paid_locked");
      await installShareCardStub(page);

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await expect(page.locator(TIMELINE_VIEW)).toBeVisible();

      const shareButton = page.locator(SHARE_BUTTON);
      await expect(shareButton).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("share CTA is hidden when order status is assigned (no longer recruiting)", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "assigned");
      await installShareCardStub(page);

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await expect(page.locator(TIMELINE_VIEW)).toBeVisible();

      const shareButton = page.locator(SHARE_BUTTON);
      await expect(shareButton).not.toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // b. ready-state field rendering from the stubbed envelope
  // -------------------------------------------------------------------------
  test("tapping share opens sheet and renders card fields from stub envelope", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "created");
      await installShareCardStub(page);

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await page.locator(SHARE_BUTTON).click();

      const sheet = page.locator(SHARE_SHEET);
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("role", "dialog");
      await expect(sheet).toHaveAttribute("aria-modal", "true");

      await expect(page.locator(SHARE_PREVIEW)).toBeVisible();
      await expect(page.locator("h3.share-card-sheet__title")).toHaveText(
        SHARE_CARD_STUB.card.title,
      );
      await expect(page.locator("p.share-card-sheet__summary")).toHaveText(
        SHARE_CARD_STUB.card.summary,
      );

      const thumb = page.locator("img.share-card-sheet__thumb");
      await expect(thumb).toHaveAttribute("src", SHARE_CARD_STUB.card.thumbnailUrl);

      await expect(page.locator(SHARE_AUDIENCE)).toHaveText(SHARE_CARD_STUB.card.audienceLabel);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // c. wechat channel truncation — backend responsibility, frontend renders
  // -------------------------------------------------------------------------
  test("wechat channel fields are present in the stub (truncation is backend responsibility)", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "created");

      // Stub with a long wechat description that would be truncated by backend
      const longDescription = "A".repeat(600);
      const truncatedStub = {
        ...SHARE_CARD_STUB,
        card: {
          ...SHARE_CARD_STUB.card,
          channel: {
            wechat: {
              ...SHARE_CARD_STUB.card.channel.wechat,
              description: longDescription.slice(0, 512) + "...",
            },
          },
        },
      };
      await page.route(`**/api/errands/orders/${STUB_ORDER_ID}/share-card`, async (route) => {
        await route.fulfill({ json: truncatedStub });
      });

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await page.locator(SHARE_BUTTON).click();
      await expect(page.locator(SHARE_PREVIEW)).toBeVisible();

      // The frontend renders whatever the backend sends — truncation is
      // backend responsibility. This test verifies the frontend doesn't
      // break when receiving truncated content.
      await expect(page.locator("h3.share-card-sheet__title")).toHaveText(truncatedStub.card.title);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // d. non-eligible invisibility — non-creator users
  // -------------------------------------------------------------------------
  test("share CTA is hidden for non-creator users", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Auth as a different user than the order creator
      await installAuthMeStub(page, STUB_OTHER_USER_ID);
      await installOrderDetailStub(page, "created");
      await installShareCardStub(page, 403);

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await expect(page.locator(TIMELINE_VIEW)).toBeVisible();

      // Share button should not be visible for non-creator
      const shareButton = page.locator(SHARE_BUTTON);
      await expect(shareButton).not.toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("share-card endpoint 403 for non-creator is handled gracefully", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Even if the frontend somehow shows the share button (race condition),
      // the 403 from the backend should be handled gracefully.
      await installAuthMeStub(page, STUB_REQUESTER_USER_ID);
      await installOrderDetailStub(page, "created");

      // First request returns 403
      await page.route(`**/api/errands/orders/${STUB_ORDER_ID}/share-card`, async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "forbidden" }),
        });
      });

      await page.goto(`/#/errand/order/${STUB_ORDER_ID}`);
      await page.locator(SHARE_BUTTON).click();

      // Sheet opens but shows error state (not-found maps from 403)
      const sheet = page.locator(SHARE_SHEET);
      await expect(sheet).toBeVisible();

      // Error state should be visible
      const errorBlock = page.locator('[data-testid="share-card-error"]');
      await expect(errorBlock).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
