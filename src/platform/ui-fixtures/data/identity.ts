/**
 * auth + verification fixtures.
 *
 * `/api/auth/me` returns `{ user: {...} | null }` — the exact envelope the
 * existing Playwright journeys fulfil (see tests/e2e/local/*.spec.ts), so the
 * real normalizer path in src/api/auth.ts is exercised unchanged. The `guest`
 * identity returns `user: null` rather than a 401 for the same reason: that is
 * what the backend actually does for an anonymous session.
 */

import { fixtureError, fixtureJson } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureRequestContext } from "../types";
import { identityProfile } from "./support";

function userPayload(context: FixtureRequestContext) {
  const profile = identityProfile(context.identity);
  if (!profile.authenticated) return null;
  return {
    id: profile.id,
    uid: profile.id,
    username: profile.username,
    displayName: profile.username,
    email: `${profile.id}@fixture.campus.invalid`,
    tags: profile.identityTags,
    identityTags: profile.identityTags,
    verificationTags: profile.verificationTags,
    roles: profile.roles,
    aliases: [],
    disabled: profile.disabled,
    createdAt: "2025-09-01T02:00:00.000Z",
  };
}

export function registerIdentityFixtures(): void {
  registerFixtureFamily("auth", [
    [
      "GET",
      "/api/auth/me",
      (context) => {
        const profile = identityProfile(context.identity);
        if (profile.disabled) {
          return fixtureError(403, "账号已被停用，请联系管理员", "ACCOUNT_DISABLED");
        }
        return fixtureJson({ user: userPayload(context) });
      },
    ],
    [
      "POST",
      "/api/auth/login",
      (context) => {
        if (context.identity === "guest") {
          return fixtureError(401, "邮箱或密码不正确", "INVALID_CREDENTIALS");
        }
        if (identityProfile(context.identity).disabled) {
          return fixtureError(403, "账号已被停用，请联系管理员", "ACCOUNT_DISABLED");
        }
        return fixtureJson({ user: userPayload(context) });
      },
    ],
    ["POST", "/api/auth/logout", () => fixtureJson({})],
    [
      "POST",
      "/api/auth/register",
      (context) => fixtureJson({ user: userPayload(context) }, 201),
    ],
    [
      "GET",
      "/api/auth/rules",
      () =>
        fixtureJson({
          usernameMinLength: 2,
          usernameMaxLength: 20,
          passwordMinLength: 8,
          allowedEmailDomains: ["campus.invalid"],
        }),
    ],
    ["POST", "/api/auth/email-code", () => fixtureJson({ sent: true, cooldownSeconds: 60 })],
    ["POST", "/api/auth/avatar", () => fixtureJson({ ok: true })],
    ["POST", "/api/auth/aliases/activate", (context) => fixtureJson({ user: userPayload(context) })],
    ["POST", "/api/auth/aliases/deactivate", (context) => fixtureJson({ user: userPayload(context) })],
    ["POST", "/api/auth/redeem-link", (context) => fixtureJson({ user: userPayload(context) })],
    ["GET", "/api/auth-link/:token/card", () => fixtureJson({ card: null })],
  ]);

  registerFixtureFamily("verification", [
    [
      "POST",
      "/api/auth/verify/campus-email/send",
      () => fixtureJson({ sent: true, cooldownSeconds: 60 }),
    ],
    [
      "POST",
      "/api/auth/verify/campus-email/confirm",
      (context) => {
        const body = (context.body ?? {}) as Record<string, unknown>;
        const code = typeof body.code === "string" ? body.code : "";
        if (code && code !== "123456") {
          return fixtureError(400, "验证码不正确或已过期", "INVALID_CODE");
        }
        return fixtureJson({ user: userPayload(context), verified: true });
      },
    ],
  ]);
}
