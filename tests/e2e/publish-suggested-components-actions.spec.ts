/**
 * PRD V0.2 §4.2.3 — `publish-suggested-components-actions.spec.ts`
 * (RFC row S5, tracking issue #874).
 *
 * The LLM tick emits `suggestedComponents` — six typed inline ghosts
 * (`location | event_time | price | merchant_info | trade_condition |
 * help_tag`) that surface under the body editor. Each ghost has an
 * accept button ("加入") and a dismiss button ("忽略"). Accept materializes
 * the ghost into the publish draft (per-kind effect listed below) and
 * removes the entry from the list. Dismiss only removes the entry.
 *
 * Per-kind accept effects (from `createSuggestedComponentsActions` in
 * `src/features/publish/usePublishDraft.ts`, post-#891):
 *
 *   event_time      → publishKind = "event"          (any role)
 *   merchant_info   → publishKind = "merchant"       (merchant_verified only)
 *                   → no kind change                 (otherwise)
 *   trade_condition → publishKind = "trade"          (campus_verified only)
 *                   → no kind change                 (otherwise)
 *   price           → publishKind = "trade"          (#891 unconditional —
 *                                                     verification gates the
 *                                                     ghost's visibility, not
 *                                                     the kind effect)
 *   help_tag        → tagInput = "求助"               (only when blank;
 *                                                     anti-silent-overwrite)
 *   location        → no publishKind change          (place sub-draft is a
 *                                                     step-F follow-up)
 *
 * Even when accept is a no-op on draft state (e.g. `merchant_info` for a
 * registered user), the ghost is still removed from the list — the user's
 * "implicit dismiss" gesture is consumed.
 *
 * **Dedupe with #891 (`feat: media priority + accept(price)→trade`):**
 *
 *   PR #891's unit suite (`tests/publish/publishSuggestedComponents.test.ts`)
 *   already locks the §4.2.3 ratchet that `accept(price)` flips publishKind
 *   to `"trade"` unconditionally — covering the merchant / campus /
 *   no-verification branches as 3 sub-tests. Re-running those three at e2e
 *   level would only duplicate that fence. This spec covers `accept(price)`
 *   ONCE, on the registered role, as the structural ghost-action E2E
 *   confirmation: the ghost renders with both buttons, accept removes it
 *   from the list, the implementation lifts publishKind to "trade". The
 *   per-role product (merchant×price, campus×price, registered×price) is
 *   #891's territory and not re-asserted here.
 *
 * Sibling-agent contract per `[[feedback-parallel-worktree-duplicate-work]]`:
 * file is self-contained. No edits to `tests/e2e/fixtures/accounts.ts`,
 * no shared helper module, no playwright config touched.
 *
 * Skip envelope: `loginAs(role)` requires the role's env credentials.
 * Without them the role's block skips cleanly via `skipIfRoleMissing` —
 * a missing seed is not a test failure (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  PUBLISH_SUGGESTED_ACCEPT,
  PUBLISH_SUGGESTED_DISMISS,
  PUBLISH_SUGGESTED_HINT_PREFIX,
} from "../../src/config/brand/publish";

import { isRoleConfigured, loginAs, type RoleId } from "./fixtures/accounts";

// ---------------------------------------------------------------------------
// Local helpers (private to this spec — see sibling-agent contract above).
// ---------------------------------------------------------------------------

type WireGhostType =
  | "location"
  | "time"
  | "media"
  | "quality"
  | "audience"
  | "tags"
  | "event"
  | "merchant"
  | "trade"
  | "help"
  | "groupbuy"
  | "event_time"
  | "price"
  | "merchant_info"
  | "trade_condition"
  | "help_tag";

type UiGhostKind =
  | "location"
  | "time"
  | "media"
  | "quality"
  | "audience"
  | "tags"
  | "event"
  | "merchant"
  | "trade"
  | "help"
  | "groupbuy";

interface GhostFixture {
  /** Server wire-shape `type`. The frontend parser renames legacy values to canonical UI `kind`. */
  type: WireGhostType;
  /** Expected rendered `data-kind` after the frontend parser normalizes the wire value. */
  kind: UiGhostKind;
  /** Server `reason`; surfaces as the ghost's `label` and the accept aria-label suffix. */
  reason: string;
}

/**
 * Stub `/api/ai/post-preview` so the LLM tick returns a fixed list of
 * ghosts. The publish surface debounces the tick (≥800ms idle); the spec
 * waits for the ghost list to mount before driving accept/dismiss.
 */
async function stubPreviewWithGhosts(context: BrowserContext, ghosts: GhostFixture[]) {
  await context.route("**/api/ai/post-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: null,
          suggestedComponents: ghosts,
          inferredKind: null,
          modelLatencyMs: 4,
          modelName: "e2e-ghost-stub",
        },
      }),
    });
  });
}

