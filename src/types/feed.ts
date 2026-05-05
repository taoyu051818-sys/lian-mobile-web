export type FeedItemId = string | number;

export interface FeedItem {
  tid: FeedItemId;
  title?: string;
  content?: string;
  contentHtml?: string;
  summary?: string;
  tag?: string;
  tags?: string[];
  type?: string;
  cover?: string;
  imageUrl?: string;
  author?: string;
  authorAvatarText?: string;
  authorIdentityTag?: string;
  contributionTag?: string;
  placeName?: string;
  locationName?: string;
  timeLabel?: string;
  timestampISO?: string;
  likeCount?: number;
  replyCount?: number;
  commentCount?: number;
  saveCount?: number;
  confirmed?: boolean;
  expired?: boolean;
  aiGenerated?: boolean;
  sourceUrl?: string;
}

export interface FeedResponse {
  tabs?: string[];
  items: FeedItem[];
  hasMore?: boolean;
  nextPage?: number;
}

export interface FeedQuery {
  tab: string;
  page: number;
  limit: number;
  read?: string;
}
