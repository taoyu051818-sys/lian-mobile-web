import { expect, type Page, type Route } from "@playwright/test";

export const LOCAL_REGISTERED_USERNAME = "e2e-registered";
export const LOCAL_REGISTERED_PASSWORD = process.env.LIAN_E2E_SEED_PASSWORD ?? "local-e2e-password";
export const LOCAL_POST_TID = 99;
export const LOCAL_PUBLISHED_TID = 700_001;
export const LOCAL_POST_TITLE = "本地确定性校园帖子";
export const LOCAL_PUBLISHED_TITLE = "本地核心流程发布帖";
export const LOCAL_PUBLISHED_BODY = "这是一条由确定性 Playwright 核心流程发布的普通帖子。";

const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

const REGISTERED_USER = {
  id: "e2e-registered-001",
  username: LOCAL_REGISTERED_USERNAME,
  displayName: "本地注册用户",
  institution: "中国传媒大学海南国际学院",
  tags: [],
  verificationTags: [],
  roleIds: [],
  aliases: [],
  identityTags: [],
  status: "active",
};

const FEED_ITEM = {
  tid: LOCAL_POST_TID,
  title: LOCAL_POST_TITLE,
  bodyPreview: "固定信息流正文预览",
  contentType: "text",
  presentationIntent: "text",
  cardTemplate: "text",
  cover: "",
  imageUrls: [],
  primaryTag: "",
  timeLabel: "固定时间",
  timestampISO: FIXED_TIMESTAMP,
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "中国传媒大学",
  relations: [],
  availableActions: [],
};

function postDetail(tid: number, title: string, body: string) {
  return {
    ...FEED_ITEM,
    tid,
    title,
    body,
    content: body,
    contentHtml: `<p>${body}</p>`,
    replies: [],
  };
}

export interface LocalCoreApiState {
  authenticated: boolean;
  authProbeCount: number;
  loginCount: number;
  publishCount: number;
  published: boolean;
  unexpectedRequests: string[];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

export async function installLocalCoreApi(page: Page): Promise<LocalCoreApiState> {
  const state: LocalCoreApiState = {
    authenticated: false,
    authProbeCount: 0,
    loginCount: 0,
    publishCount: 0,
    published: false,
    unexpectedRequests: [],
  };

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/auth/me" && method === "GET") {
      state.authProbeCount += 1;
      return json(route, { user: state.authenticated ? REGISTERED_USER : null });
    }
    if (path === "/api/auth/rules" && method === "GET") {
      return json(route, { institutions: [], interests: [], interestsRequired: false });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const payload = request.postDataJSON() as { login?: string; password?: string };
      state.loginCount += 1;
      if (
        payload.login !== LOCAL_REGISTERED_USERNAME ||
        payload.password !== LOCAL_REGISTERED_PASSWORD
      ) {
        return json(route, { error: "email or password is incorrect" }, 401);
      }
      state.authenticated = true;
      return json(route, { user: REGISTERED_USER });
    }
    if (path === "/api/feed" && method === "GET") {
      return json(route, {
        tabs: [{ id: "此刻", label: "此刻" }],
        items: [FEED_ITEM],
        hasMore: false,
        nextPage: null,
      });
    }
    if (path === `/api/posts/${LOCAL_POST_TID}` && method === "GET") {
      return json(route, postDetail(LOCAL_POST_TID, LOCAL_POST_TITLE, "固定帖子详情正文"));
    }
    if (path === `/api/posts/${LOCAL_PUBLISHED_TID}` && method === "GET" && state.published) {
      return json(
        route,
        postDetail(LOCAL_PUBLISHED_TID, LOCAL_PUBLISHED_TITLE, LOCAL_PUBLISHED_BODY),
      );
    }
    if (path === "/api/audience/options" && method === "GET") {
      return json(route, { options: [{ visibility: "public", label: "公开", disabled: false }] });
    }
    if (path === "/api/map/v2/items" && method === "GET") {
      return json(route, { items: [], layers: [] });
    }
    if (path === "/api/ai/post-preview" && method === "POST") {
      return json(route, {
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: null,
          inferredKind: "text",
          suggestedComponents: [],
        },
        riskFlags: [],
      });
    }
    if (path === "/api/ai/post-publish" && method === "POST") {
      const payload = request.postDataJSON() as { title?: string; body?: string };
      expect(payload.title).toBe(LOCAL_PUBLISHED_TITLE);
      expect(payload.body).toBe(LOCAL_PUBLISHED_BODY);
      state.publishCount += 1;
      state.published = true;
      return json(route, { tid: LOCAL_PUBLISHED_TID, place: null });
    }
    if (path === "/api/fixtures/readiness" && method === "GET") {
      return json(route, {
        ok: true,
        contract: {
          version: 1,
          environment: "local",
          actors: { registered: { username: LOCAL_REGISTERED_USERNAME } },
          resources: { post: { tid: LOCAL_POST_TID } },
        },
      });
    }
    if (path.startsWith("/api/me/") || path === "/api/me") {
      if (!state.authenticated) return json(route, { error: "login required" }, 401);
      if (path === "/api/me/settings") return json(route, {});
      if (path === "/api/me/stats") {
        return json(route, { posts: 0, replies: 0, saved: 0, liked: 0, contribution: 0 });
      }
      if (path === "/api/me/rewards") return json(route, { items: [] });
      return json(route, { items: [], total: 0, hasMore: false });
    }
    if (path === "/api/wallet/me") return json(route, { available: 0, locked: 0, total: 0 });
    if (path === "/api/identity/actors") return json(route, { actors: [] });
    if (path === "/api/notifications/serverchan/binding" && method === "GET") {
      return json(route, { bound: false, enabled: false });
    }

    const key = `${method} ${path}`;
    state.unexpectedRequests.push(key);
    return json(route, { error: `unexpected local fixture request: ${key}` }, 500);
  });

  return state;
}

export async function loginThroughUi(page: Page, state: LocalCoreApiState) {
  await page.goto("/#/profile");
  const authPanel = page.locator(".auth-panel");
  await expect(authPanel).toBeVisible();
  await authPanel.locator('input[autocomplete="username"]').fill(LOCAL_REGISTERED_USERNAME);
  await authPanel.locator('input[type="password"]').fill(LOCAL_REGISTERED_PASSWORD);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await authPanel.locator('button[type="submit"]').click();
  await expect((await loginResponse).ok()).toBe(true);
  await expect(authPanel).toHaveCount(0);
  expect(state.authenticated).toBe(true);
  expect(state.loginCount).toBe(1);
}

export function expectNoUnexpectedApiRequests(state: LocalCoreApiState) {
  expect(state.unexpectedRequests).toEqual([]);
}
