/**
 * Browser geolocation wrapper for the publish "use my current location"
 * button (mw#943).
 *
 * `navigator.geolocation` has the world's most awkward API surface
 * (callback-based, four error codes, silent on missing support), so this
 * composable normalises everything to a Promise that resolves with coords
 * or `null`. Errors are surfaced through the `error` ref using brand
 * strings so the UI can render them inline without re-deriving copy.
 *
 * Reverse geocoding is intentionally out of scope: this PR does not
 * resolve coords to a campus place name, it just hands the lat/lng pair
 * to the publish form. The placeName remains user-editable, and PublishView
 * surfaces a hint that the location came from a coordinate fix so the user
 * knows to add a label if they want one.
 */

import { ref } from "vue";
import {
  PUBLISH_LOCATION_GEOLOC_DENIED,
  PUBLISH_LOCATION_GEOLOC_TIMEOUT,
  PUBLISH_LOCATION_GEOLOC_UNAVAILABLE,
  PUBLISH_LOCATION_GEOLOC_UNSUPPORTED,
} from "../../config/brand";

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  // Cache positions briefly so a double-tap doesn't trigger a second GPS
  // hit. 60s matches what most location-aware apps use as the "fresh enough
  // for this UI gesture" threshold.
  maximumAge: 60000,
};

export interface GeolocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface NavigatorWithGeolocation {
  geolocation?: {
    getCurrentPosition(
      success: (position: {
        coords: { latitude: number; longitude: number; accuracy?: number };
      }) => void,
      error?: (err: { code: number; message: string }) => void,
      options?: PositionOptions,
    ): void;
  };
}

function getNavigator(): NavigatorWithGeolocation | null {
  if (typeof navigator === "undefined") return null;
  return navigator as unknown as NavigatorWithGeolocation;
}

/**
 * The W3C Geolocation API publishes four error codes via numeric constants
 * on the error object. Mapping them at the consumer keeps the brand copy
 * lookup co-located with the UX surface that needs it.
 *
 *   1 PERMISSION_DENIED    — user (or browser policy) refused
 *   2 POSITION_UNAVAILABLE — sensors / network failed
 *   3 TIMEOUT              — `timeout` exceeded before a fix
 */
function messageForError(code: number): string {
  if (code === 1) return PUBLISH_LOCATION_GEOLOC_DENIED;
  if (code === 3) return PUBLISH_LOCATION_GEOLOC_TIMEOUT;
  // 2 and any other (defensive) code map to the generic unavailable copy.
  return PUBLISH_LOCATION_GEOLOC_UNAVAILABLE;
}

export function useGeolocation(options: PositionOptions = DEFAULT_OPTIONS) {
  const isFetching = ref(false);
  const error = ref("");

  /**
   * Returns the coords on success, `null` on failure (with `error.value`
   * populated). Never throws — the publish flow stays clean: the button
   * handler can `await` the call and branch on truthiness, and the inline
   * error surface drives all user-visible feedback.
   *
   * Concurrent calls are coalesced — if a fetch is already in-flight,
   * subsequent calls return null immediately. This keeps the UI button
   * idempotent: tapping twice within the timeout window doesn't produce
   * two overlapping permission prompts on browsers that re-prompt.
   */
  async function fetchCurrentLocation(): Promise<GeolocationCoords | null> {
    if (isFetching.value) return null;
    error.value = "";
    const nav = getNavigator();
    if (!nav?.geolocation) {
      error.value = PUBLISH_LOCATION_GEOLOC_UNSUPPORTED;
      return null;
    }
    isFetching.value = true;
    try {
      return await new Promise<GeolocationCoords | null>((resolve) => {
        nav.geolocation!.getCurrentPosition(
          (position) => {
            const lat = Number(position.coords.latitude);
            const lng = Number(position.coords.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              error.value = PUBLISH_LOCATION_GEOLOC_UNAVAILABLE;
              resolve(null);
              return;
            }
            const accuracy = Number(position.coords.accuracy);
            resolve({
              lat,
              lng,
              accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
            });
          },
          (err) => {
            error.value = messageForError(err?.code ?? 2);
            resolve(null);
          },
          options,
        );
      });
    } finally {
      isFetching.value = false;
    }
  }

  function clearError() {
    error.value = "";
  }

  return {
    isFetching,
    error,
    fetchCurrentLocation,
    clearError,
  };
}
