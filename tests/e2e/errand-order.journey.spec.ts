import { expect, request, test, type APIRequestContext, type Browser } from "@playwright/test";

import { isRoleConfigured, loginAs, type RoleId } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

type ViewerRole = RoleId | "anonymous";

interface FeedItem {
  cover?: string;
  cardTemplate?: string;
}

interface FeedResponse {
  items?: FeedItem[];
}

interface PublishResponse {
  tid?: number | string;
}

interface PostDetailProbe {
  tid?: number | string;
  title?: string;
  merchant?: {
    errandSupported?: boolean;
    name?: string;
  } | null;
  errandEntryAvailable?: boolean;
  errandUnavailableReason?: string;
  errandUnavailableReasonText?: string;
}

interface ProbeSummary {
  role: ViewerRole;
  available: boolean | undefined;
  reason: string;
  reasonText: string;
}

function buildMerchantPublishPayload(imageUrl: string, title: string) {
  return {
    imageUrl,
    imageUrls: [imageUrl],
    title,
    body: "Playwright merchant errand journey proof post.",
    tag: "",
    identityTag: "",
    metadata: {
      locationArea: "E2E Merchant Pickup",
      visibility: "public",
      distribution: ["home", "search", "detail"],
      primaryTag: "",
      identityTag: "",
      presentationIntent: "merchant",
    },
    contentType: "merchant_food",
    merchant: {
      name: "E2E Merchant Pickup",
      category: "food",
      hours: "09:00-21:00",
      contact: "e2e-merchant",
      errandSupported: true,
    },
    locationDraft: {
      source: "manual",
      locationId: "",
      locationArea: "E2E Merchant Pickup",
      displayName: "E2E Merchant Pickup",
      lat: null,
      lng: null,
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "manual",
      coordinateSystem: "none",
      identityKind: "manual_text",
      precisionKind: "display_only",
      confidence: 0.65,
      skipped: false,
      note: "",
      issues: [],
    },
    riskFlags: [],
    confidence: 0.65,
    needsHumanReview: false,
    aiMode: "manual-vue",
  };
}

async function firstReusableImage(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const imageItem = body.items?.find(
    (item) => item.cover && (item.cardTemplate === "image" || !item.cardTemplate),
  );
  expect(imageItem?.cover, "nat100 feed must expose at least one reusable cover URL").toBeTruthy();
  return imageItem!.cover!;
}

