/**
 * Anonymous, non-personalized store projection exposed by LIAN's public
 * commerce BFF. These types mirror only the accepted browser contract; they
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
