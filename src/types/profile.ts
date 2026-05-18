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
