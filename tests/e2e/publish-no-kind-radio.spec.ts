/**
 * PRD V0.2 §6 step F regression guard — `publish-no-kind-radio.spec.ts`
 * (RFC row S7 in `docs/agent/rfc/e2e-v02-prd-coverage.md`, issue #876).
 *
 * Step F (#868) deletes the 4-radio `publishKind` fieldset on PublishView
 * (regular / event / merchant / trade). Wire-`kind` is now inferred at
 * submit time (`src/features/publish/inferKind.ts`); the `publishKind` ref
 * still exists and is mutated by suggested-component ghosts, but the user
 * never sees a radio. This spec is the lock: open the publish surface as
 * a logged-in registered user and assert the radios + their brand-string
 * labels are absent from the DOM.
 *
 * Distinct from `publish-step-f-no-radio.spec.ts` (the in-PR atomic check
 * landed with #868, which asserts on `data-testid` hooks): this spec drives
 * the assertion off the `src/config/brand/{merchant,trade}.ts` constants
 * the legacy radios used to render with, so a regression that brings back
 * the radios under any new test-id wiring still trips the guard. Both
 * specs are intentionally cheap; if one is ever consolidated, this one is
 * the canonical RFC-row check.
 *
 * Skip envelope: `loginAs("registered")` requires
 * LIAN_E2E_REGISTERED_USERNAME / _PASSWORD. Without them the spec skips
 * cleanly — a missing seed is not a test failure (see
 * `[[project-e2e-secrets-state]]`). The same shape as every other
 * publish-touching spec in this directory.
 */

import { expect, test } from "@playwright/test";

import {
  PUBLISH_TYPE_EVENT,
  PUBLISH_TYPE_MERCHANT,
  PUBLISH_TYPE_REGULAR,
} from "../../src/config/brand/merchant";
import { PUBLISH_TYPE_TRADE } from "../../src/config/brand/trade";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * Legacy radio labels the 4-radio fieldset used to render. Imported from
 * the same brand constants the deleted template referenced (PR #868 diff
 * line 213-218 of pre-step-F PublishView.vue), so a future regression that
 * re-introduces the fieldset under different test-ids still trips this
 * guard via the visible label text.
 *
 * If a future copy revision renames any of these constants, the import
 * fails fast and the spec must be updated alongside the source — that is
 * the intent: spec stays decoupled from the literal Chinese glyphs.
 */
const LEGACY_KIND_LABELS = [
  PUBLISH_TYPE_REGULAR,
  PUBLISH_TYPE_EVENT,
  PUBLISH_TYPE_MERCHANT,
  PUBLISH_TYPE_TRADE,
] as const;

test.describe("@registered publish §6 step F — no kind-radio", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("PublishView no longer renders any radio for the legacy 4 kinds", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await page.goto("/#/publish");
      // Sanity: the publish surface itself mounted, so a zero count below is
      // "the radios are gone" not "the page failed to render".
      await expect(page.locator(".publish-view")).toBeVisible();

      // Primary check (issue #876 acceptance): no radio with a publishKind
      // name. The legacy DOM used `name="publish-kind"`; the issue body
      // quotes `publishKind`. Cover both spellings so a regression that
      // brings the fieldset back under either name still trips.
      await expect(
        page.locator('input[type="radio"][name="publish-kind"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('input[type="radio"][name="publishKind"]'),
      ).toHaveCount(0);

      // Belt-and-braces: the legacy fieldset rendered each kind as a
      // `<input value="regular|event|merchant|trade">` radio. Even if a
      // regression renames the radio group, the per-value radios still
      // would not exist as type=radio inputs.
      for (const value of ["regular", "event", "merchant", "trade"]) {
        await expect(
          page.locator(`input[type="radio"][value="${value}"]`),
        ).toHaveCount(0);
      }

      // Brand-label check: the labels next to each legacy radio came from
      // PUBLISH_TYPE_{REGULAR,EVENT,MERCHANT,TRADE}. None of those strings
      // should appear inside the publish-view subtree any more (the four
      // labels are unique to the deleted fieldset — they are not reused
      // elsewhere in PublishView).
      const publishView = page.locator(".publish-view");
      for (const label of LEGACY_KIND_LABELS) {
        await expect(publishView.getByText(label, { exact: true })).toHaveCount(0);
      }
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
