import type { MapLocation } from "../../types/map";
import type { PublishVisibility } from "../../types/publish";

export const PUBLISH_DRAFT_SESSION_KEY = "lian.publishDraft.sameSession";
export const PUBLISH_DRAFT_SCOPE_ANONYMOUS = "anonymous";

export type PublishDraftScope = string;

export interface PublishDraftScopeUser {
  id?: string | null;
  username?: string | null;
}

export function resolvePublishDraftScope(
  user: PublishDraftScopeUser | null | undefined,
): PublishDraftScope {
  const id = typeof user?.id === "string" ? user.id.trim() : "";
  if (id) return `u:${id}`;
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  if (username) return `un:${username}`;
  return PUBLISH_DRAFT_SCOPE_ANONYMOUS;
}

function buildPublishDraftStorageKey(scope: PublishDraftScope): string {
  return `${PUBLISH_DRAFT_SESSION_KEY}::${scope || PUBLISH_DRAFT_SCOPE_ANONYMOUS}`;
}

const DEFAULT_VISIBILITY: PublishVisibility = "public";
const VALID_VISIBILITIES: PublishVisibility[] = ["public", "campus", "school", "private"];

export interface PublishDraftLocationSnapshot {
  id: string;
  name: string;
  type?: string;
  placeId?: string;
  lat: number;
  lng: number;
}

export interface PublishDraftSnapshot {
  title: string;
  body: string;
  tagInput: string;
  placeName: string;
  visibility: PublishVisibility;
  selectedMapLocation: PublishDraftLocationSnapshot | null;
  pendingImageCount: number;
}

export interface PublishDraftInput {
  title: string;
  body: string;
  tagInput: string;
  placeName: string;
  visibility: PublishVisibility;
  selectedMapLocation: MapLocation | null;
  selectedFileCount: number;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeVisibility(value: unknown): PublishVisibility {
  return VALID_VISIBILITIES.includes(value as PublishVisibility)
    ? (value as PublishVisibility)
    : DEFAULT_VISIBILITY;
}

function normalizeImageCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}

function normalizeLocation(value: unknown): PublishDraftLocationSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const id = normalizeText((value as { id?: unknown }).id).trim();
  const name = normalizeText((value as { name?: unknown }).name).trim();
  const lat = Number((value as { lat?: unknown }).lat);
  const lng = Number((value as { lng?: unknown }).lng);

  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const type = normalizeText((value as { type?: unknown }).type).trim() || undefined;
  const placeId = normalizeText((value as { placeId?: unknown }).placeId).trim() || undefined;

  return {
    id,
    name,
    type,
    placeId,
    lat,
    lng,
  };
}

export function hasMeaningfulPublishDraft(
  input: PublishDraftInput | PublishDraftSnapshot,
): boolean {
  const pendingImageCount = normalizeImageCount(
    "pendingImageCount" in input ? input.pendingImageCount : input.selectedFileCount,
  );

  return Boolean(
    normalizeText(input.title).trim() ||
    normalizeText(input.body).trim() ||
    normalizeText(input.tagInput).trim() ||
    normalizeText(input.placeName).trim() ||
    input.visibility !== DEFAULT_VISIBILITY ||
    input.selectedMapLocation ||
    pendingImageCount > 0,
  );
}

export function buildPublishDraftSnapshot(input: PublishDraftInput): PublishDraftSnapshot | null {
  if (!hasMeaningfulPublishDraft(input)) return null;

  return {
    title: normalizeText(input.title),
    body: normalizeText(input.body),
    tagInput: normalizeText(input.tagInput),
    placeName: normalizeText(input.placeName),
    visibility: normalizeVisibility(input.visibility),
    selectedMapLocation: input.selectedMapLocation
      ? {
          id: input.selectedMapLocation.id,
          name: input.selectedMapLocation.name,
          type: input.selectedMapLocation.type,
          placeId: input.selectedMapLocation.placeId || input.selectedMapLocation.place?.id,
          lat: input.selectedMapLocation.lat,
          lng: input.selectedMapLocation.lng,
        }
      : null,
    pendingImageCount: normalizeImageCount(input.selectedFileCount),
  };
}

