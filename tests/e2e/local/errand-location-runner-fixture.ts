import { expect, type Page, type Route } from "@playwright/test";
import { TERMINAL_RUNNER_SAFE_ORDER_KEYS } from "../../errand/fixtures/errand-wire-fixtures";

export const ERRAND_CREATOR_LOGIN = "errand-creator-a";
export const ERRAND_RUNNER_B_LOGIN = "errand-runner-b";
export const ERRAND_RUNNER_C_LOGIN = "errand-runner-c";
export const ERRAND_ORDINARY_LOGIN = "errand-ordinary-d";
export const ERRAND_PASSWORD = "local-errand-password";
export const ERRAND_MERCHANT_TID = 91_001;
export const ERRAND_ORDER_ID = "local-location-errand-001";
export const ERRAND_LOCATION_ID = "location-safe-building";
export const ERRAND_PLACE_ID = "place-safe-building";
export const ERRAND_POOL_TITLE = "公开跑腿任务";
export const PRIVATE_PICKUP_SENTINEL = "PRIVATE_PICKUP_WINDOW_77";
export const PRIVATE_DROPOFF_SENTINEL = "PRIVATE_DROPOFF_ROOM_901";
export const PRIVATE_NOTE_SENTINEL = "PRIVATE_NOTE_PHONE_18800000000";
export const PRIVATE_CREATOR_SENTINEL = "creator-A-private-id";
export const PRIVATE_LAT_SENTINEL = 18.401901;
export const PRIVATE_LNG_SENTINEL = 110.022901;

export const PRIVATE_SENTINELS = [
  PRIVATE_PICKUP_SENTINEL,
  PRIVATE_DROPOFF_SENTINEL,
  PRIVATE_NOTE_SENTINEL,
  PRIVATE_CREATOR_SENTINEL,
  String(PRIVATE_LAT_SENTINEL),
  String(PRIVATE_LNG_SENTINEL),
] as const;

export const RUNNER_POOL_KEYS = TERMINAL_RUNNER_SAFE_ORDER_KEYS;

export type ErrandActorKey = "creatorA" | "runnerB" | "runnerC" | "ordinaryD";
type ErrandStatus =
  "paid_locked" | "assigned" | "at_shop" | "delivering" | "delivered" | "completed" | "cancelled";

interface FixtureActor {
  key: ErrandActorKey;
  login: string;
  user: Record<string, unknown>;
}

interface HeldResponseState {
  actor: ErrandActorKey;
  method: string;
  path: string;
  started: Promise<void>;
  signalStarted: () => void;
  finished: Promise<void>;
  signalFinished: () => void;
  releasePromise: Promise<void>;
  release: () => void;
  responseTitle?: string;
}

interface ErrandFixtureOrder {
  status: ErrandStatus;
  runnerUserId?: string;
  timeline: Array<{ status: ErrandStatus; at: string; actor: "requester" | "runner" }>;
}

export interface ErrandLocationRunnerState {
  currentActor: ErrandActorKey | null;
  order: ErrandFixtureOrder | null;
  loginActors: ErrandActorKey[];
  logoutActors: ErrandActorKey[];
  createBodies: unknown[];
  transitions: string[];
  unexpectedRequests: string[];
  heldResponse: HeldResponseState | null;
}

const FIXED_AT = "2026-08-24T10:00:00.000Z";

function verificationState(tags: Array<"campus_verified" | "runner">) {
  return Object.fromEntries(tags.map((tag) => [tag, { tag, grantedAt: FIXED_AT, active: true }]));
}

