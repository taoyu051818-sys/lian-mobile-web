export type FeedItemId = number;

export interface FeedTab {
  id: string;
  label: string;
}

export interface FeedAuthor {
  nodebbUid: number;
  displayName: string;
  avatarUrl: string;
  identityTag: string;
  source: string;
}

export interface FeedItem {
  tid: FeedItemId;
  title: string;
  bodyPreview: string;
  cover: string;
  author: FeedAuthor;
  timeLabel: string;
  timestampISO: string;
  likeCount: number;
  liked: boolean;
  locationArea: string;
  contentType: string;
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
