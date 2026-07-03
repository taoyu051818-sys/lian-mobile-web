/**
 * PRD V0.2 §4.1 — `publish-llm-trigger-matrix.spec.ts` (RFC row S2,
 * tracking issue #871).
 *
 * The LLM preview tick (`/api/ai/post-preview`) is auto-triggered. The
 * contract is:
 *
 *   1. Continuous typing must NOT fire the tick. The watcher inside
 *      `usePublishLlmTick` re-arms its debounce on every keystroke, so a
 *      burst of edits within the debounce window collapses into zero
 *      requests.
 *   2. A pause >800ms (`PUBLISH_LLM_TICK_DEBOUNCE_MS`) after typing fires
 *      exactly one request.
 *   3. Image upload fires one request.
 *   4. Location pick fires one request.
 *   5. Submit must NOT fire an additional preview request — submit goes to
 *      `/api/ai/post-publish` (or `/api/events`), never re-routes through
 *      the preview endpoint.
 *
 * Why the spec exists alongside the unit suite (`tests/publish/usePublishLlmTick.test.ts`):
 *
 *   The unit test exercises the hook in isolation against a fake fetcher.
 *   Real-DOM coverage validates the *wiring* — that PublishComposer mounts
 *   the hook with the right refs, that the textarea/title input feed it,
 *   and that the toolbar wired image-upload/location-pick triggers through
 *   `refresh()` (PRD §4.1 lists both as additional triggers; #847 exposed
 *   the hook surface but did not bind these triggers in the composer).
 *
 * Sibling-agent contract: this file is self-contained per
 * `[[feedback-parallel-worktree-duplicate-work]]`. No edits to
 * `tests/e2e/fixtures/accounts.ts`, no shared helper, no playwright config
 * change.
 *
 * Skip envelope: matches `publish-card-as-editor.spec.ts` —
 * `loginAs("registered")` requires LIAN_E2E_REGISTERED_USERNAME / _PASSWORD;
 * without them the spec skips cleanly. Missing seed is not a failure
 * (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { PUBLISH_SUBMIT } from "../../src/config/brand/publish";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

// ---------------------------------------------------------------------------
// Local helpers (private to this spec — see sibling-agent contract above).
// ---------------------------------------------------------------------------

interface PreviewHit {
  /** Server wire shape: aiPreview.ts builds `{userText, imageUrl, locationHint}`. */
  userText: string;
  imageUrl: string;
  locationHint: string;
}

/**
 * Install a counting stub on `/api/ai/post-preview`. Every call appends to
 * the returned `hits` array; the stub always replies with an empty
 * `candidates` envelope so neither the title nor body candidate slots are
 * populated (the spec asserts on hit count + payload, not on UI side
 * effects of the response).
 */
async function installPreviewCounter(context: BrowserContext): Promise<{ hits: PreviewHit[] }> {
  const hits: PreviewHit[] = [];
  await context.route("**/api/ai/post-preview", async (route) => {
    const raw = route.request().postData() ?? "{}";
    let parsed: Partial<PreviewHit>;
    try {
      parsed = JSON.parse(raw) as Partial<PreviewHit>;
    } catch {
      parsed = {};
    }
    hits.push({
      userText: typeof parsed.userText === "string" ? parsed.userText : "",
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
      locationHint: typeof parsed.locationHint === "string" ? parsed.locationHint : "",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: null,
          suggestedComponents: [],
          inferredKind: null,
          modelLatencyMs: 4,
          modelName: "e2e-trigger-stub",
        },
      }),
    });
  });
  return { hits };
}

/**
 * Stub `/api/ai/post-publish` so submit completes hermetically. The spec
 * asserts no *preview* hit fires on submit, so it doesn't matter what the
 * publish endpoint returns — only that it captures the click without
 * touching nat100.
 */
async function stubPublishSink(context: BrowserContext) {
  await context.route("**/api/ai/post-publish", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, tid: 9101, place: null }),
    });
  });
}

async function openPublish(page: Page) {
  await page.goto("/#/publish");
  await expect(page.locator(".publish-view")).toBeVisible();
  await expect(page.locator(".publish-composer")).toBeVisible();
}

/** Type N characters one at a time with a tight inter-key delay (sub-debounce). */
async function typeBurst(page: Page, selector: string, text: string, delayMs: number) {
  const locator = page.locator(selector).first();
  await locator.focus();
  await locator.pressSequentially(text, { delay: delayMs });
}

