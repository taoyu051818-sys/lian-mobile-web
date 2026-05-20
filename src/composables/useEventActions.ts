/**
 * Event detail composable (PRD V0.1 §6.3 / §11.2).
 *
 * Wires the pure `planEventAction` policy to live event state, and exposes a
 * single `act()` entry point that calls the appropriate join/cancel route.
 *
 * Backends without these routes return 404 — we surface a soft-fail message
 * via `actionError` and leave the event state untouched. The view never
 * throws.
 *
 * The join/cancel-join response only carries `{ eventId, joinedCount, joined }`,
 * so we MERGE that authoritative count into the existing event ref instead of
 * replacing the whole block (we'd lose startsAt/endsAt/capacity/location).
 *
 * Issue #703 — `complete()` follows the same merge-don't-replace contract:
 * `POST /complete` returns `{ eventId, status, joinedCount, completedAt }`,
 * and we fold those fields into the existing event ref. Soft-fails (403/404/409)
 * surface through `completeActionError` via the `EVENT_COMPLETE_UNAVAILABLE`
 * brand string, never raw error text.
 */

import { computed, ref, type Ref } from "vue";
import { cancelJoinEvent, completeEvent, joinEvent } from "../api/events";
import { EVENT_ACTION_UNAVAILABLE, EVENT_COMPLETE_UNAVAILABLE } from "../config/brand";
import { extractErrorMessage } from "../utils/extractErrorMessage";
import { planEventAction, type EventActionPlan } from "../domain/eventActionPolicy";
import type { Audience } from "../types/audience";
import type { EventPostExtension } from "../types/post-extensions";

interface UseEventActionsOptions {
  event: Ref<EventPostExtension | undefined>;
  hasJoined: Ref<boolean>;
  isAuthenticated: Ref<boolean>;
  isEligibleForScope: (scope: Audience) => boolean;
  onChange: (next: { event: EventPostExtension; joined: boolean }) => void;
  onMessage?: (message: string) => void;
}

export function useEventActions(options: UseEventActionsOptions) {
  const busy = ref(false);
  const actionError = ref("");
  const completeBusy = ref(false);
  const completeActionError = ref("");

  const plan = computed<EventActionPlan>(() => {
    const event = options.event.value;
    if (!event) {
      return { mode: "disabled", enabled: false, reasonKey: "" };
    }
    return planEventAction({
      event,
      isAuthenticated: options.isAuthenticated.value,
      hasJoined: options.hasJoined.value,
      isEligibleForScope: options.isEligibleForScope,
    });
  });

  async function act(successMessage?: string) {
    const event = options.event.value;
    if (!event || busy.value || !plan.value.enabled) return;
    const mode = plan.value.mode;
    if (mode !== "join" && mode !== "cancel") return;
    busy.value = true;
    actionError.value = "";
    try {
      const result =
        mode === "join" ? await joinEvent(event.eventId) : await cancelJoinEvent(event.eventId);
      const next: EventPostExtension = {
        ...event,
        joinedCount: result.joinedCount,
      };
      options.onChange({ event: next, joined: result.joined });
      if (successMessage && options.onMessage) options.onMessage(successMessage);
    } catch (error) {
      actionError.value = extractErrorMessage(error, EVENT_ACTION_UNAVAILABLE);
    } finally {
      busy.value = false;
    }
  }

  /**
   * Issue #703 — author/admin-only "结束活动" action.
   * The composable does NOT gate by viewer role (manageable check stays in the
   * caller — usePostDetailExtensions); it just guards against double-submission
   * and against running on terminal events. Soft-fail wraps every error path
   * (403, 404, 409, network) in the brand string.
   */
  async function complete(successMessage?: string): Promise<void> {
    const event = options.event.value;
    if (!event || completeBusy.value) return;
    if (event.status === "completed" || event.status === "cancelled") return;
    completeBusy.value = true;
    completeActionError.value = "";
    try {
      const result = await completeEvent(event.eventId);
      // Merge authoritative state — preserve time/capacity/location/rewardSummary.
      const next: EventPostExtension = {
        ...event,
        joinedCount: result.joinedCount,
        status: result.status,
        ...(result.completedAt ? { completedAt: result.completedAt } : {}),
      };
      // Reuse the same onChange channel as join/cancel; viewer's joined state
      // is unaffected by completion. We deliberately do NOT replace the event
      // ref — the response only ships the four authoritative fields.
      options.onChange({ event: next, joined: options.hasJoined.value });
      if (successMessage && options.onMessage) options.onMessage(successMessage);
    } catch (error) {
      // Brand string covers 403 (non-author non-admin), 404 (event missing),
      // 409 (already completed by another path), and 5xx/network. Raw error
      // text never reaches the view — issue #703 explicitly requires the
      // soft-fail copy regardless of the underlying reason. We swallow the
      // error reference (only used for diagnostics) so lint stays green.
      void error;
      completeActionError.value = EVENT_COMPLETE_UNAVAILABLE;
    } finally {
      completeBusy.value = false;
    }
  }

  return {
    busy,
    actionError,
    plan,
    act,
    completeBusy,
    completeActionError,
    complete,
  };
}
