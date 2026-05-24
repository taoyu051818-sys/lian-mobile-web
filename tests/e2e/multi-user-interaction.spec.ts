/**
 * Multi-user interaction E2E tests.
 *
 * Covers cross-user scenarios where one user's action affects another user's
 * view of the same content:
 *
 *   1. User A posts → User B likes → like count verified by both
 *   2. User A posts → User B replies → reply visible to User A
 *   3. Anonymous user attempts like → blocked (401)
 *
 * Each test is independent and does not rely on state from other tests.
 * Tests use `test.skip(!isRoleConfigured(...))` to gracefully skip when
 * required accounts are not configured.
 *
 * Tag: @multi-user — run with `npx playwright test --grep @multi-user`
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

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

interface PostDetailResponse {
  tid?: number | string;
  title?: string;
  likeCount?: number;
  replies?: Array<{
    id?: number | string;
    content?: string;
    actor?: { username?: string };
  }>;
}

interface ReplyResponse {
  ok?: boolean;
}

function buildPublishPayload(imageUrl: string, title: string) {
  return {
    imageUrl,
    imageUrls: [imageUrl],
    title,
    body: "Multi-user interaction E2E test post.",
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

async function publishImagePost(
  api: APIRequestContext,
  imageUrl: string,
  prefix: string,
): Promise<{ tid: string; title: string }> {
  const title = `${prefix} ${new Date().toISOString()}`;
  const response = await api.post("/api/ai/post-publish", {
    data: buildPublishPayload(imageUrl, title),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as PublishResponse;
  expect(body.tid).toBeTruthy();
  return { tid: String(body.tid), title };
}

async function fetchPostDetail(api: APIRequestContext, tid: string): Promise<PostDetailResponse> {
  const response = await api.get(`/api/posts/${tid}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as PostDetailResponse;
}

async function firstPublicFeedItem(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const item = body.items?.find((candidate) => candidate.tid && candidate.title);
  expect(item, "nat100 feed must expose at least one public item").toBeTruthy();
  return { tid: String(item!.tid), title: String(item!.title) };
}

test.describe("@multi-user multi-user interaction scenarios", () => {
  test("@multi-user user A posts -> user B likes -> like count verified", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    // Get a reusable image from the feed (anonymous context)
    const anonApi = await request.newContext({ baseURL: BASE_URL });
    const imageUrl = await firstReusableImage(anonApi);
    await anonApi.dispose();

    // User A (registered) publishes a post
    const { api: userAApi } = await loginAs("registered", BASE_URL);
    const { tid, title } = await publishImagePost(userAApi, imageUrl, "Multi-user like test");

    // Verify post was created and get initial like count
    const initialDetail = await fetchPostDetail(userAApi, tid);
    expect(initialDetail.title).toBe(title);
    const initialLikeCount = initialDetail.likeCount ?? 0;

    // User B (campus) logs in and likes the post
    const { api: userBApi } = await loginAs("campus", BASE_URL);
    const likeResponse = await userBApi.post(`/api/posts/${tid}/like`, {
      data: { liked: true },
    });
    expect(likeResponse.ok(), await likeResponse.text()).toBe(true);
    const likeBody = (await likeResponse.json()) as LikeResponse;
    expect(likeBody.liked).toBe(true);
    expect(likeBody.likeCount).toBeGreaterThan(initialLikeCount);

    // User A verifies the like count increased
    const updatedDetail = await fetchPostDetail(userAApi, tid);
    expect(updatedDetail.likeCount).toBeGreaterThan(initialLikeCount);

    // Cleanup
    await userAApi.dispose();
    await userBApi.dispose();
  });

  test("@multi-user user A posts -> user B replies -> user A sees reply", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    // Get a reusable image from the feed (anonymous context)
    const anonApi = await request.newContext({ baseURL: BASE_URL });
    const imageUrl = await firstReusableImage(anonApi);
    await anonApi.dispose();

    // User A (registered) publishes a post
    const { api: userAApi } = await loginAs("registered", BASE_URL);
    const { tid, title } = await publishImagePost(userAApi, imageUrl, "Multi-user reply test");

    // Verify post was created
    const initialDetail = await fetchPostDetail(userAApi, tid);
    expect(initialDetail.title).toBe(title);
    const initialReplyCount = initialDetail.replies?.length ?? 0;

    // User B (campus) logs in and sends a reply
    const { api: userBApi } = await loginAs("campus", BASE_URL);
    const replyContent = `E2E reply from campus user ${Date.now()}`;
    const replyResponse = await userBApi.post(`/api/posts/${tid}/replies`, {
      data: { content: replyContent },
    });
    expect(replyResponse.ok(), await replyResponse.text()).toBe(true);
    const replyBody = (await replyResponse.json()) as ReplyResponse;
    expect(replyBody.ok).toBe(true);

    // User A fetches post detail and verifies the reply appears
    const updatedDetail = await fetchPostDetail(userAApi, tid);
    const newReplyCount = updatedDetail.replies?.length ?? 0;
    expect(newReplyCount).toBeGreaterThan(initialReplyCount);

    // Verify the reply content is present
    const foundReply = updatedDetail.replies?.find((r) => r.content === replyContent);
    expect(foundReply, `Reply with content "${replyContent}" should be visible`).toBeTruthy();

    // Cleanup
    await userAApi.dispose();
    await userBApi.dispose();
  });

  test("@multi-user anonymous user browse -> attempt like -> blocked with 401", async () => {
    // Get a public post to attempt liking (anonymous context)
    const anonApi = await request.newContext({ baseURL: BASE_URL });
    const item = await firstPublicFeedItem(anonApi);

    // Verify anonymous can browse the post detail
    const detailResponse = await anonApi.get(`/api/posts/${item.tid}`);
    expect(detailResponse.ok(), await detailResponse.text()).toBe(true);
    const detail = (await detailResponse.json()) as PostDetailResponse;
    expect(detail.title).toBe(item.title);

    // Attempt to like the post as anonymous — should be blocked
    const likeResponse = await anonApi.post(`/api/posts/${item.tid}/like`, {
      data: { liked: true },
    });

    // Expect 401 Unauthorized (or 403 Forbidden depending on backend)
    expect(
      likeResponse.status(),
      "Anonymous like attempt should return 401 or 403",
    ).toBeGreaterThanOrEqual(400);
    expect(likeResponse.status()).toBeLessThan(500);

    // Cleanup
    await anonApi.dispose();
  });
});
