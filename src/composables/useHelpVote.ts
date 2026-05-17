/**
 * Help vote composable (PRD V0.1 §6.5 / §11.3).
 *
 * Wires `planHelpVote` to live state and exposes a single `act()` that calls
 * `togglePostInteraction(tid, "vote")`. On 401/404/5xx it surfaces a brand
 * string via `actionError` and leaves vote state untouched — view never
 * throws. Mirrors `useEventActions` so the two read-side flows share shape.
 */

import { computed, ref, type Ref } from "vue";
import { togglePostInteraction } from "../api/interaction";
import { HELP_ACTION_UNAVAILABLE } from "../config/brand";
import { extractErrorMessage } from "../utils/extractErrorMessage";
import { planHelpVote, type HelpVotePlan } from "../domain/helpVotePolicy";
import type { FeedItemId } from "../types/feed";
import type { HelpPostExtension } from "../types/post-extensions";

interface UseHelpVoteOptions {
  tid: Ref<FeedItemId | null>;
  help: Ref<HelpPostExtension | undefined>;
  hasVoted: Ref<boolean>;
  isAuthenticated: Ref<boolean>;
  onChange: (next: { help: HelpPostExtension; voted: boolean }) => void;
  onMessage?: (message: string) => void;
}

export function useHelpVote(options: UseHelpVoteOptions) {
  const busy = ref(false);
  const actionError = ref("");

  const plan = computed<HelpVotePlan>(() => {
    const help = options.help.value;
    if (!help) {
      return { mode: "disabled", enabled: false, reasonKey: "" };
    }
    return planHelpVote({
      help,
      isAuthenticated: options.isAuthenticated.value,
      hasVoted: options.hasVoted.value,
    });
  });

  async function act(successMessage?: string) {
    const help = options.help.value;
    const tid = options.tid.value;
    if (!help || tid == null || busy.value || !plan.value.enabled) return;
    busy.value = true;
    actionError.value = "";
    try {
      const result = await togglePostInteraction(tid, "vote");
      const nextHelp: HelpPostExtension = {
        ...help,
        voteCount: result.count,
      };
      options.onChange({ help: nextHelp, voted: result.active });
      if (successMessage && options.onMessage) options.onMessage(successMessage);
    } catch (error) {
      actionError.value = extractErrorMessage(error, HELP_ACTION_UNAVAILABLE);
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
