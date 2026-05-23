import { expect, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * PRD V0.2 §4.2.2 — body polish candidate slot + apply / single-step revert.
 *
 * Step B (PR #826) parked the LLM-polished body in a `bodyCandidate` slot
 * instead of overwriting the textarea silently. The contract (per PRD) is:
 *
 *   1. Receiving a candidate must NOT mutate the body the user is typing.
 *      The candidate sits in `PublishCandidateBar` until the user opts in.
 *   2. Clicking "帮我润色" replaces the body with the candidate; the bar
 *      morphs into "撤回润色" mode.
 *   3. Clicking "撤回润色" restores the previous body (single-step undo).
 *      The bar flips back to "帮我润色" and the candidate is still
 *      applicable for a re-apply with one click.
 *   4. After the user types a third value into the body, the candidate
 *      slot is invalidated entirely — the bar disappears and revert is
 *      no longer reachable. PRD V0.2 explicitly scopes the undo history
 *      to a single step; this is not an unbounded undo stack.
 *
 * Why we stub `/api/ai/post-preview`:
 *
 *   The candidate is fed by `usePublishLlmTick` → `fetchPublishLlmCandidates`
 *   which posts to `/api/ai/post-preview`. On nat100 that endpoint is wired
 *   to a real provider whose latency and content are not deterministic. We
 *   intercept with `page.route` and fulfill a `candidates.bodyCandidate`
 *   payload of our choosing so the four assertions below describe behaviour
 *   under a known input. The brand strings ("帮我润色", "撤回润色", and the
 *   "AI 正文润色候选" aria-label) are imported via the same brand module the
 *   component renders from, so a future glyph change has one source of
 *   truth and this spec follows it.
 *
 * Selectors are anchored on the testids the component already exposes
 * (`publish-candidate-bar` + `publish-candidate-bar-action`) plus accessible
 * names from the brand constants. We never hard-code the literal Chinese.
 */

import {
  PUBLISH_BODY_CANDIDATE_APPLY,
  PUBLISH_BODY_CANDIDATE_REVERT,
  PUBLISH_BODY_CANDIDATE_LABEL,
} from "../../src/config/brand/publish";

const ORIGINAL_BODY = "用户原本写的正文";
const POLISHED_BODY = "AI 帮你打磨过的更顺的正文";

/**
 * Local helper: stub the LLM preview endpoint with a fixed `bodyCandidate`.
 *
 * Helper is private to this spec per the parallel-agent boundary in the
 * task brief — we do not touch the shared `tests/e2e/fixtures` directory or
 * any helper module another sibling spec might also be writing into.
 */
async function stubLlmPreview(page: import("@playwright/test").Page, bodyCandidate: string | null) {
  await page.route("**/api/ai/post-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate,
          suggestedComponents: [],
          inferredKind: null,
          modelLatencyMs: 12,
          modelName: "stub",
        },
      }),
    });
  });
}

test.describe("@registered publish §4.2.2 — body candidate apply / single-step revert", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
  });

  test("body stays user-typed; bar offers apply, then revert, then invalidates on retype", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await stubLlmPreview(page, POLISHED_BODY);

      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();
      await expect(page.locator(".publish-composer")).toBeVisible();

      const titleInput = page.locator(".publish-composer__headline input");
      const bodyTextarea = page.locator(".publish-composer__body-field textarea");
      const bar = page.locator('[data-testid="publish-candidate-bar"]');
      const action = page.locator('[data-testid="publish-candidate-bar-action"]');

      // Drive the LLM tick: title + body are watched by `usePublishLlmTick`
      // and a paused-typing window (PUBLISH_LLM_TICK_DEBOUNCE_MS = 800ms)
      // fires the request our route handler intercepts.
      await titleInput.fill("一篇晚饭后的随手记");
      await bodyTextarea.fill(ORIGINAL_BODY);

      // Case 1: candidate arrives but body remains the user's text. The bar
      // is the only surface the candidate is visible from.
      await expect(bar).toBeVisible();
      await expect(bar).toHaveAttribute("aria-label", PUBLISH_BODY_CANDIDATE_LABEL);
      await expect(action).toHaveAttribute("data-mode", "apply");
      await expect(action).toHaveAccessibleName(PUBLISH_BODY_CANDIDATE_APPLY);
      await expect(action).toHaveText(PUBLISH_BODY_CANDIDATE_APPLY);
      await expect(bodyTextarea).toHaveValue(ORIGINAL_BODY);

      // Case 2: clicking apply replaces body with candidate; bar flips to revert.
      await action.click();
      await expect(bodyTextarea).toHaveValue(POLISHED_BODY);
      await expect(bar).toBeVisible();
      await expect(action).toHaveAttribute("data-mode", "revert");
      await expect(action).toHaveAccessibleName(PUBLISH_BODY_CANDIDATE_REVERT);
      await expect(action).toHaveText(PUBLISH_BODY_CANDIDATE_REVERT);

      // Case 3: clicking revert restores the user's original body; bar flips
      // back to apply and is still actionable for a re-apply.
      await action.click();
      await expect(bodyTextarea).toHaveValue(ORIGINAL_BODY);
      await expect(bar).toBeVisible();
      await expect(action).toHaveAttribute("data-mode", "apply");
      await expect(action).toHaveAccessibleName(PUBLISH_BODY_CANDIDATE_APPLY);

      // Case 4: re-apply once more, then have the user type a third value.
      // PRD V0.2 §4.2.2 wording: "用户继续输入 → candidate 失效，单步还原栈
      // 不再可达". The bar must disappear; revert is no longer reachable.
      //
      // We pause the route so the keystrokes that follow do NOT trigger a
      // brand-new candidate landing on the slot before our assertion runs.
      // (The watcher inside usePublishLlmTick re-fires on every body change
      // after the debounce window; a fresh response would re-show the bar
      // and the spec would race against itself.)
      await action.click();
      await expect(bodyTextarea).toHaveValue(POLISHED_BODY);
      await stubLlmPreview(page, null);

      // Append a third character so the body becomes neither the candidate
      // nor the saved-previous. `createBodyCandidate`'s body watcher then
      // clears bodyCandidate + bodyBeforeCandidate, which makes
      // `bodyCandidateVisible` false.
      await bodyTextarea.focus();
      await bodyTextarea.press("End");
      await bodyTextarea.type(" 又改了一句");
      await expect(bodyTextarea).toHaveValue(`${POLISHED_BODY} 又改了一句`);

      await expect(bar).toBeHidden();
      await expect(action).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
