import { expect, request, test, type APIRequestContext, type Browser } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

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

interface LikeResponse {
  liked?: boolean;
  likeCount?: number;
}

interface LikedResponse {
  items?: Array<{ tid?: number | string; title?: string }>;
}

interface SavedResponse {
  items?: Array<{ tid?: number | string; title?: string }>;
}

function buildPublishPayload(imageUrl: string, title: string) {
  return {
    imageUrl,
    imageUrls: [imageUrl],
    title,
    body: "Playwright journey smoke post. This verifies login, publish, detail, like, profile, and anonymous share rendering.",
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

async function firstPublicFeedItem(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const item = body.items?.find((candidate) => candidate.tid && candidate.title);
  expect(item, "nat100 feed must expose at least one public item").toBeTruthy();
  return { tid: String(item!.tid), title: String(item!.title), cover: item!.cover || "" };
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

async function publishImagePost(api: APIRequestContext, imageUrl: string) {
  const title = `E2E journey ${new Date().toISOString()}`;
  const response = await api.post("/api/ai/post-publish", {
    data: buildPublishPayload(imageUrl, title),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as PublishResponse;
  expect(body.tid).toBeTruthy();
  return { tid: String(body.tid), title };
}

async function openAuthenticatedPage(browser: Browser, api: APIRequestContext) {
  const context = await browser.newContext({ storageState: await api.storageState() });
  const page = await context.newPage();
  return { context, page };
}

test("anonymous browse -> direct detail -> login gate surfaces public content", async ({
  browser,
}) => {
  const api = await request.newContext({ baseURL: BASE_URL });
  const item = await firstPublicFeedItem(api);
  await api.dispose();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.locator(".feed-view")).toBeVisible();
  await expect(page.locator(".feed-item-card").first()).toBeVisible();

  await page.goto(`/#/post/${item.tid}`);
  await expect(page.locator("#post-detail-title")).toContainText(item.title);
  await expect(page.locator(".post-detail-panel__state")).toHaveCount(0);
  await expect(page.getByText("详情加载失败")).toHaveCount(0);
  await expect(page.locator(".post-reply-dock")).toBeVisible();

  await page.goto("/#/profile");
  await expect(page.locator(".profile-view")).toBeVisible();

  await context.close();
});

test("login -> like/save existing post -> profile liked/saved -> anonymous share", async ({
  browser,
}) => {
  test.skip(
    !isRoleConfigured("registered"),
    "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
  );

  const anonApi = await request.newContext({ baseURL: BASE_URL });
  const item = await firstPublicFeedItem(anonApi);
  await anonApi.dispose();

  const { api } = await loginAs("registered", BASE_URL);

  const { context, page } = await openAuthenticatedPage(browser, api);
  await page.goto(`/#/post/${item.tid}`);
  await expect(page.locator("#post-detail-title")).toContainText(item.title);

  const likeResponse = await api.post(`/api/posts/${item.tid}/like`, { data: { liked: true } });
  expect(likeResponse.ok(), await likeResponse.text()).toBe(true);
  const likeBody = (await likeResponse.json()) as LikeResponse;
  expect(likeBody.liked).toBe(true);
  expect(likeBody.likeCount ?? 0).toBeGreaterThanOrEqual(1);

  const saveResponse = await api.post(`/api/posts/${item.tid}/save`, { data: { saved: true } });
  expect(saveResponse.ok(), await saveResponse.text()).toBe(true);

  await page.goto("/#/profile");
  await page.locator(".profile-tabs").scrollIntoViewIfNeeded();
  const likedTab = page.getByRole("tab", { name: "赞过" });
  await expect(likedTab).toBeVisible();
  await likedTab.click();
  await expect(page.locator(".profile-collection__item").first()).toContainText(item.title);

  const likedResponse = await api.get("/api/me/liked");
  expect(likedResponse.ok(), await likedResponse.text()).toBe(true);
  const likedBody = (await likedResponse.json()) as LikedResponse;
  expect(likedBody.items?.some((likedItem) => String(likedItem.tid) === item.tid)).toBe(true);

  const savedTab = page.getByRole("tab", { name: "收藏" });
  await expect(savedTab).toBeVisible();
  await savedTab.click();
  await expect(page.locator(".profile-collection__item").first()).toBeVisible();

  const savedResponse = await api.get("/api/me/saved");
  expect(savedResponse.ok(), await savedResponse.text()).toBe(true);
  const savedBody = (await savedResponse.json()) as SavedResponse;
  expect(savedBody.items?.some((savedItem) => String(savedItem.tid) === item.tid)).toBe(true);

  const logoutResponse = await api.post("/api/auth/logout");
  expect(logoutResponse.ok(), await logoutResponse.text()).toBe(true);
  await context.close();
  await api.dispose();

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`/#/post/${item.tid}`);
  await expect(anonymousPage.locator("#post-detail-title")).toContainText(item.title);
  await expect(anonymousPage.locator(".post-detail-panel__state")).toHaveCount(0);
  await expect(anonymousPage.getByText("详情加载失败")).toHaveCount(0);
  await anonymousContext.close();
});

test.fixme("login -> publish image -> like -> profile liked -> anonymous share", async ({
  browser,
}) => {
  const anonApi = await request.newContext({ baseURL: BASE_URL });
  const imageUrl = await firstReusableImage(anonApi);
  await anonApi.dispose();

  const { api } = await loginAs("registered", BASE_URL);

  const { context, page } = await openAuthenticatedPage(browser, api);
  await page.goto("/#/publish");
  await expect(page.locator(".publish-view")).toBeVisible();

  const { tid, title } = await publishImagePost(api, imageUrl);
  await page.goto(`/#/post/${tid}`);
  await expect(page.locator("#post-detail-title")).toContainText(title);

  const likeResponse = await api.post(`/api/posts/${tid}/like`, { data: { liked: true } });
  expect(likeResponse.ok(), await likeResponse.text()).toBe(true);
  const likeBody = (await likeResponse.json()) as LikeResponse;
  expect(likeBody.liked).toBe(true);
  expect(likeBody.likeCount ?? 0).toBeGreaterThanOrEqual(1);

  await page.goto("/#/profile");
  await page.locator(".profile-tabs").scrollIntoViewIfNeeded();
  const likedTab = page.getByRole("tab", { name: "赞过" });
  await expect(likedTab).toBeVisible();
  await likedTab.click();
  const firstLikedItem = page.locator(".profile-collection__item").first();
  await expect(firstLikedItem).toContainText(title);

  const likedResponse = await api.get("/api/me/liked");
  expect(likedResponse.ok(), await likedResponse.text()).toBe(true);
  const likedBody = (await likedResponse.json()) as LikedResponse;
  expect(String(likedBody.items?.[0]?.tid)).toBe(tid);

  const logoutResponse = await api.post("/api/auth/logout");
  expect(logoutResponse.ok(), await logoutResponse.text()).toBe(true);
  await context.close();
  await api.dispose();

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`/#/post/${tid}`);
  await expect(anonymousPage.locator("#post-detail-title")).toContainText(title);
  await expect(anonymousPage.locator(".post-detail-panel__state")).toHaveCount(0);
  await expect(anonymousPage.getByText("详情加载失败")).toHaveCount(0);
  await anonymousContext.close();
});
