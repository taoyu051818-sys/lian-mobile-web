/**
 * Server酱 reminder opt-in dialog controller (ps#504 I2).
 *
 * Owns the "should we prompt the user to opt into a reminder?" decision for
 * the two surfaces that wire it:
 *  - event-join handler ("是否在活动开始前提醒你？")
 *  - errand-order create handler ("是否接收此订单的关键状态提醒？")
 *
 * The dialog is suppressed when:
 *   - Server酱 is NOT bound. The whole reminder concept is gated on a binding;
 *     prompting an unbound user is just clutter.
 *   - For event-join: the user already has eventStartingReminder = true.
 *   - The user has already dismissed this kind of prompt once in the current
 *     session. The "已看过" flag is in-memory only — we deliberately do NOT
 *     persist it to localStorage, because once the user changes their mind on
 *     the next page reload there is no escape from the "no thanks" they hit
 *     last week.
 *
 * The composable is a singleton per kind; both event-join handlers in the app
 * share the same "已看过" flag, which matches user intent.
 */

import { ref } from "vue";
import type { UseServerChanBinding } from "./useServerChanBinding";
import type { UseServerChanPreferences } from "./useServerChanPreferences";

export type ServerChanOptInKind = "event-start" | "errand-order";

interface ServerChanOptInDialogState {
  open: boolean;
  kind: ServerChanOptInKind | null;
  busy: boolean;
  /** Set when the kind is "errand-order" so the primary handler can target it. */
  orderId: string;
}

const dialogState = ref<ServerChanOptInDialogState>({
  open: false,
  kind: null,
  busy: false,
  orderId: "",
});

const dismissedThisSession = new Set<ServerChanOptInKind>();

/** Test-only — reset session dismissal state. */
export function __resetServerChanOptInDismissedForTesting(): void {
  dismissedThisSession.clear();
  dialogState.value = { open: false, kind: null, busy: false, orderId: "" };
}

interface UseServerChanOptInOptions {
  binding: UseServerChanBinding;
  preferences: UseServerChanPreferences;
}

export function useServerChanOptIn(options: UseServerChanOptInOptions) {
  const { binding, preferences } = options;

  /**
   * Should we show the event-join dialog right now? Returns false when we
   * already know the answer (unbound, already on, dismissed).
   */
  function shouldOfferEventStart(): boolean {
    if (!binding.isBound.value) return false;
    if (dismissedThisSession.has("event-start")) return false;
    const current = preferences.preferences.value;
    // If we never loaded preferences (e.g. I1-E not deployed yet), default to
    // not prompting — we cannot tell whether the user is already opted in.
    if (!current) return false;
    if (current.eventStartingReminder) return false;
    return true;
  }

  /**
   * Should we show the errand-order dialog? Errand-order is per-order, so the
   * "already opted in" check does not apply at this layer (each new order
   * defaults to false at backend). We only gate on bound + not-dismissed.
   */
  function shouldOfferErrandOrder(): boolean {
    if (!binding.isBound.value) return false;
    if (dismissedThisSession.has("errand-order")) return false;
    return true;
  }

  function openEventStartDialog(): void {
    if (!shouldOfferEventStart()) return;
    dialogState.value = { open: true, kind: "event-start", busy: false, orderId: "" };
  }

  function openErrandOrderDialog(orderId: string): void {
    if (!shouldOfferErrandOrder()) return;
    if (!orderId) return;
    dialogState.value = { open: true, kind: "errand-order", busy: false, orderId };
  }

  function dismiss(): void {
    const kind = dialogState.value.kind;
    if (kind) dismissedThisSession.add(kind);
    dialogState.value = { open: false, kind: null, busy: false, orderId: "" };
  }

  /**
   * Primary action handler. Resolves with true on success, false on failure.
   * The view is responsible for showing a success/error toast based on the
   * return value.
   */
  async function confirmOptIn(): Promise<boolean> {
    const current = dialogState.value;
    if (!current.open || !current.kind) return false;
    dialogState.value = { ...current, busy: true };
    let ok = false;
    if (current.kind === "event-start") {
      const prefs = preferences.preferences.value;
      // Round-trip the FULL object so the backend never has to merge.
      const next = {
        eventStartingReminder: true,
        rewardSettledReminder: prefs?.rewardSettledReminder ?? false,
      };
      ok = await preferences.toggle("eventStartingReminder", next.eventStartingReminder);
    } else if (current.kind === "errand-order") {
      ok = await preferences.setErrandOrderReminder(current.orderId, true);
    }
    // After confirm — whether success or failure — close. On failure the view
    // can re-trigger from a different surface. We add to the dismissed set
    // either way so a failed click does not loop the dialog.
    if (current.kind) dismissedThisSession.add(current.kind);
    dialogState.value = { open: false, kind: null, busy: false, orderId: "" };
    return ok;
  }

  return {
    state: dialogState,
    shouldOfferEventStart,
    shouldOfferErrandOrder,
    openEventStartDialog,
    openErrandOrderDialog,
    dismiss,
    confirmOptIn,
  };
}

export type UseServerChanOptIn = ReturnType<typeof useServerChanOptIn>;
