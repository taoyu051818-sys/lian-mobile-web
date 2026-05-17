import type { FeedItemId } from "./feed";

export type ProfileTabKey =
  | "history"
  | "saved"
  | "liked"
  | "posts"
  | "replies"
  | "drafts"
  | "map-contributions";

export type ProfileVisibility = "public" | "campus" | "private";
export type ProfileActivityStatus = "published" | "draft" | "pending" | "hidden";

export interface ProfileAlias {
  id: string;
  name: string;
  avatarUrl?: string;
  category?: string;
  categoryLabel?: string;
  description?: string;
  persona?: string;
  identitySignal?: string;
  status?: string;
}

export interface ProfileUser {
  id?: string;
  username?: string;
  email?: string;
  institution?: string;
  avatarUrl?: string;
  nodebbUid?: number | null;
  tags?: string[];
  identityTags?: string[];
  aliases?: ProfileAlias[];
  activeAliasId?: string | null;
  invitePermission?: boolean;
  status?: string;
}

export interface ProfileStats {
  posts: number;
  replies: number;
  saved: number;
  liked: number;
  drafts: number;
  mapContributions: number;
}

export interface ProfileSettings {
  notificationEnabled: boolean;
  profileVisibility: ProfileVisibility;
  allowMessageMentions: boolean;
}

export interface ProfileListItem {
  tid?: FeedItemId;
  id?: string | number;
  title?: string;
  cover?: string;
  timeLabel?: string;
  timestampISO?: string;
  lastViewedAt?: string;
  locationArea?: string;
  status?: ProfileActivityStatus;
}

export interface ProfileListPagination {
  totalCount: number;
  count: number;
  limit: number;
  hasMore: boolean;
}

export interface ProfileListResponse {
  items: ProfileListItem[];
  pagination: ProfileListPagination;
}
