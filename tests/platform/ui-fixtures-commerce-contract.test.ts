/**
 * Feeds every commerce fixture through the REAL production decoders.
 *
 * This is the guard that makes the offline runtime trustworthy: if a fixture
 * drifts from `src/api/commerce.ts` (extra key, bad rating format, priceRange
 * that disagrees with the skus, non-UUID request id), the decoder throws here
 * instead of surfacing as a mysterious "malformed" state in the browser.
 */

import { describe, expect, it } from "vitest";

import {
  decodeCommerceProductDetail,
  decodeCommerceProductList,
  decodeCommerceStoreDetail,
  decodeCommerceStoreList,
} from "../../src/api/commerce";
import { commerceRoutes } from "../../src/platform/ui-fixtures/data/commerce";
import type {
  FixtureRequestContext,
  FixtureScenario,
  FixtureVolume,
} from "../../src/platform/ui-fixtures/types";

const SHAPING_SCENARIOS: FixtureScenario[] = [
  "normal",
  "empty",
  "long-copy",
  "many-items",
  "partial-data",
];
const VOLUMES: FixtureVolume[] = ["sparse", "default", "dense"];

function routeFor(pattern: string) {
  const route = commerceRoutes.find((candidate) => candidate.pattern === pattern);
  if (!route) throw new Error(`missing fixture route: ${pattern}`);
  return route;
}

function contextFor(
  scenario: FixtureScenario,
  volume: FixtureVolume,
  params: Record<string, string> = {},
): FixtureRequestContext {
  return {
    method: "GET",
    path: "/api/commerce/stores",
    route: "/api/commerce/stores",
    params,
    query: new URLSearchParams(),
    body: null,
    state: { scenario, identity: "guest", volume, latencyMs: 0, errorOverride: null },
    scenario,
    identity: "guest",
    volume,
  };
}

async function runRoute(
  pattern: string,
  scenario: FixtureScenario,
  volume: FixtureVolume,
  params: Record<string, string> = {},
): Promise<Response> {
  const result = await routeFor(pattern).handler(contextFor(scenario, volume, params));
  expect(result).toBeInstanceOf(Response);
  return result as Response;
}

/** Mirrors `assertSuccessHeaders` in src/api/commerce.ts. */
function readRequestId(response: Response): string {
  expect(response.headers.get("content-type")).toMatch(/^application\/json/);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const requestId = response.headers.get("x-request-id") ?? "";
  expect(requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  return requestId;
}

describe("commerce fixtures satisfy the production decoders", () => {
  for (const scenario of SHAPING_SCENARIOS) {
    for (const volume of VOLUMES) {
      it(`decodes the store list for ${scenario}/${volume}`, async () => {
        const response = await runRoute("/api/commerce/stores", scenario, volume);
        const requestId = readRequestId(response);
        const decoded = decodeCommerceStoreList(await response.json(), requestId);
        expect(decoded.page.page).toBe(1);
        expect(decoded.page.pageSize).toBe(20);
        expect(decoded.items.length).toBeLessThanOrEqual(decoded.page.pageSize);
        for (const store of decoded.items) {
          expect(store.logoAssetRef).toBeNull();
        }
      });

      it(`decodes the product list for ${scenario}/${volume}`, async () => {
        const response = await runRoute(
          "/api/commerce/stores/:storeId/products",
          scenario,
          volume,
          { storeId: "1" },
        );
        if (response.status === 404) return; // `empty` has no store 1 to browse.
        const requestId = readRequestId(response);
        const decoded = decodeCommerceProductList(await response.json(), requestId, "1");
        for (const product of decoded.items) {
          expect(product.coverAssetRef).toBeNull();
          expect(product.availability).toBe("available");
        }
      });
    }

    it(`decodes the store detail for ${scenario}`, async () => {
      const response = await runRoute("/api/commerce/stores/:storeId", scenario, "default", {
        storeId: "1",
      });
      if (response.status === 404) {
        expect(scenario).toBe("empty");
        return;
      }
      const requestId = readRequestId(response);
      const decoded = decodeCommerceStoreDetail(await response.json(), requestId, "1");
      expect(decoded.store.id).toBe("1");
    });

    it(`decodes the product detail for ${scenario}`, async () => {
      const response = await runRoute("/api/commerce/products/:productId", scenario, "default", {
        productId: "2",
      });
      const requestId = readRequestId(response);
      const decoded = decodeCommerceProductDetail(await response.json(), requestId, "2");
      expect(decoded.product.id).toBe("2");
      expect(decoded.product.skus.length).toBeGreaterThanOrEqual(1);
      expect(decoded.product.skus.filter((sku) => sku.default)).toHaveLength(1);
    });
  }

  it("returns a resource 404 for an unknown store id", async () => {
    const response = await runRoute("/api/commerce/stores/:storeId", "normal", "default", {
      storeId: "9999",
    });
    expect(response.status).toBe(404);
  });

  it("never emits a remote asset reference", async () => {
    const response = await runRoute("/api/commerce/stores", "many-items", "dense");
    const text = await response.text();
    expect(text).not.toMatch(/https?:\/\//);
  });
});
