/**
 * Help manage composable (PRD V0.1 §6.5 / §11.3).
 *
 * Wires `planHelpManage` to live state and exposes one entry point per
 * action — link / unlink event, mark resolved. On 401/404/5xx it
 * surfaces a brand string via `actionError` and leaves help state untouched —
 * the view never throws. Mirrors `useEventActions` / `useHelpVote` so the
 * three flows share shape.
 */

import { computed, ref, type Ref } from "vue";
import { linkHelpToEvent, resolveHelp, unlinkHelpFromEvent } from "../api/events";
import { HELP_MANAGE_UNAVAILABLE } from "../config/brand";
import { extractErrorMessage } from "../utils/extractErrorMessage";
import { planHelpManage, type HelpManagePlan } from "../domain/helpManagePolicy";
import type { HelpPostExtension } from "../types/post-extensions";

interface UseHelpManageOptions {
  help: Ref<HelpPostExtension | undefined>;
  isManageable: Ref<boolean>;
  onChange: (next: HelpPostExtension) => void;
  onMessage?: (message: string) => void;
}

export function useHelpManage(options: UseHelpManageOptions) {
  const busy = ref(false);
  const actionError = ref("");

  const plan = computed<HelpManagePlan>(() =>
    planHelpManage({ help: options.help.value, isManageable: options.isManageable.value }),
  );

  async function runAction(
    op: () => Promise<HelpPostExtension>,
    successMessage?: string,
  ): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    actionError.value = "";
    try {
      const next = await op();
      options.onChange(next);
      if (successMessage && options.onMessage) options.onMessage(successMessage);
    } catch (error) {
      actionError.value = extractErrorMessage(error, HELP_MANAGE_UNAVAILABLE);
    } finally {
      busy.value = false;
    }
  }

  async function linkEvent(eventTid: number, successMessage?: string): Promise<void> {
    const help = options.help.value;
    if (!help || !plan.value.allowed.has("linkEvent")) return;
    await runAction(() => linkHelpToEvent(help.helpId, eventTid), successMessage);
  }

  async function unlinkEvent(successMessage?: string): Promise<void> {
    const help = options.help.value;
    if (!help || !plan.value.allowed.has("unlinkEvent")) return;
    await runAction(() => unlinkHelpFromEvent(help.helpId), successMessage);
  }

  async function markResolved(successMessage?: string): Promise<void> {
    const help = options.help.value;
    if (!help || !plan.value.allowed.has("resolve")) return;
    await runAction(() => resolveHelp(help.helpId), successMessage);
  }

  return {
    busy,
    actionError,
    plan,
    linkEvent,
    unlinkEvent,
    markResolved,
  };
}
