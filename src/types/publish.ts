import type {
  CoordinateSystem,
  LocationIdentityKind,
  LocationPrecisionKind,
  PlaceRef,
} from "./place";
import type { Audience } from "./audience";
import type { EventJoinPolicy, MerchantCategory, TradeState } from "./post-extensions";
import type { InferredKind, SuggestedComponent } from "./publishSuggestion";

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
 * Backend (#387) accepts a single `trade` contentType. Category is free-text
 * inside `metadata.trade.category` rather than a routing axis.
 */
export type TradeContentType = "trade";

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

/**
 * Publish-side trade input. Backend `normalizeTradeMetadata` keeps only these
 * fields; `verifiedAt` is injected server-side from the active
 * `campus_verified` record so we do not send it.
 */
export interface TradePublishInput {
  price: string;
  state: TradeState;
  category: string;
}

export type PublishLocationIssueCode =
  | "manual-place-identity-removed"
  | "unknown-coordinate-system"
  | "invalid-lat-lng";

export interface PublishLocationIssue {
  code: PublishLocationIssueCode;
  message: string;
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
  coordinateSystem: CoordinateSystem;
  identityKind: LocationIdentityKind;
  precisionKind: LocationPrecisionKind;
  confidence: number;
  skipped: boolean;
  note: string;
  issues: PublishLocationIssue[];
}

export interface NormalizePublishLocationDraftResult {
  draft: PublishLocationDraft;
  issues: PublishLocationIssue[];
}

export interface PublishActionablePostPreview {
  kind: InferredKind;
  action: string;
  structure: string[];
}

export interface PublishPayload {
  imageUrl: string;
  imageUrls: string[];
  title: string;
  body: string;
  tag: string;
  identityTag: string;
  /**
   * Wire-`kind` tag (PRD V0.2 §2.2). Inferred client-side from the draft at
   * submit time — see `inferKind` in `src/features/publish/inferKind.ts`.
   * The backend continues to branch on this value rather than re-inferring,
   * so the contract is "publish front-end picks the kind, server trusts it".
   *
   * Optional on the wire so older clients (pre step F) keep working — when
   * absent the server falls through to the existing kind defaulting in
   * `normalizePostTaxonomy`. New clients always send it.
   */
  kind?: InferredKind;
  metadata: {
    locationArea?: string;
    visibility: PublishVisibility;
    distribution: string[];
    primaryTag?: string;
    identityTag?: string;
    /**
     * PRD V0.1 §10 / §11 — set to "merchant" to opt the post into the
     * merchant publish path (requires merchant_verified + merchant_*
     * contentType), or "trade" for the second-hand publish path
     * (requires campus_verified + contentType="trade").
     */
    presentationIntent?: "merchant" | "trade";
    /**
     * Optional full Audience descriptor (PRD V0.1 §6.2). Older backends ignore
     * this field and rely on `visibility` alone; newer backends use it to
     * authorize and persist scoped audience data.
     */
    audience?: Audience;
  };
  /**
   * Top-level alongside metadata, mirrors backend `normalizePostTaxonomy` —
   * `merchant_food` / `merchant_service` / `merchant_retail` for merchant,
   * `trade` for second-hand.
   */
  contentType?: MerchantContentType | TradeContentType;
  /** PRD §10 merchant block. Sent at top level, not inside metadata. */
  merchant?: MerchantPublishInput;
  /** PRD §11 trade block. Sent at top level, not inside metadata. */
  trade?: TradePublishInput;
  locationDraft: PublishLocationDraft;
  event?: {
    startsAt?: string;
    endsAt?: string;
    capacity?: number;
    rewardSummary?: string;
    joinPolicy: EventJoinPolicy;
    participantScope: Audience;
  };
  riskFlags: Array<{ message?: string }>;
  confidence: number;
  needsHumanReview: boolean;
  aiMode: string;
  candidates?: {
    title: string | null;
    bodyCandidate: string | null;
    inferredKind: InferredKind | null;
    suggestedComponents: SuggestedComponent[];
  };
  aliasId?: string;
}

export interface PublishResponse {
  tid?: string | number;
  place?: PlaceRef;
}

export interface UploadImageResponse {
  url: string;
}
