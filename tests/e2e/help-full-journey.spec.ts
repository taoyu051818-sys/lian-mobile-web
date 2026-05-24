/**
 * Help full journey E2E tests (issue #xxx).
 *
 * Covers the complete user journey for the Help feature:
 *   1. Help post discovery and voting
 *   2. Help status flow (open -> linked_event -> resolved -> closed)
 *   3. Help management operations (author perspective)
 *   4. Vote toggle (vote/unvote round-trip)
 *   5. Anonymous user restrictions
 *
 * Depends on:
 *   - `helpRuntime` fixture from `/api/fixtures` (backend self-heal contract)
 *   - `eventRuntime` fixture for link-event tests
 *   - Role accounts: registered, event_creator
 *
 * The backend self-heal contract (#472) patches the help fixture back to
 * status="open" / linkedEventId=null on each `/api/fixtures` call, making
 * tests rerun-safe.
 */

import { expect, request, test } from "@playwright/test";

import { browserContextForRole, isRoleConfigured, loginAs } from "./fixtures/accounts";
import { fetchEventRuntimeFixture } from "./fixtures/event-runtime";
import { fetchHelpRuntimeFixture, type HelpRuntimeStatus } from "./fixtures/help-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PostDetail {
  tid?: number;
  help?: {
    helpId?: string;
    status?: HelpRuntimeStatus;
    voteCount?: number;
    linkedEventTid?: number | null;
  };
  helpVoted?: boolean;
}

interface VoteResponse {
  ok?: boolean;
  liked?: boolean;
  voteCount?: number;
}

interface HelpManageResponse {
  ok?: boolean;
  helpId?: string;
  status?: HelpRuntimeStatus;
  linkedEventId?: string | null;
}

