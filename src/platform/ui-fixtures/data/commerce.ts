/**
 * Commerce fixtures.
 *
 * The commerce slice is the strictest contract in the app: `src/api/commerce.ts`
 * runs `assertExactKeys` on every object, requires the exact header triple
 * (`application/json`, `cache-control: no-store`, UUIDv4 `x-request-id`), and
 * cross-checks `meta.requestId` against that header. These builders therefore go
 * through `fixtureStrictJson` and emit no extra or missing keys — a stray field
 * would surface in the UI as "malformed" instead of silently passing.
 *
 * Field bounds mirror the decoder: name <= 50, summary <= 255, areaLabel <= 100,
 * ratings are `0` | `[1-4].dd` | `5.00`, and `logoAssetRef` / `coverAssetRef`
 * stay `null` exactly as src/types/commerce.ts declares.
 */

import { fixtureNotFound, fixtureStrictJson } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureRequestContext, FixtureRoute, FixtureScenario, FixtureVolume } from "../types";
import { pick, ratingFor, seededCount, sentenceFor, storeNameFor, summaryFor } from "./support";

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_PAGE_SIZE = 20;
const FAMILY = "commerce";
const MAX_PRODUCT_ID = 18;

const AREA_LABELS = [
  "北苑食堂一层",
  "图书馆西门旁",
  "三号教学楼底商",
  "南门快递站对面",
  "体育馆北侧",
  "留学生公寓楼下",
] as const;

/** Store and product ids are canonical decimal strings, never numbers. */
function canonicalId(index: number): string {
  return String(index + 1);
}

function buildStore(index: number, scenario: FixtureScenario) {
  const longCopy = scenario === "long-copy";
  // `partial-data` is the shared "optional fields absent" switch; commerce
  // expresses it as an empty summary plus the zero rating sentinel.
  const partial = scenario === "partial-data" && index % 2 === 0;

  return {
    id: canonicalId(index),
    name: longCopy
      ? `${storeNameFor(index)}（校园直营旗舰店 · 全时段配送 · 支持自提）`.slice(0, 50)
      : storeNameFor(index),
    summary: partial ? "" : summaryFor(index, longCopy ? 240 : 60),
    areaLabel: longCopy
      ? `${pick(AREA_LABELS, index)} · 步行约 8 分钟 · 夜间关闭西侧通道`.slice(0, 100)
      : pick(AREA_LABELS, index),
    logoAssetRef: null,
    ratings: {
      description: partial ? "0" : ratingFor(index, 0),
      service: partial ? "0" : ratingFor(index, 1),
      logistics: partial ? "0" : ratingFor(index, 2),
    },
    salesCount: longCopy ? 987_654 : seededCount(index, 40, 4_800),
    favoriteCount: longCopy ? 654_321 : seededCount(index + 7, 10, 2_400),
    recommended: index % 3 === 0,
  };
}

/**
 * Minor-unit price for a sku. Kept >= 1 because `decodeMinorAmount` rejects 0.
 */
function skuAmountMinor(index: number, skuIndex: number): number {
  return 800 + ((index * 7 + skuIndex * 13) % 42) * 50;
}

/**
 * SKU list obeying every cross-field invariant the decoder enforces:
 * ids strictly ascending and unique, exactly one `default: true`, and at least
 * one `availability: "available"`.
 */
function buildSkus(index: number, scenario: FixtureScenario) {
  const count = scenario === "long-copy" ? 4 : scenario === "partial-data" ? 3 : 2;
  return Array.from({ length: count }, (_, skuIndex) => ({
    id: canonicalId(skuIndex),
    name: scenario === "long-copy" ? sentenceFor(skuIndex + 2, 20) : sentenceFor(skuIndex + 2, 6),
    price: { currency: "CNY" as const, amountMinor: skuAmountMinor(index, skuIndex) },
    // Only non-first skus may be unavailable, guaranteeing an available one.
    availability:
      scenario === "partial-data" && skuIndex === count - 1
        ? ("unavailable" as const)
        : ("available" as const),
    default: skuIndex === 0,
  }));
}

/**
 * Product summary. `availability` is the literal `"available"` because the
 * decoder rejects any other value on this surface, and `priceRange` is derived
 * from the available skus so the decoder's min/max cross-check passes.
 */
