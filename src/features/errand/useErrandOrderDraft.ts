/**
 * Errand order draft + submit composable (issue #647).
 *
 * Owns the form draft, the pre-submit gate (eligibility ping +
 * client-known signals like wallet balance), and the create round-trip.
 * Order state machine itself is #648 — once the order is created we hand
 * the orderId back to the caller and let the timeline view take over.
 */
import { computed, ref } from "vue";
import { fetchErrandOrderEligibility, createErrandOrder } from "../../api/errands";
import { fetchMapV2Items } from "../../api/map";
import { fetchAuthMe, fetchProfileWallet } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  ERRAND_ORDER_LOAD_ERROR,
  ERRAND_ORDER_SUBMIT_FAILED,
  ERRAND_ORDER_VALIDATE_DROPOFF,
  ERRAND_ORDER_VALIDATE_MERCHANT,
  ERRAND_ORDER_VALIDATE_PICKUP,
} from "../../config/brand";
import type {
  ErrandMode,
  ErrandOrderDraft,
  ErrandOrderGate,
  ErrandOrderGateReason,
  ErrandOrderRequest,
} from "../../types/errand";
import type { MapLocation } from "../../types/map";
import type { PostLocation } from "../../types/post";
import { gateReasonFallback } from "./errand-format";

function emptyLocation(): PostLocation {
  return { placeId: "", label: "", lat: null, lng: null };
}

function emptyGate(): ErrandOrderGate {
  return { ok: false, reason: "", reasonText: "", availablePoints: 0, estimatedFeePoints: 0 };
}

function buildDraft(merchantPostId: number, pickupHint = ""): ErrandOrderDraft {
  // The merchant DTO doesn't ship a structured address — `merchant.name` is
  // the runner-facing pickup hint (PR2, issue #609). Seeding it keeps the
  // `validate()` non-empty check happy out-of-the-box and lets the user
  // append门店细节 ("到 海大食堂西餐窗口 三楼吧台") in the same field.
  const trimmedHint = (pickupHint || "").trim();
  return {
    merchantPostId,
    pickupLocation: trimmedHint
      ? { placeId: "", label: trimmedHint, lat: null, lng: null }
      : emptyLocation(),
    dropoffLocation: emptyLocation(),
    notes: "",
    mode: "dedicated",
  };
}

function deriveLocalGate(
  loggedIn: boolean,
  campusVerified: boolean,
  walletPoints: number,
  estimatedFeePoints: number,
): { reason: ErrandOrderGateReason | ""; ok: boolean } {
  if (!loggedIn) return { reason: "not_logged_in", ok: false };
  if (!campusVerified) return { reason: "not_verified", ok: false };
  if (estimatedFeePoints > 0 && walletPoints < estimatedFeePoints) {
    return { reason: "insufficient_balance", ok: false };
  }
  return { reason: "", ok: true };
}

export function errandDropoffPlaceLabel(location: MapLocation): string {
  return (location.place?.name || location.name || "").trim();
}

export function errandDropoffPlaceId(location: MapLocation): string {
  return (location.place?.id || location.placeId || "").trim();
}

function hasUsableDropoffPlace(location: MapLocation) {
  const label = errandDropoffPlaceLabel(location);
  const placeId = errandDropoffPlaceId(location);
  return Boolean(
    label && placeId && Number.isFinite(location.lat) && Number.isFinite(location.lng),
  );
}

export function useErrandDropoffPlaces() {
  const loading = ref(false);
  const loaded = ref(false);
  const locations = ref<MapLocation[]>([]);

  const selectableLocations = computed(() => locations.value.filter(hasUsableDropoffPlace));

  async function loadPlaces() {
    loading.value = true;
    try {
      const data = await fetchMapV2Items();
      locations.value = Array.isArray(data.locations) ? data.locations : [];
    } catch {
      locations.value = [];
    } finally {
      loaded.value = true;
      loading.value = false;
    }
  }

  return {
    loading,
    loaded,
    locations,
    selectableLocations,
    loadPlaces,
  };
}