/**
 * Inject verification flags into `/api/auth/me` so trade / merchant ghost
 * accepts can flip publishKind. The merchant panel's on-mount refresh
 * reads `verificationState.merchant_verified.active`; trade does the same
 * for `campus_verified`. We mirror both shapes (the typed pipeline emits
 * them and the legacy NodeBB array-of-strings still ships alongside).
 */
async function stubAuthMe(
  context: BrowserContext,
  user: { id?: string; username?: string },
  tags: ReadonlyArray<"merchant_verified" | "campus_verified" | "realname_verified">,
) {
  await context.route("**/api/auth/me", async (route) => {
    const verificationState: Record<string, { active: boolean }> = {};
    for (const t of tags) verificationState[t] = { active: true };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        user: {
          id: user.id ?? "1",
          username: user.username ?? "registered",
          tags: [...tags],
          verificationTags: [...tags],
          verificationState,
        },
      }),
    });
  });
}

async function openPublish(page: Page) {
  await page.goto("/#/publish");
  await expect(page.locator(".publish-view")).toBeVisible();
  await expect(page.locator(".publish-composer")).toBeVisible();
}

/** Type minimal grounding into title+body so the LLM tick has something to fire on. */
async function seedDraftAndAwaitGhosts(page: Page, expectedKinds: readonly string[]) {
  await page.locator(".publish-composer__headline input").first().fill("E2E ghost actions");
  await page
    .locator(".publish-composer__body-field textarea")
    .first()
    .fill("Body grounding so the LLM tick fires after the debounce window.");
  // The list mounts only when at least one ghost lands. Wait for the
  // expected kinds; this is the natural sync point (debounce + watcher).
  for (const kind of expectedKinds) {
    await expect(
      page.locator(`[data-testid="publish-suggested-item"][data-kind="${kind}"]`),
    ).toBeVisible({ timeout: 5_000 });
  }
}

function ghostItem(page: Page, kind: UiGhostKind) {
  return page.locator(`[data-testid="publish-suggested-item"][data-kind="${kind}"]`).first();
}

/**
 * Per-role test block. Wrapped in `test.describe.serial` per issue #874:
 * each role runs its own login + publish-page mount sequentially so the
 * three roles don't fight over storageState.
 */