test.describe("@registered publish §4.1 — LLM trigger matrix", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  // -------------------------------------------------------------------------
  // Test 1 — typing burst (0), idle pause (+1), submit (+0 additional).
  //
  // This is the part of the trigger matrix the current PublishComposer
  // wiring already supports: the hook watches `[title, body]` refs and
  // PUBLISH_LLM_TICK_DEBOUNCE_MS is 800ms. We type 5 chars at 80ms apart
  // (well under the debounce), then wait 1100ms for the tick to land, then
  // click submit and confirm no additional preview hit fires.
  // -------------------------------------------------------------------------
  test("typing burst zero, idle pause +1, submit zero additional", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      const { hits } = await installPreviewCounter(context);
      await stubPublishSink(context);

      await openPublish(page);

      // Title is required to enable submit later. Fill it in once up front
      // so the body burst is the only thing churning under the debounce.
      await page.locator(".publish-composer__headline input").first().fill("E2E trigger matrix");

      // Step 1: typing burst — 5 characters, 80ms apart (≪ 800ms debounce).
      // The watcher re-arms on every keystroke, so the cumulative count
      // stays at 0 while we're still inside the debounce window.
      await typeBurst(page, ".publish-composer__body-field textarea", "abcde", 80);
      // Sample a couple of times during the burst — the count must stay 0.
      await page.waitForTimeout(120);
      expect(hits, `expected zero hits during typing burst, got ${hits.length}`).toHaveLength(0);

      // Step 2: idle pause — wait past the 800ms debounce. Exactly one
      // preview hit must land after the watcher's timer fires.
      await expect.poll(() => hits.length, { timeout: 3_000 }).toBe(1);
      expect(hits[0].userText).toContain("abcde");

      // Step 3: submit — must NOT fire an additional preview hit. The
      // submit button calls `/api/ai/post-publish` (stubbed above); the
      // preview hook is unaffected.
      const beforeSubmit = hits.length;
      await page.getByTestId("publish-card").getByRole("button", { name: PUBLISH_SUBMIT }).click();
      // Give the submit click time to fire, and any spurious preview
      // request time to land. 600ms is below the debounce so a stray
      // re-typed character between focus changes also wouldn't fire.
      await page.waitForTimeout(600);
      expect(
        hits.length,
        `submit click must not trigger an additional preview tick (was ${beforeSubmit}, now ${hits.length})`,
      ).toBe(beforeSubmit);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Test 2 — image upload triggers an additional preview tick with
  // `imageUrl` populated.
  //
  // PRD §4.1 names image upload as an explicit additional trigger
  // alongside the debounced typing pause. PR #847 exposed
  // `usePublishLlmTick().refresh()` for exactly this hook-up, but the
  // composer-side wiring (calling `refresh()` from the upload completion
  // path) is not yet on main as of this PR — see `usePublishLlmTick`
  // file-level comment "What this PR does NOT do (E-main): Trigger on
  // image upload or location pick" and PublishComposer.vue, which mounts
  // the hook without `imageUrls` / `locationLabel` refs. Issue #871 calls
  // out the gap explicitly: "implementation may need a follow-up".
  //
  // We mark this test `fixme` so the spec lands as the executable
  // contract for the wiring follow-up to fulfill, rather than skipping
  // silently. Once the composer wires `refresh()` into the upload
  // success path the `.fixme` comes off in a one-line follow-up PR.
  // -------------------------------------------------------------------------
  test.fixme("image upload triggers a preview tick with imageUrl populated", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      const { hits } = await installPreviewCounter(context);
      // Stub the upload endpoint so the upload completes hermetically.
      await context.route("**/api/upload/image*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            url: "https://lian.nat100.top/uploads/e2e-trigger-matrix.png",
          }),
        });
      });

      await openPublish(page);
      await page.locator(".publish-composer__headline input").first().fill("E2E image trigger");
      await page
        .locator(".publish-composer__body-field textarea")
        .first()
        .fill("Body grounding so the tick has something to send.");

      // Settle the typing-debounce tick first so we can isolate the
      // image-upload tick that follows.
      await expect.poll(() => hits.length, { timeout: 3_000 }).toBeGreaterThanOrEqual(1);
      const beforeUpload = hits.length;

      // 1×1 transparent PNG.
      const PNG_1X1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
        "base64",
      );
      await page.locator(".publish-composer__hidden-input").setInputFiles({
        name: "trigger.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      });

      // Wait for one additional hit to land after the upload completes.
      await expect.poll(() => hits.length, { timeout: 5_000 }).toBe(beforeUpload + 1);
      const uploadHit = hits[hits.length - 1];
      expect(
        uploadHit.imageUrl,
        `image-upload tick payload should carry imageUrl, got ${JSON.stringify(uploadHit)}`,
      ).not.toBe("");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Test 3 — location pick triggers an additional preview tick with
  // `locationHint` populated.
  //
  // Same wiring gap as Test 2: PRD §4.1 names location pick as an
  // additional trigger but the composer does not currently bind it. The
  // location panel is owned by `usePublishLocationOptions` one level up
  // from the composer; the planned follow-up will pipe the location-pick
  // event into `usePublishLlmTick().refresh()` with the new
  // `locationLabel` ref. Marked `.fixme` so the spec lands as a contract.
  // -------------------------------------------------------------------------
  test.fixme("location pick triggers a preview tick with locationHint populated", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      const { hits } = await installPreviewCounter(context);

      await openPublish(page);
      await page.locator(".publish-composer__headline input").first().fill("E2E location trigger");
      await page
        .locator(".publish-composer__body-field textarea")
        .first()
        .fill("Body grounding for the location-pick tick.");
      await expect.poll(() => hits.length, { timeout: 3_000 }).toBeGreaterThanOrEqual(1);
      const beforeLocation = hits.length;

      // Open the location panel and pick a manual entry — the smallest
      // user gesture that produces a non-empty `locationLabel`. Once
      // the wiring lands, the composer's `refresh()` call should fire
      // a tick whose payload `locationHint` matches the typed text.
      await page.getByRole("button", { name: /地点/ }).first().click();
      const manualInput = page
        .locator('input[placeholder*="图书馆"], input[placeholder*="食堂"]')
        .first();
      if ((await manualInput.count()) > 0) {
        await manualInput.fill("教学楼");
      }

      await expect.poll(() => hits.length, { timeout: 5_000 }).toBe(beforeLocation + 1);
      const locationHit = hits[hits.length - 1];
      expect(
        locationHit.locationHint,
        `location-pick tick payload should carry locationHint, got ${JSON.stringify(locationHit)}`,
      ).not.toBe("");
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
