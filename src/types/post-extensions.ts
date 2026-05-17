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

export type EventStatus = "open" | "full" | "closed" | "completed" | "cancelled";

export type EventJoinPolicy =
  | "open"
  | "approval_required"
  | "org_only"
  | "school_only";

export interface EventReward {
  /** Symbolic reward identifier — backend authoritative; UI shows label only. */
  type: "contribution" | "honor" | "coupon" | "credit" | "custom";
  amount?: number;
  label?: string;
}

export interface EventPostExtension {
  eventId: string;
  participantScope: Audience;
  allowedOrganizations: string[];
  reward?: EventReward;
  eventStatus: EventStatus;
  startAt?: string;
  endAt?: string;
  location?: PostLocation;
  capacity?: number;
  participantCount: number;
  joinPolicy: EventJoinPolicy;
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
// Merchant (PRD V0.1 §6.4)
// ---------------------------------------------------------------------------

export type MerchantType = "food" | "shop" | "service" | "trade";

export interface MerchantPostExtension {
  merchantId?: string;
  merchantType: MerchantType;
  /** Identity tags the user must hold to publish in this merchant category. */
  publishRequiredTags: string[];
  supportsErrand: boolean;
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
