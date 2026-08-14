import { isCanonicalCommerceProductId, isCanonicalCommerceStoreId } from "../app/commerce-route";
import type {
  CommerceProduct,
  CommerceProductDetailResult,
  CommerceProductListResult,
  CommerceProductPage,
  CommerceProductPriceRange,
  CommerceProductSku,
  CommerceProductSkuPrice,
  CommerceProductSummary,
  CommerceResponseMeta,
  CommerceStore,
  CommerceStoreDetailResult,
  CommerceStoreListResult,
  CommerceStorePage,
  CommerceStoreRatings,
} from "../types/commerce";

export type CommerceApiErrorKind =
  | "aborted"
  | "network"
  | "timeout"
  | "rate-limited"
  | "not-found"
  | "unavailable"
  | "malformed";

export class CommerceApiError extends Error {
  readonly kind: CommerceApiErrorKind;
  readonly status: number;

  constructor(kind: CommerceApiErrorKind, message: string, status = 0) {
    super(message);
    this.name = "CommerceApiError";
    this.kind = kind;
    this.status = status;
  }
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RATING_PATTERN = /^(?:0|[1-4]\.[0-9]{2}|5\.00)$/;
const MAX_SAFE_COUNT = 9_007_199_254_740_991;
const MAX_MINOR_AMOUNT = 9_999_999_999;
const PRODUCT_HTML_TAG_PATTERN = /<[^>]*>/;

function malformed(message: string): never {
  throw new CommerceApiError("malformed", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) malformed(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    malformed(`${label} keys do not match the accepted contract`);
  }
}

function assertContractString(
  value: unknown,
  label: string,
  minCodePoints: number,
  maxCodePoints: number,
): asserts value is string {
  if (typeof value !== "string") malformed(`${label} must be a string`);
  const length = Array.from(value).length;
  if (length < minCodePoints || length > maxCodePoints || hasControlCharacter(value)) {
    malformed(`${label} is outside the accepted string contract`);
  }
}

function assertProductText(
  value: unknown,
  label: string,
  minCodePoints: number,
  maxCodePoints: number,
): asserts value is string {
  assertContractString(value, label, minCodePoints, maxCodePoints);
  if (PRODUCT_HTML_TAG_PATTERN.test(value)) {
    malformed(`${label} must not contain an HTML tag shape`);
  }
}

function decodeRating(value: unknown, label: string): string {
  if (typeof value !== "string" || !RATING_PATTERN.test(value)) {
    malformed(`${label} must be an accepted fixed-point rating`);
  }
  return value;
}

function decodeRatings(value: unknown): CommerceStoreRatings {
  assertExactKeys(value, ["description", "service", "logistics"], "ratings");
  return {
    description: decodeRating(value.description, "ratings.description"),
    service: decodeRating(value.service, "ratings.service"),
    logistics: decodeRating(value.logistics, "ratings.logistics"),
  };
}

function decodeSafeCount(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_SAFE_COUNT
  ) {
    malformed(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function decodeMinorAmount(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_MINOR_AMOUNT
  ) {
    malformed(`${label} must be an accepted integer minor-unit amount`);
  }
  return value;
}

export function decodeCommerceStore(value: unknown): CommerceStore {
  assertExactKeys(
    value,
    [
      "id",
      "name",
      "summary",
      "areaLabel",
      "logoAssetRef",
      "ratings",
      "salesCount",
      "favoriteCount",
      "recommended",
    ],
    "store",
  );
  if (!isCanonicalCommerceStoreId(value.id)) malformed("store.id is invalid");
  assertContractString(value.name, "store.name", 1, 50);
  assertContractString(value.summary, "store.summary", 0, 255);
  assertContractString(value.areaLabel, "store.areaLabel", 0, 100);
  if (value.logoAssetRef !== null) malformed("store.logoAssetRef must be null");
  if (typeof value.recommended !== "boolean") malformed("store.recommended must be boolean");

  return {
    id: value.id,
    name: value.name,
    summary: value.summary,
    areaLabel: value.areaLabel,
    logoAssetRef: null,
    ratings: decodeRatings(value.ratings),
    salesCount: decodeSafeCount(value.salesCount, "store.salesCount"),
    favoriteCount: decodeSafeCount(value.favoriteCount, "store.favoriteCount"),
    recommended: value.recommended,
  };
}

function decodeMeta(value: unknown, responseRequestId: string): CommerceResponseMeta {
  assertExactKeys(value, ["requestId", "schemaVersion"], "meta");
  if (typeof value.requestId !== "string" || !UUID_V4_PATTERN.test(value.requestId)) {
    malformed("meta.requestId must be a lowercase UUIDv4");
  }
  if (value.requestId !== responseRequestId) malformed("response request ids do not match");
  if (value.schemaVersion !== "1.0.0") malformed("meta.schemaVersion is unsupported");
  return { requestId: value.requestId, schemaVersion: "1.0.0" };
}

function decodePage(value: unknown): CommerceStorePage {
  assertExactKeys(value, ["page", "pageSize", "total", "hasMore"], "page");
  if (
    !Number.isInteger(value.page) ||
    (value.page as number) < 1 ||
    (value.page as number) > 100_000
  ) {
    malformed("page.page is invalid");
  }
  if (
    !Number.isInteger(value.pageSize) ||
    (value.pageSize as number) < 1 ||
    (value.pageSize as number) > 50
  ) {
    malformed("page.pageSize is invalid");
  }
  const total = decodeSafeCount(value.total, "page.total");
  if (typeof value.hasMore !== "boolean") malformed("page.hasMore must be boolean");
  const page = value.page as number;
  const pageSize = value.pageSize as number;
  if (value.hasMore !== page * pageSize < total) malformed("page.hasMore is inconsistent");
  return { page, pageSize, total, hasMore: value.hasMore };
}

function decodeProductPriceRange(value: unknown): CommerceProductPriceRange {
  assertExactKeys(value, ["currency", "minAmountMinor", "maxAmountMinor"], "priceRange");
  if (value.currency !== "CNY") malformed("priceRange.currency must be CNY");
  const minAmountMinor = decodeMinorAmount(value.minAmountMinor, "priceRange.minAmountMinor");
  const maxAmountMinor = decodeMinorAmount(value.maxAmountMinor, "priceRange.maxAmountMinor");
  if (minAmountMinor > maxAmountMinor) malformed("priceRange is not ordered");
  return { currency: "CNY", minAmountMinor, maxAmountMinor };
}

function decodeProductSkuPrice(value: unknown): CommerceProductSkuPrice {
  assertExactKeys(value, ["currency", "amountMinor"], "sku.price");
  if (value.currency !== "CNY") malformed("sku.price.currency must be CNY");
  return {
    currency: "CNY",
    amountMinor: decodeMinorAmount(value.amountMinor, "sku.price.amountMinor"),
  };
}

function decodeProductFields(value: Record<string, unknown>): CommerceProductSummary {
  if (!isCanonicalCommerceProductId(value.id)) malformed("product.id is invalid");
  if (!isCanonicalCommerceStoreId(value.storeId)) malformed("product.storeId is invalid");
  assertProductText(value.name, "product.name", 1, 128);
  assertProductText(value.subtitle, "product.subtitle", 0, 150);
  if (value.coverAssetRef !== null) malformed("product.coverAssetRef must be null");
  if (value.availability !== "available") malformed("product.availability must be available");
  if (typeof value.recommended !== "boolean") {
    malformed("product.recommended must be boolean");
  }

  return {
    id: value.id,
    storeId: value.storeId,
    name: value.name,
    subtitle: value.subtitle,
    coverAssetRef: null,
    priceRange: decodeProductPriceRange(value.priceRange),
    availability: "available",
    rating: decodeRating(value.rating, "product.rating"),
    salesCount: decodeSafeCount(value.salesCount, "product.salesCount"),
    recommended: value.recommended,
  };
}

const PRODUCT_SUMMARY_KEYS = [
  "id",
  "storeId",
  "name",
  "subtitle",
  "coverAssetRef",
  "priceRange",
  "availability",
  "rating",
  "salesCount",
  "recommended",
] as const;

export function decodeCommerceProductSummary(value: unknown): CommerceProductSummary {
  assertExactKeys(value, PRODUCT_SUMMARY_KEYS, "product");
  return decodeProductFields(value);
}

function decodeProductSku(value: unknown): CommerceProductSku {
  assertExactKeys(value, ["id", "name", "price", "availability", "default"], "sku");
  if (!isCanonicalCommerceProductId(value.id)) malformed("sku.id is invalid");
  assertProductText(value.name, "sku.name", 0, 20);
  if (value.availability !== "available" && value.availability !== "unavailable") {
    malformed("sku.availability is invalid");
  }
  if (typeof value.default !== "boolean") malformed("sku.default must be boolean");
  return {
    id: value.id,
    name: value.name,
    price: decodeProductSkuPrice(value.price),
    availability: value.availability,
    default: value.default,
  };
}

function compareCanonicalIds(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function decodeCommerceProduct(value: unknown): CommerceProduct {
  assertExactKeys(value, [...PRODUCT_SUMMARY_KEYS, "skus"], "product");
  assertDenseArray(value.skus, "skus", 100, 1);
  const skus = value.skus.map((sku) => decodeProductSku(sku));

  let defaultCount = 0;
  const skuIds = new Set<string>();
  let previousSkuId: string | null = null;
  const availableAmounts: number[] = [];
  for (const sku of skus) {
    if (skuIds.has(sku.id)) malformed("sku ids must be unique");
    skuIds.add(sku.id);
    if (previousSkuId !== null && compareCanonicalIds(previousSkuId, sku.id) >= 0) {
      malformed("sku ids must be numeric ascending");
    }
    previousSkuId = sku.id;
    if (sku.default) defaultCount += 1;
    if (sku.availability === "available") availableAmounts.push(sku.price.amountMinor);
  }
  if (defaultCount !== 1) malformed("product must contain exactly one default sku");
  if (availableAmounts.length === 0) malformed("product must contain an available sku");

  const product = decodeProductFields(value);
  const availableMin = Math.min(...availableAmounts);
  const availableMax = Math.max(...availableAmounts);
  if (
    product.priceRange.minAmountMinor !== availableMin ||
    product.priceRange.maxAmountMinor !== availableMax
  ) {
    malformed("product priceRange does not match available sku prices");
  }
  return { ...product, skus };
}

function decodeJsonResponseBody(responseText: string): unknown {
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return malformed("response body is not valid JSON");
  }
}

function assertSuccessHeaders(response: Response): string {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    malformed("response Content-Type is not application/json");
  }
  if (response.headers.get("cache-control") !== "no-store") {
    malformed("response Cache-Control is not no-store");
  }
  const requestId = response.headers.get("x-request-id") ?? "";
  if (!UUID_V4_PATTERN.test(requestId)) malformed("response X-Request-Id is invalid");
  return requestId;
}

function assertDenseArray(
  value: unknown,
  label = "items",
  maxItems = 50,
  minItems = 0,
): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    malformed(`${label} must be an accepted array`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) malformed(`${label} must be dense`);
  }
}