function buildProductSummary(storeIndex: number, index: number, scenario: FixtureScenario) {
  const skus = buildSkus(index, scenario);
  const availableAmounts = skus
    .filter((sku) => sku.availability === "available")
    .map((sku) => sku.price.amountMinor);
  const partial = scenario === "partial-data" && index % 2 === 0;

  return {
    id: canonicalId(index),
    storeId: canonicalId(storeIndex),
    name:
      scenario === "long-copy"
        ? `${sentenceFor(index, 40)}（加量装 · 校园限定 · 支持到店自提）`.slice(0, 128)
        : sentenceFor(index, 18),
    subtitle: partial ? "" : summaryFor(index + 3, scenario === "long-copy" ? 150 : 48),
    coverAssetRef: null,
    priceRange: {
      currency: "CNY" as const,
      minAmountMinor: Math.min(...availableAmounts),
      maxAmountMinor: Math.max(...availableAmounts),
    },
    availability: "available" as const,
    rating: partial ? "0" : ratingFor(index, 3),
    salesCount: scenario === "long-copy" ? 987_654 : seededCount(index + 3, 12, 3_600),
    recommended: index % 3 === 0,
  };
}

function storeCount(scenario: FixtureScenario, volume: FixtureVolume): number {
  if (scenario === "empty") return 0;
  if (scenario === "many-items") return volume === "dense" ? 20 : 12;
  if (scenario === "long-copy") return 3;
  return volume === "sparse" ? 2 : volume === "dense" ? 8 : 3;
}

function productCount(scenario: FixtureScenario, volume: FixtureVolume): number {
  if (scenario === "empty") return 0;
  if (scenario === "many-items") return volume === "dense" ? MAX_PRODUCT_ID : 14;
  if (scenario === "long-copy") return 3;
  return volume === "sparse" ? 2 : 6;
}

/** Page block the decoder recomputes `hasMore` against. */
function pageBlock(total: number) {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total,
    hasMore: DEFAULT_PAGE_SIZE < total,
  };
}

export const commerceRoutes: FixtureRoute[] = [
  {
    family: FAMILY,
    method: "GET",
    pattern: "/api/commerce/stores",
    handler: ({ scenario, volume }: FixtureRequestContext) => {
      const total = storeCount(scenario, volume);
      const items = Array.from({ length: Math.min(total, DEFAULT_PAGE_SIZE) }, (_, index) =>
        buildStore(index, scenario),
      );
      return fixtureStrictJson(
        (requestId) => ({
          data: { items, page: pageBlock(total) },
          meta: { requestId, schemaVersion: SCHEMA_VERSION },
        }),
        `commerce-stores:${scenario}:${volume}`,
      );
    },
  },
  {
    family: FAMILY,
    method: "GET",
    pattern: "/api/commerce/stores/:storeId",
    handler: ({ scenario, volume, params }: FixtureRequestContext) => {
      const raw = params.storeId ?? "";
      const index = Number(raw) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= storeCount(scenario, volume)) {
        return fixtureNotFound("店铺不存在或已下架");
      }
      return fixtureStrictJson(
        (requestId) => ({
          data: { store: buildStore(index, scenario) },
          meta: { requestId, schemaVersion: SCHEMA_VERSION },
        }),
        `commerce-store:${raw}:${scenario}`,
      );
    },
  },
  {
    family: FAMILY,
    method: "GET",
    pattern: "/api/commerce/stores/:storeId/products",
    handler: ({ scenario, volume, params }: FixtureRequestContext) => {
      const raw = params.storeId ?? "";
      const storeIndex = Number(raw) - 1;
      if (
        !Number.isInteger(storeIndex) ||
        storeIndex < 0 ||
        storeIndex >= storeCount(scenario, volume)
      ) {
        return fixtureNotFound("店铺不存在或已下架");
      }
      const total = productCount(scenario, volume);
      const items = Array.from({ length: Math.min(total, DEFAULT_PAGE_SIZE) }, (_, index) =>
        buildProductSummary(storeIndex, index, scenario),
      );
      return fixtureStrictJson(
        (requestId) => ({
          data: { items, page: pageBlock(total) },
          meta: { requestId, schemaVersion: SCHEMA_VERSION },
        }),
        `commerce-products:${raw}:${scenario}:${volume}`,
      );
    },
  },
  {
    family: FAMILY,
    method: "GET",
    pattern: "/api/commerce/products/:productId",
    handler: ({ scenario, params }: FixtureRequestContext) => {
      const raw = params.productId ?? "";
      const index = Number(raw) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= MAX_PRODUCT_ID) {
        return fixtureNotFound("商品不存在或已下架");
      }
      // Detail = summary keys + `skus`, and nothing else.
      const product = {
        ...buildProductSummary(0, index, scenario),
        skus: buildSkus(index, scenario),
      };
      return fixtureStrictJson(
        (requestId) => ({
          data: { product },
          meta: { requestId, schemaVersion: SCHEMA_VERSION },
        }),
        `commerce-product:${raw}:${scenario}`,
      );
    },
  },
];

/**
 * Registers the commerce family. The exported array above stays the single
 * source of truth so the contract test can decode every handler directly.
 */
export function registerCommerceFixtures(): void {
  registerFixtureFamily(
    FAMILY,
    commerceRoutes.map((route) => [route.method, route.pattern, route.handler] as const),
  );
}
