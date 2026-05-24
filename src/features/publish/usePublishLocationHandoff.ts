/**
 * Cross-route location handoff for the publish flow (mw#943).
 *
 * The publish form lives at `#/publish`, but the location-picker map lives at
 * `#/map?picker=1`. Both routes mount fresh component trees, so a regular
 * Vue ref/composable cannot bridge the two — by the time MapLeafletView's
 * picker overlay calls `confirm()`, PublishView has been unmounted, and by
 * the time PublishView re-mounts on `history.back()` the picker is gone.
 *
 * sessionStorage is the simplest envelope that survives the route change
 * without bloating the hash. The key is single-tenant ("there is at most one
 * pending location pick at a time"), which means we don't need a TTL —
 * `consumePendingPublishLocation()` is destructive on read, so the entry
 * cannot leak past the round-trip it was created for. A reload between the
 * map confirm and the publish mount also keeps the entry, which is the
 * desired UX (the user shouldn't lose their pick to a refresh).
 *
 * The geolocation button writes through the same key, so PublishView's
 * consume path is uniform across "picked from map" and "use my current
 * location" sources.
 */

const STORAGE_KEY = "lian:publish:pendingLocation";

/**
 * Two payload shapes:
 *   - `place` — picked an existing campus place. Has a stable `placeId`, so
 *     PublishView can rebind to the same `MapLocation` from
 *     `usePublishLocationOptions.mapLocations` if the catalog is loaded, and
 *     fall back to a name-only display otherwise. `lat`/`lng` are carried so
 *     a fallback render still has coordinates without re-fetching.
 *   - `coords` — picked a free coordinate (long-press pin or "use my current
 *     location"). No place ID; PublishView treats it as a manual `placeName`
 *     with optional label override. The user can edit the label after.
 */
export type PublishLocationHandoff =
  | {
      kind: "place";
      placeId: string;
      name: string;
      type?: string;
      lat: number;
      lng: number;
    }
  | {
      kind: "coords";
      lat: number;
      lng: number;
      label?: string;
    };

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Storage access can throw in sandboxed iframes / privacy modes. Falling
    // back to "no handoff available" is preferable to crashing the publish
    // flow — the user will just have to type a place name manually.
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(parsed: unknown): PublishLocationHandoff | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.kind === "place") {
    if (
      isNonEmptyString(record.placeId) &&
      isNonEmptyString(record.name) &&
      isFiniteNumber(record.lat) &&
      isFiniteNumber(record.lng)
    ) {
      const out: PublishLocationHandoff = {
        kind: "place",
        placeId: record.placeId.trim(),
        name: record.name.trim(),
        lat: record.lat,
        lng: record.lng,
      };
      if (isNonEmptyString(record.type)) out.type = record.type.trim();
      return out;
    }
    return null;
  }
  if (record.kind === "coords") {
    if (isFiniteNumber(record.lat) && isFiniteNumber(record.lng)) {
      const out: PublishLocationHandoff = {
        kind: "coords",
        lat: record.lat,
        lng: record.lng,
      };
      if (isNonEmptyString(record.label)) out.label = record.label.trim();
      return out;
    }
    return null;
  }
  return null;
}

/**
 * Write a pending pick. Both the map picker and the geolocation button call
 * this; PublishView consumes via `consumePendingPublishLocation`. The write
 * is fire-and-forget — if storage is unavailable we silently drop the
 * payload (the user will see no pre-fill on the publish form, which is the
 * least surprising fallback).
 */
export function setPendingPublishLocation(payload: PublishLocationHandoff): void {
  const store = getStorage();
  if (!store) return;
  // Re-validate at write time so a malformed call site can't poison storage
  // for a subsequent valid round-trip.
  const normalized = normalize(payload);
  if (!normalized) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* swallow — quota errors and serialization failures are non-fatal */
  }
}

/**
 * Read-and-clear. Destructive on read so a single payload cannot be applied
 * twice (e.g. mount + pageshow firing back-to-back would otherwise consume
 * the same pick twice). Returns null when nothing is pending or the entry
 * is malformed.
 */
export function consumePendingPublishLocation(): PublishLocationHandoff | null {
  const store = getStorage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  // Always remove first — even if parsing fails, leaving a malformed entry
  // would re-fail on every subsequent mount, which is worse than losing it.
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Test-only escape hatch — drops the pending entry without consuming it. */
export function clearPendingPublishLocation(): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
}

export const PUBLISH_LOCATION_HANDOFF_KEY = STORAGE_KEY;
