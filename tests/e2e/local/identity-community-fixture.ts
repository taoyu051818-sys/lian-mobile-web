import { expect, type Page, type Route } from "@playwright/test";

export const TOPIC_ID = 77;
export const REPLY_PID = 901;
export const REPLY_BODY = "B 在同一浏览器里回复 A，身份必须保持为 Bob。";
export const A_REPLY_NOTIFICATION_ID = `new_post:tid:${TOPIC_ID}:pid:${REPLY_PID}:uid:202`;
export const REPLY_NOTIFICATION_TITLE = "Bob 回复了你的隔离测试帖";
export const B_ONLY_NOTIFICATION_TITLE = "B 专属旧回复通知";

const FIXED_TIMESTAMP = "2026-08-24T01:02:03.000Z";
const PASSWORD = "local-identity-password";

type AccountKey = "a" | "b";

const USERS = {
  a: {
    id: "user-a",
    username: "alice",
    displayName: "Alice",
    nodebbUid: 101,
    institution: "LIAN Hermetic School",
    tags: [],
    verificationTags: [],
    roleIds: [],
    aliases: [],
    identityTags: [],
    status: "active",
  },
  b: {
    id: "user-b",
    username: "bob",
    displayName: "Bob",
    nodebbUid: 202,
    institution: "LIAN Hermetic School",
    tags: [],
    verificationTags: [],
    roleIds: [],
    aliases: [],
    identityTags: [],
    status: "active",
  },
} as const;

interface FixtureNotification {
  id: string;
  source: "nodebb";
  tid: number;
  pid: number;
  type: "new-reply";
  title: string;
  excerpt: string;
  actor: { id: string; username: string; displayName: string };
  read: boolean;
  timestampISO: string;
}

export interface IdentityCommunityApiState {
  activeAccount: AccountKey | null;
  loginWrites: AccountKey[];
  logoutWrites: AccountKey[];
  replyWrites: Array<{ account: AccountKey; content: string }>;
  readWrites: Array<{
    account: AccountKey;
    notificationId: string;
    source: string;
  }>;
  replies: Array<{
    id: number;
    content: string;
    actor: { id: string; username: string; displayName: string };
    timestampISO: string;
  }>;
  notifications: Record<AccountKey, FixtureNotification[]>;
  unexpectedRequests: string[];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function profileList() {
  return { items: [], total: 0, hasMore: false };
}

function postDetail(state: IdentityCommunityApiState) {
  return {
    tid: TOPIC_ID,
    title: "Alice 的隔离测试帖",
    body: "只有 B 回复后，A 的 NodeBB 收件箱才会出现回复通知。",
    content: "只有 B 回复后，A 的 NodeBB 收件箱才会出现回复通知。",
    contentHtml: "<p>只有 B 回复后，A 的 NodeBB 收件箱才会出现回复通知。</p>",
    contentType: "text",
    presentationIntent: "text",
    actor: { id: USERS.a.id, username: USERS.a.username, displayName: USERS.a.displayName },
    liked: false,
    bookmarked: false,
    likeCount: 0,
    timestampISO: FIXED_TIMESTAMP,
    timeLabel: "固定时间",
    replies: state.replies,
    relations: [],
    availableActions: [],
  };
}

function accountForLogin(login: string | undefined): AccountKey | null {
  if (login === USERS.a.username) return "a";
  if (login === USERS.b.username) return "b";
  return null;
}

export async function installIdentityCommunityApi(page: Page): Promise<IdentityCommunityApiState> {
  const state: IdentityCommunityApiState = {
    activeAccount: null,
    loginWrites: [],
    logoutWrites: [],
    replyWrites: [],
    readWrites: [],
    replies: [],
    notifications: {
      a: [],
      b: [
        {
          id: "new_post:tid:88:pid:700:uid:101",
          source: "nodebb",
          tid: 88,
          pid: 700,
          type: "new-reply",
          title: B_ONLY_NOTIFICATION_TITLE,
          excerpt: "这条通知只能属于 B。",
          actor: { id: USERS.a.id, username: USERS.a.username, displayName: USERS.a.displayName },
          read: false,
          timestampISO: "2026-08-23T01:02:03.000Z",
        },
      ],
    },
    unexpectedRequests: [],
  };

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/auth/me" && method === "GET") {
      return json(route, { user: state.activeAccount ? USERS[state.activeAccount] : null });
    }
    if (path === "/api/auth/rules" && method === "GET") {
      return json(route, { institutions: [], interests: [], interestsRequired: false });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const payload = request.postDataJSON() as { login?: string; password?: string };
      const account = accountForLogin(payload.login);
      if (!account || payload.password !== PASSWORD) {
        return json(route, { error: "email or password is incorrect" }, 401);
      }
      state.activeAccount = account;
      state.loginWrites.push(account);
      return json(route, { user: USERS[account] });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      if (!state.activeAccount) return json(route, { error: "login required" }, 401);
      state.logoutWrites.push(state.activeAccount);
      state.activeAccount = null;
      return json(route, { ok: true });
    }

