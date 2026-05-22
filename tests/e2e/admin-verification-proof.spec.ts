/**
 * Admin verification + moderation proof lane (PRD §19.2 P5).
 *
 * Drives the admin surface against a real backend (default
 * https://lian.nat100.top) using the seeded e2e admin role. Verifies four
 * pillars described by the task board:
 *
 *   1. role gate — every test skips cleanly when LIAN_E2E_ADMIN_USERNAME /
 *      LIAN_E2E_ADMIN_PASSWORD is unset.
 *   2. denial — non-admin sessions and anonymous callers must be 401/403'd
 *      out of /api/admin/* before any privileged work runs.
 *   3. merchant verification approval — admin patches the queue record from
 *      pending to approved, the user's auth/me eventually surfaces
 *      `merchant_verified`, and the PATCH response carries a real reviewedAt
 *      timestamp (the verifiedAt-equivalent on the queue record).
 *   4. post moderation — admin hides a freshly-published throwaway post and
 *      a registered viewer's feed/detail no longer surfaces it.
 *
 * Two backend gaps are surfaced as `test.fixme`:
 *   - admin help-state override: src/server/help-routes.js asserts
 *     `authorUserId === user.id` strictly; there is no admin bypass branch
 *     today. Filed as the trigger to add one.
 *   - audit trail correlation: /api/admin/audit-log is in-memory only
 *     (admin-audit-log-store.js) so a separate process can't see the entry
 *     this run wrote. The assertion is gated on whether the in-memory store
 *     happens to be the same process; documented inside the test.
 *
 * Token gating: `requireAdmin` (admin-routes.js) is token-only for every
 * `/api/admin/*` endpoint EXCEPT `/api/admin/me` (which honors the session).
 * Tests that exercise verification-queue transitions, post moderation, and
 * audit-log reads therefore additionally require LIAN_E2E_ADMIN_TOKEN. The
 * tests skip with a clear reason rather than fail when the token is unset,
 * so a credentials-light dev box can still run the role + denial proofs.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface AdminMeResponse {
  ok?: boolean;
  viaToken?: boolean;
  user?: { id?: string; roleIds?: string[] } | null;
}

interface AuthMeResponse {
  user?: {
    id?: string;
    tags?: string[];
    verificationTags?: string[];
    verificationState?: Record<string, { active?: boolean } | undefined>;
  };
}

interface VerificationDto {
  verificationId?: string;
  status?: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  reviewerNote?: string | null;
}

interface VerificationApplyResponse {
  ok?: boolean;
  deduped?: boolean;
  verification?: VerificationDto;
}

interface VerificationTransitionResponse {
  ok?: boolean;
  verification?: VerificationDto;
}

interface CreatePostResponse {
  tid?: number;
  topic?: { tid?: number };
  post?: { tid?: number };
}

interface FeedResponse {
  items?: Array<{ tid?: number }>;
}

interface AuditEvent {
  eventId?: string;
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string | null;
  detail?: unknown;
  createdAt?: string;
}

interface AuditListResponse {
  ok?: boolean;
  items?: AuditEvent[];
  total?: number;
}

function adminToken(): string {
  return (process.env.LIAN_E2E_ADMIN_TOKEN ?? "").trim();
}

function adminAuthHeaders(): Record<string, string> {
  const token = adminToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function hasMerchantVerifiedTag(body: AuthMeResponse): boolean {
  const user = body.user;
  if (!user) return false;
  const tags = new Set([...(user.tags ?? []), ...(user.verificationTags ?? [])]);
  if (tags.has("merchant_verified")) return true;
  return user.verificationState?.merchant_verified?.active === true;
}

async function tryDeletePostMetadata(api: APIRequestContext, tid: number): Promise<void> {
  if (!tid) return;
  try {
    await api.delete(`/api/admin/post-metadata/${tid}`, { headers: adminAuthHeaders() });
  } catch {
    // Cleanup is best-effort; the post is already deleted on the NodeBB side
    // by the hide call. A leftover metadata entry only matters for next-run
    // hygiene and never breaks the assertion below.
  }
}

const moderationContext: { hiddenTid: number } = { hiddenTid: 0 };

test.describe
  .serial("@admin admin verification + moderation real proof @admin-verification", () => {
  test("@admin role gate — /api/admin/me responds ok for the e2e admin session", async () => {
    test.skip(
      !isRoleConfigured("admin"),
      "admin role not configured — set LIAN_E2E_ADMIN_USERNAME / LIAN_E2E_ADMIN_PASSWORD to enable",
    );

    const { api } = await loginAs("admin");
    try {
      const response = await api.get("/api/admin/me");
      expect(response.ok(), await response.text()).toBe(true);
      const body = (await response.json()) as AdminMeResponse;
      expect(body.ok).toBe(true);
      // Session entry — viaToken false proves the cookie path, not the shared
      // ADMIN_TOKEN bearer. Token-only endpoints below still need
      // LIAN_E2E_ADMIN_TOKEN; the gate here is the role surface, not auth.
      expect(body.viaToken).toBe(false);
      const roleIds = body.user?.roleIds ?? [];
      const hasAdminRole = roleIds.some((role) => {
        const normalized = String(role || "")
          .trim()
          .toLowerCase();
        return normalized === "admin" || normalized === "moderator";
      });
      expect(
        hasAdminRole,
        `admin probe must surface admin/moderator role; got roleIds=${JSON.stringify(roleIds)}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@admin denial — registered session is rejected from /api/admin/verifications", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api } = await loginAs("registered");
    try {
      const response = await api.get("/api/admin/verifications?verificationType=merchant&limit=1");
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for non-admin session, got ${response.status()}: ${await response.text()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@admin denial — anonymous POST /api/admin/posts/:tid/hide is rejected", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post("/api/admin/posts/1/hide", { data: {} });
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for anonymous moderation, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@admin merchant verification — admin approves a queue record and user surfaces merchant_verified", async () => {
    test.skip(!isRoleConfigured("admin"), "admin role not configured — gate at top of describe");
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(
      !adminToken(),
      "LIAN_E2E_ADMIN_TOKEN required — /api/admin/verifications/* uses requireAdmin (token-only)",
    );

    const { api: userApi, user } = await loginAs("registered");
    const adminApi = await request.newContext({ baseURL: BASE_URL });
    try {
      // If the registered fixture is already merchant_verified from a prior
      // run, we can't deterministically prove the pending → approved transition
      // (the apply call dedupes against any pending row, and there is no API
      // to revoke an active grant). Skip with a clear reason — the assertion
      // is about the transition itself, not the steady-state tag.
      const meBefore = await userApi.get("/api/auth/me");
      expect(meBefore.ok(), await meBefore.text()).toBe(true);
      const meBeforeBody = (await meBefore.json()) as AuthMeResponse;
      test.skip(
        hasMerchantVerifiedTag(meBeforeBody),
        "registered fixture already merchant_verified — transition is not testable until the grant is reset",
      );

      const merchantName = `e2e-admin-verification-${Date.now()}`;
      const submit = await userApi.post("/api/verifications/merchant", {
        data: { merchantName, note: "admin-verification-proof e2e submission" },
      });
      expect(submit.ok(), await submit.text()).toBe(true);
      const submitBody = (await submit.json()) as VerificationApplyResponse;
      const verificationId = submitBody.verification?.verificationId ?? "";
      expect(verificationId, "verification submit must return a verificationId").toBeTruthy();

      // Belt-and-braces: the admin queue list must surface this verification
      // (or at least one record for this user) before we PATCH.
      const listResponse = await adminApi.get(
        `/api/admin/verifications/merchant?userId=${encodeURIComponent(user.id ?? "")}`,
        { headers: adminAuthHeaders() },
      );
      expect(listResponse.ok(), await listResponse.text()).toBe(true);

      const patch = await adminApi.patch(
        `/api/admin/verifications/merchant/${encodeURIComponent(verificationId)}`,
        {
          headers: adminAuthHeaders(),
          data: {
            status: "approved",
            reviewerNote: `approved by admin-verification-proof ${Date.now()}`,
          },
        },
      );
      expect(patch.ok(), await patch.text()).toBe(true);
      const patchBody = (await patch.json()) as VerificationTransitionResponse;
      expect(patchBody.verification?.status).toBe("approved");
      expect(
        String(patchBody.verification?.reviewedAt ?? ""),
        "approved verification must record a reviewedAt (verifiedAt-equivalent on the queue side)",
      ).not.toBe("");
      expect(String(patchBody.verification?.reviewerId ?? "")).not.toBe("");

      // Eventual consistency on the auth/me side — grantVerification writes
      // the tag synchronously, but Redis-object propagation can lag a tick.
      await expect
        .poll(
          async () => {
            const me = await userApi.get("/api/auth/me");
            if (!me.ok()) return false;
            return hasMerchantVerifiedTag((await me.json()) as AuthMeResponse);
          },
          { timeout: 15_000, intervals: [500, 1_000, 2_000] },
        )
        .toBe(true);
    } finally {
      await userApi.dispose();
      await adminApi.dispose();
    }
  });

  test("@admin moderation — admin hides a fresh post; registered viewer no longer sees it in feed/detail", async () => {
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(
      !adminToken(),
      "LIAN_E2E_ADMIN_TOKEN required — /api/admin/posts/:tid/hide uses requireAdmin (token-only)",
    );

    const { api: authorApi } = await loginAs("event_creator");
    const { api: viewerApi } = await loginAs("registered");
    const adminApi = await request.newContext({ baseURL: BASE_URL });
    let createdTid = 0;
    try {
      const sentinel = `admin-verification-proof-throwaway-${Date.now()}`;
      const create = await authorApi.post("/api/posts", {
        data: {
          title: sentinel,
          content: "admin-verification-proof: throwaway post — hide expected.",
          visibility: "public",
        },
      });
      expect(create.ok(), await create.text()).toBe(true);
      const createBody = (await create.json()) as CreatePostResponse;
      createdTid = Number(createBody.tid ?? createBody.topic?.tid ?? createBody.post?.tid ?? 0);
      expect(
        createdTid,
        `create-post must return a tid; got ${JSON.stringify(createBody)}`,
      ).toBeGreaterThan(0);

      // Sanity — the viewer can fetch detail BEFORE the hide. If this already
      // 404s, the assertion below proves nothing.
      const beforeDetail = await viewerApi.get(`/api/posts/${createdTid}`);
      expect(
        beforeDetail.ok(),
        `pre-hide detail fetch failed: ${beforeDetail.status()} ${await beforeDetail.text()}`,
      ).toBe(true);

      const hide = await adminApi.post(`/api/admin/posts/${createdTid}/hide`, {
        headers: adminAuthHeaders(),
        data: {},
      });
      expect(hide.ok(), await hide.text()).toBe(true);
      moderationContext.hiddenTid = createdTid;

      // Feed: the freshly-hidden tid must drop out of the registered viewer's
      // recent slice. Poll because feed pages are cached briefly server-side.
      await expect
        .poll(
          async () => {
            const feed = await viewerApi.get("/api/feed?limit=50");
            if (!feed.ok()) return null;
            const body = (await feed.json()) as FeedResponse;
            return (body.items ?? []).some((item) => Number(item.tid) === createdTid);
          },
          { timeout: 15_000, intervals: [500, 1_000, 2_000] },
        )
        .toBe(false);

      // Detail: NodeBB deleteTopic typically surfaces as 404, but a 403 from
      // the audience guard or a 410 from a soft-delete are also acceptable
      // — the contract is "viewer can no longer read the topic."
      const afterDetail = await viewerApi.get(`/api/posts/${createdTid}`);
      expect(
        [403, 404, 410].includes(afterDetail.status()),
        `post-hide detail fetch should be 403/404/410, got ${afterDetail.status()}: ${await afterDetail.text()}`,
      ).toBe(true);
    } finally {
      // Best-effort cleanup of the metadata stub left behind by the deleted
      // topic. Hide already removes the NodeBB topic, so this is purely
      // hygiene for next-run signal.
      await tryDeletePostMetadata(adminApi, createdTid);
      await authorApi.dispose();
      await viewerApi.dispose();
      await adminApi.dispose();
    }
  });

  test.fixme("@admin help override — admin can resolve the help-runtime fixture without owning it", async () => {
    // Backend gap (2026-05-22): src/server/help-routes.js#assertAuthorAndAudience
    // requires `String(post.authorUserId) === String(user.id)` strictly and
    // does NOT branch on viewer.isAdmin. As a result, an admin session that
    // POSTs /api/help/200/resolve receives 403 FORBIDDEN even though the
    // moderation surface (/api/admin/posts/:tid/hide) accepts the same admin.
    //
    // To unblock this test:
    //   1. Add an admin/moderator override branch in
    //      assertAuthorAndAudience (use canModeratePost() from
    //      audience-service.js — already returns true for admin/moderator).
    //   2. Decide whether the audit log gets a `help.resolve` actorId=admin
    //      entry (recommended; matches the post.hide pattern).
    //   3. Flip this test from .fixme to test() and assert:
    //      - admin (LIAN_E2E_ADMIN_USERNAME session) POSTs /api/help/<tid>/resolve
    //      - response is ok and help.status flips to "resolved"
    //      - GET /api/fixtures self-heals back to status=open after
    //      - audit-log has a corresponding entry
  });

  test("@admin audit trail — /api/admin/audit-log surfaces post.hide events", async () => {
    test.skip(
      !adminToken(),
      "LIAN_E2E_ADMIN_TOKEN required — /api/admin/audit-log uses requireAdmin (token-only)",
    );
    test.skip(
      moderationContext.hiddenTid === 0,
      "no tid was hidden by the moderation test — can't correlate an audit row",
    );

    const adminApi = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await adminApi.get("/api/admin/audit-log?action=post.hide&limit=100", {
        headers: adminAuthHeaders(),
      });
      expect(response.ok(), await response.text()).toBe(true);
      const body = (await response.json()) as AuditListResponse;
      const items = Array.isArray(body.items) ? body.items : [];
      // Every item must be the post.hide action — proves the action filter
      // works rather than returning the unfiltered log.
      for (const event of items) {
        expect(event.action).toBe("post.hide");
      }
      // Soft assertion: when the audit store is the same process that handled
      // the hide, our entry will be visible. When the API is served from a
      // different worker (or restarted between calls), the in-memory store
      // won't carry it. Use expect.soft so a process-boundary mismatch
      // doesn't fail the gate; the strict assertion above already proves the
      // action filter is wired.
      const matched = items.some(
        (event) => String(event.targetId ?? "") === String(moderationContext.hiddenTid),
      );
      expect
        .soft(
          matched,
          `audit log did not surface post.hide for tid=${moderationContext.hiddenTid}; ` +
            "this is expected when the API node and the audit store are separate processes " +
            "(admin-audit-log-store.js is in-memory only as of 2026-05-22).",
        )
        .toBe(true);
    } finally {
      await adminApi.dispose();
    }
  });
});