export function decodeCommerceStoreList(
  value: unknown,
  responseRequestId: string,
): CommerceStoreListResult {
  assertExactKeys(value, ["data", "meta"], "response");
  assertExactKeys(value.data, ["items", "page"], "data");
  assertDenseArray(value.data.items);
  const items = value.data.items.map((item) => decodeCommerceStore(item));
  const page = decodePage(value.data.page);

  // This first slice sends no query and therefore accepts only the documented defaults.
  if (page.page !== 1 || page.pageSize !== 20) malformed("response page does not match request");
  if (items.length > page.pageSize || items.length > page.total) {
    malformed("response item count exceeds its page bounds");
  }
  if (items.length > 0 && (page.page - 1) * page.pageSize + items.length > page.total) {
    malformed("response items exceed the reported total offset");
  }

  return { items, page, meta: decodeMeta(value.meta, responseRequestId) };
}

export function decodeCommerceStoreDetail(
  value: unknown,
  responseRequestId: string,
  requestedStoreId: string,
): CommerceStoreDetailResult {
  assertExactKeys(value, ["data", "meta"], "response");
  assertExactKeys(value.data, ["store"], "data");
  const store = decodeCommerceStore(value.data.store);
  if (store.id !== requestedStoreId) malformed("detail store does not match the requested id");
  return { store, meta: decodeMeta(value.meta, responseRequestId) };
}

