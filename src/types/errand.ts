/**
 * Errand order (PRD V0.1 §6.4 / §12) — types owned by issue #647.
 *
 * The bare lifecycle / order shapes already live in `post-extensions.ts`
 * because the V0.1 wave seeded them as shape-only contracts. We re-export
 * them here so #648 (runner center) and any downstream feature can import
 * everything from a single module — see the issue brief: "#647 owns
 * src/types/errand.ts and src/api/errands.ts; #648 only consumes them".
 *
 * What this module adds on top of `post-extensions.ts`:
 * - Draft / request types for the user-side order form.
 * - Gate reason union (PRD §12 — not_logged_in / not_verified /
 *   insufficient_balance / merchant_paused / no_runner_coverage / unknown).
 * - Timeline event shape returned by `GET /api/errand-orders/:id`.
 *
 * The order state machine itself stays out of scope (#648); the timeline
 * event shape is intentionally read-only here.
 */

import type { PostLocation } from "./post";
export type {
  ErrandMode,
  ErrandOrder,
  ErrandRunnerLocation,
  ErrandStatus,
} from "./post-extensions";
import type { ErrandMode, ErrandOrder, ErrandStatus } from "./post-extensions";

/**
 * Reasons the order CTA may be blocked before submit. Mirrors the merchant
 * eligibility code style (`MerchantErrandUnavailableReason`) so the UI can
 * dispatch on the same union shape end-to-end.
 *
 * Order matters for the gate evaluator — auth gates win first, then
 * verification, then balance, then merchant-specific reasons.
 */
export type ErrandOrderGateReason =
  | "not_logged_in"
  | "not_verified"
  | "insufficient_balance"
  | "merchant_paused"
  | "no_runner_coverage"
  | "unknown";

export interface ErrandOrderGate {
  /** Whether the user can open the order form (and submit on success). */
  ok: boolean;
  /** First blocking reason; empty string when `ok=true`. */
  reason: ErrandOrderGateReason | "";
  /** Human-readable explanation; backend may localize. Empty when ok. */
  reasonText: string;
  /**
   * Wallet balance points the user has available right now. Surfaced so the
   * form can render a balance hint even when `ok=true` (lets the user see
   * how close they are to hitting the gate before submit).
   */
  availablePoints: number;
  /** Estimated fee for the prospective order; 0 when unknown. */
  estimatedFeePoints: number;
}

/**
 * Editable form state owned by `useErrandOrderDraft`. Pickup/dropoff carry
 * the same `PostLocation` shape the rest of the app uses so the place
 * picker is reusable. `notes` is free-text and trimmed on submit.
 */
export interface ErrandOrderDraft {
  merchantPostId: number;
  pickupLocation: PostLocation | null;
  dropoffLocation: PostLocation | null;
  notes: string;
  mode: ErrandMode;
}

/**
 * Wire-shape sent to `POST /api/errand-orders`. Locations are flattened to
 * the same shape `PostLocation` exposes so the backend keeps a single
 * normalizer. `notes` is trimmed; empty notes degrade to omitted on the
 * wire (handled by the API helper, not the form).
 */
export interface ErrandOrderRequest {
  merchantPostId: number;
  pickupLocation: PostLocation;
  dropoffLocation: PostLocation;
  notes?: string;
  mode: ErrandMode;
}

/**
 * Single timeline entry surfaced on the order detail view. The status
 * machine itself is #648's job — the user-side detail view only renders
 * what the backend already wrote, so this stays a flat record.
 *
 * `at` is the ISO timestamp the entry landed; `actor` is `"system"` for
 * automated transitions (state machine ticks) and the user/runner alias
 * otherwise.
 */
export interface ErrandOrderTimelineEvent {
  status: ErrandStatus;
  at: string;
  actor: "system" | "requester" | "runner" | "platform";
  /** Optional human-readable line accompanying the transition. */
  note?: string;
}

/**
 * Full order detail returned by `GET /api/errand-orders/:id`. Composes the
 * existing `ErrandOrder` (lifecycle fields) with a timeline + the human
 * preview we want to show on the order detail page.
 */
export interface ErrandOrderDetail {
  order: ErrandOrder;
  timeline: ErrandOrderTimelineEvent[];
  /** Optional notes the requester left at submit — empty string when omitted. */
  notes: string;
  /** ISO of `created` event; convenience copy of `timeline[0].at`. */
  createdAt: string;
}

/**
 * Successful response from `POST /api/errand-orders`. Backend either echoes
 * the created order back (and the UI can pivot straight into the timeline
 * view) or — if the gate evaluator fired late — returns `ok=false` with a
 * reason. Treating the failure as a gate keeps the failure handling
 * symmetric with the pre-submit pre-flight.
 */
export interface ErrandOrderCreateResponse {
  ok: boolean;
  order?: ErrandOrderDetail;
  reason?: ErrandOrderGateReason;
  reasonText?: string;
}

/**
 * Single row in "我的跑腿订单" (the requester's order list). Only the fields
 * the row needs to render are surfaced — full detail lives behind
 * `GET /api/errand-orders/:id` once the user taps in. Status drives the
 * sort + visual state on the list; createdAt is the secondary sort key.
 */
export interface ErrandOrderSummary {
  orderId: string;
  status: ErrandStatus;
  mode: ErrandMode;
  feeAmount: number;
  pickupLabel: string;
  dropoffLabel: string;
  createdAt: string;
}

/**
 * Response shape for `GET /api/errand-orders?mine=1`. Backend may also ship
 * a server-side cursor in the future; for now the list is whole-history with
 * the active orders sorted ahead of finished ones (server side).
 */
export interface ErrandOrderListResponse {
  items: ErrandOrderSummary[];
}
