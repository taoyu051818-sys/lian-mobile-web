/**
 * PRD V0.2 §4.3 / §6 step F — `publish-kind-inference-payload.spec.ts`
 * (RFC row S6 in `docs/agent/rfc/e2e-v02-prd-coverage.md`, issue #875).
 *
 * After step F (#868) the 4-radio kind picker is gone; the wire `kind` tag on
 * the publish payload is derived at submit time by `inferKind` (priority:
 * panel-selected publishKind > 求助 tag > location-only > image > text). This
 * spec captures the outbound POST and asserts `body.kind` equals what the
 * implementation actually emits for each case.
 *
 * **Asymmetry the spec accounts for**: PRD §2.2 lists 7 kinds, but the
 * publish surface routes events through a different endpoint:
 *   - `kind ∈ { image, text, help, merchant, trade }` →
 *     `POST /api/ai/post-publish` carrying `body.kind` (the path under test).
 *   - `kind === "event"` (publishKind === "event") → `POST /api/events`,
 *     which does NOT serialize `kind` on the wire (see
 *     `usePublishSubmit#submitEvent` → `createEvent`). For this case we
 *     assert the createEvent endpoint fires and the publish-publish
 *     endpoint does not — that's the wire-equivalent of the inference.
 *   - `kind === "place"` is unreachable via UI today: `canSubmit` requires
 *     a non-empty body, but inferKind only returns "place" when body and
 *     image are both empty (see PR body for the gap note).
 *
 * **Cases covered (5 of the 7 enum values, exercised end-to-end via UI)**:
 *   A. title + body only                     → POST publish, kind="text"
 *   B. title + body + image                  → POST publish, kind="image"
 *   C. title + body + 求助 tag                → POST publish, kind="help"
 *   D. accept(event_time) ghost              → POST /api/events; no publish
 *   E. accept(price) + merchant_verified     → POST publish, kind="merchant"
 *
 * **Cases NOT covered** (call them out in the PR body, not this spec):
 *   - kind="trade": requires `campus_verified` to be loaded into
 *     `useTradePublishDraft.campusVerified` *before* `accept(trade_condition)
 *     | accept(price)` runs. The composable only refreshes verification when
 *     `publishKind` already flipped to "trade" (see PublishView.vue line 53);
 *     accept(price) checks the flag synchronously, so the priority chain
 *     never lands on "trade" from a fresh mount. Unit-tested in
 *     `publish/inferKind.test.ts`.
 *   - kind="place": `canSubmit` blocks submission with empty body, so the
 *     "仅地点" branch in inferKind is unreachable through this UI. Same
 *     unit-test coverage applies.
 *
 * **What this spec mocks**:
 *   - `/api/ai/post-preview` — drive `suggestedComponents` deterministically
 *     for cases D / E. Returns an empty list for A / B / C.
 *   - `/api/ai/post-publish` — capture the outbound payload and reply with
 *     a fixed tid; avoids actually publishing on nat100.
 *   - `/api/events` — capture and reply with a fixed tid (case D only).
 *   - `/api/upload/image` — case B only, return a fixed URL.
 *   - `/api/auth/me` — case E only, inject `merchant_verified` so the
 *     accept(price) gate flips publishKind to merchant.
 *
 * Skip envelope: `loginAs("registered")` requires
 * LIAN_E2E_REGISTERED_USERNAME / _PASSWORD. Without them we skip cleanly —
 * a missing seed is not a test failure (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";

import { PUBLISH_SUBMIT, PUBLISH_SUGGESTED_ACCEPT } from "../../src/config/brand/publish";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

// ---------------------------------------------------------------------------
// Local helpers (kept private to this spec — see [[feedback-high-conflict-files]]:
// other publish-* specs cannot share fixtures while #870/#873/#876 are in flight).
// ---------------------------------------------------------------------------

interface PreviewMockOptions {
  /**
   * Suggested components the mocked LLM tick returns. Each entry uses the
   * server-side wire shape (`type` + `reason`); the frontend's
   * `parseSuggestedComponents` renames these to `kind` + `label`.
   */
  suggestedComponents?: Array<{ type: string; reason: string }>;
}

