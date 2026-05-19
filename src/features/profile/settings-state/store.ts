/**
 * Module-scoped reactive wrapper around the pure profile-settings reducer.
 *
 * Mirrors the structure of `src/app/detail-navigation/store.ts` (#628). The
 * settings block is mounted in exactly one place today (ProfileView), but
 * keeping the singleton pattern means tests can reset between cases the same
 * way detail-navigation's tests do, and a future second consumer (e.g. an
 * inline mention preference toggle elsewhere) shares state automatically
 * rather than racing with another copy of the same FSM.
 *
 * Component-side, callers go through `useProfileSettings()` which exposes
 * computed views and three command verbs (load / patch / retry). All other
 * mutations are internal.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { ProfileSettings, ProfileSettingsPatch } from "../../../types/profile";
import {
  PROFILE_SETTINGS_LOAD_ERROR,
  PROFILE_SETTINGS_PATCH_ERROR,
} from "../../../config/brand";
import {
  initialState,
  reduce,
  select,
  type SettingsAction,
  type SettingsState,
  type SideEffect,
} from "./state";
import { fetchSettingsWithToken, patchSettingsWithToken } from "./fetcher";

const stateRef = ref<SettingsState>(initialState());

type EffectHandler = (effect: SideEffect) => void;

const defaultEffectHandlers: Record<SideEffect["kind"], EffectHandler> = {
  fetch: (effect) => {
    if (effect.kind !== "fetch") return;
    void fetchSettingsWithToken(effect.token, dispatch);
  },
  patch: (effect) => {
    if (effect.kind !== "patch") return;
    void patchSettingsWithToken(effect.token, effect.patch, dispatch);
  },
};

let effectHandlers: Record<SideEffect["kind"], EffectHandler> = defaultEffectHandlers;

/**
 * Tests swap handlers to assert effect emission without touching the network.
 * Production never calls this. Returns a restore function for symmetry with
 * detail-navigation's `__setEffectHandlersForTesting`.
 */
export function __setEffectHandlersForTesting(
  handlers: Partial<Record<SideEffect["kind"], EffectHandler>>,
): () => void {
  const prior = effectHandlers;
  effectHandlers = { ...defaultEffectHandlers, ...handlers };
  return () => {
    effectHandlers = prior;
  };
}

/**
 * Reset to a clean idle state — only intended for tests so the module
 * singleton can be reused across cases without bleed-through.
 */
export function __resetStoreForTesting(): void {
  stateRef.value = initialState();
}

export function dispatch(action: SettingsAction): void {
  const result = reduce(stateRef.value, action);
  stateRef.value = result.state;
  for (const effect of result.effects) {
    effectHandlers[effect.kind](effect);
  }
}

const isReady = computed(() => select.isReady(stateRef.value));
const saving = computed(() => select.saving(stateRef.value));
const settings = computed<ProfileSettings | null>(() => select.settings(stateRef.value));
const errorPhase = computed(() => select.errorPhase(stateRef.value));

/**
 * Brand-string error message derived from the FSM phase. Components read this
 * directly so the i18n string lookup is centralized rather than repeated at
 * every consumer.
 */
const errorMessage = computed<string>(() => {
  const phase = errorPhase.value;
  if (phase === "load") return PROFILE_SETTINGS_LOAD_ERROR;
  if (phase === "patch") return PROFILE_SETTINGS_PATCH_ERROR;
  return "";
});

export interface ProfileSettingsView {
  state: Readonly<Ref<SettingsState>>;
  isReady: ComputedRef<boolean>;
  saving: ComputedRef<boolean>;
  settings: ComputedRef<ProfileSettings | null>;
  errorPhase: ComputedRef<"load" | "patch" | null>;
  errorMessage: ComputedRef<string>;
  load(): void;
  patch(p: ProfileSettingsPatch): void;
  retry(): void;
}

export function useProfileSettings(): ProfileSettingsView {
  return {
    state: stateRef,
    isReady,
    saving,
    settings,
    errorPhase,
    errorMessage,
    load() {
      dispatch({ type: "load" });
    },
    patch(p) {
      dispatch({ type: "patch", patch: p });
    },
    retry() {
      // After either a load- or patch-error, the right user-visible recovery
      // is to re-issue load and pick up the canonical server state. We never
      // auto-retry the patch — the user already saw the rolled-back value
      // and decides whether to try again.
      dispatch({ type: "load" });
    },
  };
}

/** Read-only accessor for tests / advanced consumers. */
export function getSettingsStateRef(): Readonly<Ref<SettingsState>> {
  return stateRef;
}
