/**
 * Post detail action registry (issue #793, follow-up to #785/#788).
 *
 * Single canonical lookup for which post-detail action surfaces should be
 * available for a given (post type, viewer role, state) tuple. Pairs with the
 * block-level `postCapabilityRegistry`: the capability registry decides which
 * detail blocks render at all, this action registry decides which buttons or
 * auxiliary action entries inside those already-rendered blocks are available.
 *
 * Adapters in `src/api/posts.ts` keep ownership of raw API normalization. The
 * registry is a pure function over already-normalized `PostDetail` fields, the
 * viewer-role flags the detail surface already derives, and the existing
 * report-flow follow-up state.
 */

import { helpHasLinkedEvent } from "../../domain/helpVotePolicy";
import type { PostType } from "../../types/post";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  TradePostExtension,
  TradeState,
} from "../../types/post-extensions";

export type PostActionId =
  | "report"
  | "hide-reported"
  | "event-act"
  | "event-complete"
  | "help-act"
  | "help-open-linked-event"
  | "help-link-event"
  | "help-unlink-event"
  | "help-resolve"
  | "merchant-errand"
  | "trade-set-available"
  | "trade-set-reserved"
  | "trade-set-sold"
  | "trade-set-cancelled"
  | "trade-set-hidden";

export interface PostViewerCapabilities {
  canManageEvent: boolean;
  canManageHelp: boolean;
  canManageTrade: boolean;
}

export interface PostActionContext {
  type?: PostType;
  viewer: PostViewerCapabilities;
  event?: EventPostExtension;
  help?: HelpPostExtension;
  merchant?: MerchantPostExtension;
  trade?: TradePostExtension;
  errandEntryAvailable?: boolean;
  reportFollowUpVisible?: boolean;
}

interface ActionDefinition {
  id: PostActionId;
  isAvailable: (ctx: PostActionContext) => boolean;
}

const TRADE_TRANSITIONS: Readonly<Record<TradeState, ReadonlySet<TradeState>>> = {
  available: new Set<TradeState>(["reserved", "sold", "cancelled", "hidden"]),
  reserved: new Set<TradeState>(["available", "sold", "cancelled", "hidden"]),
  hidden: new Set<TradeState>(["available", "cancelled"]),
  sold: new Set<TradeState>(),
  cancelled: new Set<TradeState>(),
};

function isEventExtensionUsable(event: EventPostExtension | undefined): boolean {
  return typeof event?.eventId === "string" && event.eventId.length > 0;
}

function isEventTerminal(event: EventPostExtension | undefined): boolean {
  if (!event) return false;
  return event.status === "completed" || event.status === "cancelled";
}

function isHelpExtensionUsable(help: HelpPostExtension | undefined): help is HelpPostExtension {
  return typeof help?.helpId === "string" && help.helpId.length > 0;
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
  { id: "report", isAvailable: () => true },
  { id: "hide-reported", isAvailable: (ctx) => Boolean(ctx.reportFollowUpVisible) },
  {
    id: "event-act",
    isAvailable: (ctx) => isEventExtensionUsable(ctx.event) && !isEventTerminal(ctx.event),
  },
  {
    id: "event-complete",
    isAvailable: (ctx) =>
      isEventExtensionUsable(ctx.event) && ctx.viewer.canManageEvent && !isEventTerminal(ctx.event),
  },
  {
    id: "help-act",
    isAvailable: (ctx) => isHelpExtensionUsable(ctx.help) && isHelpActive(ctx.help),
  },
  {
    id: "help-open-linked-event",
    isAvailable: (ctx) => isHelpExtensionUsable(ctx.help) && helpHasLinkedEvent(ctx.help),
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
    id: "merchant-errand",
    isAvailable: (ctx) => Boolean(ctx.merchant) && ctx.errandEntryAvailable === true,
  },
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

export type PostActionAvailability = "available" | "unavailable";

export function isPostActionAvailable(id: PostActionId, ctx: PostActionContext): boolean {
  const def = REGISTRY_BY_ID.get(id);
  if (!def) return false;
  return def.isAvailable(ctx);
}

export function selectPostAction(id: PostActionId, ctx: PostActionContext): PostActionAvailability {
  return isPostActionAvailable(id, ctx) ? "available" : "unavailable";
}

export function availablePostActions(ctx: PostActionContext): readonly PostActionId[] {
  return REGISTRY.filter((entry) => entry.isAvailable(ctx)).map((entry) => entry.id);
}
