/**
 * Server酱 preferences composable (ps#504 I2).
 *
 * Module-scope singleton — there is exactly one preferences object per
 * session, and three surfaces consume it:
 *  - ProfileServerChanBlock (settings page) — reads + toggles globally.
 *  - The event-join opt-in dialog handler — reads `eventStartingReminder`
 *    to decide whether to suppress the prompt; writes it on confirm.
 *  - The errand-order opt-in dialog handler — does NOT touch the global
 *    preferences object; it calls a per-order endpoint instead.
 *
 * Owns the lifecycle for the I1-E global preferences endpoint:
 *  - load preferences (`{ eventStartingReminder, rewardSettledReminder }`).
 *  - toggle either flag with optimistic UI; revert on failure.
 *  - per-order errand reminder write (no read).
 *
 * I1-E ships in another worktree. Until that endpoint lands, the GET will
 * 404 — `loadError` surfaces the brand string and toggles stay disabled.
 */

import { computed, ref } from "vue";
import {
  fetchServerChanPreferences,
  setErrandOrderReminderPreference,
  updateServerChanPreferences,
  type ServerChanPreferences,
} from "../../api/serverchan";
import {
  SERVERCHAN_PREFERENCES_LOAD_FAILED,
  SERVERCHAN_PREFERENCES_PATCH_FAILED,
} from "../../config/brand";

interface PreferencesApi {
  fetch: () => Promise<ServerChanPreferences>;
  update: (next: ServerChanPreferences) => Promise<ServerChanPreferences>;
  setErrandOrder: (orderId: string, enabled: boolean) => Promise<{ enabled: boolean }>;
}

const defaultApi: PreferencesApi = {
  fetch: fetchServerChanPreferences,
  update: updateServerChanPreferences,
  setErrandOrder: setErrandOrderReminderPreference,
};

let api: PreferencesApi = defaultApi;

const preferences = ref<ServerChanPreferences | null>(null);
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const saveError = ref("");

const isReady = computed(() => preferences.value !== null);

export type ServerChanPreferenceKey = keyof ServerChanPreferences;

async function load() {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    preferences.value = await api.fetch();
  } catch {
    loadError.value = SERVERCHAN_PREFERENCES_LOAD_FAILED;
  } finally {
    loading.value = false;
  }
}

/**
 * Toggle a single key; round-trip the FULL object so the backend never
 * has to merge. On rejection, revert the optimistic flip.
 *
 * Returns the success/failure boolean so the dialog opt-in handlers (which
 * need to know whether to show the success toast) can branch.
 */
async function toggle(key: ServerChanPreferenceKey, next: boolean): Promise<boolean> {
  if (!preferences.value || saving.value) return false;
  const before: ServerChanPreferences = { ...preferences.value };
  const optimistic: ServerChanPreferences = { ...preferences.value, [key]: next };
  preferences.value = optimistic;
  saving.value = true;
  saveError.value = "";
  try {
    const result = await api.update(optimistic);
    preferences.value = result;
    return true;
  } catch {
    preferences.value = before;
    saveError.value = SERVERCHAN_PREFERENCES_PATCH_FAILED;
    return false;
  } finally {
    saving.value = false;
  }
}

/**
 * Set whether a single errand order should fan out Server酱 reminders.
 * Per-order is intentionally NOT on the global preferences object — backend
 * persists it on the order envelope. Returns success boolean.
 */
async function setErrandOrderReminder(orderId: string, enabled: boolean): Promise<boolean> {
  if (!orderId) return false;
  saveError.value = "";
  try {
    await api.setErrandOrder(orderId, enabled);
    return true;
  } catch {
    saveError.value = SERVERCHAN_PREFERENCES_PATCH_FAILED;
    return false;
  }
}

export interface UseServerChanPreferencesApi {
  preferences: typeof preferences;
  isReady: typeof isReady;
  loading: typeof loading;
  loadError: typeof loadError;
  saving: typeof saving;
  saveError: typeof saveError;
  load: () => Promise<void>;
  toggle: (key: ServerChanPreferenceKey, next: boolean) => Promise<boolean>;
  setErrandOrderReminder: (orderId: string, enabled: boolean) => Promise<boolean>;
}

export function useServerChanPreferences(): UseServerChanPreferencesApi {
  return {
    preferences,
    isReady,
    loading,
    loadError,
    saving,
    saveError,
    load,
    toggle,
    setErrandOrderReminder,
  };
}

/** Test-only — swap api implementations. */
export function __setServerChanPreferencesApiForTesting(next: Partial<PreferencesApi>): () => void {
  const prior = api;
  api = { ...defaultApi, ...next };
  return () => {
    api = prior;
  };
}

/** Test-only — reset the singleton to a clean state between cases. */
export function __resetServerChanPreferencesForTesting(): void {
  preferences.value = null;
  loading.value = false;
  loadError.value = "";
  saving.value = false;
  saveError.value = "";
  api = defaultApi;
}

export type UseServerChanPreferences = ReturnType<typeof useServerChanPreferences>;