const ACTORS: FixtureActor[] = [
  {
    key: "creatorA",
    login: ERRAND_CREATOR_LOGIN,
    user: {
      id: PRIVATE_CREATOR_SENTINEL,
      username: ERRAND_CREATOR_LOGIN,
      institution: "本地校园",
      status: "active",
      tags: ["campus_verified"],
      verificationTags: ["campus_verified"],
      verificationState: verificationState(["campus_verified"]),
    },
  },
  {
    key: "runnerB",
    login: ERRAND_RUNNER_B_LOGIN,
    user: {
      id: "assigned-runner-B-id",
      username: ERRAND_RUNNER_B_LOGIN,
      institution: "本地校园",
      status: "active",
      tags: ["campus_verified", "runner"],
      verificationTags: ["campus_verified", "runner"],
      verificationState: verificationState(["campus_verified", "runner"]),
    },
  },
  {
    key: "runnerC",
    login: ERRAND_RUNNER_C_LOGIN,
    user: {
      id: "other-runner-C-id",
      username: ERRAND_RUNNER_C_LOGIN,
      institution: "本地校园",
      status: "active",
      tags: ["campus_verified", "runner"],
      verificationTags: ["campus_verified", "runner"],
      verificationState: verificationState(["campus_verified", "runner"]),
    },
  },
  {
    key: "ordinaryD",
    login: ERRAND_ORDINARY_LOGIN,
    user: {
      id: "ordinary-D-id",
      username: ERRAND_ORDINARY_LOGIN,
      institution: "本地校园",
      status: "active",
      tags: ["campus_verified"],
      verificationTags: ["campus_verified"],
      verificationState: verificationState(["campus_verified"]),
    },
  },
];

function actorByKey(key: ErrandActorKey | null) {
  return ACTORS.find((actor) => actor.key === key) || null;
}

function actorByLogin(login: string) {
  return ACTORS.find((actor) => actor.login === login) || null;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function poolOrder(order: ErrandFixtureOrder) {
  const projected = {
    orderId: ERRAND_ORDER_ID,
    merchantPostId: ERRAND_MERCHANT_TID,
    state: order.status,
    status: order.status,
    title: ERRAND_POOL_TITLE,
    mode: "dedicated",
    feePoints: 3,
    rewardPoints: 5,
    totalLockedPoints: ["completed", "cancelled"].includes(order.status) ? 0 : 8,
    createdAt: FIXED_AT,
  };
  if (["completed", "cancelled"].includes(order.status)) {
    const keys = Object.keys(projected).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...TERMINAL_RUNNER_SAFE_ORDER_KEYS])) {
      throw new Error(`terminal runner wire fixture drifted: ${keys.join(",")}`);
    }
  }
  return projected;
}

function fullOrder(order: ErrandFixtureOrder) {
  return {
    ...poolOrder(order),
    creatorUserId: PRIVATE_CREATOR_SENTINEL,
    requesterUserId: PRIVATE_CREATOR_SENTINEL,
    ...(order.runnerUserId ? { runnerUserId: order.runnerUserId } : {}),
    pickupLocation: {
      placeId: "private-merchant-place",
      label: PRIVATE_PICKUP_SENTINEL,
      lat: 18.4001,
      lng: 110.0211,
    },
    dropoffLocation: {
      placeId: ERRAND_PLACE_ID,
      label: PRIVATE_DROPOFF_SENTINEL,
      lat: PRIVATE_LAT_SENTINEL,
      lng: PRIVATE_LNG_SENTINEL,
    },
    notes: PRIVATE_NOTE_SENTINEL,
    timeline: order.timeline,
  };
}

function fullDetail(order: ErrandFixtureOrder) {
  return {
    ok: true,
    order: fullOrder(order),
    timeline: order.timeline,
    notes: PRIVATE_NOTE_SENTINEL,
    createdAt: FIXED_AT,
  };
}

function safeDetail(order: ErrandFixtureOrder) {
  return {
    ok: true,
    order: poolOrder(order),
    timeline: [],
    notes: "",
    createdAt: FIXED_AT,
  };
}

function canSeeFullOrder(actor: ErrandActorKey | null, order: ErrandFixtureOrder) {
  if (actor === "creatorA") return true;
  return (
    actor === "runnerB" &&
    order.runnerUserId === "assigned-runner-B-id" &&
    order.status !== "completed" &&
    order.status !== "cancelled"
  );
}

async function fixtureResponse(
  route: Route,
  state: ErrandLocationRunnerState,
  actor: ErrandActorKey | null,
  method: string,
  path: string,
  body: unknown,
  status = 200,
) {
  const held = state.heldResponse;
  let matchedHeld: HeldResponseState | null = null;
  let responseBody = body;
  if (held && held.actor === actor && held.method === method && held.path === path) {
    matchedHeld = held;
    state.heldResponse = null;
    if (held.responseTitle) {
      const record = body && typeof body === "object" ? (body as { items?: unknown[] }) : {};
      if (Array.isArray(record.items)) {
        responseBody = {
          ...record,
          items: record.items.map((item) =>
            item && typeof item === "object"
              ? { ...(item as Record<string, unknown>), title: held.responseTitle }
              : item,
          ),
        };
      }
    }
    held.signalStarted();
    await held.releasePromise;
  }
  const result = await json(route, responseBody, status);
  matchedHeld?.signalFinished();
  return result;
}

