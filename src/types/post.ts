import type { FeedItem, FeedItemId } from "./feed";

export interface PostReply {
  id?: FeedItemId;
  username?: string;
  content?: string;
  contentHtml?: string;
  timestampISO?: string;
}

export interface PostDetail extends FeedItem {
  contentHtml?: string;
  replies?: PostReply[];
  liked?: boolean;
  bookmarked?: boolean;
}
