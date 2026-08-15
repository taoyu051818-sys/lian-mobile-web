/**
 * Development-only UI fixtures for the commerce store catalog.
 *
 * These objects exist so a developer can inspect the catalog's visual edge
 * cases (long copy, many items, empty, error, zero rating, missing summary)
 * without a backend. They are NOT test data for the API layer:
 *
 *   - they reuse the production `CommerceStore` type verbatim, so a DTO drift
 *     fails `vue-tsc` instead of being papered over here;
 *   - they never travel through `src/api/commerce.ts`, so response validation,
 *     abort handling, and request ownership stay untouched;
 *   - they contain no asset URL and no external host, matching the accepted
 *     anonymous projection where `logoAssetRef` is always `null`.
 *
 * Production exclusion is structural, not incidental: every scenario is built
 * inside `buildCommerceStoreUiFixtures()` (no module-level data), and the only
 * consumer reaches this module through a dynamic `import()` that lives behind
 * `import.meta.env.DEV`. A production build therefore never references the
 * chunk, so the strings below cannot reach the shipped bundle.
 */

import type { CommerceStore } from "../../../types/commerce";
import type { CommerceReadErrorKind, CommerceReadStatus } from "../useCommerceStoreRead";

export interface CommerceStoreUiFixture {
  status: CommerceReadStatus;
  errorKind: CommerceReadErrorKind;
  items: readonly CommerceStore[];
}

export type CommerceStoreUiFixtureName =
  | "normal"
  | "long-copy"
  | "many-items"
  | "zero-rating"
  | "missing-summary"
  | "loading"
  | "empty"
  | "error"
  | "timeout"
  | "rate-limited";

export type CommerceStoreUiFixtureMap = Readonly<
  Record<CommerceStoreUiFixtureName, CommerceStoreUiFixture>
>;

export function buildCommerceStoreUiFixtures(): CommerceStoreUiFixtureMap {
  function store(overrides: Partial<CommerceStore> & Pick<CommerceStore, "id">): CommerceStore {
    return {
      name: "东区校园便利店",
      summary: "日常用品、零食和文具，靠近东区宿舍楼下。",
      areaLabel: "东区生活区",
      logoAssetRef: null,
      ratings: { description: "4.80", service: "4.90", logistics: "4.60" },
      salesCount: 128,
      favoriteCount: 36,
      recommended: false,
      ...overrides,
    };
  }

  const ready = (items: readonly CommerceStore[]): CommerceStoreUiFixture => ({
    status: "ready",
    errorKind: "generic",
    items,
  });

  const failed = (errorKind: CommerceReadErrorKind): CommerceStoreUiFixture => ({
    status: "error",
    errorKind,
    items: [],
  });

  return {
    normal: ready([
      store({ id: "1", recommended: true }),
      store({
        id: "2",
        name: "西区文具铺",
        summary: "打印、复印、文具和学习用品。",
        areaLabel: "西区教学楼",
        ratings: { description: "5.00", service: "4.70", logistics: "4.50" },
        salesCount: 42,
        favoriteCount: 9,
      }),
      store({
        id: "3",
        name: "南门水果店",
        summary: "当季水果与切好的果盒，支持自提。",
        areaLabel: "南门商业街",
        ratings: { description: "4.30", service: "4.40", logistics: "4.10" },
        salesCount: 7,
        favoriteCount: 1,
      }),
    ]),

    // Longest realistic name, summary, area label, and 6-digit counters at once.
    "long-copy": ready([
      store({
        id: "1",
        name: "东区校园生活综合服务中心便利店旗舰门店（含打印与快递代收）",
        summary:
          "这家店提供日常用品、零食饮料、文具耗材、打印复印、快递代收代寄以及雨具借用等服务，营业时间覆盖工作日与周末，位置在东区宿舍区中心广场的西南角。",
        areaLabel: "东区生活区中心广场西南角快递柜旁",
        ratings: { description: "4.95", service: "4.88", logistics: "4.72" },
        salesCount: 128_640,
        favoriteCount: 25_318,
        recommended: true,
      }),
      store({
        id: "2",
        name: "西区文具铺",
        summary: "",
        areaLabel: "",
        ratings: { description: "0", service: "0", logistics: "0" },
        salesCount: 0,
        favoriteCount: 0,
      }),
    ]),

    "many-items": ready(
      Array.from({ length: 12 }, (_unused, index) =>
        store({
          id: String(index + 1),
          name: `校园周边店铺 ${index + 1} 号`,
          areaLabel: index % 2 === 0 ? "东区生活区" : "西区教学楼",
          salesCount: index * 37,
          favoriteCount: index * 4,
          recommended: index % 4 === 0,
        }),
      ),
    ),

    // "0" is the accepted "no rating yet" sentinel, not a real score.
    "zero-rating": ready([
      store({ id: "1", ratings: { description: "0", service: "0", logistics: "0" } }),
      store({
        id: "2",
        name: "西区文具铺",
        ratings: { description: "0", service: "4.70", logistics: "4.50" },
        salesCount: 0,
        favoriteCount: 0,
        recommended: true,
      }),
    ]),

    "missing-summary": ready([
      store({ id: "1", summary: "", areaLabel: "" }),
      store({ id: "2", name: "西区文具铺", summary: "", areaLabel: "西区教学楼" }),
    ]),

    loading: { status: "loading", errorKind: "generic", items: [] },
    empty: { status: "empty", errorKind: "generic", items: [] },
    error: failed("generic"),
    timeout: failed("timeout"),
    "rate-limited": failed("rate-limited"),
  };
}