function merchantPost() {
  return {
    tid: ERRAND_MERCHANT_TID,
    title: "本地跑腿商家",
    body: "确定性跑腿商家详情",
    contentHtml: "<p>确定性跑腿商家详情</p>",
    contentType: "merchant_food",
    presentationIntent: "merchant",
    merchant: {
      name: PRIVATE_PICKUP_SENTINEL,
      category: "food",
      hours: "10:00-20:00",
      contact: "",
      errandSupported: true,
    },
    errandEntryAvailable: true,
    timestampISO: FIXED_AT,
    timeLabel: "固定时间",
    replies: [],
    relations: [],
    availableActions: [],
  };
}

export function holdNextResponse(
  state: ErrandLocationRunnerState,
  actor: ErrandActorKey,
  method: string,
  path: string,
  responseTitle?: string,
) {
  if (state.heldResponse) throw new Error("Only one fixture response may be held at a time.");
  let signalStarted: () => void = () => undefined;
  let signalFinished: () => void = () => undefined;
  let release: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    signalFinished = resolve;
  });
  state.heldResponse = {
    actor,
    method,
    path,
    started,
    signalStarted,
    finished,
    signalFinished,
    releasePromise,
    release,
    responseTitle,
  };
  return { started, finished, release };
}

export async function installErrandLocationRunnerApi(page: Page) {
  const state: ErrandLocationRunnerState = {
    currentActor: null,
    order: null,
    loginActors: [],
    logoutActors: [],
    createBodies: [],
    transitions: [],
    unexpectedRequests: [],
    heldResponse: null,
  };

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const actorAtRequest = state.currentActor;

    if (path === "/api/auth/me" && method === "GET") {
      return fixtureResponse(route, state, actorAtRequest, method, path, {
        user: actorByKey(actorAtRequest)?.user || null,
      });
    }
    if (path === "/api/auth/rules" && method === "GET") {
      return json(route, { institutions: [], interests: [], interestsRequired: false });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const payload = request.postDataJSON() as { login?: string; password?: string };
      const actor = actorByLogin(String(payload.login || ""));
      if (!actor || payload.password !== ERRAND_PASSWORD) {
        return json(route, { error: "email or password is incorrect" }, 401);
      }
      state.currentActor = actor.key;
      state.loginActors.push(actor.key);
      return json(route, { user: actor.user });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      if (actorAtRequest) state.logoutActors.push(actorAtRequest);
      state.currentActor = null;
      return json(route, { ok: true });
    }
    if (path === "/api/feed" && method === "GET") {
      return json(route, {
        tabs: [{ id: "此刻", label: "此刻" }],
        items: [merchantPost()],
        hasMore: false,
        nextPage: null,
      });
    }
    if (path === `/api/posts/${ERRAND_MERCHANT_TID}` && method === "GET") {
      return json(route, merchantPost());
    }
    if (path === "/api/map/v2/items" && method === "GET") {
      return json(route, {
        locations: [
          {
            id: ERRAND_LOCATION_ID,
            name: PRIVATE_DROPOFF_SENTINEL,
            lat: PRIVATE_LAT_SENTINEL,
            lng: PRIVATE_LNG_SENTINEL,
            place: { id: ERRAND_PLACE_ID, name: PRIVATE_DROPOFF_SENTINEL },
          },
        ],
        layers: {},
      });
    }
    if (path === "/api/audience/options" && method === "GET") {
      return json(route, { options: [] });
    }
    if (path === "/api/wallet/me" && method === "GET") {
      if (!actorAtRequest) return json(route, { error: "login required" }, 401);
      return json(route, { points: 100, honor: 0, lockedPoints: 0 });
    }
    if (path === "/api/me/stats" && method === "GET") {
      return json(route, { posts: 0, replies: 0, saved: 0, liked: 0, contribution: 0 });
    }
    if (path === "/api/me/rewards" && method === "GET") {
      return json(route, { lifecycle: "placeholder", entries: [] });
    }
    if (path === "/api/me/settings" && method === "GET") return json(route, {});
    if (path === "/api/me/history" && method === "POST") return json(route, { items: [] });
    if (path.startsWith("/api/me/") && method === "GET") return json(route, { items: [] });
    if (path === "/api/identity/actors" && method === "GET") {
      return json(route, { actors: [] });
    }
    if (path === "/api/notifications/serverchan/binding" && method === "GET") {
      return json(route, { bound: false, enabled: false });
    }
    if (path === "/api/channel" && method === "GET") {
      return json(route, { ok: true, items: [], hasMore: false, nextOffset: 0 });
    }
    if (path === "/api/messages" && method === "GET") {
      const terminalNotification =
        actorAtRequest === "runnerB" && state.order?.status === "completed"
          ? [
              {
                id: "errand-terminal-notification",
                type: "errand-order-status",
                title: "订单已完成结算",
                excerpt: "下单方已确认完成，奖励已入账。",
                actor: { id: "system", name: "LIAN" },
                read: false,
                timestampISO: FIXED_AT,
                data: {
                  orderId: ERRAND_ORDER_ID,
                  merchantPostId: String(ERRAND_MERCHANT_TID),
                  status: "completed",
                  previousStatus: "delivered",
                  targetType: "errand-order",
                },
              },
            ]
          : [];
      return json(route, {
        ok: true,
        items: terminalNotification,
        sources: ["lian", "nodebb"],
        pagination: {
          limit: Number(url.searchParams.get("limit") || 30),
          offset: Number(url.searchParams.get("offset") || 0),
          lianCount: terminalNotification.length,
          lianHasMore: false,
        },
      });
    }
    if (/^\/api\/notifications\/[A-Za-z0-9:._-]+\/read$/.test(path) && method === "POST") {
      return json(route, { ok: true });
    }
    if (path === "/api/errands/orders/eligibility" && method === "GET") {
      if (actorAtRequest !== "creatorA") return json(route, { error: "forbidden" }, 403);
      return json(route, {
        ok: true,
        reason: "",
        reasonText: "",
        availablePoints: 100,
        estimatedFeePoints: 8,
      });
    }
    if (path === "/api/errands/orders" && method === "POST") {
      if (actorAtRequest !== "creatorA") return json(route, { error: "forbidden" }, 403);
      const payload = request.postDataJSON();
      state.createBodies.push(payload);
      state.order = {
        status: "paid_locked",
        timeline: [{ status: "paid_locked", at: FIXED_AT, actor: "requester" }],
      };
      return json(route, fullDetail(state.order));
    }
    if (path === "/api/errands/orders/available" && method === "GET") {
      if (actorAtRequest !== "runnerB" && actorAtRequest !== "runnerC") {
        return json(route, { error: "runner verification required" }, 403);
      }
      const items =
        state.order && state.order.status === "paid_locked" && !state.order.runnerUserId
          ? [poolOrder(state.order)]
          : [];
      return fixtureResponse(route, state, actorAtRequest, method, path, {
        items,
        total: items.length,
      });
    }
    if (path === "/api/errands/orders/mine" && method === "GET") {
      if (!state.order) return json(route, { items: [], total: 0 });
      if (url.searchParams.get("role") === "runner") {
        if (actorAtRequest !== "runnerB" && actorAtRequest !== "runnerC") {
          return json(route, { error: "runner verification required" }, 403);
        }
        const visibleToAssignedRunner =
          actorAtRequest === "runnerB" && state.order.runnerUserId === "assigned-runner-B-id";
        const terminal = ["completed", "cancelled"].includes(state.order.status);
        const items = visibleToAssignedRunner
          ? [terminal ? poolOrder(state.order) : fullOrder(state.order)]
          : [];
        const body = { items, total: items.length };
        return fixtureResponse(route, state, actorAtRequest, method, path, body);
      }
      if (actorAtRequest !== "creatorA") return json(route, { error: "forbidden" }, 403);
      return json(route, { items: [fullOrder(state.order)], total: 1 });
    }

    const detailMatch = path.match(/^\/api\/errands\/orders\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      if (!state.order || detailMatch[1] !== ERRAND_ORDER_ID) {
        return json(route, { error: "not found" }, 404);
      }
      if (canSeeFullOrder(actorAtRequest, state.order)) {
        return fixtureResponse(route, state, actorAtRequest, method, path, fullDetail(state.order));
      }
      if (
        actorAtRequest === "runnerB" &&
        state.order.runnerUserId === "assigned-runner-B-id" &&
        ["completed", "cancelled"].includes(state.order.status)
      ) {
        return fixtureResponse(route, state, actorAtRequest, method, path, safeDetail(state.order));
      }
      return fixtureResponse(
        route,
        state,
        actorAtRequest,
        method,
        path,
        { error: "forbidden" },
        403,
      );
    }

    const transitionMatch = path.match(
      /^\/api\/errands\/orders\/([^/]+)\/(accept|at-shop|pickup|deliver|complete|cancel)$/,
    );
    if (transitionMatch && method === "POST") {
      if (!state.order || transitionMatch[1] !== ERRAND_ORDER_ID) {
        return json(route, { error: "not found" }, 404);
      }
      const action = transitionMatch[2];
      if (action === "accept") {
        if (actorAtRequest !== "runnerB" || state.order.status !== "paid_locked") {
          return json(route, { error: "transition forbidden" }, 409);
        }
        state.order.runnerUserId = "assigned-runner-B-id";
        state.order.status = "assigned";
      } else if (action === "at-shop") {
        if (actorAtRequest !== "runnerB" || state.order.status !== "assigned") {
          return json(route, { error: "transition forbidden" }, 409);
        }
        state.order.status = "at_shop";
      } else if (action === "pickup") {
        if (actorAtRequest !== "runnerB" || state.order.status !== "at_shop") {
          return json(route, { error: "transition forbidden" }, 409);
        }
        state.order.status = "delivering";
      } else if (action === "deliver") {
        if (actorAtRequest !== "runnerB" || state.order.status !== "delivering") {
          return json(route, { error: "transition forbidden" }, 409);
        }
        state.order.status = "delivered";
      } else if (action === "complete") {
        if (actorAtRequest !== "creatorA" || state.order.status !== "delivered") {
          return json(route, { error: "transition forbidden" }, 409);
        }
        state.order.status = "completed";
      } else {
        if (actorAtRequest !== "creatorA") return json(route, { error: "forbidden" }, 403);
        state.order.status = "cancelled";
      }
      state.order.timeline.push({
        status: state.order.status,
        at: new Date(Date.parse(FIXED_AT) + state.order.timeline.length * 60_000).toISOString(),
        actor: action === "complete" || action === "cancel" ? "requester" : "runner",
      });
      state.transitions.push(action);
      const body =
        actorAtRequest === "runnerB" && state.order.status === "cancelled"
          ? safeDetail(state.order)
          : fullDetail(state.order);
      return fixtureResponse(route, state, actorAtRequest, method, path, body);
    }

    const key = `${method} ${path}`;
    state.unexpectedRequests.push(key);
    return json(route, { error: `unexpected errand fixture request: ${key}` }, 500);
  });

  return state;
}

export async function loginErrandActor(page: Page, login: string) {
  await page.goto("/#/profile");
  const panel = page.locator(".auth-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await panel.locator('input[autocomplete="username"]').fill(login);
  await panel.locator('input[type="password"]').fill(ERRAND_PASSWORD);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/api/auth/login") && candidate.request().method() === "POST",
  );
  await panel.locator('button[type="submit"]').click();
  await expect((await response).ok()).toBe(true);
  await expect(panel).toHaveCount(0);
}

export async function openProfileWithoutReload(page: Page) {
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "我的" })
    .click();
  await expect(page).toHaveURL(/#\/profile$/);
}

export async function logoutErrandActor(page: Page) {
  if (!/#\/profile$/.test(new URL(page.url()).hash)) await openProfileWithoutReload(page);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/api/auth/logout") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect((await response).ok()).toBe(true);
  await expect(page.locator(".auth-panel")).toBeVisible();
}

export function expectNoPrivateSentinel(value: unknown) {
  const wire = JSON.stringify(value);
  for (const sentinel of PRIVATE_SENTINELS) expect(wire).not.toContain(sentinel);
}
