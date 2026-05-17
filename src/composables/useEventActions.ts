/**
 * Event detail composable (PRD V0.1 §6.3 / §11.2).
 *
 * Wires the pure `planEventAction` policy to live event state, and exposes a
 * single `act()` entry point that calls the appropriate join/cancel route.
 *
 * AI / new backend routes return 404 in environments where the events service
 * is not deployed yet — we surface a soft-fail message via `actionError` and
 * leave the event state untouched. The view never throws.
 *
 * State stays in this composable; the view binds to flat refs only, so it
 * cannot reach into nested objects (the same pattern as `usePublishAiDraft`).
 */

import { computed, ref, type Ref } from "vue";
import { cancelJoinEvent, joinEvent } from "../api/events";
import { EVENT_ACTION_UNAVAILABLE } from "../config/brand";
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
      const next =
        mode === "join" ? await joinEvent(event.eventId) : await cancelJoinEvent(event.eventId);
      options.onChange({ event: next, joined: mode === "join" });
      if (successMessage && options.onMessage) options.onMessage(successMessage);
    } catch (error) {
      actionError.value = extractErrorMessage(error, EVENT_ACTION_UNAVAILABLE);
    } finally {
      busy.value = false;
    }
  }

  return {
    busy,
    actionError,
    plan,
    act,
  };
}
