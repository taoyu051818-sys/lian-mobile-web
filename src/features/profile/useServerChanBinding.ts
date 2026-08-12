/**
 * Server酱 binding composable (ps#504 I2).
 *
 * Module-scope singleton — there is exactly one Server酱 binding per session,
 * and three surfaces consume it:
 *  - ProfileServerChanBlock (settings page)
 *  - the event-join opt-in dialog handler (gates on `bound === true`)
 *  - the errand-order opt-in dialog handler (gates on `bound === true`)
 *
 * Singleton mirrors the pattern in `settings-state/store.ts` and
 * `detail-navigation/store.ts` so cross-surface readers see one canonical
 * state without prop-drilling.
 *
 * Hard security boundary:
 *   - The sendKey input value lives ONLY in the `manualKey` ref. The
 *     composable never copies it elsewhere, never logs it, never echoes it
 *     in error messages, and clears it via `clearManualKey()` immediately
 *     after a successful POST.
 *   - On a 4xx/5xx other than `BINDING_KEY_INVALID`, the user-visible error
 *     is a brand string. Backend response body is NEVER surfaced verbatim.
 */

import { computed, ref } from "vue";
import {
  bindServerChanWithSendKey,
  fetchServerChanBinding,
  fetchServerChanBindUrl,
  unbindServerChan,
  type ServerChanBinding,
} from "../../api/serverchan";
import { LianApiError } from "../../api/http";
import {
  SERVERCHAN_BIND_FAILED,
  SERVERCHAN_BIND_KEY_INVALID,
  SERVERCHAN_BIND_URL_FAILED,
  SERVERCHAN_LOAD_FAILED,
  SERVERCHAN_UNBIND_FAILED,
} from "../../config/brand";

/**
 * Backend reason code that the manual paste form must surface as the
 * "格式不正确" copy (NOT the generic failure). Locked here so a future
 * code-rename has exactly one place to update.
 */
const BINDING_KEY_INVALID_CODE = "BINDING_KEY_INVALID";

interface BindingApi {
  fetchBinding: () => Promise<ServerChanBinding>;
  fetchBindUrl: () => Promise<{ url: string }>;
  bind: (sendKey: string) => Promise<ServerChanBinding>;
  unbind: () => Promise<unknown>;
}

const defaultApi: BindingApi = {
  fetchBinding: fetchServerChanBinding,
  fetchBindUrl: fetchServerChanBindUrl,
  bind: bindServerChanWithSendKey,
  unbind: unbindServerChan,
};

let api: BindingApi = defaultApi;

