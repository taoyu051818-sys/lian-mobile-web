import type { FeedItem, FeedItemId } from "./feed";

export interface PostReply {
  id: FeedItemId;
  content: string;
  author: string;
  authorAvatarUrl: string;
  timestampISO: string;
}

export interface PostDetail extends Omit<FeedItem, "bodyPreview" | "contentType"> {
  contentHtml: string;
  imageUrls: string[];
  sourceUrl: string;
  replies: PostReply[];
  bookmarked: boolean;
}
