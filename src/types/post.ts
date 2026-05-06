import type { DisplayActor, FeedItemId, SourceSignal } from "./feed";
import type { PlaceRef } from "./place";

export interface PostReply {
  id: FeedItemId;
  content: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  author?: string;
  authorAvatarUrl?: string;
  authorIdentityTag?: string;
  timestampISO: string;
}

export interface PostDetail {
  tid: FeedItemId;
  title: string;
  cover: string;
  primaryTag: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  author?: string;
  authorAvatarUrl?: string;
  authorIdentityTag?: string;
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
}
