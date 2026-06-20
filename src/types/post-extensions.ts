/**
 * Event / Help / Merchant / Trade / Errand domain types (PRD V0.1 §6).
 *
 * V0.1 ships shapes only — no UI yet. The point is to give the API/storage
 * layers a canonical TypeScript contract so downstream features (feed cards,
 * detail page, admin moderation) can be written against a stable vocabulary.
 */

import type { Audience } from "./audience";
import type { PostLocation } from "./post";

// ---------------------------------------------------------------------------
// Event (PRD V0.1 §6.3)
// ---------------------------------------------------------------------------

/**
 * Event lifecycle state — derived from time/capacity/joinedCount on the
 * frontend (see `derivedEventStatus` in domain/eventActionPolicy). The backend
 * does NOT ship a status enum on the wire (decision: time + capacity express
 * lifecycle). Kept here so views can branch on a single computed value.
 */
export type EventStatus = "open" | "full" | "closed" | "completed" | "cancelled";

/**
 * Publish-side join policy. Not on the read DTO yet — only validated in the
 * publish form. When the backend grows server-driven join policy, this moves
 * onto `EventPostExtension`.
 */
export type EventJoinPolicy = "open" | "approval_required" | "org_only" | "school_only";

/**
 * Read-side event extension as returned by `GET /api/posts/:tid` after PR-V4b.
 * Wire shape mirrors backend `metadata.event` exactly: additive, no enum, no
 * audience scope (audience lives on the post itself).
 *
 * `status` is optional — backends that have not adopted server-driven lifecycle
 * yet simply omit it, and `derivedEventStatus` falls back to time/capacity
 * inference. When the field is present (e.g. after `POST /events/:id/complete`
 * or a moderator-driven cancel), the frontend honors it as authoritative.
 */
export interface EventPostExtension {
  eventId: string;
  startsAt?: string;
  endsAt?: string;
  /** Free-text location label; backend stores it as a string. */
  location?: string;
  capacity?: number;
  rewardSummary?: string;
  joinedCount: number;
  /**
   * Backend-authoritative lifecycle state. Optional on the wire — when missing,
   * status is inferred from `endsAt` / capacity. When present, `cancelled` and
   * `completed` win over the time-based fallback. `POST /complete` (issue #703)
   * sets this to "completed".
   */
  status?: EventStatus;
  /** ISO timestamp when the event was marked completed (issue #703). */
  completedAt?: string;
  /**
   * Settled reward block (issue #705). Populated by `POST /events/:id/reward`
   * (B1, lian-platform-server #444) once the author triggers settlement after
   * `/complete`. Optional on the wire — when missing, the readout block on
   * the detail view is simply absent. Read-only on the frontend.
   */
  rewardSettlement?: EventRewardSettlement;
}

/**
 * Frozen reward-settlement record. Mirrors the backend wire shape stored on
 * `metadata.event.rewardSettlement` after B1 (#444 / merge
 * 6c37ece93fc1ffcf255f26896563458f72526503). The frontend renders these
 * fields read-only; settlement actions live on the server.
 */
export interface EventRewardSettlement {
  /** Server-issued settlement id (e.g. `stl_…`). Required. */
  settlementId: string;
  /** ISO timestamp when settlement closed. */
  settledAt?: string;
  /** uid that triggered `/reward` (the post author). */
  settledBy?: string;
  /** Points credited to each paid joiner. */
  perJoiner: number;
  /** Paid joiner count after the anti-fraud floor. */
  joinerCount: number;
  /** `perJoiner * joinerCount` — the points actually paid out. */
  totalPaid: number;
  /** Locked-budget remainder returned to the author. */
  remainder: number;
  /** Frozen paid roster (uids). */
  joinerIds: string[];
  /**
   * Per-uid honor awarded by the settlement (joiners + author). Backend ships
   * this as a record `{ [uid]: number }`; the frontend currently does not
   * render the breakdown but round-trips it for future surfaces / debugging.
   */
  honorAwarded?: Record<string, number>;
}