export function readPublishDraft(
  scopeOrStorage: PublishDraftScope | Storage = PUBLISH_DRAFT_SCOPE_ANONYMOUS,
  storage: Storage = sessionStorage,
): PublishDraftSnapshot | null {
  const { scope, store } = normalizeReadArgs(scopeOrStorage, storage);
  try {
    const raw = store.getItem(buildPublishDraftStorageKey(scope));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const draft: PublishDraftSnapshot = {
      title: normalizeText((parsed as { title?: unknown }).title),
      body: normalizeText((parsed as { body?: unknown }).body),
      tagInput: normalizeText((parsed as { tagInput?: unknown }).tagInput),
      placeName: normalizeText((parsed as { placeName?: unknown }).placeName),
      visibility: normalizeVisibility((parsed as { visibility?: unknown }).visibility),
      selectedMapLocation: normalizeLocation(
        (parsed as { selectedMapLocation?: unknown }).selectedMapLocation,
      ),
      pendingImageCount: normalizeImageCount(
        (parsed as { pendingImageCount?: unknown }).pendingImageCount,
      ),
    };

    return hasMeaningfulPublishDraft(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function savePublishDraft(
  input: PublishDraftInput,
  scopeOrStorage: PublishDraftScope | Storage = PUBLISH_DRAFT_SCOPE_ANONYMOUS,
  storage: Storage = sessionStorage,
): PublishDraftSnapshot | null {
  const { scope, store } = normalizeReadArgs(scopeOrStorage, storage);
  const snapshot = buildPublishDraftSnapshot(input);
  const key = buildPublishDraftStorageKey(scope);

  try {
    if (!snapshot) {
      store.removeItem(key);
      return null;
    }

    store.setItem(key, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return snapshot;
  }
}

export function clearPublishDraft(
  scopeOrStorage: PublishDraftScope | Storage = PUBLISH_DRAFT_SCOPE_ANONYMOUS,
  storage: Storage = sessionStorage,
): void {
  const { scope, store } = normalizeReadArgs(scopeOrStorage, storage);
  try {
    store.removeItem(buildPublishDraftStorageKey(scope));
  } catch {
    // Storage cleanup should not block the publish flow.
  }
}

/**
 * Drop every scoped publish-draft entry. Called on logout / account switch so
 * a different account can't restore the previous user's draft.
 */
export function clearAllPublishDrafts(storage: Storage = sessionStorage): void {
  try {
    const prefix = `${PUBLISH_DRAFT_SESSION_KEY}::`;
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const candidate = storage.key(index);
      if (typeof candidate !== "string") continue;
      if (candidate === PUBLISH_DRAFT_SESSION_KEY || candidate.startsWith(prefix)) {
        keysToRemove.push(candidate);
      }
    }
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    // Storage cleanup should not block the publish flow.
  }
}

function normalizeReadArgs(
  scopeOrStorage: PublishDraftScope | Storage,
  fallbackStorage: Storage,
): { scope: PublishDraftScope; store: Storage } {
  if (typeof scopeOrStorage === "string") {
    return { scope: scopeOrStorage || PUBLISH_DRAFT_SCOPE_ANONYMOUS, store: fallbackStorage };
  }
  return { scope: PUBLISH_DRAFT_SCOPE_ANONYMOUS, store: scopeOrStorage };
}

export function restorePublishDraftLocation(
  snapshot: PublishDraftLocationSnapshot | null,
): MapLocation | null {
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    name: snapshot.name,
    type: snapshot.type,
    placeId: snapshot.placeId,
    lat: snapshot.lat,
    lng: snapshot.lng,
  };
}