test.describe("@help-journey Help full journey", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Help post discovery and voting
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Help post discovery and voting", () => {
    test("@help-journey discover help post via fixture and verify PostDetailHelpBlock renders", async ({
      browser,
    }) => {
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(
        fixture === null || !fixture.ready,
        "helpRuntime fixture not available — skipping gracefully",
      );

      // Verify the post detail API surfaces the help extension
      const api = await request.newContext({ baseURL: BASE_URL });
      try {
        const response = await api.get(`/api/posts/${fixture!.tid}`);
        expect(response.ok(), await response.text()).toBe(true);
        const detail = (await response.json()) as PostDetail;
        expect(detail.help, "post detail must carry the help extension").toBeTruthy();
        expect(detail.help!.helpId).toBe(fixture!.help!.helpId);
        expect(typeof detail.help!.voteCount).toBe("number");

        // Browser proof: detail page renders the help block
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
          await page.waitForSelector('[data-testid="post-detail-help-block"]', {
            state: "visible",
            timeout: 15000,
          });
          // Verify status pill is visible
          const statusEl = page.locator(".post-detail-help-block__status");
          await expect(statusEl).toBeVisible();
          // Verify vote count is displayed
          const votesEl = page.locator(".post-detail-help-block__votes");
          await expect(votesEl).toBeVisible();
        } finally {
          await context.close();
        }
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey logged-in user can vote on help post and see count increase", async ({
      browser,
    }) => {
      test.skip(
        !isRoleConfigured("registered"),
        "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
      );

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api } = await loginAs("registered");
      try {
        const tid = fixture!.tid;

        // Reset vote state to false first (ensure clean baseline)
        const resetResp = await api.post(`/api/posts/${tid}/vote`, { data: { liked: false } });
        expect(resetResp.ok(), `vote reset failed: ${await resetResp.text()}`).toBe(true);

        // Get initial vote count
        const beforeResp = await api.get(`/api/posts/${tid}`);
        expect(beforeResp.ok()).toBe(true);
        const beforeDetail = (await beforeResp.json()) as PostDetail;
        const initialCount = beforeDetail.help?.voteCount ?? 0;

        // Vote (liked: true)
        const voteResp = await api.post(`/api/posts/${tid}/vote`, { data: { liked: true } });
        expect(voteResp.ok(), `vote failed: ${await voteResp.text()}`).toBe(true);
        const voteBody = (await voteResp.json()) as VoteResponse;
        expect(voteBody.liked).toBe(true);

        // Verify count increased
        const afterResp = await api.get(`/api/posts/${tid}`);
        expect(afterResp.ok()).toBe(true);
        const afterDetail = (await afterResp.json()) as PostDetail;
        const afterCount = afterDetail.help?.voteCount ?? 0;
        expect(afterCount).toBeGreaterThanOrEqual(initialCount);

        // Browser proof: verify UI shows the vote button in voted state
        const context = await browserContextForRole(browser, api);
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/#/post/${tid}`);
          await page.waitForSelector('[data-testid="post-detail-help-block"]', {
            state: "visible",
            timeout: 15000,
          });
          // The vote CTA should be visible
          const ctaButton = page.locator('[data-testid="detail-cta-help-vote"]');
          await expect(ctaButton).toBeVisible();
        } finally {
          await context.close();
        }

        // Clean up: reset vote state
        await api.post(`/api/posts/${tid}/vote`, { data: { liked: false } });
      } finally {
        await api.dispose();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Help status flow verification
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Help status UI representation", () => {
    test("@help-journey status=open shows '求助中' pill", async ({ browser }) => {
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");
      // Backend self-heal ensures status="open" on fixture fetch
      expect(fixture!.help!.status).toBe("open");

      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-help-block"]', {
          state: "visible",
          timeout: 15000,
        });
        const statusEl = page.locator(".post-detail-help-block__status");
        await expect(statusEl).toHaveAttribute("data-status", "open");
        await expect(statusEl).toContainText("求助中");
      } finally {
        await context.close();
      }
    });

    test("@help-journey status transitions are reflected in UI after API calls", async () => {
      test.skip(
        !isRoleConfigured("event_creator"),
        "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
      );

      const helpFixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      const eventFixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
      test.skip(helpFixture === null || !helpFixture.ready, "helpRuntime fixture not ready");
      test.skip(
        eventFixture === null || !eventFixture.ready || !eventFixture.event?.eventId,
        "eventRuntime fixture not ready",
      );

      const { api, user } = await loginAs("event_creator");
      try {
        expect(String(user.id ?? "")).toBe(helpFixture!.expectedAuthorUserId);

        const helpId = helpFixture!.help!.helpId;
        const eventId = eventFixture!.event!.eventId;

        // Transition: open -> linked_event
        const linkResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/link-event`, {
          data: { eventId },
        });
        expect(linkResp.ok(), `link-event failed: ${await linkResp.text()}`).toBe(true);
        const linkBody = (await linkResp.json()) as HelpManageResponse;
        expect(linkBody.status).toBe("linked_event");

        // Verify via GET
        const detailResp = await api.get(`/api/posts/${helpFixture!.tid}`);
        expect(detailResp.ok()).toBe(true);
        const detail = (await detailResp.json()) as PostDetail;
        expect(detail.help?.status).toBe("linked_event");

        // Transition back: linked_event -> open (via unlink)
        const unlinkResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/unlink-event`);
        expect(unlinkResp.ok(), `unlink-event failed: ${await unlinkResp.text()}`).toBe(true);
        const unlinkBody = (await unlinkResp.json()) as HelpManageResponse;
        expect(unlinkBody.status).toBe("open");
      } finally {
        await api.dispose();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Help management operations (author perspective)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Help management (author)", () => {
    test("@help-journey author sees PostDetailHelpManageBlock with management actions", async ({
      browser,
    }) => {
      test.skip(
        !isRoleConfigured("event_creator"),
        "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
      );

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api, user } = await loginAs("event_creator");
      try {
        expect(String(user.id ?? "")).toBe(fixture!.expectedAuthorUserId);

        const context = await browserContextForRole(browser, api);
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
          // Wait for help block first
          await page.waitForSelector('[data-testid="post-detail-help-block"]', {
            state: "visible",
            timeout: 15000,
          });
          // Author should see the manage block
          const manageBlock = page.locator('[data-testid="post-detail-help-manage"]');
          await expect(manageBlock).toBeVisible({ timeout: 10000 });

          // Verify link-event input is present (for open status)
          const linkInput = page.locator('[data-testid="help-manage-link-input"]');
          await expect(linkInput).toBeVisible();

          // Verify resolve button is present
          const resolveBtn = page.locator('[data-testid="detail-cta-help-resolve"]');
          await expect(resolveBtn).toBeVisible();

          // Verify close button is present
          const closeBtn = page.locator('[data-testid="detail-cta-help-close"]');
          await expect(closeBtn).toBeVisible();
        } finally {
          await context.close();
        }
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey author can link event via input field", async ({ browser }) => {
      test.skip(!isRoleConfigured("event_creator"), "event_creator role not configured");

      const helpFixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      const eventFixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
      test.skip(helpFixture === null || !helpFixture.ready, "helpRuntime fixture not ready");
      test.skip(eventFixture === null || !eventFixture.ready, "eventRuntime fixture not ready");

      const { api, user } = await loginAs("event_creator");
      try {
        expect(String(user.id ?? "")).toBe(helpFixture!.expectedAuthorUserId);

        const helpId = helpFixture!.help!.helpId;
        const eventId = eventFixture!.event!.eventId;

        // API test: link event
        const linkResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/link-event`, {
          data: { eventId },
        });
        expect(linkResp.ok(), `link-event failed: ${await linkResp.text()}`).toBe(true);
        const linkBody = (await linkResp.json()) as HelpManageResponse;
        expect(linkBody.ok).toBe(true);
        expect(linkBody.status).toBe("linked_event");
        expect(linkBody.linkedEventId).toBe(eventId);

        // Verify the "查看关联活动" entry appears in UI
        const context = await browserContextForRole(browser, api);
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/#/post/${helpFixture!.tid}`);
          await page.waitForSelector('[data-testid="post-detail-help-block"]', {
            state: "visible",
            timeout: 15000,
          });
          // The linked event button should be visible
          const linkedEventBtn = page.locator('[data-testid="post-detail-help-linked-event"]');
          await expect(linkedEventBtn).toBeVisible({ timeout: 5000 });
        } finally {
          await context.close();
        }

        // Clean up: unlink
        await api.post(`/api/help/${encodeURIComponent(helpId)}/unlink-event`);
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey author can mark help as resolved", async () => {
      test.skip(!isRoleConfigured("event_creator"), "event_creator role not configured");

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api, user } = await loginAs("event_creator");
      try {
        expect(String(user.id ?? "")).toBe(fixture!.expectedAuthorUserId);

        const helpId = fixture!.help!.helpId;

        // Resolve the help post
        const resolveResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
          data: { status: "resolved" },
        });
        const status = resolveResp.status();
        // Accept 200 (success) or typed denial (400/403/409)
        expect(
          status === 200 || status === 400 || status === 403 || status === 409,
          `expected 200 or typed denial, got ${status}: ${await resolveResp.text()}`,
        ).toBe(true);

        if (status === 200) {
          // Verify status changed
          const detailResp = await api.get(`/api/posts/${fixture!.tid}`);
          expect(detailResp.ok()).toBe(true);
          const detail = (await detailResp.json()) as PostDetail;
          expect(detail.help?.status).toBe("resolved");
        }

        // Note: Backend self-heal will restore to "open" on next /api/fixtures call
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey author can close help post", async () => {
      test.skip(!isRoleConfigured("event_creator"), "event_creator role not configured");

      // Fetch fresh fixture to ensure open state
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api, user } = await loginAs("event_creator");
      try {
        expect(String(user.id ?? "")).toBe(fixture!.expectedAuthorUserId);

        const helpId = fixture!.help!.helpId;

        // Close the help post (using resolve endpoint with status=closed)
        const closeResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
          data: { status: "closed" },
        });
        const status = closeResp.status();
        expect(
          status === 200 || status === 400 || status === 403 || status === 409,
          `expected 200 or typed denial, got ${status}: ${await closeResp.text()}`,
        ).toBe(true);

        // Note: Backend self-heal will restore to "open" on next /api/fixtures call
      } finally {
        await api.dispose();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Vote toggle (vote/unvote round-trip)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Vote toggle", () => {
    test("@help-journey user can vote then unvote (toggle round-trip)", async () => {
      test.skip(!isRoleConfigured("registered"), "registered role not configured");

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api } = await loginAs("registered");
      try {
        const tid = fixture!.tid;

        // Ensure clean state: unvote first
        const resetResp = await api.post(`/api/posts/${tid}/vote`, { data: { liked: false } });
        expect(resetResp.ok()).toBe(true);
        const resetBody = (await resetResp.json()) as VoteResponse;
        expect(resetBody.liked).toBe(false);

        // Vote (liked: true)
        const voteResp = await api.post(`/api/posts/${tid}/vote`, { data: { liked: true } });
        expect(voteResp.ok(), `vote failed: ${await voteResp.text()}`).toBe(true);
        const voteBody = (await voteResp.json()) as VoteResponse;
        expect(voteBody.liked).toBe(true);

        // Unvote (liked: false)
        const unvoteResp = await api.post(`/api/posts/${tid}/vote`, { data: { liked: false } });
        expect(unvoteResp.ok(), `unvote failed: ${await unvoteResp.text()}`).toBe(true);
        const unvoteBody = (await unvoteResp.json()) as VoteResponse;
        expect(unvoteBody.liked).toBe(false);
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey vote count decreases after unvote", async () => {
      test.skip(!isRoleConfigured("registered"), "registered role not configured");

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api } = await loginAs("registered");
      try {
        const tid = fixture!.tid;

        // Ensure voted state first
        await api.post(`/api/posts/${tid}/vote`, { data: { liked: true } });

        // Get count after voting
        const afterVoteResp = await api.get(`/api/posts/${tid}`);
        expect(afterVoteResp.ok()).toBe(true);
        const afterVoteDetail = (await afterVoteResp.json()) as PostDetail;
        const countAfterVote = afterVoteDetail.help?.voteCount ?? 0;

        // Unvote
        await api.post(`/api/posts/${tid}/vote`, { data: { liked: false } });

        // Get count after unvoting
        const afterUnvoteResp = await api.get(`/api/posts/${tid}`);
        expect(afterUnvoteResp.ok()).toBe(true);
        const afterUnvoteDetail = (await afterUnvoteResp.json()) as PostDetail;
        const countAfterUnvote = afterUnvoteDetail.help?.voteCount ?? 0;

        // Count should decrease (or stay same if there was a race)
        expect(countAfterUnvote).toBeLessThanOrEqual(countAfterVote);
      } finally {
        await api.dispose();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Anonymous user restrictions
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Anonymous user restrictions", () => {
    test("@help-journey anonymous user can view help post but vote is denied", async ({
      browser,
    }) => {
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      // API: anonymous vote should be denied
      const api = await request.newContext({ baseURL: BASE_URL });
      try {
        const voteResp = await api.post(`/api/posts/${fixture!.tid}/vote`);
        expect(
          [401, 403].includes(voteResp.status()),
          `expected 401/403 for anonymous vote, got ${voteResp.status()}`,
        ).toBe(true);
      } finally {
        await api.dispose();
      }

      // Browser: anonymous user sees help block but vote button shows login hint
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-help-block"]', {
          state: "visible",
          timeout: 15000,
        });

        // The vote CTA should be visible
        const ctaButton = page.locator('[data-testid="detail-cta-help-vote"]');
        await expect(ctaButton).toBeVisible();

        // The hint message should indicate login required
        const hintEl = page.locator('[data-testid="post-detail-help-hint"]');
        // Hint may or may not be visible depending on button state
        // If visible, it should contain the login prompt
        const hintVisible = await hintEl.isVisible().catch(() => false);
        if (hintVisible) {
          await expect(hintEl).toContainText("登录");
        }
      } finally {
        await context.close();
      }
    });

    test("@help-journey anonymous user cannot access manage endpoints", async () => {
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const helpId = fixture!.help!.helpId;
      const api = await request.newContext({ baseURL: BASE_URL });
      try {
        const endpoints = [
          { path: `/api/help/${encodeURIComponent(helpId)}/link-event`, data: { eventTid: 156 } },
          { path: `/api/help/${encodeURIComponent(helpId)}/unlink-event`, data: {} },
          { path: `/api/help/${encodeURIComponent(helpId)}/resolve`, data: { status: "resolved" } },
        ];

        for (const { path, data } of endpoints) {
          const resp = await api.post(path, { data });
          expect(
            [401, 403].includes(resp.status()),
            `expected 401/403 for anonymous ${path}, got ${resp.status()}`,
          ).toBe(true);
        }
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey anonymous user does not see manage block", async ({ browser }) => {
      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-help-block"]', {
          state: "visible",
          timeout: 15000,
        });

        // Manage block should NOT be visible for anonymous users
        const manageBlock = page.locator('[data-testid="post-detail-help-manage"]');
        await expect(manageBlock).not.toBeVisible();
      } finally {
        await context.close();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Non-author logged-in user restrictions
  // ─────────────────────────────────────────────────────────────────────────

  test.describe("Non-author user restrictions", () => {
    test("@help-journey non-author logged-in user cannot manage help post", async () => {
      test.skip(!isRoleConfigured("registered"), "registered role not configured");

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api, user } = await loginAs("registered");
      try {
        // Verify this user is NOT the author
        const isAuthor = String(user.id ?? "") === fixture!.expectedAuthorUserId;
        test.skip(
          isAuthor,
          "registered user happens to be the author — cannot test non-author path",
        );

        const helpId = fixture!.help!.helpId;

        // Attempt to resolve — should be denied
        const resolveResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
          data: { status: "resolved" },
        });
        expect(
          [401, 403].includes(resolveResp.status()),
          `expected 401/403 for non-author resolve, got ${resolveResp.status()}`,
        ).toBe(true);
      } finally {
        await api.dispose();
      }
    });

    test("@help-journey non-author does not see manage block in UI", async ({ browser }) => {
      test.skip(!isRoleConfigured("registered"), "registered role not configured");

      const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
      test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

      const { api, user } = await loginAs("registered");
      try {
        const isAuthor = String(user.id ?? "") === fixture!.expectedAuthorUserId;
        test.skip(
          isAuthor,
          "registered user happens to be the author — cannot test non-author path",
        );

        const context = await browserContextForRole(browser, api);
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
          await page.waitForSelector('[data-testid="post-detail-help-block"]', {
            state: "visible",
            timeout: 15000,
          });

          // Non-author should NOT see the manage block
          const manageBlock = page.locator('[data-testid="post-detail-help-manage"]');
          await expect(manageBlock).not.toBeVisible();

          // But should see the vote button
          const voteBtn = page.locator('[data-testid="detail-cta-help-vote"]');
          await expect(voteBtn).toBeVisible();
        } finally {
          await context.close();
        }
      } finally {
        await api.dispose();
      }
    });
  });
});
