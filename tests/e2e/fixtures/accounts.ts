import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

import { retryTransientApiRequest } from "./retry";
import type { VerificationTag } from "../../../src/types/verification";

export type RoleId =
  | "anonymous"
  | "registered"
  | "campus"
  | "merchant"
  | "runner"
  | "admin"
  | "event_creator"
  | "org_member";

export interface RoleDefinition {
  id: RoleId;
  description: string;
  envUser: string | null;
  envPass: string | null;
  expectedTags: readonly VerificationTag[];
  /**
   * Sibling tags we accept on the user record alongside `expectedTags`. Two
   * shapes coexist on nat100:
   *  - `VerificationTag` enum values (`realname_verified`, `campus_verified`,
   *    …) that the typed verification pipeline emits.
   *  - Free-form Chinese display labels (`高校认证`, `实名认证`, `商家认证`)
   *    that the legacy NodeBB user record still carries for UI badges.
   * The `@account-fixture` spec asserts every entry in `expectedTags` is
   * present and tolerates anything listed here without warning.
   */
  toleratedExtraTags?: readonly string[];
}

const ROLE_TABLE: Record<RoleId, RoleDefinition> = {
  anonymous: {
    id: "anonymous",
    description: "no login — used by anonymous browse / share-link flows",
    envUser: null,
    envPass: null,
    expectedTags: [],
  },
  registered: {
    id: "registered",
    description: "logged-in user with no verification tags",
    envUser: "LIAN_E2E_REGISTERED_USERNAME",
    envPass: "LIAN_E2E_REGISTERED_PASSWORD",
    expectedTags: [],
  },
  campus: {
    id: "campus",
    description: "campus_verified — emitted by /api/verify/campus-email/confirm",
    envUser: "LIAN_E2E_CAMPUS_USERNAME",
    envPass: "LIAN_E2E_CAMPUS_PASSWORD",
    expectedTags: ["campus_verified"],
    // "高校认证" is the legacy NodeBB display label that pairs with the
    // `campus_verified` enum value on the user record.
    toleratedExtraTags: ["org_member", "高校认证"],
  },
  merchant: {
    id: "merchant",
    description: "merchant_verified — usually carries realname_verified as well",
    envUser: "LIAN_E2E_MERCHANT_USERNAME",
    envPass: "LIAN_E2E_MERCHANT_PASSWORD",
    expectedTags: ["merchant_verified"],
    // The merchant seed is also campus_verified on nat100 and carries the
    // legacy display labels "高校认证" (campus) and "商家认证" (merchant).
    toleratedExtraTags: ["realname_verified", "campus_verified", "高校认证", "商家认证"],
  },
  runner: {
    id: "runner",
    description: "runner — campus runner / errand role",
    envUser: "LIAN_E2E_RUNNER_USERNAME",
    envPass: "LIAN_E2E_RUNNER_PASSWORD",
    expectedTags: ["runner"],
    // Legacy display labels "高校认证" / "实名认证" accompany the enum siblings.
    toleratedExtraTags: ["campus_verified", "realname_verified", "高校认证", "实名认证"],
  },
  admin: {
    id: "admin",
    description: "admin / moderator — backend marks via NodeBB group membership",
    envUser: "LIAN_E2E_ADMIN_USERNAME",
    envPass: "LIAN_E2E_ADMIN_PASSWORD",
    expectedTags: [],
    // The admin seed on nat100 also happens to be campus_verified + carries
    // the legacy display label "高校认证".
    toleratedExtraTags: ["campus_verified", "高校认证"],
  },
  event_creator: {
    id: "event_creator",
    description:
      "event_creator — owns rewarded events; campus_verified + realname_verified to clear /reward V0.2 anti-fraud floor (issue #439).",
    envUser: "LIAN_E2E_EVENT_CREATOR_USERNAME",
    envPass: "LIAN_E2E_EVENT_CREATOR_PASSWORD",
    expectedTags: ["campus_verified", "realname_verified"],
    // Legacy display labels "高校认证" / "实名认证" accompany the enum tags.
    toleratedExtraTags: ["高校认证", "实名认证"],
  },
  org_member: {
    id: "org_member",
    description:
      "org_member — baseline org-affiliated joiner; appears in event.joinedUserIds without owning the event (issue #439).",
    envUser: "LIAN_E2E_ORG_MEMBER_USERNAME",
    envPass: "LIAN_E2E_ORG_MEMBER_PASSWORD",
    expectedTags: ["campus_verified", "org_member"],
    // Legacy display label "高校认证" accompanies campus_verified.
    toleratedExtraTags: ["高校认证"],
  },
};

