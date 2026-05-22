/**
 * Post detail action registry (issue #793, follow-up to #785/#788).
 *
 * Single canonical lookup for which post-detail action surfaces should be
 * available for a given (post type, viewer role, state) tuple. Pairs with the
 * block-level `postCapabilityRegistry` (issue #785, shipped in #788): the
 * capability registry decides which detail blocks render at all, this action
 * registry decides which buttons inside those blocks are available.
 *
 * Adapters in `src/api/posts.ts` keep ownership of raw API normalization. The
 * registry is a pure function over already-normalized `PostDetail` fields,
 * the same role flags `usePostDetailExtensions` already derives, and the
 * report-flow follow-up flag the panel already owns.
 *
 * Scope (per issue #793):
 *   - currently shipped post-facing actions: report / hide-reported,
 *     event-act + event-complete, help-act + help manage transitions,
 *     merchant errand entry, trade state transitions
 *   - registry decides availability only; per-block components keep ownership
 *     of disabled-state and disabled-reason copy through the existing
 *     `eventActionPolicy` / `helpVotePolicy` / `helpManagePolicy` policies
 *   - errand orders / wallet ledgers / verification applications / audit
 *     records are explicitly NOT modeled as post actions
 */

import type { PostType } from "../../types/post";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  TradePostExtension,
  TradeState,
} from "../../types/post-extensions";

/**
 * Action identifiers known to the registry. New post-facing actions add an
 * entry to `REGISTRY` rather than widening conditionals across detail blocks.
 */
export type PostActionId =
  | "report"
  | "hide-reported"
  | "event-act"
  | "event-complete"
  | "help-act"
  | "help-link-event"
  | "help-unlink-event"
  | "help-resolve"
  | "help-close"
  | "merchant-errand"
  | "trade-set-available"
  | "trade-set-reserved"
  | "trade-set-sold"
  | "trade-set-cancelled"
  | "trade-set-hidden";

/**
 * Viewer-side role flags the registry needs. Mirrors what
 * `usePostDetailExtensions` and `PostDetailTradeManageBlock` already derive
 * (server-shipped flag, otherwise client-side actor / admin probe). Kept
 * narrow on purpose — the registry never reads `/api/auth/me` itself.
 */
export interface PostViewerCapabilities {
  /** True iff viewer is the post author OR a site admin (event manage surface). */
  canManageEvent: boolean;
  /** True iff viewer is allowed to manage this help post (server-driven flag). */
  canManageHelp: boolean;
  /** True iff viewer is the post author of a trade listing. */
  canManageTrade: boolean;
}

export interface PostActionContext {
  type?: PostType;
  viewer: PostViewerCapabilities;
  event?: EventPostExtension;
  help?: HelpPostExtension;
  merchant?: MerchantPostExtension;
  trade?: TradePostExtension;
  /** Hoisted by the backend from `merchant.errandSupported`. */
  errandEntryAvailable?: boolean;
  /** True after a report has been submitted; gates the hide-reported follow-up. */
  reportFollowUpVisible?: boolean;
}

interface ActionDefinition {
  id: PostActionId;
  isAvailable: (ctx: PostActionContext) => boolean;
}

// Mirrors the backend transition matrix (`assertTradeStateTransition`, #649)
// and the table inside `PostDetailTradeManageBlock`. Sold + cancelled are
// terminal; hidden round-trips to available or cancelled but cannot jump to
// sold/reserved without surfacing first.
const TRADE_TRANSITIONS: Readonly<Record<TradeState, ReadonlySet<TradeState>>> = {
  available: new Set<TradeState>(["reserved", "sold", "cancelled", "hidden"]),
  reserved: new Set<TradeState>(["available", "sold", "cancelled", "hidden"]),
  hidden: new Set<TradeState>(["available", "cancelled"]),
  sold: new Set<TradeState>(),
  cancelled: new Set<TradeState>(),
};

function isEventTerminal(event: EventPostExtension | undefined): boolean {
  if (!event) return false;
  // Mirrors `derivedEventStatus` terminal handling (server-driven status
  // wins). Time-based completion is left to the per-block plan because it
  // depends on a clock the registry deliberately does not own.
  return event.status === "completed" || event.status === "cancelled";
}

function isEventExtensionUsable(event: EventPostExtension | undefined): boolean {
  if (!event) return false;
  return typeof event.eventId === "string" && event.eventId.length > 0;
}

function isHelpExtensionUsable(help: HelpPostExtension | undefined): boolean {
  if (!help) return false;
  return typeof help.helpId === "string" && help.helpId.length > 0;
}