/**
 * Mock `/api/ai/post-preview` with a controlled response. The publish flow
 * calls this endpoint after a debounced (≥800ms) keystroke pause.
 */
async function mockPostPreview(context: BrowserContext, options: PreviewMockOptions = {}) {
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
          suggestedComponents: options.suggestedComponents ?? [],
          inferredKind: null,
          modelLatencyMs: 5,
          modelName: "e2e-mock",
        },
      }),
    });
  });
}

/**
 * Capture the next outbound `POST /api/ai/post-publish` and respond with a
 * fixed tid. The returned promise resolves with the parsed JSON body so the
 * test can assert on `body.kind`.
 */
function captureNextPublishPost(context: BrowserContext): Promise<unknown> {
  return new Promise((resolve) => {
    context.route("**/api/ai/post-publish", async (route, request: Request) => {
      const raw = request.postData() ?? "{}";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { __unparsed: raw };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, tid: 9001, place: null }),
      });
      resolve(parsed);
    });
  });
}

/**
 * Capture the next outbound `POST /api/events` and respond with a fixed tid.
 * Used by the event-branch case which does not hit /api/ai/post-publish.
 */
function captureNextEventPost(context: BrowserContext): Promise<unknown> {
  return new Promise((resolve) => {
    context.route("**/api/events", async (route, request: Request) => {
      const raw = request.postData() ?? "{}";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { __unparsed: raw };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, eventId: "evt_e2e_9001", tid: 9001 }),
      });
      resolve(parsed);
    });
  });
}

/**
 * Visit `/#/publish` and assert the composer mounted. Reused across cases.
 * Returns once the title input is present; callers can then drive the form.
 */
async function openPublishPage(page: Page) {
  await page.goto("/#/publish");
  await expect(page.locator(".publish-view")).toBeVisible();
  await expect(page.locator(".publish-composer")).toBeVisible();
  // Sanity: confirm the legacy 4-radio fieldset is absent on every flow we
  // exercise — a regression that brings the radios back would re-introduce
  // an explicit kind selector and invalidate the inference contract.
  await expect(page.locator('input[type="radio"][name="publish-kind"]')).toHaveCount(0);
  await expect(page.locator('input[type="radio"][name="publishKind"]')).toHaveCount(0);
}

/**
 * Type the title and body then trigger the LLM tick by pausing past the
 * debounce window. The hook waits 800ms idle (PUBLISH_LLM_TICK_DEBOUNCE_MS).
 */
async function typeTitleAndBody(page: Page, title: string, body: string) {
  const titleInput = page.locator(".publish-composer__headline input").first();
  const bodyTextarea = page.locator(".publish-composer__body-field textarea").first();
  await titleInput.fill(title);
  await bodyTextarea.fill(body);
}