/**
 * Publish-side event input — kept separate from the read shape because the
 * publish form collects fields the read side does not return (participantScope,
 * joinPolicy, allowedOrganizations).
 */
export interface EventPublishInput {
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
  rewardSummary?: string;
  participantScope: Audience;
  allowedOrganizations?: string[];
  joinPolicy: EventJoinPolicy;
}

/**
 * Response from `POST /api/events/:eventId/{join,cancel-join}` — only the
 * count + flag are authoritative; other event fields stay as the previously
 * fetched detail.
 */
export interface EventJoinResult {
  eventId: string;
  joinedCount: number;
  joined: boolean;
}

// ---------------------------------------------------------------------------
// Help (PRD V0.1 §6.5)
// ---------------------------------------------------------------------------

export type HelpStatus = "open" | "linked_event" | "resolved" | "closed";

export interface HelpPostExtension {
  helpId: string;
  voteCount: number;
  commentCount: number;
  status: HelpStatus;
  linkedEventTid?: number;
}

// ---------------------------------------------------------------------------
// Merchant (PRD V0.1 §6.4 / §10)
// ---------------------------------------------------------------------------

/**
 * Backend taxonomy: post contentType is one of `merchant_food` /
 * `merchant_service` / `merchant_retail`; the inner `metadata.merchant.category`
 * mirrors the trailing slug. We keep this tight to the wire so the frontend
 * does not need to translate.
 */
export type MerchantCategory = "food" | "service" | "retail";

/**
 * Read-side merchant block surfaced by `GET /api/posts/:tid` after PR-V607a
 * (backend #383). Wire shape mirrors `metadata.merchant` exactly. Optional
 * fields (`hours`, `contact`) are empty strings rather than missing keys when
 * the publisher left them blank.
 */
