/**
 * PRD V0.2 §3 Card-as-Editor structural guard — RFC row S1 in
 * `docs/agent/rfc/e2e-v02-prd-coverage.md`, issue #870.
 *
 * The publish surface is one full-screen card whose fields ARE the editing
 * surface. There is no `preview` ↔ `edit` toggle button and no
 * mount/unmount of a separate "preview component". Display state and edit
 * state are styling branches of the same DOM tree (`.is-editing` toggles,
 * focus state, etc.) — never two components swapped at the v-if seam.
 *
 * What this spec locks (PRD §3 acceptance):
 *
 *   1. Exactly one card-shell root mounts on the publish surface (so a
 *      regression that re-introduces a `<PublishPreview />` ↔
 *      `<PublishEditor />` v-if pair would push the count to 2 and trip
 *      this assertion).
 *   2. No element exposes a "preview / edit" mode toggle — neither a
 *      Chinese-label button (`预览模式` / `切换到编辑` / `进入编辑`) nor a
 *      `role=button` whose `aria-pressed` cycles between `preview` /
 *      `edit` modes nor a `[aria-label*="preview"]` button.
 *   3. Clicking the title region focuses the title `<input>` directly
 *      (no intermediate `role=button` / `aria-expanded=true` step).
 *   4. Clicking the body region focuses the body `<textarea>` directly.
 *   5. The card root is the same DOM node before and after a field is
 *      clicked into edit mode. We hold the element-handle across the click
 *      and assert it still resolves — that proves the node was not
 *      unmounted and replaced (a v-if swap would invalidate the handle).
 *
 * Sibling-agent contract (#870 / #873 / #875 / #876 are all writing
 * `tests/e2e/publish-*.spec.ts` in parallel): this file is self-contained.
 * No edits to `tests/e2e/fixtures/accounts.ts`, no shared helper file,
 * no `playwright.config.ts` change.
 *
 * `data-testid="publish-card"` was added to PublishView.vue's root section
 * to give this spec a stable selector. That single attribute is the only
 * source change; markup is otherwise untouched. Once step G mounts a
 * shared `<FeedItemCardShell>` at the publish surface, the testid travels
 * with that root and the assertion below still holds.
 *
 * Skip envelope: matches `publish-step-f-no-radio.spec.ts` —
 * `loginAs("registered")` requires LIAN_E2E_REGISTERED_USERNAME / _PASSWORD;
 * without them the spec skips cleanly. Missing seed is not a failure
 * (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * Phrases that would signal a "preview ↔ edit" toggle was reintroduced.
 * The PRD §3 / RFC S1 acceptance enumerates these explicitly. Kept local
 * to this spec because no other publish spec asserts on them and the
 * sibling-agent contract forbids new shared helper files.
 */
const PREVIEW_EDIT_TOGGLE_PHRASES = ["预览模式", "切换到编辑", "进入编辑"] as const;

async function openPublish(page: Page) {
  await page.goto("/#/publish");
  // Sanity gate: a zero count anywhere below means "the toggle is gone",
  // not "the page failed to render". Mirrors `publish-step-f-no-radio.spec.ts`.
  await expect(page.locator(".publish-view")).toBeVisible();
}

test.describe("@registered publish §3 — card-as-editor", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("publish surface is a single card with no preview/edit toggle", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await openPublish(page);

      // (1) Exactly one card-shell root. A regression that brings back a
      // separate <PublishPreview /> ↔ <PublishEditor /> v-if pair would
      // push the count to 2 (or 0 if the testid moved with the wrong
      // branch) and trip this assertion.
      await expect(page.locator('[data-testid="publish-card"]')).toHaveCount(1);

      // (2a) No phrase that signals a preview-mode toggle button.
      // We scope to `.publish-view` so any unrelated brand-string usage
      // (e.g. inside an unrelated app shell) does not contaminate the
      // assertion. Phrases are unique to a hypothetical toggle — they do
      // not appear elsewhere on the publish surface today.
      const publishView = page.locator(".publish-view");
      for (const phrase of PREVIEW_EDIT_TOGGLE_PHRASES) {
        await expect(publishView.getByText(phrase, { exact: false })).toHaveCount(0);
      }

      // (2b) No `aria-label*="preview"` button. Catches the English spelling
      // a future regression might choose ("Preview mode", "preview toggle").
      await expect(publishView.locator('button[aria-label*="preview" i]')).toHaveCount(0);

      // (2c) No `aria-pressed` button whose value/label is a preview/edit
      // mode marker. The aria-pressed motif is reserved for like / save /
      // bookmark toggles (see motion contract RFC); a "mode" pressed-toggle
      // would be a §3 violation. We assert no aria-pressed button carries
      // a `data-mode` or aria-label hinting at preview/edit cycling.
      await expect(
        publishView.locator(
          'button[aria-pressed][aria-label*="edit" i], button[aria-pressed][aria-label*="preview" i]',
        ),
      ).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("clicking the title region focuses the title input directly without an intermediate toggle", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await openPublish(page);

      // The card root is held as an ElementHandle across the click. If a
      // v-if regression unmounts and remounts the root on click, the
      // handle becomes stale and `evaluate` throws. Persistence proves
      // the click flipped a *style* state, not a component-tree branch.
      const cardHandle = await page.locator('[data-testid="publish-card"]').elementHandle();
      expect(cardHandle, "publish-card root must mount before click").not.toBeNull();

      const titleInput = page.locator(".publish-composer__headline input");
      await expect(titleInput).toBeVisible();

      // The composer renders the title `<input>` inside a `<label>` whose
      // text is the title field label. There is no intermediate
      // role=button / aria-expanded element between the label and the
      // input — the input IS the editing surface (PRD §3). Asserting on
      // the absence first locks the structural contract; the focus
      // assertion afterwards locks the behaviour.
      await expect(page.locator(".publish-composer__headline [role='button']")).toHaveCount(0);
      await expect(page.locator(".publish-composer__headline [aria-expanded='true']")).toHaveCount(
        0,
      );

      await titleInput.click();
      await expect(titleInput).toBeFocused();

      // Card root must still resolve — same node, not a remount.
      const stillThere = await cardHandle!.evaluate((el) => el.isConnected);
      expect(
        stillThere,
        "card root unmounted on title click — V0.2 §3 forbids preview↔edit remounts",
      ).toBe(true);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("clicking the body region focuses the body textarea directly without an intermediate toggle", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await openPublish(page);

      const cardHandle = await page.locator('[data-testid="publish-card"]').elementHandle();
      expect(cardHandle, "publish-card root must mount before click").not.toBeNull();

      const bodyTextarea = page.locator(".publish-composer__body-field textarea");
      await expect(bodyTextarea).toBeVisible();

      await expect(page.locator(".publish-composer__body-field [role='button']")).toHaveCount(0);
      await expect(
        page.locator(".publish-composer__body-field [aria-expanded='true']"),
      ).toHaveCount(0);

      await bodyTextarea.click();
      await expect(bodyTextarea).toBeFocused();

      const stillThere = await cardHandle!.evaluate((el) => el.isConnected);
      expect(
        stillThere,
        "card root unmounted on body click — V0.2 §3 forbids preview↔edit remounts",
      ).toBe(true);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