export function useErrandOrderDraft(initialMerchantPostId: number, initialPickupHint = "") {
  const draft = ref<ErrandOrderDraft>(buildDraft(initialMerchantPostId, initialPickupHint));
  const gate = ref<ErrandOrderGate>(emptyGate());
  const gateLoading = ref(false);
  const gateLoaded = ref(false);
  const gateError = ref("");
  const submitting = ref(false);
  const submitError = ref("");
  const lastOrderId = ref("");

  const canSubmit = computed(() => {
    if (!gateLoaded.value || !gate.value.ok || submitting.value) return false;
    if (!draft.value.pickupLocation || !draft.value.pickupLocation.label.trim()) return false;
    if (!draft.value.dropoffLocation || !draft.value.dropoffLocation.label.trim()) return false;
    return draft.value.merchantPostId > 0;
  });

  /**
   * Refreshes the gate by combining three signals:
   *  - Server-side eligibility (covers merchant_paused / no_runner_coverage).
   *  - /api/auth/me presence (logged-in + campus_verified).
   *  - Wallet balance vs the eligibility's estimatedFee.
   *
   * Whichever blocks earliest wins. Server-supplied reason text wins over the
   * local fallback so backend can localize without a frontend release.
   *
   * Failure handling differs by call:
   *  - /api/auth/me 401 is *expected* for anonymous users — that's how we
   *    derive `not_logged_in`, so we tolerate a rejection by treating it as
   *    "no user".
   *  - Wallet and eligibility, however, must NOT be silently coerced to fake
   *    defaults. A wallet failure with `points = 0` would mis-fire as
   *    `insufficient_balance`; an eligibility failure swallowed as `null`
   *    would let an unavailable merchant fall through to the form. Both are
   *    surfaced as a retry-able `gateError` instead.
   */
  async function refresh(merchantPostId: number) {
    if (merchantPostId > 0) draft.value.merchantPostId = merchantPostId;
    gateLoading.value = true;
    gateError.value = "";
    try {
      const [serverGateResult, meResult, walletResult] = await Promise.allSettled([
        fetchErrandOrderEligibility(draft.value.merchantPostId),
        fetchAuthMe(),
        fetchProfileWallet(),
      ]);
      const me = meResult.status === "fulfilled" ? meResult.value : null;
      const loggedIn = Boolean(me && me.id);
      const campusVerified = Boolean(me?.verificationState?.campus_verified?.active);

      // Anonymous user wins outright — no point bubbling the inevitable
      // wallet/eligibility 401s as "load failed" when "请先登录" is the right
      // copy.
      if (!loggedIn) {
        gate.value = {
          ok: false,
          reason: "not_logged_in",
          reasonText: gateReasonFallback("not_logged_in"),
          availablePoints: 0,
          estimatedFeePoints: 0,
        };
        gateLoaded.value = true;
        return;
      }

      if (walletResult.status === "rejected") {
        gateError.value = extractErrorMessage(walletResult.reason, ERRAND_ORDER_LOAD_ERROR);
        return;
      }
      if (serverGateResult.status === "rejected") {
        gateError.value = extractErrorMessage(serverGateResult.reason, ERRAND_ORDER_LOAD_ERROR);
        return;
      }

      const wallet = walletResult.value;
      const serverGate = serverGateResult.value;
      const availablePoints = Math.max(0, wallet.points - wallet.lockedPoints);
      const estimatedFee = serverGate?.estimatedFeePoints ?? 0;

      const local = deriveLocalGate(loggedIn, campusVerified, availablePoints, estimatedFee);
      if (!local.ok) {
        gate.value = {
          ok: false,
          reason: local.reason,
          reasonText: gateReasonFallback(local.reason),
          availablePoints,
          estimatedFeePoints: estimatedFee,
        };
      } else if (serverGate && !serverGate.ok) {
        gate.value = {
          ok: false,
          reason: serverGate.reason || "unknown",
          reasonText: serverGate.reasonText || gateReasonFallback(serverGate.reason || "unknown"),
          availablePoints,
          estimatedFeePoints: estimatedFee,
        };
      } else {
        gate.value = {
          ok: true,
          reason: "",
          reasonText: "",
          availablePoints,
          estimatedFeePoints: estimatedFee,
        };
      }
      gateLoaded.value = true;
    } catch (error) {
      gateError.value = extractErrorMessage(error, ERRAND_ORDER_LOAD_ERROR);
    } finally {
      gateLoading.value = false;
    }
  }

  function setMode(mode: ErrandMode) {
    draft.value.mode = mode;
  }

  function setNotes(value: string) {
    draft.value.notes = value;
  }

  function setPickup(label: string) {
    draft.value.pickupLocation = {
      placeId: "",
      label,
      lat: null,
      lng: null,
    };
  }

  function setDropoff(label: string) {
    draft.value.dropoffLocation = {
      placeId: "",
      label,
      lat: null,
      lng: null,
    };
  }

  function setDropoffPlace(place: MapLocation) {
    const label = (place.place?.name || place.name || "").trim();
    const placeId = errandDropoffPlaceId(place);
    const lat = Number.isFinite(place.lat) ? place.lat : null;
    const lng = Number.isFinite(place.lng) ? place.lng : null;
    draft.value.dropoffLocation = {
      placeId,
      label,
      lat,
      lng,
    };
  }

  function validate(): string {
    if (!draft.value.merchantPostId) return ERRAND_ORDER_VALIDATE_MERCHANT;
    if (!draft.value.pickupLocation || !draft.value.pickupLocation.label.trim()) {
      return ERRAND_ORDER_VALIDATE_PICKUP;
    }
    if (!draft.value.dropoffLocation || !draft.value.dropoffLocation.label.trim()) {
      return ERRAND_ORDER_VALIDATE_DROPOFF;
    }
    return "";
  }

  async function submit(): Promise<string> {
    submitError.value = "";
    const validationMessage = validate();
    if (validationMessage) {
      submitError.value = validationMessage;
      return "";
    }
    // `validate()` already proved both locations are present, but it ran
    // against `draft.value` which TS won't narrow across the await below.
    // Bind locals so the request body doesn't need an `as` cast.
    const pickup = draft.value.pickupLocation;
    const dropoff = draft.value.dropoffLocation;
    if (!pickup || !dropoff) {
      submitError.value = ERRAND_ORDER_VALIDATE_PICKUP;
      return "";
    }
    submitting.value = true;
    try {
      const request: ErrandOrderRequest = {
        merchantPostId: draft.value.merchantPostId,
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        mode: draft.value.mode,
        notes: draft.value.notes.trim(),
      };
      const result = await createErrandOrder(request);
      if (!result.ok) {
        // The backend may reject a submit even after we passed the pre-flight
        // gate (race conditions: balance dropped, runner coverage went away).
        // Fold the failure back into the gate so the UI shows the same chip.
        gate.value = {
          ok: false,
          reason: result.reason || "unknown",
          reasonText: result.reasonText || gateReasonFallback(result.reason || "unknown"),
          availablePoints: gate.value.availablePoints,
          estimatedFeePoints: gate.value.estimatedFeePoints,
        };
        submitError.value = gate.value.reasonText;
        return "";
      }
      const orderId = result.order?.order.orderId || "";
      lastOrderId.value = orderId;
      return orderId;
    } catch (error) {
      submitError.value = extractErrorMessage(error, ERRAND_ORDER_SUBMIT_FAILED);
      return "";
    } finally {
      submitting.value = false;
    }
  }

  function reset(merchantPostId: number, pickupHint = "") {
    draft.value = buildDraft(merchantPostId, pickupHint);
    gate.value = emptyGate();
    gateLoaded.value = false;
    gateError.value = "";
    submitError.value = "";
    lastOrderId.value = "";
  }

  return {
    draft,
    gate,
    gateLoading,
    gateLoaded,
    gateError,
    submitting,
    submitError,
    lastOrderId,
    canSubmit,
    refresh,
    setMode,
    setNotes,
    setPickup,
    setDropoff,
    setDropoffPlace,
    submit,
    reset,
  };
}

export type UseErrandOrderDraft = ReturnType<typeof useErrandOrderDraft>;