async function publishMerchantPost(api: APIRequestContext) {
  const imageUrl = await firstReusableImage(api);
  const title = `E2E merchant errand ${new Date().toISOString()}`;
  const response = await api.post("/api/ai/post-publish", {
    data: buildMerchantPublishPayload(imageUrl, title),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as PublishResponse;
  expect(body.tid).toBeTruthy();
  return { tid: String(body.tid), title };
}

async function fetchPostDetail(api: APIRequestContext, tid: string) {
  const response = await api.get(`/api/posts/${tid}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as PostDetailProbe;
}

async function waitForMerchantDetail(api: APIRequestContext, tid: string) {
  let last: PostDetailProbe | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const detail = await fetchPostDetail(api, tid);
    last = detail;
    if (detail.merchant?.errandSupported) return detail;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`merchant detail never surfaced errandSupported=true for tid=${tid}: ${JSON.stringify(last)}`);
}

async function probeRole(role: ViewerRole, tid: string): Promise<ProbeSummary> {
  if (role === "anonymous") {
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const detail = await fetchPostDetail(api, tid);
      return {
        role,
        available: detail.errandEntryAvailable,
        reason: detail.errandUnavailableReason || "",
        reasonText: detail.errandUnavailableReasonText || "",
      };
    } finally {
      await api.dispose();
    }
  }

  const { api } = await loginAs(role, BASE_URL);
  try {
    const detail = await fetchPostDetail(api, tid);
    return {
      role,
      available: detail.errandEntryAvailable,
      reason: detail.errandUnavailableReason || "",
      reasonText: detail.errandUnavailableReasonText || "",
    };
  } finally {
    await api.dispose();
  }
}

async function openAuthenticatedPage(browser: Browser, api: APIRequestContext) {
  const context = await browser.newContext({ storageState: await api.storageState() });
  const page = await context.newPage();
  return { context, page };
}

test.describe("@errand-order merchant detail journey (#693)", () => {
  test("published merchant detail yields a CTA for one eligible viewer and a visible reason for one rejected viewer", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("merchant"),
      "merchant role not configured — set LIAN_E2E_MERCHANT_USERNAME / LIAN_E2E_MERCHANT_PASSWORD",
    );

    const { api: merchantApi } = await loginAs("merchant", BASE_URL);
    const { tid, title } = await publishMerchantPost(merchantApi);
    await waitForMerchantDetail(merchantApi, tid);
    await merchantApi.dispose();

    const availableCandidates: RoleId[] = ["campus", "runner", "merchant", "registered"];
    const availableProbes: ProbeSummary[] = [];
    let availableRole: RoleId | null = null;

    for (const role of availableCandidates) {
      if (!isRoleConfigured(role)) continue;
      const probe = await probeRole(role, tid);
      availableProbes.push(probe);
      if (probe.available === true) {
        availableRole = role;
        break;
      }
    }

    expect(
      availableRole,
      `no configured role could reach errandEntryAvailable=true for tid=${tid}; probes=${JSON.stringify(availableProbes)}`,
    ).toBeTruthy();

    const unavailableCandidates: ViewerRole[] = ["registered", "anonymous", "campus", "runner", "merchant"];
    const unavailableProbes: ProbeSummary[] = [];
    let unavailableRole: ViewerRole | null = null;
    let unavailableReasonText = "";

    for (const role of unavailableCandidates) {
      if (role !== "anonymous" && !isRoleConfigured(role)) continue;
      const probe = await probeRole(role, tid);
      unavailableProbes.push(probe);
      if (probe.available === false && (probe.reasonText || probe.reason)) {
        unavailableRole = role;
        unavailableReasonText = probe.reasonText;
        break;
      }
    }

    expect(
      unavailableRole,
      `no configured role produced a rejected detail-side errand reason for tid=${tid}; probes=${JSON.stringify(unavailableProbes)}`,
    ).toBeTruthy();

    const { api: availableApi } = await loginAs(availableRole as RoleId, BASE_URL);
    const { context: availableContext, page: availablePage } = await openAuthenticatedPage(
      browser,
      availableApi,
    );
    await availablePage.goto(`/#/post/${tid}`);
    await expect(availablePage.locator("#post-detail-title")).toContainText(title);
    await expect(availablePage.getByTestId("post-detail-merchant-block")).toBeVisible();
    await expect(availablePage.getByTestId("post-detail-merchant-errand-entry")).toBeVisible();
    await expect(availablePage.getByTestId("post-detail-merchant-errand-cta")).toBeEnabled();
    await availablePage.getByTestId("post-detail-merchant-errand-cta").click();
    await expect.poll(() => availablePage.evaluate(() => location.hash)).toMatch(/#\/errand-order/);
    await expect(availablePage.getByTestId("errand-order-view")).toBeVisible();
    await expect(availablePage.getByTestId("errand-order-form")).toBeVisible();
    await expect(availablePage.getByTestId("errand-order-pickup-input")).not.toHaveValue("");
    await availablePage.getByTestId("errand-order-back").click();
    await expect.poll(() => availablePage.evaluate(() => location.hash)).toMatch(/^#\/feed\/?$|^$/);
    await availableContext.close();
    await availableApi.dispose();

    if (unavailableRole === "anonymous") {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/#/post/${tid}`);
      await expect(page.locator("#post-detail-title")).toContainText(title);
      await expect(page.getByTestId("post-detail-merchant-block")).toBeVisible();
      await expect(page.getByTestId("post-detail-merchant-errand-entry")).toHaveCount(0);
      await expect(page.getByTestId("post-detail-merchant-errand-unavailable")).toBeVisible();
      const reason = page.getByTestId("post-detail-merchant-errand-reason");
      await expect(reason).toBeVisible();
      await expect(reason).not.toHaveText("");
      if (unavailableReasonText) {
        await expect(reason).toContainText(unavailableReasonText);
      }
      await context.close();
      return;
    }

    const { api: unavailableApi } = await loginAs(unavailableRole as RoleId, BASE_URL);
    const { context: unavailableContext, page: unavailablePage } = await openAuthenticatedPage(
      browser,
      unavailableApi,
    );
    await unavailablePage.goto(`/#/post/${tid}`);
    await expect(unavailablePage.locator("#post-detail-title")).toContainText(title);
    await expect(unavailablePage.getByTestId("post-detail-merchant-block")).toBeVisible();
    await expect(unavailablePage.getByTestId("post-detail-merchant-errand-entry")).toHaveCount(0);
    await expect(unavailablePage.getByTestId("post-detail-merchant-errand-unavailable")).toBeVisible();
    const reason = unavailablePage.getByTestId("post-detail-merchant-errand-reason");
    await expect(reason).toBeVisible();
    await expect(reason).not.toHaveText("");
    if (unavailableReasonText) {
      await expect(reason).toContainText(unavailableReasonText);
    }
    await unavailableContext.close();
    await unavailableApi.dispose();
  });
});