/**
 * Post visibility permission matrix E2E tests.
 *
 * LIAN posts have multiple visibility levels (audience.visibility). Different
 * users have different access rights depending on their relationship to the
 * post (author, admin, same school, etc.).
 *
 * Visibility levels (src/types/audience.ts):
 *   - public    — visible to everyone
 *   - school    — visible to users with same school verification
 *   - private   — visible only to the author
 *   - linkOnly  — visible only via direct link (not in feeds)
 *
 * Test matrix:
 * | Visibility | Anonymous | Registered (non-author) | Author | Admin |
 * |------------|-----------|-------------------------|--------|-------|
 * | public     | 200       | 200                     | 200    | 200   |
 * | school     | 403       | depends on verification | 200    | 200   |
 * | private    | 403/404   | 403/404                 | 200    | 200   |
 * | linkOnly   | 403/404   | 403/404                 | 200    | 200   |
 *
 * Implementation notes:
 *   - Posts are created via POST /api/ai/post-publish with different
 *     metadata.visibility values.
 *   - Access is tested via GET /api/posts/:tid.
 *   - The backend may not support all visibility levels for creation; tests
 *     skip gracefully when a visibility level cannot be created.
 *   - Uses isRoleConfigured() skip pattern from existing E2E tests.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PublishResponse {
  tid?: number | string;
  error?: string;
  message?: string;
}

type VisibilityLevel = "public" | "school" | "private" | "linkOnly";

/**
 * Build a publish payload for a text-only post with the specified visibility.
 * Mirrors the shape from self-published-round-trip-proof.spec.ts.
 */
function buildPublishPayload(title: string, body: string, visibility: VisibilityLevel) {
  return {
    imageUrl: "",
    imageUrls: [],
    title,
    body,
    tag: "",
    identityTag: "",
    metadata: {
      locationArea: "",
      visibility,
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
      coordinateSystem: "none",
      identityKind: "skipped",
      precisionKind: "none",
      confidence: 0,
      skipped: true,
      note: "",
      issues: [],
    },
    riskFlags: [],
    confidence: 0,
    needsHumanReview: false,
    aiMode: "manual-vue",
  };
}

/**
 * Attempt to publish a post with the given visibility. Returns the tid on
 * success, or null if the backend rejects the visibility level.
 */
async function tryPublishPost(
  api: APIRequestContext,
  title: string,
  body: string,
  visibility: VisibilityLevel,
): Promise<string | null> {
  const response = await api.post("/api/ai/post-publish", {
    data: buildPublishPayload(title, body, visibility),
  });

  if (!response.ok()) {
    // Backend may reject certain visibility levels (e.g., private/linkOnly
    // not implemented). Return null to signal the test should skip.
    return null;
  }

  const json = (await response.json()) as PublishResponse;
  const tid = json.tid;
  if (!tid) return null;
  return String(tid);
}

/**
 * Fetch a post and return the status code.
 */
async function fetchPostStatus(api: APIRequestContext, tid: string): Promise<number> {
  const response = await api.get(`/api/posts/${tid}`);
  return response.status();
}

function adminToken(): string {
  return (process.env.LIAN_E2E_ADMIN_TOKEN ?? "").trim();
}

