import type { AudienceVisibility } from "./audience";
import type { MetadataComponentV2 } from "./post-extensions";
import type { ClubMetadata, PostAvailableAction } from "./post";

export type FeedItemId = number;

export interface FeedTab {
  id: string;
  label: string;
}

export interface DisplayActor {
  id?: string;
  displayName?: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  avatarText?: string;
  identityTag?: string;
  /**
   * Issue #938 — when the post is attributed to an alias identity, the actor
   * carries the alias key here. The avatar resolver uses this as the trigger
   * to fall back to the generic anonymous SVG instead of leaking the user's
   * real avatar.
   */
  aliasId?: string;
}

export interface SourceSignal {
  provider?: string;
  label?: string;
  visible?: boolean;
}

export interface FeedRelation {
  type: string;
  targetTid: number;
}

export type FeedRelationHint = "help_event_link" | "trade_offer_link" | "event_followup";

/**
 * Card-template vocabulary the Feed UI knows how to render. `activity` is the
 * presentation label for `event` PostType (PRD V0.1 §3.2). `trade` reuses the
 * `merchant` template at the UI level until it gets its own visual variant.
 * `club` renders a dedicated club card with organization metadata.
 */
export type FeedPresentationIntent =
  | "image"
  | "text"
  | "activity"
  | "place"
  | "merchant"
  | "help"
  | "club";

/**
 * Card templates supported by FeedItemCardShell. Club cards use a dedicated
 * component (FeedItemClubCard) and are not rendered through the shell.
 */
export type FeedItemShellCardTemplate =
  | "image"
  | "text"
  | "activity"
  | "place"
  | "merchant"
  | "help";
export type FeedItemCardTemplateSource = "server" | "content-type" | "cover-fallback";

export interface FeedItem {
  tid: FeedItemId;
  title: string;
  bodyPreview: string;
  cover: string;
  primaryTag: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  timeLabel: string;
  timestampISO: string;
  likeCount: number;
  liked: boolean;
  locationArea: string;
  contentType: string;
  presentationIntent?: FeedPresentationIntent | string | null;
  cardTemplate?: FeedPresentationIntent | null;
  cardTemplateSource?: FeedItemCardTemplateSource;
  relationHint?: FeedRelationHint;
  /** Raw backend-shaped metadata components preserved for feed/detail parity. */
  components?: MetadataComponentV2[];
  /** Optional read-only relation hints for feed cards. */
  relations?: FeedRelation[];
  /** Backend-declared actions preserved verbatim for future graph consumers. */
  availableActions?: PostAvailableAction[];
  /** Club metadata — present iff contentType === "club". */
  club?: ClubMetadata;
  /** Audience visibility — defaults to "public" if absent. */
  visibility?: AudienceVisibility;
}

export interface FeedResponse {
  tabs: FeedTab[];
  items: FeedItem[];
  hasMore: boolean;
  nextPage: number | null;
}

export interface FeedQuery {
  tab: string;
  page: number;
  limit: number;
  read?: string;
  visibility?: AudienceVisibility[];
}