    if (path === `/api/posts/${TOPIC_ID}` && method === "GET") {
      return json(route, postDetail(state));
    }
    if (path === `/api/posts/${TOPIC_ID}/replies` && method === "POST") {
      if (state.activeAccount !== "b") {
        return json(route, { error: "reply actor must be B" }, 403);
      }
      const payload = request.postDataJSON() as { content?: string };
      const content = String(payload.content || "");
      state.replyWrites.push({ account: state.activeAccount, content });
      state.replies = [
        {
          id: REPLY_PID,
          content,
          actor: { id: USERS.b.id, username: USERS.b.username, displayName: USERS.b.displayName },
          timestampISO: FIXED_TIMESTAMP,
        },
      ];
      if (!state.notifications.a.some((item) => item.id === A_REPLY_NOTIFICATION_ID)) {
        state.notifications.a.unshift({
          id: A_REPLY_NOTIFICATION_ID,
          source: "nodebb",
          tid: TOPIC_ID,
          pid: REPLY_PID,
          type: "new-reply",
          title: REPLY_NOTIFICATION_TITLE,
          excerpt: content,
          actor: { id: USERS.b.id, username: USERS.b.username, displayName: USERS.b.displayName },
          read: false,
          timestampISO: FIXED_TIMESTAMP,
        });
      }
      return json(route, { ok: true, tid: TOPIC_ID, pid: REPLY_PID });
    }

    if (path === "/api/messages" && method === "GET") {
      if (!state.activeAccount) return json(route, { error: "login required" }, 401);
      const items = state.notifications[state.activeAccount];
      return json(route, { items, hasMore: false, nextOffset: items.length });
    }
    const readMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (readMatch && method === "POST") {
      if (!state.activeAccount) return json(route, { error: "login required" }, 401);
      const notificationId = decodeURIComponent(readMatch[1]);
      const source = url.searchParams.get("source") || "";
      const item = state.notifications[state.activeAccount].find(
        (entry) => entry.id === notificationId && entry.source === source,
      );
      if (!item) return json(route, { error: "Notification not found", code: "NOT_FOUND" }, 404);
      item.read = true;
      state.readWrites.push({ account: state.activeAccount, notificationId, source });
      return json(route, { ok: true, source, item });
    }

    if (path === "/api/channel" && method === "GET") {
      return json(route, { items: [], hasMore: false, nextOffset: 0 });
    }
    if (path.startsWith("/api/me/") || path === "/api/me") {
      if (!state.activeAccount) return json(route, { error: "login required" }, 401);
      if (path === "/api/me/settings") return json(route, {});
      if (path === "/api/me/stats") {
        return json(route, { posts: 0, replies: 0, saved: 0, liked: 0, contribution: 0 });
      }
      if (path === "/api/me/rewards") return json(route, { items: [] });
      return json(route, profileList());
    }
    if (path === "/api/wallet/me" && method === "GET") {
      return json(route, { available: 0, locked: 0, total: 0 });
    }
    if (path === "/api/identity/actors" && method === "GET") {
      return json(route, { actors: [] });
    }
    if (path === "/api/notifications/serverchan/binding" && method === "GET") {
      return json(route, { bound: false, enabled: false });
    }
    if (path === "/api/notifications/serverchan/preferences" && method === "GET") {
      return json(route, { enabled: false, categories: {} });
    }

    const key = `${method} ${path}`;
    state.unexpectedRequests.push(key);
    return json(route, { error: `unexpected identity/community fixture request: ${key}` }, 500);
  });

  return state;
}

export async function loginIdentityThroughUi(page: Page, account: AccountKey) {
  await page.goto("/#/profile");
  const authPanel = page.locator(".auth-panel");
  // A cold Vite transform can keep the lazy profile route behind the shell's
  // loading state for longer than Playwright's default five-second assertion.
  await expect(authPanel).toBeVisible({ timeout: 15_000 });
  await authPanel.locator('input[autocomplete="username"]').fill(USERS[account].username);
  await authPanel.locator('input[type="password"]').fill(PASSWORD);

  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
  );
  await authPanel.locator('button[type="submit"]').click();
  await expect((await loginResponse).ok()).toBe(true);
  await expect(authPanel).toHaveCount(0);
}

export async function logoutIdentityThroughUi(page: Page, account: AccountKey) {
  await page.goto("/#/profile");
  await expect(page.locator(".shell-chrome__identity-name")).toHaveText(USERS[account].username);
  const logoutResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/logout" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect((await logoutResponse).ok()).toBe(true);
  await expect(page.locator(".auth-panel")).toBeVisible();
}

export async function openRepliesInbox(page: Page) {
  await expect(page.getByTestId("filter-state-toggle")).toBeVisible();
  const messagesResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/messages" && response.request().method() === "GET",
  );
  await page.getByTestId("filter-state-toggle").click();
  await page.locator('[data-filter-value="replies"]').click();
  await expect((await messagesResponse).ok()).toBe(true);
}

export function expectNoUnexpectedIdentityCommunityRequests(state: IdentityCommunityApiState) {
  expect(state.loginWrites).toEqual(["a", "b", "a"]);
  expect(state.logoutWrites).toEqual(["a", "b"]);
  expect(state.unexpectedRequests).toEqual([]);
}