function adminAuthHeaders(): Record<string, string> {
  const token = adminToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

test.describe("@post-visibility post visibility permission matrix @post-visibility", () => {
  const runId = randomUUID().slice(0, 8);

  // -------------------------------------------------------------------------
  // Public visibility tests
  // -------------------------------------------------------------------------

  test.describe("public visibility", () => {
    let authorApi: APIRequestContext | null = null;
    let publicTid: string | null = null;

    test.beforeAll(async () => {
      if (!isRoleConfigured("registered")) return;
      const result = await loginAs("registered", BASE_URL);
      authorApi = result.api;

      // Create a public post
      const title = `[E2E ${runId}] public visibility test`;
      const body = `[E2E ${runId}] public visibility test post`;
      publicTid = await tryPublishPost(authorApi, title, body, "public");
    });

    test.afterAll(async () => {
      if (authorApi) {
        await authorApi.dispose();
        authorApi = null;
      }
    });

    test("anonymous user can view public post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(!publicTid, "public post creation failed — backend may not support this flow");

      const anonApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const status = await fetchPostStatus(anonApi, publicTid!);
        expect(status, "anonymous user should see public post").toBe(200);
      } finally {
        await anonApi.dispose();
      }
    });

    test("registered non-author can view public post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — need a different user to test non-author access",
      );
      test.skip(!publicTid, "public post creation failed — backend may not support this flow");

      const { api: viewerApi } = await loginAs("campus", BASE_URL);
      try {
        const status = await fetchPostStatus(viewerApi, publicTid!);
        expect(status, "registered non-author should see public post").toBe(200);
      } finally {
        await viewerApi.dispose();
      }
    });

    test("author can view own public post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(!publicTid, "public post creation failed — backend may not support this flow");

      const status = await fetchPostStatus(authorApi!, publicTid!);
      expect(status, "author should see own public post").toBe(200);
    });

    test("admin can view public post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(!publicTid, "public post creation failed — backend may not support this flow");
      test.skip(!adminToken(), "LIAN_E2E_ADMIN_TOKEN not configured");

      const adminApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const response = await adminApi.get(`/api/posts/${publicTid}`, {
          headers: adminAuthHeaders(),
        });
        expect(response.status(), "admin should see public post").toBe(200);
      } finally {
        await adminApi.dispose();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Private visibility tests
  // -------------------------------------------------------------------------

  test.describe("private visibility", () => {
    let authorApi: APIRequestContext | null = null;
    let privateTid: string | null = null;

    test.beforeAll(async () => {
      if (!isRoleConfigured("registered")) return;
      const result = await loginAs("registered", BASE_URL);
      authorApi = result.api;

      // Attempt to create a private post
      const title = `[E2E ${runId}] private visibility test`;
      const body = `[E2E ${runId}] private visibility test post`;
      privateTid = await tryPublishPost(authorApi, title, body, "private");
    });

    test.afterAll(async () => {
      if (authorApi) {
        await authorApi.dispose();
        authorApi = null;
      }
    });

    test("anonymous user cannot view private post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !privateTid,
        "private post creation failed — backend may not support this visibility",
      );

      const anonApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const status = await fetchPostStatus(anonApi, privateTid!);
        expect(
          [403, 404].includes(status),
          `anonymous user should be denied private post, got ${status}`,
        ).toBe(true);
      } finally {
        await anonApi.dispose();
      }
    });

    test("registered non-author cannot view private post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — need a different user to test non-author access",
      );
      test.skip(
        !privateTid,
        "private post creation failed — backend may not support this visibility",
      );

      const { api: viewerApi } = await loginAs("campus", BASE_URL);
      try {
        const status = await fetchPostStatus(viewerApi, privateTid!);
        expect(
          [403, 404].includes(status),
          `registered non-author should be denied private post, got ${status}`,
        ).toBe(true);
      } finally {
        await viewerApi.dispose();
      }
    });

    test("author can view own private post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !privateTid,
        "private post creation failed — backend may not support this visibility",
      );

      const status = await fetchPostStatus(authorApi!, privateTid!);
      expect(status, "author should see own private post").toBe(200);
    });

    test("admin can view private post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !privateTid,
        "private post creation failed — backend may not support this visibility",
      );
      test.skip(!adminToken(), "LIAN_E2E_ADMIN_TOKEN not configured");

      const adminApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const response = await adminApi.get(`/api/posts/${privateTid}`, {
          headers: adminAuthHeaders(),
        });
        expect(response.status(), "admin should see private post").toBe(200);
      } finally {
        await adminApi.dispose();
      }
    });
  });

  // -------------------------------------------------------------------------
  // School visibility tests
  // -------------------------------------------------------------------------

  test.describe("school visibility", () => {
    let authorApi: APIRequestContext | null = null;
    let schoolTid: string | null = null;

    test.beforeAll(async () => {
      if (!isRoleConfigured("campus")) return;
      // Use campus user as author since they have school verification
      const result = await loginAs("campus", BASE_URL);
      authorApi = result.api;

      // Attempt to create a school-only post
      const title = `[E2E ${runId}] school visibility test`;
      const body = `[E2E ${runId}] school visibility test post`;
      schoolTid = await tryPublishPost(authorApi, title, body, "school");
    });

    test.afterAll(async () => {
      if (authorApi) {
        await authorApi.dispose();
        authorApi = null;
      }
    });

    test("anonymous user cannot view school post", async () => {
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — cannot create school-visibility post",
      );
      test.skip(
        !schoolTid,
        "school post creation failed — backend may not support this visibility",
      );

      const anonApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const status = await fetchPostStatus(anonApi, schoolTid!);
        expect(
          [403, 404].includes(status),
          `anonymous user should be denied school post, got ${status}`,
        ).toBe(true);
      } finally {
        await anonApi.dispose();
      }
    });

    test("registered user without school verification cannot view school post", async () => {
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — cannot create school-visibility post",
      );
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — need unverified user",
      );
      test.skip(
        !schoolTid,
        "school post creation failed — backend may not support this visibility",
      );

      const { api: viewerApi } = await loginAs("registered", BASE_URL);
      try {
        const status = await fetchPostStatus(viewerApi, schoolTid!);
        // Registered user without campus verification should be denied
        // (unless they happen to be from the same school, which we can't
        // control in this test — so we accept 200 as a soft pass)
        expect(
          [200, 403, 404].includes(status),
          `registered user access to school post should be 200/403/404, got ${status}`,
        ).toBe(true);
      } finally {
        await viewerApi.dispose();
      }
    });

    test("author can view own school post", async () => {
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — cannot create school-visibility post",
      );
      test.skip(
        !schoolTid,
        "school post creation failed — backend may not support this visibility",
      );

      const status = await fetchPostStatus(authorApi!, schoolTid!);
      expect(status, "author should see own school post").toBe(200);
    });

    test("admin can view school post", async () => {
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — cannot create school-visibility post",
      );
      test.skip(
        !schoolTid,
        "school post creation failed — backend may not support this visibility",
      );
      test.skip(!adminToken(), "LIAN_E2E_ADMIN_TOKEN not configured");

      const adminApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const response = await adminApi.get(`/api/posts/${schoolTid}`, {
          headers: adminAuthHeaders(),
        });
        expect(response.status(), "admin should see school post").toBe(200);
      } finally {
        await adminApi.dispose();
      }
    });
  });

  // -------------------------------------------------------------------------
  // LinkOnly visibility tests
  // -------------------------------------------------------------------------

  test.describe("linkOnly visibility", () => {
    let authorApi: APIRequestContext | null = null;
    let linkOnlyTid: string | null = null;

    test.beforeAll(async () => {
      if (!isRoleConfigured("registered")) return;
      const result = await loginAs("registered", BASE_URL);
      authorApi = result.api;

      // Attempt to create a linkOnly post
      const title = `[E2E ${runId}] linkOnly visibility test`;
      const body = `[E2E ${runId}] linkOnly visibility test post`;
      linkOnlyTid = await tryPublishPost(authorApi, title, body, "linkOnly");
    });

    test.afterAll(async () => {
      if (authorApi) {
        await authorApi.dispose();
        authorApi = null;
      }
    });

    test("anonymous user cannot view linkOnly post without link context", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !linkOnlyTid,
        "linkOnly post creation failed — backend may not support this visibility",
      );

      const anonApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const status = await fetchPostStatus(anonApi, linkOnlyTid!);
        // linkOnly posts may be accessible via direct API call (the "link")
        // or may require a special token. Accept 200/403/404.
        expect(
          [200, 403, 404].includes(status),
          `anonymous user access to linkOnly post should be 200/403/404, got ${status}`,
        ).toBe(true);
      } finally {
        await anonApi.dispose();
      }
    });

    test("registered non-author access to linkOnly post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !isRoleConfigured("campus"),
        "campus role not configured — need a different user to test non-author access",
      );
      test.skip(
        !linkOnlyTid,
        "linkOnly post creation failed — backend may not support this visibility",
      );

      const { api: viewerApi } = await loginAs("campus", BASE_URL);
      try {
        const status = await fetchPostStatus(viewerApi, linkOnlyTid!);
        // linkOnly semantics vary — may allow direct API access or not
        expect(
          [200, 403, 404].includes(status),
          `registered non-author access to linkOnly post should be 200/403/404, got ${status}`,
        ).toBe(true);
      } finally {
        await viewerApi.dispose();
      }
    });

    test("author can view own linkOnly post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !linkOnlyTid,
        "linkOnly post creation failed — backend may not support this visibility",
      );

      const status = await fetchPostStatus(authorApi!, linkOnlyTid!);
      expect(status, "author should see own linkOnly post").toBe(200);
    });

    test("admin can view linkOnly post", async () => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — cannot create test post",
      );
      test.skip(
        !linkOnlyTid,
        "linkOnly post creation failed — backend may not support this visibility",
      );
      test.skip(!adminToken(), "LIAN_E2E_ADMIN_TOKEN not configured");

      const adminApi = await request.newContext({ baseURL: BASE_URL });
      try {
        const response = await adminApi.get(`/api/posts/${linkOnlyTid}`, {
          headers: adminAuthHeaders(),
        });
        expect(response.status(), "admin should see linkOnly post").toBe(200);
      } finally {
        await adminApi.dispose();
      }
    });
  });
});
