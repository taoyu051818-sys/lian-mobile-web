export type CommerceRoute = { name: "catalog" } | { name: "store"; storeId: string };

const STORE_DETAIL_PREFIX = "#/commerce/stores/";
const MAX_STORE_ID = "2147483647";
const CANONICAL_DECIMAL_PATTERN = /^[1-9][0-9]{0,9}$/;

/**
 * Validate the accepted GD INT identifier without numeric coercion. The URL
 * spelling remains the source of truth, so aliases such as 01, +1, %31 and
 * 1.0 never collapse onto the same store.
 */
export function isCanonicalCommerceStoreId(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_DECIMAL_PATTERN.test(value)) return false;
  if (value.length < MAX_STORE_ID.length) return true;
  return value.length === MAX_STORE_ID.length && value <= MAX_STORE_ID;
}

/** Parse only the two exact raw hash shapes owned by the commerce slice. */
export function parseCommerceRoute(hash: string | null | undefined): CommerceRoute | null {
  if (hash === "#/commerce") return { name: "catalog" };
  if (typeof hash !== "string" || !hash.startsWith(STORE_DETAIL_PREFIX)) return null;
  const storeId = hash.slice(STORE_DETAIL_PREFIX.length);
  return isCanonicalCommerceStoreId(storeId) ? { name: "store", storeId } : null;
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
