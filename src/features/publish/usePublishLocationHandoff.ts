/** Cross-route location handoff shared by Publish and the Map picker. */

const STORAGE_KEY = "lian:publish:pendingLocation";

export type PublishMapPickerLocationHandoff =
  | {
      version: 2;
      source: "map_picker";
      coordinateSystem: "gcj02";
      kind: "place";
      locationId?: string;
      placeId: string;
      name: string;
      type?: string;
      lat: number;
      lng: number;
    }
  | {
      version: 2;
      source: "map_picker";
      coordinateSystem: "gcj02";
      kind: "coords";
      lat: number;
      lng: number;
      label?: string;
    };

export type PublishBrowserLocationHandoff = {
  version: 2;
  source: "browser_geolocation";
  coordinateSystem: "wgs84";
  kind: "coords";
  lat: number;
  lng: number;
  accuracy?: number;
};

/** The only union accepted by the write path. */
export type PublishLocationHandoffV2 =
  | PublishMapPickerLocationHandoff
  | PublishBrowserLocationHandoff;

export type LegacyPublishLocationHandoff = {
  version: 1;
  source: "legacy";
  coordinateSystem: "unknown";
  kind: "coords";
  lat: number;
  lng: number;
  label?: string;
};

/** Read result. Legacy coordinates are intentionally read-only and display-only. */
export type NormalizedPublishLocationHandoff =
  | PublishLocationHandoffV2
  | LegacyPublishLocationHandoff;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMapPickerV2(
  record: Record<string, unknown>,
): PublishMapPickerLocationHandoff | null {
  if (
    record.version !== 2 ||
    record.source !== "map_picker" ||
    record.coordinateSystem !== "gcj02" ||
    !hasValidLatLng(record.lat, record.lng)
  ) {
    return null;
  }
  const lat = record.lat as number;
  const lng = record.lng as number;

  if (record.kind === "place") {
    if (!isNonEmptyString(record.placeId) || !isNonEmptyString(record.name)) return null;
    if (record.locationId !== undefined && !isNonEmptyString(record.locationId)) return null;
    if (record.type !== undefined && !isNonEmptyString(record.type)) return null;
    const result: Extract<PublishMapPickerLocationHandoff, { kind: "place" }> = {
      version: 2,
      source: "map_picker",
      coordinateSystem: "gcj02",
      kind: "place",
      placeId: record.placeId.trim(),
      name: record.name.trim(),
      lat,
      lng,
    };
    if (isNonEmptyString(record.locationId)) result.locationId = record.locationId.trim();
    if (isNonEmptyString(record.type)) result.type = record.type.trim();
    return result;
  }

  if (record.kind === "coords") {
    if (record.label !== undefined && !isNonEmptyString(record.label)) return null;
    const result: Extract<PublishMapPickerLocationHandoff, { kind: "coords" }> = {
      version: 2,
      source: "map_picker",
      coordinateSystem: "gcj02",
      kind: "coords",
      lat,
      lng,
    };
    if (isNonEmptyString(record.label)) result.label = record.label.trim();
    return result;
  }

  return null;
}

function normalizeBrowserV2(record: Record<string, unknown>): PublishBrowserLocationHandoff | null {
  if (
    record.version !== 2 ||
    record.source !== "browser_geolocation" ||
    record.coordinateSystem !== "wgs84" ||
    record.kind !== "coords" ||
    !hasValidLatLng(record.lat, record.lng)
  ) {
    return null;
  }
  const lat = record.lat as number;
  const lng = record.lng as number;
  if (record.accuracy !== undefined && (!isFiniteNumber(record.accuracy) || record.accuracy < 0)) {
    return null;
  }
  const result: PublishBrowserLocationHandoff = {
    version: 2,
    source: "browser_geolocation",
    coordinateSystem: "wgs84",
    kind: "coords",
    lat,
    lng,
  };
  if (isFiniteNumber(record.accuracy)) result.accuracy = record.accuracy;
  return result;
}

function normalizeV2(parsed: unknown): PublishLocationHandoffV2 | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.source === "map_picker") return normalizeMapPickerV2(record);
  if (record.source === "browser_geolocation") return normalizeBrowserV2(record);
  return null;
}

/** Pure validator used by account-scoped Publish draft snapshots. */
export function normalizePublishMapPickerLocationHandoff(
  parsed: unknown,
): PublishMapPickerLocationHandoff | null {
  if (!parsed || typeof parsed !== "object") return null;
  return normalizeMapPickerV2(parsed as Record<string, unknown>);
}

function normalizeLegacy(record: Record<string, unknown>): NormalizedPublishLocationHandoff | null {
  if (
    record.version !== undefined ||
    record.source !== undefined ||
    record.coordinateSystem !== undefined ||
    !hasValidLatLng(record.lat, record.lng)
  ) {
    return null;
  }
  const lat = record.lat as number;
  const lng = record.lng as number;

  if (record.kind === "place") {
    if (!isNonEmptyString(record.placeId) || !isNonEmptyString(record.name)) return null;
    const result: Extract<PublishMapPickerLocationHandoff, { kind: "place" }> = {
      version: 2,
      source: "map_picker",
      coordinateSystem: "gcj02",
      kind: "place",
      placeId: record.placeId.trim(),
      name: record.name.trim(),
      lat,
      lng,
    };
    if (isNonEmptyString(record.type)) result.type = record.type.trim();
    return result;
  }

  if (record.kind === "coords") {
    const result: LegacyPublishLocationHandoff = {
      version: 1,
      source: "legacy",
      coordinateSystem: "unknown",
      kind: "coords",
      lat,
      lng,
    };
    if (isNonEmptyString(record.label)) result.label = record.label.trim();
    return result;
  }

  return null;
}

function normalizeReadPayload(parsed: unknown): NormalizedPublishLocationHandoff | null {
  const v2 = normalizeV2(parsed);
  if (v2) return v2;
  if (!parsed || typeof parsed !== "object") return null;
  return normalizeLegacy(parsed as Record<string, unknown>);
}

export function setPendingPublishLocation(payload: PublishLocationHandoffV2): void {
  const normalized = normalizeV2(payload);
  if (!normalized) {
    clearPendingPublishLocation();
    return;
  }
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      // Storage failures must not block Publish.
    }
  }
}

export function consumePendingPublishLocation(): NormalizedPublishLocationHandoff | null {
  const store = getStorage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Destructive read remains best-effort in restricted storage modes.
  }
  try {
    return normalizeReadPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingPublishLocation(): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Storage cleanup is non-fatal.
  }
}

export const PUBLISH_LOCATION_HANDOFF_KEY = STORAGE_KEY;
