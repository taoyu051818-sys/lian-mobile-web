import type { FeedItemId } from "./feed";

export type ProfileTabKey = "history" | "saved" | "liked";

export interface ProfileAlias {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ProfileUser {
  username?: string;
  email?: string;
  institution?: string;
  avatarUrl?: string;
  tags?: string[];
  identityTags?: string[];
  aliases?: ProfileAlias[];
  activeAliasId?: string | null;
  invitePermission?: boolean;
  status?: string;
}

export interface ProfileListItem {
  tid: FeedItemId;
  title?: string;
  cover?: string;
  timestampISO?: string;
  lastViewedAt?: string;
}

export interface ProfileListResponse {
  items?: ProfileListItem[];
}