export function decodeCommerceProductList(
  value: unknown,
  responseRequestId: string,
  requestedStoreId: string,
): CommerceProductListResult {
  assertExactKeys(value, ["data", "meta"], "response");
  assertExactKeys(value.data, ["items", "page"], "data");
  assertDenseArray(value.data.items);
  const items = value.data.items.map((item) => decodeCommerceProductSummary(item));
  const page: CommerceProductPage = decodePage(value.data.page);

  if (page.page !== 1 || page.pageSize !== 20) malformed("response page does not match request");
  if (items.length > page.pageSize || items.length > page.total) {
    malformed("response item count exceeds its page bounds");
  }
  if (items.length > 0 && (page.page - 1) * page.pageSize + items.length > page.total) {
    malformed("response items exceed the reported total offset");
  }
  if (items.some((item) => item.storeId !== requestedStoreId)) {
    malformed("product list contains an item from another store");
  }

  return { items, page, meta: decodeMeta(value.meta, responseRequestId) };
}

export function decodeCommerceProductDetail(
  value: unknown,
  responseRequestId: string,
  requestedProductId: string,
): CommerceProductDetailResult {
  assertExactKeys(value, ["data", "meta"], "response");
  assertExactKeys(value.data, ["product"], "data");
  const product = decodeCommerceProduct(value.data.product);
  if (product.id !== requestedProductId) {
    malformed("detail product does not match the requested id");
  }
  return { product, meta: decodeMeta(value.meta, responseRequestId) };
}