function defaultOpenExternalUrl(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function defaultReadLocationHash(): string {
  return typeof window !== "undefined" ? window.location.hash : "";
}

let openExternal: (url: string) => void = defaultOpenExternalUrl;
let readHash: () => string = defaultReadLocationHash;

const binding = ref<ServerChanBinding | null>(null);
const loading = ref(false);
const loadError = ref("");
const submitting = ref(false);
const submitError = ref("");
const unbindBusy = ref(false);
const manualOpen = ref(false);
/**
 * The ONLY place the sendKey ever lives. The view binds an <input> here.
 * `clearManualKey()` zeros it on success / cancel; it is never logged or
 * persisted.
 */
const manualKey = ref("");
let sessionGeneration = 0;

const isBound = computed(() => Boolean(binding.value?.bound));
const isEnabled = computed(() => Boolean(binding.value?.enabled));

function isCurrentSession(generation: number): boolean {
  return generation === sessionGeneration;
}

/** Clear account-scoped UI state and invalidate work started by the prior session. */
export function resetServerChanBindingSessionState(): void {
  sessionGeneration += 1;
  binding.value = null;
  loading.value = false;
  loadError.value = "";
  submitting.value = false;
  submitError.value = "";
  unbindBusy.value = false;
  manualOpen.value = false;
  manualKey.value = "";
}

async function load() {
  if (loading.value) return;
  const generation = sessionGeneration;
  loading.value = true;
  loadError.value = "";
  try {
    const next = await api.fetchBinding();
    if (!isCurrentSession(generation)) return;
    binding.value = next;
  } catch {
    if (!isCurrentSession(generation)) return;
    // Generic load failure; binding state stays whatever it was. Brand
    // string only — backend response body is intentionally NOT echoed.
    loadError.value = SERVERCHAN_LOAD_FAILED;
  } finally {
    if (isCurrentSession(generation)) loading.value = false;
  }
}

function openManualForm() {
  submitError.value = "";
  manualOpen.value = true;
}

function closeManualForm() {
  manualOpen.value = false;
  clearManualKey();
  submitError.value = "";
}

function clearManualKey() {
  manualKey.value = "";
}

async function startBindFlow(): Promise<boolean> {
  const generation = sessionGeneration;
  submitError.value = "";
  try {
    const { url } = await api.fetchBindUrl();
    if (!isCurrentSession(generation)) return false;
    if (!url) {
      loadError.value = SERVERCHAN_BIND_URL_FAILED;
      return false;
    }
    openExternal(url);
    return true;
  } catch {
    if (!isCurrentSession(generation)) return false;
    loadError.value = SERVERCHAN_BIND_URL_FAILED;
    return false;
  }
}

async function submitManualKey(): Promise<boolean> {
  const value = manualKey.value;
  if (submitting.value) return false;
  if (!value || !value.trim()) {
    submitError.value = SERVERCHAN_BIND_KEY_INVALID;
    return false;
  }
  const generation = sessionGeneration;
  submitting.value = true;
  submitError.value = "";
  try {
    const next = await api.bind(value);
    if (!isCurrentSession(generation)) return false;
    binding.value = next;
    // Clear the local input as soon as the round-trip lands. The composable
    // never touches `value` again — caller's reactive ref is reset to "".
    clearManualKey();
    manualOpen.value = false;
    return true;
  } catch (err) {
    if (!isCurrentSession(generation)) return false;
    if (err instanceof LianApiError) {
      if (err.status === 400 && err.code === BINDING_KEY_INVALID_CODE) {
        submitError.value = SERVERCHAN_BIND_KEY_INVALID;
      } else {
        // Login-required and other errors fall through to a non-secret-leaking
        // generic message. Backend response body is NEVER surfaced verbatim.
        submitError.value = SERVERCHAN_BIND_FAILED;
      }
    } else {
      submitError.value = SERVERCHAN_BIND_FAILED;
    }
    return false;
  } finally {
    if (isCurrentSession(generation)) submitting.value = false;
  }
}

async function unbindNow(): Promise<boolean> {
  if (unbindBusy.value) return false;
  const generation = sessionGeneration;
  unbindBusy.value = true;
  submitError.value = "";
  loadError.value = "";
  try {
    await api.unbind();
    if (!isCurrentSession(generation)) return false;
    binding.value = { bound: false, enabled: false };
    return true;
  } catch {
    if (!isCurrentSession(generation)) return false;
    loadError.value = SERVERCHAN_UNBIND_FAILED;
    return false;
  } finally {
    if (isCurrentSession(generation)) unbindBusy.value = false;
  }
}

/**
 * Parse the post-callback hash query for the Server酱 redirect signals.
 * Returns "bound" | "manual" | null. The settings page calls this on mount
 * to surface a toast or pre-open the manual form.
 */
function consumeCallbackSignal(): "bound" | "manual" | null {
  const hash = readHash();
  const queryStart = hash.indexOf("?");
  if (queryStart < 0) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const signal = params.get("serverchan");
  if (signal === "bound") return "bound";
  if (signal === "manual") return "manual";
  return null;
}

export interface UseServerChanBindingApi {
  binding: typeof binding;
  isBound: typeof isBound;
  isEnabled: typeof isEnabled;
  loading: typeof loading;
  loadError: typeof loadError;
  submitting: typeof submitting;
  submitError: typeof submitError;
  unbindBusy: typeof unbindBusy;
  manualOpen: typeof manualOpen;
  manualKey: typeof manualKey;
  load: () => Promise<void>;
  openManualForm: () => void;
  closeManualForm: () => void;
  clearManualKey: () => void;
  startBindFlow: () => Promise<boolean>;
  submitManualKey: () => Promise<boolean>;
  unbindNow: () => Promise<boolean>;
  consumeCallbackSignal: () => "bound" | "manual" | null;
}

export function useServerChanBinding(): UseServerChanBindingApi {
  return {
    binding,
    isBound,
    isEnabled,
    loading,
    loadError,
    submitting,
    submitError,
    unbindBusy,
    manualOpen,
    manualKey,
    load,
    openManualForm,
    closeManualForm,
    clearManualKey,
    startBindFlow,
    submitManualKey,
    unbindNow,
    consumeCallbackSignal,
  };
}

/** Test-only — swap api implementations. */
export function __setServerChanBindingApiForTesting(next: Partial<BindingApi>): () => void {
  const prior = api;
  api = { ...defaultApi, ...next };
  return () => {
    api = prior;
  };
}

/** Test-only — swap the openExternalUrl + readLocationHash seams. */
export function __setServerChanBindingPlatformForTesting(next: {
  openExternalUrl?: (url: string) => void;
  readLocationHash?: () => string;
}): () => void {
  const priorOpen = openExternal;
  const priorRead = readHash;
  if (next.openExternalUrl) openExternal = next.openExternalUrl;
  if (next.readLocationHash) readHash = next.readLocationHash;
  return () => {
    openExternal = priorOpen;
    readHash = priorRead;
  };
}

/** Test-only — reset the singleton to a clean state between cases. */
export function __resetServerChanBindingForTesting(): void {
  resetServerChanBindingSessionState();
  api = defaultApi;
  openExternal = defaultOpenExternalUrl;
  readHash = defaultReadLocationHash;
}

export type UseServerChanBinding = ReturnType<typeof useServerChanBinding>;
