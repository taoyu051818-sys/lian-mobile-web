/**
 * PRD V0.2 §6 step G — RFC row S10 in
 * `docs/agent/rfc/e2e-v02-prd-coverage.md`, issue #879.
 *
 * The publish surface re-uses `FeedItemCardShell.vue` so the visual
 * baseline (border, radius, padding tokens) matches a feed-list item.
 * Shape of the assertion (per RFC):
 *
 *   - Both the feed page and the publish page expose
 *     `[data-feed-card-shell]` as a stable hook on the shell root.
 *   - `border-radius`, `border-width`, and `padding` agree across the
 *     two surfaces (within `±0.5px` rendering tolerance).
 *   - The base background colour (`background-color`, computed as the
 *     lowest layer when a gradient stack is in play) agrees too —
 *     the publish overlay is allowed on top, but the shell layer
 *     underneath has to match.
 *
 * Status on `main` (2026-05-23): `FeedItemCardShell.vue` is mounted by
 * `FeedItemCard.vue` (step A, #825) but neither side yet exposes a
 * `[data-feed-card-shell]` data hook, and the publish view does NOT yet
 * mount the shell. Step G is the gating PR that lands both halves. Until
 * step G ships, the case selectors below cannot resolve, so the whole
 * `describe` ships as `test.describe.fixme`. The spec file itself is on
 * `main` so step G can flip the gate from `describe.fixme` to `describe`
 * in the same PR that mounts the shell on publish.
 *
 * Skip envelope: `loginAs("registered")` requires
 * LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD; without
 * them the spec skips cleanly. Missing seed is not a failure (see
 * `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

interface ShellTokens {
  borderRadiusTopLeft: number;
  borderRadiusTopRight: number;
  borderRadiusBottomLeft: number;
  borderRadiusBottomRight: number;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  /** Lowest-layer background colour — see `pickBaseBackgroundColor`. */
  baseBackgroundColor: string;
}

/**
 * The publish surface adds an overlay gradient on top of the shell base;
 * `getComputedStyle` on the shell root therefore returns a non-zero
 * `background-color` on the shell layer (the overlay sits on a child).
 * Reading `background-color` directly off the shell root is what RFC S10
 * specifies as the comparable token. We keep this helper inline so a
 * future "let's read the parent gradient" regression has to pass through
 * a comment that says "no, RFC S10 wants the shell base".
 */
async function readShellTokens(page: Page, selector: string): Promise<ShellTokens> {
  return page.evaluate((sel: string) => {
    const node = document.querySelector(sel) as HTMLElement | null;
    if (!node) {
      throw new Error(`shell selector "${sel}" did not resolve to an element`);
    }
    const style = window.getComputedStyle(node);
    const num = (raw: string) => {
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      borderRadiusTopLeft: num(style.borderTopLeftRadius),
      borderRadiusTopRight: num(style.borderTopRightRadius),
      borderRadiusBottomLeft: num(style.borderBottomLeftRadius),
      borderRadiusBottomRight: num(style.borderBottomRightRadius),
      borderTopWidth: num(style.borderTopWidth),
      borderRightWidth: num(style.borderRightWidth),
      borderBottomWidth: num(style.borderBottomWidth),
      borderLeftWidth: num(style.borderLeftWidth),
      paddingTop: num(style.paddingTop),
      paddingRight: num(style.paddingRight),
      paddingBottom: num(style.paddingBottom),
      paddingLeft: num(style.paddingLeft),
      baseBackgroundColor: style.backgroundColor,
    };
  }, selector);
}

const RENDERING_TOLERANCE_PX = 0.5;

function expectClose(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ~${expected}, got ${actual} (tolerance ${RENDERING_TOLERANCE_PX}px)`,
  ).toBeLessThanOrEqual(RENDERING_TOLERANCE_PX);
}

async function captureFeedShellTokens(context: BrowserContext): Promise<ShellTokens> {
  const page = await context.newPage();
  try {
    await page.goto("/#/feed");
    await expect(page.locator("[data-feed-card-shell]").first()).toBeVisible({ timeout: 10_000 });
    return await readShellTokens(page, "[data-feed-card-shell]");
  } finally {
    await page.close();
  }
}

async function capturePublishShellTokens(context: BrowserContext): Promise<ShellTokens> {
  const page = await context.newPage();
  try {
    await page.goto("/#/publish");
    await expect(page.locator(".publish-view")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-feed-card-shell]").first()).toBeVisible({ timeout: 10_000 });
    return await readShellTokens(page, "[data-feed-card-shell]");
  } finally {
    await page.close();
  }
}

test.describe
  .fixme("@registered publish §6 step G — shell parity with feed (blocked on step G mounting FeedItemCardShell on publish)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("publish shell border-radius matches feed shell", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      const feed = await captureFeedShellTokens(context);
      const publish = await capturePublishShellTokens(context);

      expectClose(publish.borderRadiusTopLeft, feed.borderRadiusTopLeft, "border-top-left");
      expectClose(publish.borderRadiusTopRight, feed.borderRadiusTopRight, "border-top-right");
      expectClose(
        publish.borderRadiusBottomLeft,
        feed.borderRadiusBottomLeft,
        "border-bottom-left",
      );
      expectClose(
        publish.borderRadiusBottomRight,
        feed.borderRadiusBottomRight,
        "border-bottom-right",
      );
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("publish shell padding matches feed shell", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      const feed = await captureFeedShellTokens(context);
      const publish = await capturePublishShellTokens(context);

      expectClose(publish.paddingTop, feed.paddingTop, "padding-top");
      expectClose(publish.paddingRight, feed.paddingRight, "padding-right");
      expectClose(publish.paddingBottom, feed.paddingBottom, "padding-bottom");
      expectClose(publish.paddingLeft, feed.paddingLeft, "padding-left");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("publish shell border + base background match feed shell", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      const feed = await captureFeedShellTokens(context);
      const publish = await capturePublishShellTokens(context);

      expectClose(publish.borderTopWidth, feed.borderTopWidth, "border-top-width");
      expectClose(publish.borderRightWidth, feed.borderRightWidth, "border-right-width");
      expectClose(publish.borderBottomWidth, feed.borderBottomWidth, "border-bottom-width");
      expectClose(publish.borderLeftWidth, feed.borderLeftWidth, "border-left-width");

      // Base background-color: the publish surface MAY layer an overlay
      // gradient on top of the shell, but the shell layer underneath
      // (which is what `getComputedStyle(...).backgroundColor` returns
      // on the shell root) has to match feed exactly.
      expect(publish.baseBackgroundColor).toBe(feed.baseBackgroundColor);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