type CommerceNotFoundResource = "store" | "product";

function errorForStatus(
  status: number,
  notFoundResource: CommerceNotFoundResource | null,
): CommerceApiError {
  if (status === 404 && notFoundResource) {
    const message =
      notFoundResource === "store"
        ? "Commerce store was not found"
        : "Commerce product was not found";
    return new CommerceApiError("not-found", message, status);
  }
  if (status === 429) {
    return new CommerceApiError("rate-limited", "Commerce request was rate limited", status);
  }
  if (status === 504) {
    return new CommerceApiError("timeout", "Commerce request timed out", status);
  }
  return new CommerceApiError("unavailable", "Commerce catalog is unavailable", status);
}

async function requestCommerceJson(
  path: string,
  signal: AbortSignal,
  notFoundResource: CommerceNotFoundResource | null,
): Promise<{ value: unknown; requestId: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new CommerceApiError("aborted", "Commerce request was aborted");
    }
    throw new CommerceApiError("network", "Commerce request failed");
  }

  if (response.status !== 200) throw errorForStatus(response.status, notFoundResource);
  const requestId = assertSuccessHeaders(response);
  return { value: decodeJsonResponseBody(await response.text()), requestId };
}

export async function fetchCommerceStoreList(
  signal: AbortSignal,
): Promise<CommerceStoreListResult> {
  const { value, requestId } = await requestCommerceJson("/api/commerce/stores", signal, null);
  return decodeCommerceStoreList(value, requestId);
}

export async function fetchCommerceStoreDetail(
  storeId: string,
  signal: AbortSignal,
): Promise<CommerceStoreDetailResult> {
  if (!isCanonicalCommerceStoreId(storeId)) {
    throw new CommerceApiError("malformed", "Commerce store id is invalid");
  }
  const { value, requestId } = await requestCommerceJson(
    `/api/commerce/stores/${storeId}`,
    signal,
    "store",
  );
  return decodeCommerceStoreDetail(value, requestId, storeId);
}

export async function fetchCommerceStoreProducts(
  storeId: string,
  signal: AbortSignal,
): Promise<CommerceProductListResult> {
  if (!isCanonicalCommerceStoreId(storeId)) {
    throw new CommerceApiError("malformed", "Commerce store id is invalid");
  }
  const { value, requestId } = await requestCommerceJson(
    `/api/commerce/stores/${storeId}/products`,
    signal,
    "store",
  );
  return decodeCommerceProductList(value, requestId, storeId);
}

export async function fetchCommerceProductDetail(
  productId: string,
  signal: AbortSignal,
): Promise<CommerceProductDetailResult> {
  if (!isCanonicalCommerceProductId(productId)) {
    throw new CommerceApiError("malformed", "Commerce product id is invalid");
  }
  const { value, requestId } = await requestCommerceJson(
    `/api/commerce/products/${productId}`,
    signal,
    "product",
  );
  return decodeCommerceProductDetail(value, requestId, productId);
}