function isHelpActive(help: HelpPostExtension | undefined): boolean {
  if (!help) return false;
  return help.status === "open" || help.status === "linked_event";
}

function tradeCanTransitionTo(trade: TradePostExtension | undefined, target: TradeState): boolean {
  if (!trade) return false;
  return TRADE_TRANSITIONS[trade.state].has(target);
}

const TRADE_TARGETS: readonly TradeState[] = [
  "available",
  "reserved",
  "sold",
  "cancelled",
  "hidden",
];

const REGISTRY: readonly ActionDefinition[] = [
  // Universal — `report` is always surfaceable; `hide-reported` only after
  // the report flow advanced past the submit step.
  { id: "report", isAvailable: () => true },
  { id: "hide-reported", isAvailable: (ctx) => Boolean(ctx.reportFollowUpVisible) },

  // Event — surface needs a usable extension; the manage action additionally
  // needs the manageable role and a non-terminal status.
  {
    id: "event-act",
    isAvailable: (ctx) => isEventExtensionUsable(ctx.event) && !isEventTerminal(ctx.event),
  },
  {
    id: "event-complete",
    isAvailable: (ctx) =>
      isEventExtensionUsable(ctx.event) && ctx.viewer.canManageEvent && !isEventTerminal(ctx.event),
  },

  // Help — vote/unvote surfaces while the help is active; manage transitions
  // mirror `planHelpManage` so the registry can act as the canonical gate.
  {
    id: "help-act",
    isAvailable: (ctx) => isHelpExtensionUsable(ctx.help) && isHelpActive(ctx.help),
  },
  {
    id: "help-link-event",
    isAvailable: (ctx) =>
      ctx.viewer.canManageHelp && isHelpExtensionUsable(ctx.help) && ctx.help?.status === "open",
  },
  {
    id: "help-unlink-event",
    isAvailable: (ctx) =>
      ctx.viewer.canManageHelp &&
      isHelpExtensionUsable(ctx.help) &&
      ctx.help?.status === "linked_event",
  },
  {
    id: "help-resolve",
    isAvailable: (ctx) =>
      ctx.viewer.canManageHelp && isHelpExtensionUsable(ctx.help) && isHelpActive(ctx.help),
  },
  {
    id: "help-close",
    isAvailable: (ctx) =>
      ctx.viewer.canManageHelp && isHelpExtensionUsable(ctx.help) && isHelpActive(ctx.help),
  },

  // Merchant — errand entry only surfaces when the backend says it's currently
  // available. `errandSupported && entry-available === false` is the explicit
  // unavailable state and is owned by the merchant block; from the registry's
  // perspective the action itself is unavailable.
  { id: "merchant-errand", isAvailable: (ctx) => ctx.errandEntryAvailable === true },

  // Trade — one entry per outbound state, gated by manage role and the
  // backend transition matrix.
  ...TRADE_TARGETS.map(
    (target): ActionDefinition => ({
      id: `trade-set-${target}` as PostActionId,
      isAvailable: (ctx) => ctx.viewer.canManageTrade && tradeCanTransitionTo(ctx.trade, target),
    }),
  ),
];

const REGISTRY_BY_ID: ReadonlyMap<PostActionId, ActionDefinition> = new Map(
  REGISTRY.map((entry) => [entry.id, entry] as const),
);

/**
 * True iff the given action surface should be available for the supplied
 * context. Returns `false` for unknown action ids so callers stay safe when
 * older code references an id that has since been removed.
 */
export function isPostActionAvailable(id: PostActionId, ctx: PostActionContext): boolean {
  const def = REGISTRY_BY_ID.get(id);
  if (!def) return false;
  return def.isAvailable(ctx);
}

/**
 * Resolve every action the registry knows about. Iteration order is stable
 * and matches the order actions surface in the detail panel today.
 */
export function availablePostActions(ctx: PostActionContext): readonly PostActionId[] {
  const out: PostActionId[] = [];
  for (const entry of REGISTRY) {
    if (entry.isAvailable(ctx)) out.push(entry.id);
  }
  return out;
}

/**
 * `available` / `unavailable` selection token, matching the shape used by
 * `postCapabilityRegistry` so callers can pattern-match on the same vocabulary.
 */
export type PostActionAvailability = "available" | "unavailable";

export function selectPostAction(id: PostActionId, ctx: PostActionContext): PostActionAvailability {
  return isPostActionAvailable(id, ctx) ? "available" : "unavailable";
}
