/**
 * Picker-mode awareness for the map view (mw#943).
 *
 * The map view has two operational modes: the regular browse mode (its
 * historical UX — taps open the place sheet, posts open detail) and the
 * picker mode triggered by `#/map?picker=1` from the publish form. In
 * picker mode the user is choosing a target location to hand back to the
 * publish flow; selection becomes a transient highlight rather than an
 * immediate detail open, and a confirm/cancel overlay drives the round-trip.
 *
 * The flag is derived from the URL hash (single source of truth, survives
 * reload). Selection state lives here too because it is meaningless outside
 * picker mode and would only confuse the existing place-sheet selection
 * machinery if folded into `useMapSelection`.
 *
 * Confirmation hands the payload to `usePublishLocationHandoff` and pops
 * back to the publish form. The composable does not import the publish
 * slice; the dependency runs the other direction (publish reads what map
 * wrote), so the two features can ship independently.
 */

import { computed, onBeforeUnmount, ref } from "vue";
import { parseDeepLinkQuery } from "../../app/deepLink";
import { setPendingPublishLocation, type PublishMapPickerLocationHandoff } from "../publish";
import type { MapLocation, MapPoint } from "../../types/map";

export interface MapPickerSelection {
  /** Existing place tapped from a marker. Null when only a free pin is dropped. */
  location: MapLocation | null;
  /** Free coordinate dropped via long-press. Null when only an existing place is selected. */
  pin: MapPoint | null;
}

export interface UseMapPickerModeOptions {
  /**
   * Hash source override for tests. Defaults to `window.location.hash` at
   * call time; the composable also re-reads on every `hashchange` event so
   * the picker flag stays current as the user navigates.
   */
  hashSource?: () => string;
}

function placeIdForLocation(location: MapLocation): string {
  return location.place?.id || location.placeId || "";
}

function readHash(hashSource?: () => string): string {
  if (hashSource) return hashSource();
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

export function useMapPickerMode(options: UseMapPickerModeOptions = {}) {
  const { hashSource } = options;
  // Track the hash in a ref so the picker flag reacts to navigation. The
  // computed `isPickerMode` derives from this ref instead of reading
  // `window.location.hash` lazily, so KeepAlive remounts and back/forward
  // gestures don't strand stale state. The listener is unwired on unmount
  // to avoid leaking handlers across map view re-mounts.
  const currentHash = ref(readHash(hashSource));

  function refreshHash() {
    currentHash.value = readHash(hashSource);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", refreshHash);
    window.addEventListener("popstate", refreshHash);
  }

  onBeforeUnmount(() => {
    if (typeof window === "undefined") return;
    window.removeEventListener("hashchange", refreshHash);
    window.removeEventListener("popstate", refreshHash);
  });

  const isPickerMode = computed(() => parseDeepLinkQuery(currentHash.value).picker === "1");

  const selection = ref<MapPickerSelection>({ location: null, pin: null });

  /**
   * Existing-marker tap: highlight as the picker target, drop any previously
   * dropped pin (last-action-wins). The marker tap path in MapView
   * funnels here in picker mode instead of opening the post detail sheet.
   */
  function selectLocation(location: MapLocation) {
    selection.value = { location, pin: null };
  }

  /**
   * Long-press: drop a free pin at `latlng`. Clears any previously
   * highlighted existing place — the user has chosen a coordinate, not a
   * named place, so binding the place would be misleading.
   */
  function dropPin(latlng: MapPoint) {
    selection.value = { location: null, pin: latlng };
  }

  function clearSelection() {
    selection.value = { location: null, pin: null };
  }

  const hasSelection = computed(
    () => selection.value.location !== null || selection.value.pin !== null,
  );

  /**
   * Build the handoff payload for the current selection. Returns null when
   * nothing is selected — the overlay disables its confirm button in that
   * case.
   */
  function buildHandoff(): PublishMapPickerLocationHandoff | null {
    const { location, pin } = selection.value;
    if (location) {
      const placeId = placeIdForLocation(location);
      // Existing places without a stable place ID (rare — most catalog
      // entries carry one) are surfaced as a coordinate pick so the publish
      // form gets at least the lat/lng + display name. The publish consume
      // path tolerates either kind, so this fallback is preferred over
      // dropping the selection on the floor.
      if (!placeId) {
        return {
          version: 2,
          source: "map_picker",
          coordinateSystem: "gcj02",
          kind: "coords",
          lat: location.lat,
          lng: location.lng,
          label: location.name,
        };
      }
      const out: PublishMapPickerLocationHandoff = {
        version: 2,
        source: "map_picker",
        coordinateSystem: "gcj02",
        kind: "place",
        locationId: location.id,
        placeId,
        name: location.name,
        lat: location.lat,
        lng: location.lng,
      };
      const placeType = location.place?.type || location.type;
      if (placeType) out.type = placeType;
      return out;
    }
    if (pin) {
      return {
        version: 2,
        source: "map_picker",
        coordinateSystem: "gcj02",
        kind: "coords",
        lat: pin.lat,
        lng: pin.lng,
      };
    }
    return null;
  }

  /**
   * Confirm and pop back. Writes the handoff payload, then steps history
   * back if available (preserves the user's tab stack so the publish form
   * doesn't lose its scroll/draft state on remount). When there is no
   * history entry behind the picker (deep-linked directly), falls back to
   * `#/publish` so the user lands on the right view.
   */
  function commitSelection(): boolean {
    const payload = buildHandoff();
    if (!payload) return false;
    setPendingPublishLocation(payload);
    clearSelection();
    navigateBack();
    return true;
  }

  /**
   * Cancel — bail without writing any handoff. Same navigation strategy as
   * confirm so the picker overlay always exits the user back to wherever
   * they came from.
   */
  function cancel(): void {
    selection.value = { location: null, pin: null };
    navigateBack();
  }

  function navigateBack(): void {
    if (typeof window === "undefined") return;
    // history.length > 1 is the most reliable "we have somewhere to go back
    // to" signal in jsdom + real browsers. Direct deep-links land at
    // length === 1 so we hop to #/publish manually.
    if (window.history.length > 1) {
      try {
        window.history.back();
        return;
      } catch {
        /* fall through to hash assignment */
      }
    }
    try {
      window.location.hash = "#/publish";
    } catch {
      /* swallow — sandboxed iframes can refuse hash writes */
    }
  }

  return {
    isPickerMode,
    selection,
    hasSelection,
    selectLocation,
    dropPin,
    clearSelection,
    buildHandoff,
    commitSelection,
    cancel,
  };
}
