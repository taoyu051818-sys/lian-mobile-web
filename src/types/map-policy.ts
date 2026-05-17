/**
 * Map viewport policy (PRD V0.1 §7.2.3).
 *
 * Bounds are deliberately permissive for V0.1 (large enough to cover any
 * reasonable campus footprint) so the surface is shipped without hard-coding
 * any specific school. Backends/admins can override this at runtime once the
 * audience policy + school registry stand up.
 */

export interface MapViewportPolicy {
  minZoom: number;
  maxZoom: number;
  campusBounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  /** Soft padding in meters around campusBounds where rendering still works. */
  outsideBufferMeters: number;
}

/**
 * Default policy used until the backend/admin overrides it. Numbers are
 * conservative: zoom out far enough to see a city, zoom in far enough to
 * read a building label, and a global bounding box that simply prevents
 * panning across the planet.
 */
export const DEFAULT_MAP_VIEWPORT_POLICY: MapViewportPolicy = Object.freeze({
  minZoom: 12,
  maxZoom: 19,
  campusBounds: { south: -85, west: -180, north: 85, east: 180 },
  outsideBufferMeters: 5000,
}) as MapViewportPolicy;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * True iff `point` is inside `policy.campusBounds`. Strict comparison — for
 * "inside or just past the buffer" use isWithinBufferedBounds.
 */
export function isWithinCampusBounds(point: LatLng, policy: MapViewportPolicy): boolean {
  const { south, west, north, east } = policy.campusBounds;
  return point.lat >= south && point.lat <= north && point.lng >= west && point.lng <= east;
}

/** Approximate meters-per-degree at a given latitude (cheap haversine). */
function metersPerDegreeLat(): number {
  return 111_111;
}
function metersPerDegreeLng(lat: number): number {
  return 111_111 * Math.cos((lat * Math.PI) / 180);
}

/**
 * True iff `point` is within `policy.campusBounds` plus `outsideBufferMeters`.
 * Used by the map view to decide whether to nudge the camera back vs. hard-stop.
 */
export function isWithinBufferedBounds(point: LatLng, policy: MapViewportPolicy): boolean {
  if (isWithinCampusBounds(point, policy)) return true;
  const buffer = policy.outsideBufferMeters;
  if (buffer <= 0) return false;
  const { south, west, north, east } = policy.campusBounds;
  const latBufferDeg = buffer / metersPerDegreeLat();
  const lngBufferDeg = buffer / Math.max(1, metersPerDegreeLng(point.lat));
  return (
    point.lat >= south - latBufferDeg &&
    point.lat <= north + latBufferDeg &&
    point.lng >= west - lngBufferDeg &&
    point.lng <= east + lngBufferDeg
  );
}

/** Clamp a zoom value to the policy's allowed range. */
export function clampZoom(zoom: number, policy: MapViewportPolicy): number {
  if (!Number.isFinite(zoom)) return policy.minZoom;
  return Math.min(policy.maxZoom, Math.max(policy.minZoom, zoom));
}
