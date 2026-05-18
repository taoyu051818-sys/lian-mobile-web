import type { DisplayActor, FeedItemId, SourceSignal } from "./feed";
import type { PlaceRef } from "./place";
import type { Audience } from "./audience";
import type { EventPostExtension, HelpPostExtension } from "./post-extensions";

export interface PostReply {
  id: FeedItemId;
  content: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  timestampISO: string;
}

export interface PostDetail {
  tid: FeedItemId;
  title: string;
  cover: string;
  primaryTag: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  place?: PlaceRef;
  timeLabel: string;
  timestampISO: string;
  likeCount: number;
  liked: boolean;
  locationArea: string;
  contentHtml: string;
  imageUrls: string[];
  sourceUrl: string;
  replies: PostReply[];
  bookmarked: boolean;
  /** PRD V0.1 §6.3 — present iff postType === "event". */
  event?: EventPostExtension;
  /** Whether the current viewer has already joined this event. */
  eventJoined?: boolean;
  /** PRD V0.1 §6.5 — present iff postType === "help". */
  help?: HelpPostExtension;
  /** Whether the current viewer has already voted on this help post. */
  helpVoted?: boolean;
  /** PRD V0.1 §6.5 / §11.3 — backend-driven flag for help management surface. */
  helpManageable?: boolean;
}

/**
 * Unified PostType vocabulary (PRD V0.1 §6.1).
 *
 *   - data model (server)         → `PostType` (here)
 *   - feed/card presentation      → `FeedPresentationIntent` (in types/feed)
 *   - publish input               → `PublishVisibility` (in types/publish)
 *
 * `event` is canonical; `activity` is kept only as a card-template label
 * (PRD §3.2) so existing Feed cards keep rendering during migration.
 */
export type PostType = "image" | "text" | "event" | "merchant" | "trade" | "help" | "place";

export const POST_TYPES: ReadonlySet<PostType> = new Set([
  "image",
  "text",
  "event",
  "merchant",
  "trade",
  "help",
  "place",
]);

export type PostStatus = "active" | "hidden" | "deleted" | "pending_review";

export interface PostLocation {
  /** Canonical place id when one is bound; empty string otherwise. */
  placeId: string;
  /** Display label — may be free-text when no place is bound. */
  label: string;
  lat: number | null;
  lng: number | null;
  place?: PlaceRef;
}

/**
 * Optional cross-references to other posts. PRD V0.1 §7.1.2 calls out that
 * `help` posts may resolve into `event` posts; that relation lives here.
 */
export interface PostRelation {
  type: "help_event_link" | "trade_offer_link" | "event_followup";
  targetTid: number;
}

export interface BasePostShape {
  tid: number;
  type: PostType;
  title: string;
  body: string;
  bodyPreview: string;
  cover?: string;
  imageUrls?: string[];
  tags: string[];
  authorUserId: string;
  aliasId?: string;
  identityTag?: string;
  location?: PostLocation;
  audience: Audience;
  relations?: PostRelation[];
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export function isKnownPostType(value: unknown): value is PostType {
  return typeof value === "string" && POST_TYPES.has(value as PostType);
}

/**
 * Coerce a raw value into a known PostType, falling back to `image`/`text`
 * based on the presence of a cover. Mirrors the Feed cardTemplate fallback.
 */
export function normalizePostType(value: unknown, hasCover: boolean): PostType {
  if (isKnownPostType(value)) return value;
  return hasCover ? "image" : "text";
}