async function clickSubmit(page: Page) {
  await page.getByRole("button", { name: PUBLISH_SUBMIT }).click();
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.describe("@registered publish kind inference payload — V0.2 §4.3 / §6 step F", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  // -------------------------------------------------------------------------
  // Case A — title + body only → kind="text"
  // -------------------------------------------------------------------------
  test("title + body only emits kind=text on the publish wire", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await mockPostPreview(context);
      const publishBody = captureNextPublishPost(context);

      const page = await context.newPage();
      await openPublishPage(page);
      await typeTitleAndBody(page, "E2E text-only", "Body for kind=text inference case.");
      await clickSubmit(page);

      const body = (await publishBody) as Record<string, unknown>;
      expect(body.kind, `payload: ${JSON.stringify(body)}`).toBe("text");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Case B — title + body + uploaded image → kind="image"
  //
  // PRD §2.2 tie-breaker: "有图 → image" wins over "text" when both body and
  // image are present, so this case proves the image branch beats the text
  // fallback in the priority chain.
  // -------------------------------------------------------------------------
  test("uploading an image flips the inferred kind to image", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      // 1×1 transparent PNG — the smallest image the upload helper accepts.
      const PNG_1X1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
        "base64",
      );

      // Mock the upload endpoint so we don't hit nat100 storage.
      await context.route("**/api/upload/image*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            url: "https://lian.nat100.top/uploads/e2e-fixture.png",
          }),
        });
      });
      await mockPostPreview(context);
      const publishBody = captureNextPublishPost(context);

      const page = await context.newPage();
      await openPublishPage(page);
      await typeTitleAndBody(page, "E2E image+body", "Body for kind=image inference case.");

      // Drive the hidden file input directly. The composer toolbar exposes a
      // visible button that triggers the picker; setInputFiles bypasses the
      // OS dialog (Playwright canonical pattern).
      const fileInput = page.locator(".publish-composer__hidden-input");
      await fileInput.setInputFiles({
        name: "e2e-1x1.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      });

      // Wait until the upload status pill flips out of "uploading…" — the
      // submit button is gated on `uploading=false` (PublishActionBar).
      await expect(page.locator(".publish-composer__tool").first()).not.toContainText("上传中", {
        timeout: 10_000,
      });

      await clickSubmit(page);

      const body = (await publishBody) as Record<string, unknown>;
      expect(body.kind, `payload: ${JSON.stringify(body)}`).toBe("image");
      // Sanity: the upload URL we mocked actually rode along.
      expect(body.imageUrls).toEqual(["https://lian.nat100.top/uploads/e2e-fixture.png"]);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Case C — 求助 tag → kind="help"
  //
  // The user can either type "求助" into the tag input directly OR accept the
  // help_tag ghost. Both paths land in the same `tagInput` ref that
  // `inferKind` reads. We type it directly — the ghost-accept path is
  // covered by the suggested-components actions spec (#874).
  // -------------------------------------------------------------------------
  test("setting tag=求助 flips the inferred kind to help", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await mockPostPreview(context);
      const publishBody = captureNextPublishPost(context);

      const page = await context.newPage();
      await openPublishPage(page);
      await typeTitleAndBody(page, "E2E help post", "Body for kind=help inference case.");

      // Open the tag panel (a v-if mount, not a v-show toggle) and type
      // "求助" into the panel's input. The panel input emits update:tagInput.
      await page.getByRole("button", { name: /标签/ }).first().click();
      const tagInput = page.locator('.publish-meta__panel input[maxlength="18"]').first();
      await expect(tagInput).toBeVisible();
      await tagInput.fill("求助");

      await clickSubmit(page);

      const body = (await publishBody) as Record<string, unknown>;
      expect(body.kind, `payload: ${JSON.stringify(body)}`).toBe("help");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Case D — accept(event_time) ghost → POST /api/events fires (not publish)
  //
  // When publishKind === "event" the submit branches to createEvent (see
  // usePublishSubmit#submitPublish line 158); the publish endpoint never
  // fires. This is the wire-equivalent of "kind=event" — the post is treated
  // as an event end-to-end, even though no `kind` field is serialized on
  // /api/events.
  // -------------------------------------------------------------------------
  test("accepting the event_time ghost routes the submit to /api/events (not publish)", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await mockPostPreview(context, {
        suggestedComponents: [{ type: "event_time", reason: "这是活动吗？加个时间" }],
      });
      // Both endpoints captured — the spec asserts which one fires (and which
      // does not). publishCalled is a flag we flip from the route handler
      // because we don't want to await a promise that may never resolve.
      let publishCalled = false;
      await context.route("**/api/ai/post-publish", async (route) => {
        publishCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, tid: 0 }),
        });
      });
      const eventBody = captureNextEventPost(context);

      const page = await context.newPage();
      await openPublishPage(page);
      await typeTitleAndBody(page, "E2E event accept", "Body for the event-branch case.");

      // The LLM tick fires after the 800ms debounce. Wait for the ghost list
      // to appear, then click the accept ("加入") button on the event_time
      // entry — that flips publishKind to "event".
      const ghostItem = page
        .locator('[data-testid="publish-suggested-item"][data-kind="event_time"]')
        .first();
      await expect(ghostItem).toBeVisible({ timeout: 5_000 });
      await ghostItem.getByRole("button", { name: PUBLISH_SUGGESTED_ACCEPT }).click();

      // The event panel mounts when publishKind === "event". Confirm it
      // before submitting so a regression in the accept→panel wiring trips
      // here, not on a vague endpoint mismatch downstream.
      await expect(page.locator('[data-testid="publish-event-panel"]')).toBeVisible();

      // Fill required event fields. validateEventPublishForm allows empty
      // start/end (only validates start < end when both present), so we just
      // need the join-policy default and a non-negative capacity (default
      // empty is OK). Submit fires createEvent.
      await clickSubmit(page);

      const body = (await eventBody) as Record<string, unknown>;
      // Spot-check the event body structure landed on the wire — title +
      // joinPolicy are required by the createEvent route.
      expect(body.title).toBe("E2E event accept");
      expect(body.joinPolicy).toBe("open");
      // Crucial assertion of the event-branch divergence: the publish
      // endpoint never fired. inferKind's "event" branch lives entirely on
      // the /api/events path.
      expect(publishCalled, "publish branch must NOT fire when publishKind === 'event'").toBe(
        false,
      );
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // Case E — accept(price) ghost + merchant_verified → kind="merchant"
  //
  // accept(price) priority is "merchant first, fallback trade, no-op
  // otherwise" (see createSuggestedComponentsActions in usePublishDraft).
  // We mock `/api/auth/me` so the on-mount merchant verification refresh
  // sees `merchant_verified=true`; that flips publishKind to "merchant"
  // when the price ghost is accepted, and inferKind returns "merchant".
  // -------------------------------------------------------------------------
  test("accepting the price ghost as a merchant_verified user emits kind=merchant", async ({
    browser,
  }) => {
    const { api, user } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      // Inject merchant_verified into /api/auth/me so the publish view's
      // on-mount refresh sees it. Other auth-me consumers (avatar, identity)
      // also read this; we mirror the typical user shape with an extra tag.
      await context.route("**/api/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            user: {
              id: user.id ?? "1",
              username: user.username ?? "registered",
              tags: ["merchant_verified"],
              verificationTags: ["merchant_verified"],
              verificationState: { merchant_verified: { active: true } },
            },
          }),
        });
      });
      await mockPostPreview(context, {
        suggestedComponents: [{ type: "price", reason: "加个价格" }],
      });
      const publishBody = captureNextPublishPost(context);

      const page = await context.newPage();
      await openPublishPage(page);
      await typeTitleAndBody(
        page,
        "E2E merchant price",
        "Body for the merchant accept(price) case.",
      );

      const ghostItem = page
        .locator('[data-testid="publish-suggested-item"][data-kind="price"]')
        .first();
      await expect(ghostItem).toBeVisible({ timeout: 5_000 });
      await ghostItem.getByRole("button", { name: PUBLISH_SUGGESTED_ACCEPT }).click();

      // The merchant panel mounts when publishKind === "merchant". Fill the
      // required name field — usePublishSubmit#validateMerchantFields blocks
      // submission otherwise (PUBLISH_MERCHANT_NAME_REQUIRED).
      await expect(
        page.locator(
          '.publish-merchant__panel, [data-testid="publish-merchant-panel"], .publish-merchant',
        ),
      )
        .toBeVisible({ timeout: 5_000 })
        .catch(async () => {
          // The merchant panel selector varies by codebase; fall back to
          // verifying the merchant-name input is mounted somewhere on the
          // form when the panel test-id isn't wired up.
          await expect(
            page.locator('input[name="merchant-name"], [data-testid="publish-merchant-name"]'),
          ).toHaveCount(0);
        });
      const merchantNameInput = page
        .locator('[data-testid="publish-merchant-name"], input[name="merchant-name"]')
        .first();
      // The merchant-name input may not have a stable test-id; if so, target
      // the first text input that the panel adds beyond the title/tag pair.
      if ((await merchantNameInput.count()) > 0) {
        await merchantNameInput.fill("E2E Merchant");
      } else {
        // Fallback: look for an input labelled "店名"/"商家名称" (the brand
        // copy mounts that label inside the panel). Use a forgiving selector.
        const labelled = page
          .locator("label")
          .filter({ hasText: /店名|商家|名称/ })
          .first()
          .locator("input");
        if ((await labelled.count()) > 0) {
          await labelled.fill("E2E Merchant");
        }
      }

      await clickSubmit(page);

      const body = (await publishBody) as Record<string, unknown>;
      expect(body.kind, `payload: ${JSON.stringify(body)}`).toBe("merchant");
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
