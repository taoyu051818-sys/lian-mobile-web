/**
 * PRD V0.2 §4.2.x + Motion Contract RFC — RFC row S11 in
 * `docs/agent/rfc/e2e-v02-prd-coverage.md`, issue #880.
 *
 * When `prefers-reduced-motion: reduce` is set, the LLM ghost suggestion
 * list and the candidate bars MUST not animate — the
 * `publish-suggested--reduced` BEM modifier on the `<ul>` strips
 * `transition` to `none`, and the candidate bars themselves never
 * declare a `transition` rule.
 *
 * What this spec locks:
 *
 *   1. Under `reducedMotion: 'reduce'`, after a tick lands and the
 *      ghost list mounts, every `.publish-suggested__item` reports
 *      `transitionDuration === "0s"` (the BEM modifier is applied via
 *      `useReducedMotion`).
 *   2. Under the same media emulation, `PublishCandidateBar` and
 *      `PublishTitleCandidateBar` each report `transitionDuration ===
 *      "0s"`. (They have no transition declared today, but the spec
 *      pins the contract so a future polish PR can't slide one in
 *      without honouring reduced-motion.)
 *   3. Sanity baseline: with NO reduced-motion emulation, the ghost
 *      item's `transitionDuration` is non-zero — that's what proves
 *      the toggle is actually exercised, not just "everything is 0s
 *      everywhere".
 *
 * What this spec mocks:
 *   - `/api/ai/post-preview` — drive `bodyCandidate` + 1
 *     `suggestedComponents` entry deterministically. The publish flow
 *     calls this endpoint after a debounced (≥800ms) keystroke pause.
 *
 * Skip envelope: matches sibling specs — `loginAs("registered")`
 * requires LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD;
 * without them the spec skips cleanly. Missing seed is not a failure
 * (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

interface PreviewStubOptions {
  bodyCandidate?: string | null;
  suggestedComponents?: Array<{ type: string; reason: string }>;
}

/**
 * Stub `/api/ai/post-preview` with a deterministic candidate + 1 ghost
 * suggestion. Helper kept private to this spec per the parallel-agent
 * boundary in the task brief.
 */
async function stubPostPreview(context: BrowserContext, options: PreviewStubOptions = {}) {
  await context.route("**/api/ai/post-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: options.bodyCandidate ?? "AI 帮你打磨过的更顺的正文",
          suggestedComponents: options.suggestedComponents ?? [
            { type: "location", reason: "加个地点会让别人更容易找到你" },
          ],
          inferredKind: null,
          modelLatencyMs: 5,
          modelName: "stub-model",
        },
      }),
    });
  });
}

async function typeTitleAndBody(page: Page, title: string, body: string) {
  await page.locator(".publish-composer__headline input").fill(title);
  await page.locator(".publish-composer__body-field textarea").fill(body);
}

/**
 * Returns the computed `transitionDuration` of the first element matching
 * `selector`, or `null` if the element is not present. Reading inside a
 * `page.evaluate` (rather than via Playwright's `evaluate` on a locator)
 * keeps the call-site shape uniform for absent / present nodes.
 */
async function readTransitionDuration(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel: string) => {
    const node = document.querySelector(sel) as HTMLElement | null;
    if (!node) return null;
    return window.getComputedStyle(node).transitionDuration;
  }, selector);
}

test.describe("@registered publish §4.2.x — reduced-motion strips ghost + candidate-bar transitions", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("ghost suggestion item has transitionDuration=0s under reducedMotion=reduce", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({
      storageState: await api.storageState(),
      reducedMotion: "reduce",
    });
    try {
      await stubPostPreview(context);

      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(page, "E2E reduced motion", "Body to drive the LLM tick.");

      // The list mounts only when at least one suggestedComponent landed.
      const ghostItem = page.locator('[data-testid="publish-suggested-item"]').first();
      await expect(ghostItem).toBeVisible({ timeout: 10_000 });

      const duration = await readTransitionDuration(page, '[data-testid="publish-suggested-item"]');
      // CSS computed-style normalizes `transition: none` to "0s"; the
      // `publish-suggested--reduced` modifier sets `transition: none`
      // when `useReducedMotion()` flips, which is exactly what we expect.
      expect(duration).toBe("0s");

      // Pin the BEM modifier directly too — a future regression that
      // strips the modifier but keeps `transition: none` would still
      // pass the duration check; this assertion catches that branch.
      await expect(page.locator(".publish-suggested.publish-suggested--reduced")).toHaveCount(1);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("body + title candidate bars have transitionDuration=0s under reducedMotion=reduce", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({
      storageState: await api.storageState(),
      reducedMotion: "reduce",
    });
    try {
      await stubPostPreview(context, {
        bodyCandidate: "AI 帮你打磨过的更顺的正文",
        suggestedComponents: [],
      });

      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(
        page,
        "E2E reduced motion bars",
        "Body that triggers the bodyCandidate slot.",
      );

      const bodyBar = page.locator('[data-testid="publish-candidate-bar"]');
      await expect(bodyBar).toBeVisible({ timeout: 10_000 });

      const bodyBarDuration = await readTransitionDuration(
        page,
        '[data-testid="publish-candidate-bar"]',
      );
      expect(bodyBarDuration).toBe("0s");

      // The title-candidate bar mounts only when the title-candidate slot
      // is populated. Our preview stub does not seed `title`, so the bar
      // may or may not be on the page at this point — read its duration
      // only if it is visible. The body-bar assertion above is the
      // primary anchor; this one is a forward-compatibility guard for
      // when step E/F start populating titleCandidate too.
      const titleBar = page.locator('[data-testid="publish-title-candidate-bar"]');
      if ((await titleBar.count()) > 0) {
        const titleBarDuration = await readTransitionDuration(
          page,
          '[data-testid="publish-title-candidate-bar"]',
        );
        expect(titleBarDuration).toBe("0s");
      }
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("sanity baseline — without reducedMotion emulation, ghost item carries a non-zero transition", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    // No reducedMotion override on the context — defaults to "no-preference".
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await stubPostPreview(context);

      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(page, "E2E baseline motion", "Body to drive the LLM tick.");

      const ghostItem = page.locator('[data-testid="publish-suggested-item"]').first();
      await expect(ghostItem).toBeVisible({ timeout: 10_000 });

      // The base rule is `transition: opacity 160ms ..., transform 160ms ...`.
      // Computed style returns the comma-joined per-property durations
      // (e.g. `0.16s, 0.16s`). The exact text varies by browser; the
      // contract is "non-zero" — i.e. the toggle below is doing real work.
      const duration = await readTransitionDuration(page, '[data-testid="publish-suggested-item"]');
      expect(duration).not.toBe("0s");
      expect(duration).not.toBeNull();

      // Inverse modifier check — the reduced class must NOT be on the
      // list when reducedMotion is unset. Catches a regression that
      // accidentally keeps the modifier on under all media states.
      await expect(page.locator(".publish-suggested.publish-suggested--reduced")).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