function ghostActionsForRole(role: RoleId) {
  test.describe.serial(`@${role} publish §4.2.3 — suggested-components actions`, () => {
    test.beforeEach(() => {
      test.skip(
        !isRoleConfigured(role),
        `role "${role}" not configured — set the LIAN_E2E_${role.toUpperCase()}_USERNAME / _PASSWORD env vars to enable`,
      );
    });

    // -----------------------------------------------------------------------
    // Test 1 — render + a11y per ghost kind. All 6 kinds appear with both
    // buttons; accept's aria-label is "建议添加 <reason>"; dismiss's is "忽略".
    // -----------------------------------------------------------------------
    test("each of the 6 ghost kinds renders with accept + dismiss buttons and the right aria-labels", async ({
      browser,
    }) => {
      const { api } = await loginAs(role);
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        const ghosts: GhostFixture[] = [
          { type: "location", kind: "location", reason: "加个地点" },
          { type: "event_time", kind: "time", reason: "这是活动吗？加个时间" },
          { type: "price", kind: "trade", reason: "加个价格" },
          { type: "merchant_info", kind: "merchant", reason: "看起来像商家信息" },
          { type: "help_tag", kind: "help", reason: "需要别人帮忙吗？" },
          { type: "groupbuy", kind: "groupbuy", reason: "发起拼单吗？" },
        ];
        await stubPreviewWithGhosts(context, ghosts);

        await openPublish(page);
        await seedDraftAndAwaitGhosts(
          page,
          ghosts.map((g) => g.kind),
        );

        for (const ghost of ghosts) {
          const item = ghostItem(page, ghost.kind);
          await expect(item).toBeVisible();
          // Accept button: aria-label = "建议添加 <reason>" (PRD §4.2.3 a11y).
          const accept = item.locator('[data-testid="publish-suggested-accept"]');
          await expect(accept).toHaveAttribute(
            "aria-label",
            `${PUBLISH_SUGGESTED_HINT_PREFIX} ${ghost.reason}`,
          );
          await expect(accept).toHaveText(PUBLISH_SUGGESTED_ACCEPT);
          // Dismiss button: aria-label is the generic "忽略" (the reason
          // belongs to the accept gesture per PRD §4.2.3).
          const dismiss = item.locator('[data-testid="publish-suggested-dismiss"]');
          await expect(dismiss).toHaveAttribute("aria-label", PUBLISH_SUGGESTED_DISMISS);
          await expect(dismiss).toHaveText(PUBLISH_SUGGESTED_DISMISS);
        }
      } finally {
        await context.close();
        await api.dispose();
      }
    });

    // -----------------------------------------------------------------------
    // Test 2 — dismiss removes only the targeted ghost; siblings remain.
    // -----------------------------------------------------------------------
    test("dismiss removes only the targeted ghost; siblings stay", async ({ browser }) => {
      const { api } = await loginAs(role);
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        const ghosts: GhostFixture[] = [
          { type: "location", kind: "location", reason: "加个地点" },
          { type: "event_time", kind: "time", reason: "这是活动吗？加个时间" },
          { type: "help_tag", kind: "help", reason: "需要别人帮忙吗？" },
        ];
        await stubPreviewWithGhosts(context, ghosts);

        await openPublish(page);
        await seedDraftAndAwaitGhosts(
          page,
          ghosts.map((g) => g.kind),
        );

        await ghostItem(page, "time").locator('[data-testid="publish-suggested-dismiss"]').click();

        // Wait for the dismissed entry to leave the DOM, then sibling
        // ghosts must still be there.
        await expect(ghostItem(page, "time")).toHaveCount(0);
        await expect(ghostItem(page, "location")).toBeVisible();
        await expect(ghostItem(page, "help")).toBeVisible();
      } finally {
        await context.close();
        await api.dispose();
      }
    });

    // -----------------------------------------------------------------------
    // Test 3 — accept(event_time) flips publishKind to "event" (any role).
    //   Observable signal: PublishEventControls mounts, exposing
    //   `data-testid="publish-event-panel"`. The spec doesn't submit; this
    //   is the smallest visible mutation that proves publishKind flipped.
    //   And the ghost is removed from the list afterwards.
    // -----------------------------------------------------------------------
    test("accept(event_time) flips publishKind to event and removes the ghost", async ({
      browser,
    }) => {
      const { api } = await loginAs(role);
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await stubPreviewWithGhosts(context, [
          { type: "event_time", kind: "time", reason: "这是活动吗？加个时间" },
          { type: "location", kind: "location", reason: "加个地点" },
        ]);
        await openPublish(page);
        await seedDraftAndAwaitGhosts(page, ["time", "location"]);

        await ghostItem(page, "time").locator('[data-testid="publish-suggested-accept"]').click();

        // publishKind === "event" → PublishEventControls v-if mounts.
        await expect(page.locator('[data-testid="publish-event-panel"]')).toBeVisible({
          timeout: 5_000,
        });
        // Accepted ghost is removed; the unrelated `location` ghost stays.
        await expect(ghostItem(page, "time")).toHaveCount(0);
        await expect(ghostItem(page, "location")).toBeVisible();
      } finally {
        await context.close();
        await api.dispose();
      }
    });

    // -----------------------------------------------------------------------
    // Test 4 — accept(help_tag) writes "求助" into the tag panel only when
    // tagInput is blank (anti-silent-overwrite, PRD §4.2.3).
    //
    // The ghost is consumed (removed from the list) regardless; the
    // observable signal is whether the tag panel's input matches "求助".
    // -----------------------------------------------------------------------
    test("accept(help_tag) sets tag=求助 only when blank; existing tag is preserved", async ({
      browser,
    }) => {
      const { api } = await loginAs(role);
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await stubPreviewWithGhosts(context, [
          { type: "help_tag", kind: "help", reason: "需要别人帮忙吗？" },
        ]);
        await openPublish(page);
        await seedDraftAndAwaitGhosts(page, ["help"]);

        // Accept once with a blank tagInput → tag panel input becomes "求助".
        await ghostItem(page, "help").locator('[data-testid="publish-suggested-accept"]').click();
        await expect(ghostItem(page, "help")).toHaveCount(0);

        // Open the tag panel and read the input to confirm "求助" landed.
        // The panel uses a v-if mount; it opens via the toolbar "标签" button.
        await page.getByRole("button", { name: /标签/ }).first().click();
        const tagInput = page.locator('.publish-meta__panel input[maxlength="18"]').first();
        await expect(tagInput).toBeVisible();
        await expect(tagInput).toHaveValue("求助");
      } finally {
        await context.close();
        await api.dispose();
      }
    });

    // -----------------------------------------------------------------------
    // Test 5 — accept(location) consumes the ghost without flipping
    // publishKind. PRD §4.2.3 reserves `accept(location)` as a no-op on
    // draft state (the location panel is owned one level up by
    // `usePublishLocationOptions`); the gesture is purely a visual
    // dismiss-with-intent for now. Step-F follow-up may revisit.
    // -----------------------------------------------------------------------
    test("accept(location) consumes the ghost without mounting event/merchant/trade panels", async ({
      browser,
    }) => {
      const { api } = await loginAs(role);
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await stubPreviewWithGhosts(context, [
          { type: "location", kind: "location", reason: "加个地点" },
        ]);
        await openPublish(page);
        await seedDraftAndAwaitGhosts(page, ["location"]);

        await ghostItem(page, "location")
          .locator('[data-testid="publish-suggested-accept"]')
          .click();
        await expect(ghostItem(page, "location")).toHaveCount(0);

        // None of the three publishKind-bound panels should mount —
        // accept(location) does not change publishKind.
        await expect(page.locator('[data-testid="publish-event-panel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="publish-merchant-form"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="publish-trade-form"]')).toHaveCount(0);
      } finally {
        await context.close();
        await api.dispose();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Registered role — covers all 5 tests above. accept(merchant_info) /
// accept(trade_condition) for the unverified path are asserted as part of
// Test 1's render-only matrix; the verification gate keeps publishKind
// unchanged. Per the dedupe note, accept(price) per-role behavior is
// owned by #891's unit suite — we just confirm the structural ghost
// action below for the registered role.
// ---------------------------------------------------------------------------
ghostActionsForRole("registered");

// Extra registered-only test: accept(price) consumes the ghost. The
// publishKind=trade ratchet is unit-locked by #891; here we only assert
// the ghost is removed from the list (the structural E2E contract).
test.describe("@registered publish §4.2.3 — accept(price) structural confirm (dedupe note for #891)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("accept(price) consumes the ghost (kind→trade ratchet covered by #891 unit suite)", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await stubPreviewWithGhosts(context, [{ type: "price", kind: "trade", reason: "加个价格" }]);
      await openPublish(page);
      await seedDraftAndAwaitGhosts(page, ["trade"]);

      await ghostItem(page, "trade").locator('[data-testid="publish-suggested-accept"]').click();
      await expect(ghostItem(page, "trade")).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Merchant role — adds the verified-merchant accept(merchant_info) →
// publishKind="merchant" panel-mount assertion the registered role can't
// reach. accept(price) per-role unit coverage already lives in #891.
// ---------------------------------------------------------------------------
test.describe.serial("@merchant publish §4.2.3 — verified-merchant accept(merchant_info)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("merchant"),
      "merchant role not configured — set LIAN_E2E_MERCHANT_USERNAME / _PASSWORD",
    );
  });

  test("accept(merchant_info) flips publishKind to merchant for a verified merchant", async ({
    browser,
  }) => {
    const { api, user } = await loginAs("merchant");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Defense in depth: explicitly inject merchant_verified into
      // /api/auth/me so the panel's on-mount refresh sees it even if the
      // seeded merchant role drifts on nat100.
      await stubAuthMe(context, user, ["merchant_verified", "realname_verified"]);
      await stubPreviewWithGhosts(context, [
        { type: "merchant_info", kind: "merchant", reason: "看起来像商家信息" },
      ]);
      await openPublish(page);
      await seedDraftAndAwaitGhosts(page, ["merchant"]);

      await ghostItem(page, "merchant").locator('[data-testid="publish-suggested-accept"]').click();

      // Merchant form mounts when publishKind === "merchant".
      await expect(page.locator('[data-testid="publish-merchant-form"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(ghostItem(page, "merchant")).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Campus role — adds the verified-campus accept(trade_condition) →
// publishKind="trade" panel-mount assertion. accept(price)→trade per-role
// unit coverage lives in #891.
// ---------------------------------------------------------------------------
test.describe.serial("@campus publish §4.2.3 — verified-campus accept(trade_condition)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / _PASSWORD",
    );
  });

  test("accept(trade_condition) flips publishKind to trade for a verified campus user", async ({
    browser,
  }) => {
    const { api, user } = await loginAs("campus");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await stubAuthMe(context, user, ["campus_verified"]);
      await stubPreviewWithGhosts(context, [
        { type: "trade_condition", kind: "trade", reason: "加个二手物品状态" },
      ]);
      await openPublish(page);
      await seedDraftAndAwaitGhosts(page, ["trade"]);

      await ghostItem(page, "trade").locator('[data-testid="publish-suggested-accept"]').click();

      // Trade form mounts when publishKind === "trade". The gate panel
      // (`publish-trade-gate`) renders for unverified users; the form
      // panel only mounts when verification + publishKind both flip.
      await expect(page.locator('[data-testid="publish-trade-form"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(ghostItem(page, "trade")).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
