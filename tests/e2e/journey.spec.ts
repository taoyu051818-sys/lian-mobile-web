import { expect, request, test, type APIRequestContext, type Browser } from "@playwright/test";

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

interface LoginResponse {
  user?: unknown;
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

function envOrThrow(name: "LIAN_E2E_USERNAME" | "LIAN_E2E_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the nat100 journey test.`);
  return value;
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

async function login(api: APIRequestContext) {
  const response = await api.post("/api/auth/login", {
    data: {
      login: envOrThrow("LIAN_E2E_USERNAME"),
      password: envOrThrow("LIAN_E2E_PASSWORD"),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as LoginResponse;
  expect(body.user).toBeTruthy();
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

test("login -> publish image -> like -> profile liked -> anonymous share", async ({ browser }) => {
  const api = await request.newContext({ baseURL: BASE_URL });
  const imageUrl = await firstReusableImage(api);
  await login(api);

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
  const likedTab = page.getByRole("tab", { name: "喜欢" });
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
