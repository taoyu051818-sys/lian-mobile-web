import type { FeedItemId } from "./feed";
import type { VerificationState, VerificationTag } from "./verification";

export type ProfileTabKey = "history" | "saved" | "liked";

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
  tags?: string[];
  identityTags?: string[];
  aliases?: ProfileAlias[];
  activeAliasId?: string | null;
  invitePermission?: boolean;
  status?: string;
  /**
   * PRD V0.1 §17 — verification records keyed by tag (campus_verified,
   * merchant_verified, ...). Backend `/api/auth/me` returns this after #381.
   * Use `verificationState[tag]?.active` for the gate; reading `revokedAt`
   * directly will mis-classify expired-but-not-revoked records.
   */
  verificationState?: VerificationState;
  /**
   * Flat list of currently-active verification tags. Mirrors
   * `Object.entries(verificationState).filter(([, r]) => r.active)`. Kept
   * as a convenience for places that just need a yes/no answer.
   */
  verificationTags?: VerificationTag[];
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

/**
 * Mirrors the backend `/api/me/stats` shape (DEFAULT_PROFILE_STATS in
 * `lian-platform-server/src/server/profile-service.js`). All counts are
 * non-negative integers; stats degrade to 0 when NodeBB data is unreachable.
 */
export interface ProfileStats {
  posts: number;
  replies: number;
  saved: number;
  liked: number;
  drafts: number;
  mapContributions: number;
}

/**
 * Mirrors backend `DEFAULT_PROFILE_SETTINGS` in `profile-service.js`.
 * Three controls: notification opt-in, who can see this profile, and whether
 * @-mentions in messages are allowed. The backend normalizes payloads on
 * PATCH, so the client trusts whatever the server returns and rolls back to
 * the entering-saving snapshot on a rejected patch (see settings-state).
 */
export type ProfileVisibility = "public" | "campus" | "private";

export interface ProfileSettings {
  notificationEnabled: boolean;
  profileVisibility: ProfileVisibility;
  allowMessageMentions: boolean;
}

/**
 * PATCH payload — every field optional. Backend treats the request as a
 * partial update and only validates / writes keys that are present.
 */
export type ProfileSettingsPatch = Partial<ProfileSettings>;
