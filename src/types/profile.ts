import type { FeedItemId } from "./feed";

export type ProfileTabKey = "history" | "saved" | "liked";

export interface ProfileAlias {
  id: string;
  poolId?: string;
  name: string;
  avatarUrl?: string;
  avatarSeed?: string;
  category?: string;
  categoryLabel?: string;
  status?: string;
  createdAt?: string;
}

export interface ProfileUser {
  username?: string;
  email?: string;
  institution?: string;
  avatarUrl?: string;
  tags?: string[];
  identityTags?: string[];
  interests?: string[];
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
