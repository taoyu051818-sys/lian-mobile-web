/**
 * PRD V0.2 §4.1 — `publish-llm-stale-and-failure.spec.ts` (RFC row S8,
 * tracking issue #877).
 *
 * The LLM preview tick (`/api/ai/post-preview`) has two race-correctness
 * obligations the unit suite locks at the hook level
 * (`tests/publish/usePublishLlmTick.test.ts`):
 *
 *   Case A — stale drop. If a response is in flight when the user keeps
 *     typing, that response must NOT mutate the candidate slots. The hook's
 *     `inflight` ticket + snapshot guard drops the stale fetch on arrival;
 *     the user keeps the body they were typing and `PublishCandidateBar`
 *     never flashes the stale `bodyCandidate` text.
 *
 *   Case B — silent failure. A 500 (or any LLM error) must not surface a
 *     toast / alert / banner. The user's draft refs stay intact, the
 *     manual submit path still works, and the publish endpoint accepts
 *     the post. PRD §4.1 names this "silent fail" — failures should be
 *     logged to telemetry but never surface UI state to interrupt the
 *     compose flow.
 *
 * This spec validates the wiring under real route latency in a real DOM.
 * The unit suite already guarantees the `inflight` race is correct in
 * isolation; this spec proves that PublishComposer + PublishCandidateBar
 * + the body textarea behave correctly when the latency happens against a
 * real Vue render loop.
 *
 * Sibling-agent contract per `[[feedback-parallel-worktree-duplicate-work]]`:
 * file is self-contained. No edits to `tests/e2e/fixtures/accounts.ts`,
 * no shared helper module, no playwright config touched.
 *
 * Skip envelope: `loginAs("registered")` requires
 * LIAN_E2E_REGISTERED_USERNAME / _PASSWORD; without them the spec skips
 * cleanly. Missing seed is not a test failure
 * (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { PUBLISH_BODY_CANDIDATE_APPLY, PUBLISH_SUBMIT } from "../../src/config/brand/publish";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

// ---------------------------------------------------------------------------
// Local helpers (private to this spec — see sibling-agent contract above).
// ---------------------------------------------------------------------------

const STALE_BODY_CANDIDATE = "STALE-BODY-CANDIDATE-FROM-OLD-DRAFT";
const ORIGINAL_DRAFT = "original";
const EXTENDED_DRAFT = "original-extended";

/**
 * Stub `/api/ai/post-preview` with a long delay before fulfilling. The
 * stub always returns the same "stale" body candidate; in Case A the
 * user keeps typing during the delay so the response arrives after the
 * snapshot has changed and must be dropped.
 */
async function stubSlowPreview(context: BrowserContext, delayMs: number) {
  await context.route("**/api/ai/post-preview", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: STALE_BODY_CANDIDATE,
          suggestedComponents: [],
          inferredKind: null,
          modelLatencyMs: delayMs,
          modelName: "e2e-stale-stub",
        },
      }),
    });
  });
}

/** Stub `/api/ai/post-preview` with a 500 to exercise the silent-fail path. */
async function stubFailingPreview(context: BrowserContext) {
  await context.route("**/api/ai/post-preview", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "llm_unavailable" } }),
    });
  });
}

/**
 * Stub `/api/ai/post-publish` so the manual-submit recovery path lands
 * hermetically. Returns a fixed tid so PublishView's success branch
 * fires without touching nat100. Resolves with the captured payload
 * when invoked, so Case B can assert the body the user typed actually
 * shipped on the wire.
 */
function stubPublishSink(context: BrowserContext): Promise<{ body: string }> {
  return new Promise((resolve) => {
    context.route("**/api/ai/post-publish", async (route) => {
      const raw = route.request().postData() ?? "{}";
      let parsed: { body?: unknown };
      try {
        parsed = JSON.parse(raw) as { body?: unknown };
      } catch {
        parsed = {};
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, tid: 9201, place: null }),
      });
      resolve({ body: typeof parsed.body === "string" ? parsed.body : "" });
    });
  });
}

async function openPublish(page: Page) {
  await page.goto("/#/publish");
  await expect(page.locator(".publish-view")).toBeVisible();
  await expect(page.locator(".publish-composer")).toBeVisible();
}

