import type { DisplayActor } from "../types/feed";

/**
 * Issue #938 — when a post is attributed to an alias identity but the alias
 * has no explicit avatar, every avatar surface must render this generic
 * silhouette instead of falling back to the poster's real account avatar.
 * The asset is shared with `lian-platform-server`'s alias-pool contract; see
 * `public/assets/aliases/README.md` for the cross-repo rules.
 */
export const ANONYMOUS_ALIAS_AVATAR_URL = "/assets/aliases/anonymous.svg";

/**
 * Alias avatars are sourced from the shared `/assets/aliases/` pool. Any
 * avatar URL outside that pool, attached to an alias-attributed actor, is
 * treated as a real-account leak and replaced with the anonymous fallback.
 */
const ALIAS_AVATAR_PREFIX = "/assets/aliases/";

function isAliasActor(actor?: DisplayActor | null): boolean {
  return Boolean(actor?.aliasId);
}

export function actorDisplayName(actor?: DisplayActor | null, fallback = ""): string {
  return actor?.displayName || actor?.username || actor?.name || fallback || "";
}

export function actorAvatarUrl(actor?: DisplayActor | null): string {
  if (isAliasActor(actor)) {
    // Alias-attributed actors must never inherit the real-account avatar.
    // Honor only avatar URLs sourced from the alias asset pool; everything
    // else (including an empty value) collapses to the anonymous fallback.
    const url = actor?.avatarUrl || "";
    return url.startsWith(ALIAS_AVATAR_PREFIX) ? url : ANONYMOUS_ALIAS_AVATAR_URL;
  }
  return actor?.avatarUrl || "";
}

export function actorAvatarText(actor?: DisplayActor | null, fallback = ""): string {
  return actor?.avatarText || actorDisplayName(actor, fallback).slice(0, 2) || "";
}
