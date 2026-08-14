export type CommerceRoute =
  | { name: "catalog" }
  | { name: "store"; storeId: string }
  | { name: "product"; productId: string };

const STORE_DETAIL_PREFIX = "#/commerce/stores/";
const PRODUCT_DETAIL_PREFIX = "#/commerce/products/";
const MAX_STORE_ID = "2147483647";
const CANONICAL_DECIMAL_PATTERN = /^[1-9][0-9]{0,9}$/;

/**
 * Validate the accepted GD INT identifier without numeric coercion. The URL
 * spelling remains the source of truth, so aliases such as 01, +1, %31 and
 * 1.0 never collapse onto the same commerce resource.
 */
export function isCanonicalCommerceStoreId(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_DECIMAL_PATTERN.test(value)) return false;
  if (value.length < MAX_STORE_ID.length) return true;
  return value.length === MAX_STORE_ID.length && value <= MAX_STORE_ID;
}

export const isCanonicalCommerceProductId = isCanonicalCommerceStoreId;

/** Parse only the three exact raw hash shapes owned by the commerce slice. */
export function parseCommerceRoute(hash: string | null | undefined): CommerceRoute | null {
  if (hash === "#/commerce") return { name: "catalog" };
  if (typeof hash !== "string") return null;
  if (hash.startsWith(STORE_DETAIL_PREFIX)) {
    const storeId = hash.slice(STORE_DETAIL_PREFIX.length);
    return isCanonicalCommerceStoreId(storeId) ? { name: "store", storeId } : null;
  }
  if (hash.startsWith(PRODUCT_DETAIL_PREFIX)) {
    const productId = hash.slice(PRODUCT_DETAIL_PREFIX.length);
    return isCanonicalCommerceProductId(productId) ? { name: "product", productId } : null;
  }
  return null;
}

export function buildCommerceCatalogHash(): "#/commerce" {
  return "#/commerce";
}

export function buildCommerceStoreHash(storeId: string): string {
  if (!isCanonicalCommerceStoreId(storeId)) {
    throw new RangeError("Commerce store id must be a canonical decimal in the accepted range");
  }
  return `${STORE_DETAIL_PREFIX}${storeId}`;
}

export function buildCommerceProductHash(productId: string): string {
  if (!isCanonicalCommerceProductId(productId)) {
    throw new RangeError("Commerce product id must be a canonical decimal in the accepted range");
  }
  return `${PRODUCT_DETAIL_PREFIX}${productId}`;
}
