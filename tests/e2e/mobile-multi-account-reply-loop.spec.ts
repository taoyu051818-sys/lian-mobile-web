import { devices, expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";
const MOBILE_DEVICE = devices["iPhone 13"];

interface FeedItem {
  tid?: number | string;
  title?: string;
  cover?: string;
  cardTemplate?: string;
}

interface FeedResponse {
  items?: FeedItem[];
}

interface PublishResponse {
  tid?: number | string;
}

interface PostDetailResponse {
  tid?: number | string;
  title?: string;
  liked?: boolean;
  likeCount?: number;
}

async function firstReusableImage(api: APIRequestContext): Promise<string> {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const imageItem = body.items?.find(
    (item) => item.cover && (item.cardTemplate === "image" || !item.cardTemplate),
  );
  expect(imageItem?.cover, "nat100 feed must expose at least one reusable cover URL").toBeTruthy();
  return imageItem!.cover!;
}

function buildPublishPayload(imageUrl: string, title: string, body: string) {
  return {
    imageUrl,
    imageUrls: [imageUrl],
    title,
    body,
    tag: "",
    identityTag: "",
    metadata: {
      locationArea: "",
      visibility: "public",
      distribution: ["home", "search", "detail"],
      primaryTag: "",
      identityTag: "",
    },
    locationDraft: {
      source: "skipped",
      locationId: "",
      locationArea: "",
      displayName: "",
      lat: null,
      lng: null,
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "manual",
      confidence: 0,
      skipped: true,
      note: "",
    },
    riskFlags: [],
    confidence: 0,
    needsHumanReview: false,
    aiMode: "manual-vue",
  };
}

async function publishImagePost(
  api: APIRequestContext,
  imageUrl: string,
  title: string,
  body: string,
) {
  const response = await api.post("/api/ai/post-publish", {
    data: buildPublishPayload(imageUrl, title, body),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const json = (await response.json()) as PublishResponse;
  expect(json.tid, "publish response must carry tid").toBeTruthy();
  return String(json.tid);
}

async function fetchPostDetail(api: APIRequestContext, tid: string): Promise<PostDetailResponse> {
  const response = await api.get(`/api/posts/${tid}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as PostDetailResponse;
}

async function openMobilePage(browser: Browser, api: APIRequestContext) {
  const context = await browser.newContext({
    ...MOBILE_DEVICE,
    storageState: await api.storageState(),
  });
  const page = await context.newPage();
  return { context, page };
}

function parseCount(text: string | null | undefined): number {
  const normalized = (text ?? "").replace(/[^\d]/g, "").trim();
  return Number(normalized || "0");
}

async function readDockLikeCount(page: {
  locator(selector: string): { first(): { innerText(): Promise<string> } };
}): Promise<number> {
  const text = await page.locator(".post-reply-dock__action-count").first().innerText();
  return parseCount(text);
}

test.describe
  .serial("@registered @multi-user @mobile @starter mobile multi-account closures", () => {
  test("registered author -> campus like -> author sees like count in mobile detail and profile liked remains stable", async ({
    browser,
  }, testInfo) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    const runId = randomUUID().slice(0, 8);
    const title = `[E2E ${runId}] mobile multi-account like loop`;
    const body = `[E2E ${runId}] author post for mobile multi-account like loop`;

    const { api: authorApi } = await loginAs("registered", BASE_URL);
    const { api: responderApi } = await loginAs("campus", BASE_URL);

    let authorContext: Awaited<ReturnType<typeof openMobilePage>>["context"] | null = null;
    let responderContext: Awaited<ReturnType<typeof openMobilePage>>["context"] | null = null;

    try {
      const imageUrl = await firstReusableImage(authorApi);
      const tid = await publishImagePost(authorApi, imageUrl, title, body);
      const initialDetail = await fetchPostDetail(authorApi, tid);
      expect(`${initialDetail.title ?? ""}\n${body}`).toContain(`[E2E ${runId}]`);

      const authorSession = await openMobilePage(browser, authorApi);
      authorContext = authorSession.context;
      const authorPage = authorSession.page;
      await authorPage.goto(`${BASE_URL}/#/post/${tid}`);
      await expect(authorPage.locator("#post-detail-title")).toContainText(`[E2E ${runId}]`);
      await expect(authorPage.locator(".post-reply-dock")).toBeVisible();
      await attachStepScreenshot(authorPage, testInfo, "01-author-detail-before-like-mobile");

      const responderSession = await openMobilePage(browser, responderApi);
      responderContext = responderSession.context;
      const responderPage = responderSession.page;
      await responderPage.goto(`${BASE_URL}/#/post/${tid}`);
      await expect(responderPage.locator("#post-detail-title")).toContainText(`[E2E ${runId}]`);
      await attachStepScreenshot(responderPage, testInfo, "02-campus-open-post-mobile");

      const responderLikeButton = responderPage.locator(".post-reply-dock__action").first();
      await expect(responderLikeButton).toBeVisible();
      const initialLikeCount = await readDockLikeCount(responderPage);
      await responderLikeButton.click();
      await expect
        .poll(
          async () => {
            const detail = await fetchPostDetail(authorApi, tid);
            return Number(detail.likeCount ?? 0);
          },
          {
            timeout: 25000,
            intervals: [500, 1000, 2000],
            message: `post ${tid} likeCount should increase after campus like`,
          },
        )
        .toBeGreaterThanOrEqual(initialLikeCount + 1);

      await expect
        .poll(
          async () => {
            await authorPage.reload();
            await expect(authorPage.locator("#post-detail-title")).toContainText(`[E2E ${runId}]`);
            return readDockLikeCount(authorPage);
          },
          {
            timeout: 25000,
            intervals: [1000, 2000, 3000],
            message: `author detail should reflect campus like for post ${tid}`,
          },
        )
        .toBeGreaterThanOrEqual(initialLikeCount + 1);
      await attachStepScreenshot(authorPage, testInfo, "03-author-sees-campus-like-mobile");

      await authorPage.goto(`${BASE_URL}/#/profile`);
      await expect(authorPage.locator(".profile-view")).toBeVisible();
      await authorPage.locator(".profile-tabs").scrollIntoViewIfNeeded();
      const likedTab = authorPage.getByRole("tab", { name: "赞过" });
      await expect(likedTab).toBeVisible();
      await likedTab.click();
      await expect(authorPage.locator(".profile-collection, .profile-view__state")).toBeVisible();
      await attachStepScreenshot(authorPage, testInfo, "04-author-liked-tab-mobile");
    } finally {
      if (responderContext) await responderContext.close();
      if (authorContext) await authorContext.close();
      await responderApi.dispose();
      await authorApi.dispose();
    }
  });

  test("registered mobile profile liked/saved collections and anonymous detail access stay stable on an existing public post", async ({
    browser,
  }, testInfo) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api } = await loginAs("registered", BASE_URL);
    let context: Awaited<ReturnType<typeof openMobilePage>>["context"] | null = null;

    try {
      const profileSession = await openMobilePage(browser, api);
      context = profileSession.context;
      const page = profileSession.page;

      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view")).toBeVisible();
      await page.locator(".profile-tabs").scrollIntoViewIfNeeded();

      const likedTab = page.getByRole("tab", { name: "赞过" });
      await likedTab.click();
      await expect(page.locator(".profile-collection__item").first()).toBeVisible();
      const likedTitle = (
        (await page.locator(".profile-collection__item h3").first().innerText()) || ""
      ).trim();
      expect(likedTitle.length).toBeGreaterThan(0);
      await attachStepScreenshot(page, testInfo, "05-profile-liked-mobile");

      const savedTab = page.getByRole("tab", { name: "收藏" });
      await savedTab.click();
      await expect(page.locator(".profile-collection__item").first()).toBeVisible();
      const savedTitle = (
        (await page.locator(".profile-collection__item h3").first().innerText()) || ""
      ).trim();
      expect(savedTitle.length).toBeGreaterThan(0);
      await attachStepScreenshot(page, testInfo, "06-profile-saved-mobile");

      const detailTid =
        (await page.locator(".profile-collection__item").first().getAttribute("data-tid")) || "";
      expect(detailTid).toMatch(/^\d+$/);

      await context.close();
      context = null;
      await api.dispose();

      const anonymousContext = await browser.newContext({
        ...MOBILE_DEVICE,
      });
      const anonymousPage = await anonymousContext.newPage();
      try {
        await anonymousPage.goto(`${BASE_URL}/#/post/${detailTid}`);
        await expect(anonymousPage.locator("#post-detail-title")).toContainText(
          savedTitle || likedTitle,
        );
        await attachStepScreenshot(
          anonymousPage,
          testInfo,
          "07-anonymous-detail-from-profile-mobile",
        );
      } finally {
        await anonymousContext.close();
      }
    } finally {
      if (context) await context.close();
      await api.dispose().catch(() => undefined);
    }
  });
});