export interface MerchantPostExtension {
  name: string;
  category: MerchantCategory;
  hours: string;
  contact: string;
  errandSupported: boolean;
  /** ISO timestamp of the active `merchant_verified` grant at publish time. */
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// Trade (PRD V0.1 §6.4 / §11)
// ---------------------------------------------------------------------------

/**
 * Lifecycle of a second-hand listing. PRD §J4. `available` → `reserved` →
 * `sold` is the happy path; `cancelled` is the terminal exit. Backend #400
 * also supports author-side `hidden` as a soft-delete that can return to
 * `available`.
 */
export type TradeState = "available" | "reserved" | "sold" | "cancelled" | "hidden";

/**
 * Read-side trade block surfaced by `GET /api/posts/:tid` after backend #387.
 * Mirrors `metadata.trade` exactly. `category` is free-text (textbooks /
 * electronics / daily / 搬寝出物 …) — it's merchandising, not a routing axis,
 * so we keep it as a string and let frontend chips curate without forcing a
 * server-side enum migration.
 */
export interface TradePostExtension {
  /** Display string. Backend never parses currency — it's whatever the seller typed. */
  price: string;
  state: TradeState;
  category: string;
  /** ISO timestamp of the active `campus_verified` grant at publish time. */
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// Errand (PRD V0.1 §6.4)
// ---------------------------------------------------------------------------

export type ErrandMode = "dedicated" | "meal_peak_batch";

export type ErrandStatus =
  | "created"
  | "paid_locked"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "disputed";

export interface ErrandRunnerLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface ErrandOrder {
  orderId: string;
  requesterUserId: string;
  runnerUserId?: string;
  merchantPostId?: number;
  pickupLocation: PostLocation;
  dropoffLocation: PostLocation;
  mode: ErrandMode;
  status: ErrandStatus;
  feeAmount: number;
  lockedBalanceAmount: number;
  etaSeconds?: number;
  runnerLocation?: ErrandRunnerLocation;
}

// ---------------------------------------------------------------------------
// Vote / Like interaction (PRD V0.1 §11.3)
// ---------------------------------------------------------------------------

export type InteractionKind = "like" | "vote";

export interface InteractionToggleResult {
  tid: number;
  kind: InteractionKind;
  /** Whether the current user holds an active interaction after the toggle. */
  active: boolean;
  count: number;
}

// ---------------------------------------------------------------------------
// V2 Metadata Components (lian-platform-server #560)
// ---------------------------------------------------------------------------

/**
 * V2 component type discriminator. Each component in the `components` array
 * carries a `type` field that identifies its shape.
 */
export type MetadataComponentType =
  | "location"
  | "time"
  | "media"
  | "quality"
  | "audience"
  | "tags"
  | "event"
  | "merchant"
  | "trade"
  | "help"
  | "groupbuy";

/**
 * V2 LocationComponent — structured place/location data.
 */
export interface LocationComponentV2 {
  type: "location";
  placeId?: string;
  label?: string;
  lat?: number;
  lng?: number;
}

/**
 * V2 TimeComponent — event timing data.
 */
export interface TimeComponentV2 {
  type: "time";
  startsAt?: string;
  endsAt?: string;
}

/**
 * V2 EventComponent — event-specific metadata.
 */
export interface EventComponentV2 {
  type: "event";
  eventId: string;
  capacity?: number;
  joinedCount?: number;
  rewardSummary?: string;
  status?: EventStatus;
  completedAt?: string;
  location?: string;
}

/**
 * V2 MerchantComponent — merchant-specific metadata.
 */
export interface MerchantComponentV2 {
  type: "merchant";
  name: string;
  category?: MerchantCategory;
  hours?: string;
  contact?: string;
  errandSupported?: boolean;
  verifiedAt?: string;
}

/**
 * V2 TradeComponent — trade/second-hand listing metadata.
 */
export interface TradeComponentV2 {
  type: "trade";
  price: string;
  state?: TradeState;
  category?: string;
  verifiedAt?: string;
}

/**
 * V2 HelpComponent — help post metadata.
 */
export interface HelpComponentV2 {
  type: "help";
  helpId: string;
  status?: HelpStatus;
  voteCount?: number;
  commentCount?: number;
  linkedEventTid?: number;
}

export type GroupbuyState = "forming" | "success" | "failed" | "closed" | (string & {});
export type GroupbuyViewerStatus = "joined" | "not_joined" | "creator" | (string & {});
export type GroupbuyPaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | (string & {});

/**
 * V2 GroupbuyComponent — group-buy participation metadata.
 */
export interface GroupbuyComponentV2 {
  type: "groupbuy";
  groupbuyId?: string;
  state?: GroupbuyState;
  participantCount?: number;
  targetCount?: number;
  channelId?: string;
  joined?: boolean;
  viewerStatus?: GroupbuyViewerStatus;
  paymentStatus?: GroupbuyPaymentStatus;
}

export interface MediaComponentV2 {
  type: "media";
  imageUrls?: string[];
  coverUrl?: string;
}

export interface QualityComponentV2 {
  type: "quality";
  score?: number;
  labels?: string[];
}

export interface AudienceComponentV2 {
  type: "audience";
  visibility?: string;
  schoolId?: string;
  campusId?: string;
}

export interface TagsComponentV2 {
  type: "tags";
  tags?: string[];
}

/**
 * Union of all V2 metadata component types.
 */
export type MetadataComponentV2 =
  | LocationComponentV2
  | TimeComponentV2
  | MediaComponentV2
  | QualityComponentV2
  | AudienceComponentV2
  | TagsComponentV2
  | EventComponentV2
  | MerchantComponentV2
  | TradeComponentV2
  | HelpComponentV2
  | GroupbuyComponentV2;

/**
 * V2 metadata block as returned by the backend when `components` is present.
 * The frontend reads from this when available, falling back to V1 flat fields.
 */
export interface MetadataV2 {
  version: 2;
  components: MetadataComponentV2[];
}
