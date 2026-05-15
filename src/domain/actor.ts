import type { DisplayActor } from "../types/feed";

export function actorDisplayName(actor?: DisplayActor | null, fallback = ""): string {
  return actor?.displayName || actor?.username || actor?.name || fallback || "";
}

export function actorAvatarUrl(actor?: DisplayActor | null): string {
  return actor?.avatarUrl || "";
}

export function actorAvatarText(actor?: DisplayActor | null, fallback = ""): string {
  return actor?.avatarText || actorDisplayName(actor, fallback).slice(0, 2) || "";
}
