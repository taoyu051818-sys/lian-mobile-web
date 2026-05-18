import type { PlaceRef } from "./place";
import type { Audience } from "./audience";
import type { MerchantCategory } from "./post-extensions";

export type PublishVisibility = "public" | "campus" | "school" | "private";
export type PublishLocationSource = "manual" | "skipped" | "map_v2";
/** "manual" = display-only free-text fallback, "gaode_v2" = resolved map selection */
export type PublishMapVersion = "legacy" | "manual" | "gaode_v2";

/**
 * Backend (#383) accepts these contentType values for merchant publishes; the
 * trailing slug mirrors `metadata.merchant.category`.
 */
export type MerchantContentType = "merchant_food" | "merchant_service" | "merchant_retail";

/**
 * Publish-side merchant input. Backend `normalizeMerchantMetadata` keeps only
 * the fields here; `verifiedAt` is injected server-side from the active
 * `merchant_verified` record so we do not send it.
 */
export interface MerchantPublishInput {
  name: string;
  category: MerchantCategory;
  hours: string;
  contact: string;
  errandSupported: boolean;
}

export interface PublishLocationDraft {
  source: PublishLocationSource;
  locationId: string;
  placeId?: string;
  place?: PlaceRef;
  locationArea: string;
  displayName: string;
  lat: number | null;
  lng: number | null;
  legacyPoint: { x: number | null; y: number | null };
  imagePoint: { x: number | null; y: number | null };
  mapVersion: PublishMapVersion;
  confidence: number;
  skipped: boolean;
  note: string;
}

export interface PublishPayload {
  imageUrl: string;
  imageUrls: string[];
  title: string;
  body: string;
  tag: string;
  identityTag: string;
  metadata: {
    locationArea?: string;
    visibility: PublishVisibility;
    distribution: string[];
    primaryTag?: string;
    identityTag?: string;
    /**
     * PRD V0.1 §10 — set to "merchant" to opt the post into the merchant
     * publish path. Backend then requires `contentType` to be one of the
     * three merchant_* values and active `merchant_verified` on the actor.
     */
    presentationIntent?: "merchant";
    /**
     * Optional full Audience descriptor (PRD V0.1 §6.2). Older backends ignore
     * this field and rely on `visibility` alone; newer backends use it to
     * authorize and persist scoped audience data.
     */
    audience?: Audience;
  };
  /**
   * Top-level alongside metadata, mirrors backend `normalizePostTaxonomy` —
   * `merchant_food` / `merchant_service` / `merchant_retail`.
   */
  contentType?: MerchantContentType;
  /** PRD §10 merchant block. Sent at top level, not inside metadata. */
  merchant?: MerchantPublishInput;
  locationDraft: PublishLocationDraft;
  riskFlags: Array<{ message?: string }>;
  confidence: number;
  needsHumanReview: boolean;
  aiMode: string;
  aliasId?: string;
}

export interface PublishResponse {
  tid?: string | number;
  place?: PlaceRef;
}

export interface UploadImageResponse {
  url: string;
}
