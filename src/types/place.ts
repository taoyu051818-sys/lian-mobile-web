import type { DisplayActor, FeedItemId, SourceSignal } from "./feed";

export type PlaceStatus =
  | "confirmed"
  | "pending"
  | "disputed"
  | "expired"
  | "ai-organized"
  | "official";

export interface PlaceRef {
  id: string;
  name: string;
  type?: string;
  status?: PlaceStatus;
}

export interface PlaceSummary {
  text?: string;
  sourceCount?: number;
  aiGenerated?: boolean;
  confidenceLabel?: string;
}

export interface PlaceStats {
  postCount?: number;
  correctionCount?: number;
  savedCount?: number;
}

export interface PlaceRecentPost {
  tid: FeedItemId | string;
  title?: string;
  excerpt?: string;
  imageUrl?: string;
  actor?: DisplayActor;
  timestampISO?: string;
  primaryTag?: string;
}

export interface PlaceSheet {
  id: string;
  name: string;
  type?: string;
  lat?: number;
  lng?: number;
  status: PlaceStatus;
  updatedAt?: string;
  source?: SourceSignal;
  summary?: PlaceSummary;
  stats?: PlaceStats;
  recentPosts?: PlaceRecentPost[];
}
