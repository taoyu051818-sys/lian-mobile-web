import type { FeedItemId } from "./feed";

export interface PostReply {
  id: FeedItemId;
  content: string;
  author: string;
  authorAvatarUrl: string;
  timestampISO: string;
}

export interface PostDetail {
  tid: FeedItemId;
  title: string;
  cover: string;
  primaryTag: string;
  author: string;
  authorAvatarUrl: string;
  authorIdentityTag: string;
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
}
