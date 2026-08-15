/**
 * Commerce catalog UI contract (store list + store card).
 *
 * Following the repo convention documented in
 * `tests/publish/publishHintPrimitives.test.ts`, `@vue/test-utils` is not
 * shipped and component tests are source-text contracts. This file locks the
 * pieces of the catalog UI that are easy to regress during a visual pass:
 *
 *   - the read-path contract the parent view depends on (props, retry emit,
 *     the four status branches, `data-testid` values the e2e journeys select);
 *   - the "no remote asset" rule the anonymous projection relies on
 *     (`logoAssetRef` stays unrendered, no `<img>`, no `url(`, no http origin);
 *   - design-token discipline (no magic colors / spacing in either file);
 *   - accessibility affordances (list label, `aria-busy`, `:focus-visible`,
 *     honest `prefers-reduced-motion` handling);
 *   - the copy source (everything routes through `src/config/brand`);
 *   - the development-fixture gate, so a preview helper can never ship.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), "utf8");

/** Strips comments so boundary assertions can't be tripped by prose. */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const LIST_PAGE = "src/features/commerce/catalog/CommerceStoreListPage.vue";
const STORE_CARD = "src/features/commerce/catalog/CommerceStoreCard.vue";
const FIXTURE_HOOK = "src/features/commerce/dev/useCommerceStoreUiFixture.ts";
const FIXTURE_DATA = "src/features/commerce/__fixtures__/commerce-store-fixtures.ts";
const COMMERCE_VIEW = "src/features/commerce/CommerceView.vue";

const listPage = read(LIST_PAGE);
const storeCard = read(STORE_CARD);
const fixtureHook = read(FIXTURE_HOOK);
const fixtureData = read(FIXTURE_DATA);
const commerceView = read(COMMERCE_VIEW);

describe("commerce catalog UI: read-path contract", () => {
  it("keeps the presentational prop shape the parent view passes down", () => {
    expect(listPage).toContain("status: CommerceReadStatus");
    expect(listPage).toContain("errorKind: CommerceReadErrorKind");
    expect(listPage).toContain("items: readonly CommerceStore[]");
    expect(storeCard).toContain("defineProps<{ store: CommerceStore }>()");
  });

  it("keeps retry an emit so the reader stays the only API owner", () => {
    expect(listPage).toContain("defineEmits<{ retry: [] }>()");
    expect(listPage).toContain("@action=\"emit('retry')\"");
    expect(commerceView).toContain('@retry="reader.retry"');
    // No page-level fetching: the composable owns the request.
    expect(listPage).not.toContain("fetch(");
    expect(storeCard).not.toContain("fetch(");
  });

  it("renders exactly one branch per read status", () => {
    expect(listPage).toContain("v-if=\"status === 'loading'\"");
    expect(listPage).toContain("v-else-if=\"status === 'empty'\"");
    expect(listPage).toContain("v-else-if=\"status === 'error'\"");
    expect(listPage).toContain("v-else-if=\"status === 'ready'\"");
    expect(listPage).toContain("<EmptyState");
    expect(listPage).toContain("<InlineError");
  });

  it("maps every error kind to distinct copy", () => {
    expect(listPage).toContain('props.errorKind === "rate-limited"');
    expect(listPage).toContain('props.errorKind === "timeout"');
    expect(listPage).toContain("COMMERCE_RATE_LIMIT_TITLE");
    expect(listPage).toContain("COMMERCE_TIMEOUT_TITLE");
    expect(listPage).toContain("COMMERCE_ERROR_TITLE");
  });

  it("preserves the selectors the e2e journeys depend on", () => {
    for (const testid of [
      "commerce-list-page",
      "commerce-loading",
      "commerce-empty",
      "commerce-error",
    ]) {
      expect(listPage).toContain(`data-testid="${testid}"`);
    }
    expect(listPage).toContain("commerce-list-page__list");
    expect(storeCard).toContain('class="commerce-store-card"');
    expect(storeCard).toContain("`commerce-store-${store.id}`");
    expect(storeCard).toContain('data-testid="commerce-logo-placeholder"');
    expect(storeCard).toContain("buildCommerceStoreHash(props.store.id)");
  });
});

