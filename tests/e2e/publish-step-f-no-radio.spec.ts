import { expect, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * PRD V0.2 step F (§2.2 / §6 step F) — kind-by-radio is gone.
 *
 * User-visible contract: a logged-in user lands on `/publish` and the
 * 4-radio "publishKind" fieldset (regular / event / merchant / trade) is
 * not present. Type-specific panels (event / merchant / trade) only mount
 * when the inline ghost-component list flips `publishKind` via
 * `accept(suggestedComponent)` — they are not gated on radios.
 *
 * Wire-`kind` is inferred at submit time by `inferKind`; the spec does not
 * try to publish a post here (that path is exercised by the existing
 * journey.spec.ts publish smoke). Step F's atomic deliverable is the
 * removal of the fieldset, so this spec is scoped tightly: open the page,
 * assert the fieldset is gone, assert the composer is still up.
 *
 * Skips (no role configured / network failure) drop cleanly so the spec
 * doesn't gate CI when secrets aren't provisioned. The same
 * `loginAs("registered")` pattern is what every other publish-touching
 * spec in this directory uses.
 */

test.describe("@registered publish step F — no kind radio", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
  });

  test("the publish surface no longer renders a publishKind radio fieldset", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      // Step F atomic check: the fieldset and every per-radio testid are
      // absent. We assert on count rather than visibility because the
      // template removed the DOM nodes entirely (no v-show / display:none).
      await expect(page.locator('[data-testid="publish-type-switch"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="publish-type-event"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="publish-type-merchant"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="publish-type-trade"]')).toHaveCount(0);
      await expect(page.locator('input[name="publish-kind"]')).toHaveCount(0);

      // Composer is still up — kind selection is handled elsewhere
      // (suggested-component ghosts), but title/body input is unchanged.
      await expect(page.locator(".publish-composer")).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
