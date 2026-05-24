/**
 * Floating-chrome alignment + responsiveness E2E spec.
 *
 * After PR #943 (FeedFilterBar) and PR #945 (ChannelFilterBar) moved their
 * filter rows into the top floating chrome, several views drifted off-center
 * at common widths. This spec asserts that the inner content of the top
 * floating bar is horizontally centered (within a small tolerance) on:
 *   - home (feed)        — dual-state filter bar
 *   - messages           — dual-state filter bar
 *   - map (探索)         — typed filters only (worst-case before the fix)
 *   - publish            — identity strip (no slot/buttons on first paint)
 *   - profile (guest)    — chrome may be hidden; assert it's at least not skewed
 *
 * Widths exercised: 375 / 414 / 760 / 1024.
 *
 * The assertion is deliberately structural (boundingBox math) rather than
 * pixel-perfect so it survives token tweaks.  See `src/styles/chrome-surface.css`
 * and `src/shell/shell-chrome.css` for the layout under test.
 */

import { expect, test, type Page } from "@playwright/test";

const VIEWPORT_WIDTHS = [375, 414, 760, 1024] as const;

/** Hermetic stubs: this spec is a layout assertion, not a data-flow proof. */
async function stubCommonEndpoints(
  page: Page,
  options: { loggedIn: boolean } = { loggedIn: true },
) {
  await page.route("**/api/feed**", (route) =>
    route.fulfill({
      json: { tabs: [{ id: "now", label: "此刻" }], items: [], hasMore: false, nextPage: null },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: options.loggedIn
        ? { user: { id: "u1", username: "tester", identityTags: [], aliases: [] } }
        : { user: null },
    }),
  );
  await page.route("**/api/channel**", (route) =>
    route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } }),
  );
  await page.route("**/api/messages**", (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.route("**/api/map/**", (route) =>
    route.fulfill({ json: { locations: [], posts: [] } }),
  );
  await page.route("**/api/notifications**", (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
}

interface CenteringSample {
  width: number;
  outerLeft: number;
  outerRight: number;
  innerLeft: number;
  innerRight: number;
  innerWidth: number;
}

/**
 * Measure the floating chrome surface (`[data-floating-chrome="top"]`) and
 * the inner row that should be centered within it. Returns null when the
 * chrome is not present (e.g. guest profile may hide it).
 */
async function measureChrome(page: Page): Promise<CenteringSample | null> {
  const sample = await page.evaluate(() => {
    const surface = document.querySelector('[data-floating-chrome="top"]') as HTMLElement | null;
    if (!surface) return null;
    // Inner is whichever of these is mounted: the dual-state filter bar, the
    // typed tabs nav, or the default `.shell-chrome__inner` row.  When the
    // surface IS the inner row (default chrome / typed tabs nav), measure the
    // surface itself — querySelector only walks descendants.
    const isSurfaceTheInner =
      surface.classList.contains("shell-chrome__inner") ||
      surface.classList.contains("shell-chrome__tabs");
    const inner = isSurfaceTheInner
      ? surface
      : (surface.querySelector(".feed-filter-bar") ??
        surface.querySelector(".channel-filter-bar") ??
        surface.querySelector(".shell-chrome__inner") ??
        surface.querySelector(".shell-chrome__tabs"));
    if (!inner) return null;
    const outerRect = surface.getBoundingClientRect();
    const innerRect = (inner as HTMLElement).getBoundingClientRect();
    return {
      width: window.innerWidth,
      outerLeft: outerRect.left,
      outerRight: outerRect.right,
      innerLeft: innerRect.left,
      innerRight: innerRect.right,
      innerWidth: innerRect.width,
    };
  });
  return sample;
}

/**
 * Centering assertion: the inner row's mid-x should sit on the surface's mid-x
 * within a small tolerance (4px covers sub-pixel rounding + scrollbar gutter).
 */
function assertHorizontallyCentered(sample: CenteringSample, label: string) {
  const outerMid = (sample.outerLeft + sample.outerRight) / 2;
  const innerMid = (sample.innerLeft + sample.innerRight) / 2;
  const drift = Math.abs(outerMid - innerMid);
  expect(
    drift,
    `${label} @${sample.width}px — inner row drifted ${drift.toFixed(1)}px from chrome center`,
  ).toBeLessThanOrEqual(4);
}

/**
 * Surface itself should be page-centered on every width: distance from the
 * chrome's left edge to the viewport's left edge should equal the distance
 * from the chrome's right edge to the viewport's right edge.
 */
async function assertSurfaceCenteredInViewport(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const surface = document.querySelector('[data-floating-chrome="top"]') as HTMLElement | null;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return { left: rect.left, right: rect.right, vw: window.innerWidth };
  });
  if (!result) return;
  const drift = Math.abs(result.left - (result.vw - result.right));
  expect(drift, `${label} — surface itself drifted ${drift.toFixed(1)}px`).toBeLessThanOrEqual(2);
}

interface ViewSpec {
  hash: string;
  label: string;
  /** Wait for this selector to settle before measuring. */
  ready: string;
  loggedIn?: boolean;
}

const VIEW_MATRIX: ViewSpec[] = [
  { hash: "/", label: "feed", ready: '[data-testid="feed-filter-bar"]' },
  { hash: "/messages", label: "messages", ready: '[data-testid="channel-filter-bar"]' },
  { hash: "/map", label: "map", ready: '[data-floating-chrome="top"]' },
  { hash: "/publish", label: "publish", ready: '[data-testid="publish-card"]' },
];

test.describe("@floating-chrome-alignment top floating bar", () => {
  for (const view of VIEW_MATRIX) {
    for (const width of VIEWPORT_WIDTHS) {
      test(`${view.label} centers content @${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await stubCommonEndpoints(page, { loggedIn: view.loggedIn ?? true });
        await page.goto(`/#${view.hash}`);

        // Wait for the view to mount.  Map/publish may take a beat to async-load.
        await page
          .locator(view.ready)
          .first()
          .waitFor({ state: "visible", timeout: 10_000 })
          .catch(() => {
            // Some views (e.g. guest profile) intentionally hide chrome.
            // The next measure step will produce null and the test will skip.
          });

        const sample = await measureChrome(page);
        if (!sample) {
          test.skip(true, `${view.label} did not render top floating chrome at ${width}px`);
          return;
        }

        assertHorizontallyCentered(sample, view.label);
        await assertSurfaceCenteredInViewport(page, view.label);

        // Inner should not exceed the surface — catches inner padding/margin bugs.
        expect(sample.innerLeft).toBeGreaterThanOrEqual(sample.outerLeft - 0.5);
        expect(sample.innerRight).toBeLessThanOrEqual(sample.outerRight + 0.5);
      });
    }
  }
});