describe("commerce catalog UI: no remote assets", () => {
  it("never renders a remote or file-backed image", () => {
    for (const source of [listPage, storeCard, fixtureData]) {
      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toContain("<img");
      expect(source).not.toContain("<picture");
      expect(source).not.toContain("background-image");
      expect(source).not.toContain("url(");
    }
  });

  it("leaves logoAssetRef unrendered and keeps fixtures asset-free", () => {
    expect(storeCard).not.toContain("logoAssetRef");
    expect(fixtureData).toContain("logoAssetRef: null");
    expect(fixtureData).not.toContain('logoAssetRef: "');
  });
});

describe("commerce catalog UI: token discipline", () => {
  it("uses no magic colors", () => {
    for (const source of [listPage, storeCard]) {
      const style = source.slice(source.indexOf("<style"));
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(style).not.toMatch(/\brgba?\(/);
    }
  });

  it("uses spacing and radius tokens instead of raw pixel padding", () => {
    for (const source of [listPage, storeCard]) {
      const style = source.slice(source.indexOf("<style"));
      // Multi-step spacing must come from the scale. Sub-token optical nudges
      // (<= 2px, e.g. the badge's vertical inset) stay allowed on purpose.
      expect(style).not.toMatch(/\b(?:padding|gap|margin)[^:]*:\s*(?:[3-9]|[1-9][0-9]+)px/);
      expect(style).not.toMatch(/border-radius:\s*[0-9]+px/);
      expect(style).toContain("var(--space-");
      expect(style).toContain("var(--radius-");
    }
  });

  it("draws the logo placeholder from type tokens, not a hardcoded gradient", () => {
    expect(storeCard).toContain("var(--lian-primary-soft)");
    expect(storeCard).toContain("var(--type-food-soft)");
  });
});

describe("commerce catalog UI: accessibility", () => {
  it("labels the list and announces the loading state", () => {
    expect(listPage).toContain("COMMERCE_CATALOG_LIST_LABEL");
    expect(listPage).toContain(':aria-label="COMMERCE_CATALOG_LIST_LABEL"');
    expect(listPage).toContain("aria-busy");
    expect(listPage).toContain('role="status"');
  });

  it("hides decorative skeleton and logo glyphs from assistive tech", () => {
    expect(listPage).toContain('aria-hidden="true"');
    expect(storeCard).toContain('aria-hidden="true"');
  });

  it("gives the keyboard its own focus ring separate from hover", () => {
    expect(storeCard).toContain(".commerce-store-card__link:focus-visible");
    expect(storeCard).toContain("outline: 2px solid var(--lian-primary)");
    // hover must not be merged into the focus-visible rule
    expect(storeCard).not.toMatch(/:hover\s*,\s*\.[^\n]*:focus-visible/);
  });

  it("headings the page instead of dropping the user into a bare card stream", () => {
    expect(listPage).toContain("COMMERCE_CATALOG_HEADING");
    expect(listPage).toContain("<h2");
  });

  it("honours prefers-reduced-motion by disabling real motion", () => {
    expect(listPage).toContain("@media (prefers-reduced-motion: reduce)");
    expect(listPage).toContain("animation: none");
    expect(storeCard).toContain("@media (prefers-reduced-motion: reduce)");
    expect(storeCard).toContain("transition: none");
    // the previous placeholder implementation only reset scroll-behavior
    expect(storeCard).not.toContain("scroll-behavior");
  });
});

describe("commerce catalog UI: copy ownership", () => {
  it("routes every visible string through the brand module", () => {
    for (const token of [
      "COMMERCE_CATALOG_HEADING",
      "COMMERCE_CATALOG_HINT",
      "COMMERCE_CATALOG_COUNT_SUFFIX",
      "COMMERCE_LOADING",
      "COMMERCE_RETRY",
    ]) {
      expect(listPage).toContain(token);
    }
    for (const token of [
      "COMMERCE_LOGO_PLACEHOLDER",
      "COMMERCE_RECOMMENDED",
      "COMMERCE_RATING_LABEL",
      "COMMERCE_RATING_EMPTY",
      "COMMERCE_SALES_LABEL",
      "COMMERCE_FAVORITES_LABEL",
      "COMMERCE_AREA_FALLBACK",
      "COMMERCE_SUMMARY_FALLBACK",
    ]) {
      expect(storeCard).toContain(token);
    }
  });

  it("has no hardcoded CJK copy left in either template", () => {
    for (const source of [listPage, storeCard]) {
      const template = source.slice(source.indexOf("<template"), source.indexOf("<style"));
      expect(template).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("still degrades gracefully when optional fields are missing", () => {
    expect(storeCard).toContain("store.areaLabel || COMMERCE_AREA_FALLBACK");
    expect(storeCard).toContain("store.summary || COMMERCE_SUMMARY_FALLBACK");
    expect(storeCard).toContain('props.store.ratings.description === "0"');
  });
});

describe("commerce catalog UI: development fixtures", () => {
  it("gates the preview on DEV and an explicit opt-in flag", () => {
    const hookCode = codeOnly(fixtureHook);
    expect(hookCode).toContain("!import.meta.env.DEV");
    expect(hookCode).toContain('import.meta.env.VITE_UI_FIXTURES !== "true"');
  });

  it("loads fixture data lazily so production bundles drop it", () => {
    expect(fixtureHook).toContain("import(");
    expect(fixtureHook).not.toMatch(/^import .*commerce-store-fixtures/m);
  });

  it("reuses the production type instead of redefining a DTO", () => {
    const dataCode = codeOnly(fixtureData);
    expect(dataCode).toContain('import type { CommerceStore } from "../../../types/commerce"');
    expect(dataCode).not.toMatch(/\binterface\s+CommerceStore\b/);
    expect(dataCode).not.toMatch(/\btype\s+CommerceStore\s*=/);
  });

  it("never issues requests or reaches into the api layer", () => {
    for (const source of [fixtureHook, fixtureData]) {
      const code = codeOnly(source);
      expect(code).not.toContain("api/commerce");
      expect(code).not.toContain("fetch(");
      expect(code).not.toContain("XMLHttpRequest");
    }
  });

  it("falls back to the real reader state on every catalog input", () => {
    expect(commerceView).toContain("catalogFixture.value?.status ?? reader.status.value");
    expect(commerceView).toContain("catalogFixture.value?.errorKind ?? reader.errorKind.value");
    expect(commerceView).toContain("catalogFixture.value?.items ?? reader.items.value");
  });
});

describe("commerce catalog UI: development fixture behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { dev: false, enabled: "true", scenario: "normal" },
    { dev: true, enabled: "false", scenario: "normal" },
    { dev: true, enabled: undefined, scenario: "normal" },
    { dev: true, enabled: "true", scenario: undefined },
    { dev: true, enabled: "true", scenario: "unknown" },
  ])("keeps real rendering inputs when the fixture gate is not fully accepted", async (env) => {
    vi.stubEnv("DEV", env.dev);
    vi.stubEnv("VITE_UI_FIXTURES", env.enabled);
    vi.stubEnv("VITE_UI_FIXTURE_SCENARIO", env.scenario);

    const { useCommerceStoreUiFixture } =
      await import("../../src/features/commerce/dev/useCommerceStoreUiFixture");

    expect(useCommerceStoreUiFixture().value).toBeNull();
  });

  it("loads the selected typed fixture only when both development gates are accepted", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_UI_FIXTURES", "true");
    vi.stubEnv("VITE_UI_FIXTURE_SCENARIO", "normal");

    const { useCommerceStoreUiFixture } =
      await import("../../src/features/commerce/dev/useCommerceStoreUiFixture");
    const fixture = useCommerceStoreUiFixture();

    expect(fixture.value).toBeNull();
    await vi.waitFor(() => expect(fixture.value?.status).toBe("ready"));
    expect(fixture.value?.items[0]).toMatchObject({
      id: "1",
      logoAssetRef: null,
      recommended: true,
    });
  });
});