test.describe("@registered publish §4.1 — stale drop + silent failure", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  // -------------------------------------------------------------------------
  // Case A — stale drop. With a 2s delay on the preview endpoint, the user
  // pauses past the debounce (firing the tick), then keeps typing so by
  // the time the response lands the body snapshot has moved on. The hook
  // must drop the response: the textarea retains the latest user value,
  // and `PublishCandidateBar` never flashes the stale candidate text.
  // -------------------------------------------------------------------------
  test("stale LLM response is dropped; bar never shows the stale candidate", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await stubSlowPreview(context, 2_000);

      await openPublish(page);
      const titleInput = page.locator(".publish-composer__headline input").first();
      const bodyTextarea = page.locator(".publish-composer__body-field textarea").first();
      const bar = page.locator('[data-testid="publish-candidate-bar"]');

      await titleInput.fill("E2E stale drop");
      await bodyTextarea.fill(ORIGINAL_DRAFT);

      // Sit idle ~900ms so the watcher's timer fires and the slow stub
      // starts its 2s wait. We're now committed to a stale response.
      await page.waitForTimeout(900);

      // Append more text BEFORE the stale response arrives. The hook's
      // snapshot guard compares `options.body.value !== bodyAtSend`; once
      // we've extended the draft, the in-flight ticket is still the
      // newest but the snapshot mismatches and the response is dropped.
      // Use `pressSequentially` so each keystroke flows through Vue's
      // input handler the same way a real user would type.
      await bodyTextarea.focus();
      await bodyTextarea.press("End");
      await bodyTextarea.pressSequentially("-extended", { delay: 30 });
      await expect(bodyTextarea).toHaveValue(EXTENDED_DRAFT);

      // Wait past the slow stub's 2s window — the dropped response would
      // have landed by now, so any leak would have flashed by 2.5s.
      await page.waitForTimeout(2_500);

      // Stale candidate must never have populated the slot. The candidate
      // bar shows when `bodyCandidate` is set + visible + not equal to
      // the body — three conditions that all hinge on the response not
      // being applied. Either of the first two would fail this assertion.
      await expect(bar).toHaveCount(0);
      // Textarea retains the user's latest value, not the stale candidate.
      await expect(bodyTextarea).toHaveValue(EXTENDED_DRAFT);
      await expect(bodyTextarea).not.toHaveValue(STALE_BODY_CANDIDATE);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Case B — silent 500. When the LLM endpoint fails, no toast / alert /
  // banner appears in the DOM; the user's draft is unchanged; manual
  // submit still works against the (separate) publish endpoint.
  //
  // PublishMessage / role=alert are the two surfaces that *would* render
  // a UI failure. We assert both stay at zero count after a 500.
  // -------------------------------------------------------------------------
  test("LLM 500 stays silent; user draft survives; manual submit still publishes", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await stubFailingPreview(context);
      const submitted = stubPublishSink(context);

      await openPublish(page);
      const titleInput = page.locator(".publish-composer__headline input").first();
      const bodyTextarea = page.locator(".publish-composer__body-field textarea").first();
      const bar = page.locator('[data-testid="publish-candidate-bar"]');
      const action = page.locator('[data-testid="publish-candidate-bar-action"]');

      const TYPED_TITLE = "E2E silent fail";
      const TYPED_BODY = "Body that the user typed; LLM is broken in this run.";
      await titleInput.fill(TYPED_TITLE);
      await bodyTextarea.fill(TYPED_BODY);

      // Wait past the debounce + a margin so the tick has fired and the
      // 500 has been swallowed. Anything UI would have shown by now.
      await page.waitForTimeout(1_500);

      // No alert / status / failure-banner rendered. We anchor on
      // role=alert (the WAI-ARIA failure surface) and the testid the
      // candidate bar uses (which would only show with a successful
      // candidate; a failed tick must leave it at count 0).
      await expect(page.locator('[role="alert"]')).toHaveCount(0);
      await expect(bar).toHaveCount(0);
      await expect(action).toHaveCount(0);
      // Step B's apply button text — if any failure path coerced the
      // bar into an "I'm here to help" mode, this would show up. It
      // must not (silent fail = nothing rendered).
      await expect(page.getByText(PUBLISH_BODY_CANDIDATE_APPLY, { exact: true })).toHaveCount(0);

      // User draft refs intact across the failure window.
      await expect(titleInput).toHaveValue(TYPED_TITLE);
      await expect(bodyTextarea).toHaveValue(TYPED_BODY);

      // Manual submit still succeeds against the separate publish
      // endpoint. The captured request body must carry what the user
      // typed — i.e. the failure didn't clobber the publish payload.
      await page.getByRole("button", { name: PUBLISH_SUBMIT }).click();
      const result = await submitted;
      expect(result.body).toBe(TYPED_BODY);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