export const ROLES: readonly RoleDefinition[] = Object.values(ROLE_TABLE);

export function roleDefinition(role: RoleId): RoleDefinition {
  return ROLE_TABLE[role];
}

export interface RoleCredentials {
  username: string;
  password: string;
}

export function readRoleCredentials(role: RoleId): RoleCredentials | null {
  const def = ROLE_TABLE[role];
  if (!def.envUser || !def.envPass) return null;
  const username = process.env[def.envUser];
  const password = process.env[def.envPass];
  if (!username || !password) return null;
  return { username, password };
}

export function isRoleConfigured(role: RoleId): boolean {
  if (role === "anonymous") return true;
  return readRoleCredentials(role) !== null;
}

/**
 * Skip the current test if the role is not configured. Use this instead of
 * raising — an unconfigured high-privilege account is a missing seed, not a
 * test failure.
 */
export function skipIfRoleMissing(role: RoleId): void {
  if (isRoleConfigured(role)) return;
  const def = ROLE_TABLE[role];
  test.skip(true, `role "${role}" not configured — set ${def.envUser}/${def.envPass} to enable`);
}

interface LoginResponse {
  user?: {
    id?: string;
    username?: string;
    tags?: string[];
    verificationTags?: string[];
  } | null;
}

export interface LoginResult {
  api: APIRequestContext;
  user: NonNullable<LoginResponse["user"]>;
}

const DEFAULT_BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Login as `role` against `/api/auth/login` and return an API context with the
 * resulting session cookies. Throws if the role has no env credentials — call
 * `skipIfRoleMissing` first when the test should skip in that case.
 */
export async function loginAs(role: RoleId, baseURL = DEFAULT_BASE_URL): Promise<LoginResult> {
  if (role === "anonymous") {
    throw new Error("loginAs cannot be used with the 'anonymous' role.");
  }
  const creds = readRoleCredentials(role);
  if (!creds) {
    throw new Error(
      `role "${role}" not configured — set ${ROLE_TABLE[role].envUser}/${ROLE_TABLE[role].envPass} before calling loginAs.`,
    );
  }

  const api = await request.newContext({ baseURL });
  const response = await retryTransientApiRequest(() =>
    api.post("/api/auth/login", {
      data: { login: creds.username, password: creds.password },
    }),
  );
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as LoginResponse;
  expect(body.user, `login as ${role} returned no user record`).toBeTruthy();
  return { api, user: body.user! };
}

/**
 * Open an authenticated browser context for `role`. Reuses cookies from the
 * provided API context. Caller is responsible for closing the returned
 * context.
 */
export async function browserContextForRole(
  browser: Browser,
  api: APIRequestContext,
): Promise<BrowserContext> {
  return browser.newContext({ storageState: await api.storageState() });
}

/**
 * Returns Playwright `storageState` (cookies + localStorage) for `role` after
 * a fresh login. Useful for `test.use({ storageState })`.
 */
export async function storageStateForRole(role: RoleId, baseURL = DEFAULT_BASE_URL) {
  const { api } = await loginAs(role, baseURL);
  const state = await api.storageState();
  await api.dispose();
  return state;
}
