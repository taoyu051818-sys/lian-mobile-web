/**
 * Anonymous, non-personalized projections exposed by LIAN's public commerce
 * BFF. These types mirror only the accepted browser contracts; they
 * deliberately contain no GDPlatform origin, account state, or asset URL.
 */

export interface CommerceStoreRatings {
  description: string;
  service: string;
  logistics: string;
}

export interface CommerceStore {
  id: string;
  name: string;
  summary: string;
  areaLabel: string;
  logoAssetRef: null;
  ratings: CommerceStoreRatings;
  salesCount: number;
  favoriteCount: number;
  recommended: boolean;
}

export interface CommerceStorePage {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CommerceResponseMeta {
  requestId: string;
  schemaVersion: "1.0.0";
}

export interface CommerceStoreListResult {
  items: CommerceStore[];
  page: CommerceStorePage;
  meta: CommerceResponseMeta;
}

export interface CommerceStoreDetailResult {
  store: CommerceStore;
  meta: CommerceResponseMeta;
}

export interface CommerceProductPriceRange {
  currency: "CNY";
  minAmountMinor: number;
  maxAmountMinor: number;
}

export interface CommerceProductSkuPrice {
  currency: "CNY";
  amountMinor: number;
}

export interface CommerceProductSummary {
  id: string;
  storeId: string;
  name: string;
  subtitle: string;
  coverAssetRef: null;
  priceRange: CommerceProductPriceRange;
  availability: "available";
  rating: string;
  salesCount: number;
  recommended: boolean;
}

export interface CommerceProductSku {
  id: string;
  name: string;
  price: CommerceProductSkuPrice;
  availability: "available" | "unavailable";
  default: boolean;
}

export interface CommerceProduct extends CommerceProductSummary {
  skus: CommerceProductSku[];
}

export interface CommerceProductPage {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CommerceProductListResult {
  items: CommerceProductSummary[];
  page: CommerceProductPage;
  meta: CommerceResponseMeta;
}

export interface CommerceProductDetailResult {
  product: CommerceProduct;
  meta: CommerceResponseMeta;
}
