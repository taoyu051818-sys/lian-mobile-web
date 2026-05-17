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
}

export interface SourceSignal {
  provider?: string;
  label?: string;
  visible?: boolean;
}

/**
 * Card-template vocabulary the Feed UI knows how to render. `activity` is the
 * presentation label for `event` PostType (PRD V0.1 §3.2). `trade` reuses the
 * `merchant` template at the UI level until it gets its own visual variant.
 */
export type FeedPresentationIntent = "image" | "text" | "activity" | "place" | "merchant" | "help";
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
}
