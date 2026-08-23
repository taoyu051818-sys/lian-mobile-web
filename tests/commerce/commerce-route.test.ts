import { describe, expect, it } from "vitest";
import {
  buildCommerceCartHash,
  buildCommerceCatalogHash,
  buildCommerceProductHash,
  buildCommerceStoreHash,
  isCanonicalCommerceProductId,
  isCanonicalCommerceStoreId,
  parseCommerceRoute,
} from "../../src/app/commerce-route";
import { parseDeepLink } from "../../src/app/deepLink";

describe("commerce raw-hash route contract", () => {
  it("round-trips only the catalog and canonical store/product routes", () => {
    expect(buildCommerceCatalogHash()).toBe("#/commerce");
    expect(parseCommerceRoute(buildCommerceCatalogHash())).toEqual({ name: "catalog" });

    for (const storeId of ["1", "9", "2147483647"]) {
      const hash = buildCommerceStoreHash(storeId);
      expect(hash).toBe(`#/commerce/stores/${storeId}`);
      expect(parseCommerceRoute(hash)).toEqual({ name: "store", storeId });
      expect(parseDeepLink(hash)).toEqual({ view: "commerce" });
    }
    for (const productId of ["1", "9", "2147483647"]) {
      const hash = buildCommerceProductHash(productId);
      expect(hash).toBe(`#/commerce/products/${productId}`);
      expect(parseCommerceRoute(hash)).toEqual({ name: "product", productId });
      expect(parseDeepLink(hash)).toEqual({ view: "commerce" });
    }
    expect(parseDeepLink("#/commerce")).toEqual({ view: "commerce" });
    expect(buildCommerceCartHash()).toBe("#/commerce/cart");
    expect(parseCommerceRoute(buildCommerceCartHash())).toEqual({ name: "cart" });
    expect(parseDeepLink(buildCommerceCartHash())).toEqual({ view: "commerce" });
  });

  it("keeps identifiers string-valued and enforces the exact GD INT range", () => {
    expect(isCanonicalCommerceStoreId("1")).toBe(true);
    expect(isCanonicalCommerceStoreId("2147483647")).toBe(true);
    expect(isCanonicalCommerceStoreId("2147483648")).toBe(false);
    expect(isCanonicalCommerceStoreId("9999999999")).toBe(false);
    expect(isCanonicalCommerceStoreId(1)).toBe(false);
    expect(isCanonicalCommerceStoreId(BigInt(1))).toBe(false);
    expect(isCanonicalCommerceProductId("1")).toBe(true);
    expect(isCanonicalCommerceProductId("2147483647")).toBe(true);
    expect(isCanonicalCommerceProductId("2147483648")).toBe(false);
  });

  it.each([
    "",
    "#",
    "#/commerce/",
    "#/commerce?x=1",
    "#/commerce/cart/",
    "#/commerce/cart?x=1",
    " /commerce",
    "/commerce",
    "#/commerce/stores/",
    "#/commerce/stores/0",
    "#/commerce/stores/00",
    "#/commerce/stores/01",
    "#/commerce/stores/+1",
    "#/commerce/stores/-1",
    "#/commerce/stores/1.0",
    "#/commerce/stores/2147483648",
    "#/commerce/stores/%31",
    "#/commerce/stores/%2F1",
    "#/commerce/stores/%",
    "#/commerce/stores/1/",
    "#/commerce/stores/1?x=2",
    "#/commerce/stores/1#tail",
    "#/commerce/stores/1\u0000",
    "#/commerce/stores/１２",
    "#/commerce/products/",
    "#/commerce/products/0",
    "#/commerce/products/00",
    "#/commerce/products/01",
    "#/commerce/products/+1",
    "#/commerce/products/-1",
    "#/commerce/products/1.0",
    "#/commerce/products/2147483648",
    "#/commerce/products/%31",
    "#/commerce/products/%2F1",
    "#/commerce/products/%",
    "#/commerce/products/1/",
    "#/commerce/products/1?x=2",
    "#/commerce/products/1#tail",
    "#/commerce/products/1\u0000",
    "#/commerce/products/１２",
  ])("rejects the non-canonical raw hash %j without decoding or trimming", (hash) => {
    expect(parseCommerceRoute(hash)).toBeNull();
    expect(parseDeepLink(hash)).toBeNull();
  });

  it("rejects invalid values at the builder boundary", () => {
    for (const storeId of ["", "0", "01", "+1", "1.0", "2147483648", "%31"]) {
      expect(() => buildCommerceStoreHash(storeId)).toThrow(RangeError);
      expect(() => buildCommerceProductHash(storeId)).toThrow(RangeError);
    }
  });
});
