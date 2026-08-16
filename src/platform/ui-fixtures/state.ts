/**
 * Runtime selection + request log for the offline fixture runtime.
 *
 * Deliberately framework-agnostic (no Vue import) so it is unit-testable under
 * plain Node and so the store cannot accidentally become a second source of
 * truth for real business state. The toolbar subscribes and mirrors into a ref.
 *
 * Persistence is DEV-only localStorage under a dedicated key. It never touches
 * session, auth, routing or any production store.
 */

import type {
  FixtureRequestCounts,
  FixtureRequestLogEntry,
  FixtureRequestOutcome,
  FixtureRuntimeState,
  FixtureScenario,
} from "./types";
import { isFixtureIdentity, isFixtureScenario, isFixtureVolume } from "./types";
import { readDefaultIdentity, readDefaultScenario } from "./env";

const STORAGE_KEY = "lian.dev.ui-fixtures.v1";
const REQUEST_LOG_LIMIT = 50;
const MAX_LATENCY_MS = 10_000;

type Listener = (state: Readonly<FixtureRuntimeState>) => void;

function createInitialState(): FixtureRuntimeState {
  return {
    scenario: readDefaultScenario(),
    identity: readDefaultIdentity(),
    volume: "default",
    latencyMs: 0,
    errorOverride: null,
  };
}

let state: FixtureRuntimeState = createInitialState();
const listeners = new Set<Listener>();

const requestLog: FixtureRequestLogEntry[] = [];
let requestSeq = 0;
let unmappedCount = 0;
let handledCount = 0;
let blockedCount = 0;

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function clampLatency(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Math.round(numeric), MAX_LATENCY_MS);
}

/** Restores the persisted toolbar selection. Env vars are first-run defaults. */
export function hydrateFixtureState(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  let parsed: unknown;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object") return;
  const record = parsed as Record<string, unknown>;
  const next: FixtureRuntimeState = { ...state };
  if (isFixtureScenario(record.scenario)) next.scenario = record.scenario;
  if (isFixtureIdentity(record.identity)) next.identity = record.identity;
  if (isFixtureVolume(record.volume)) next.volume = record.volume;
  next.latencyMs = clampLatency(record.latencyMs);
  next.errorOverride = isFixtureScenario(record.errorOverride) ? record.errorOverride : null;
  state = next;
}

function persist(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or privacy mode — selection simply won't survive reload */
  }
}

function emit(): void {
  const snapshot = getFixtureState();
  for (const listener of [...listeners]) {
    try {
      listener(snapshot);
    } catch {
      /* a broken subscriber must not break the transport */
    }
  }
}

export function getFixtureState(): Readonly<FixtureRuntimeState> {
  return { ...state };
}

export function subscribeFixtureState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Applies a partial selection. Scenario/identity changes take effect on the
 * next request with no Vite restart and no page reload.
 */
export function setFixtureState(patch: Partial<FixtureRuntimeState>): void {
  const next: FixtureRuntimeState = { ...state };
  if (patch.scenario !== undefined && isFixtureScenario(patch.scenario)) {
    next.scenario = patch.scenario;
  }
  if (patch.identity !== undefined && isFixtureIdentity(patch.identity)) {
    next.identity = patch.identity;
  }
  if (patch.volume !== undefined && isFixtureVolume(patch.volume)) {
    next.volume = patch.volume;
  }
  if (patch.latencyMs !== undefined) {
    next.latencyMs = clampLatency(patch.latencyMs);
  }
  if (patch.errorOverride !== undefined) {
    next.errorOverride = isFixtureScenario(patch.errorOverride) ? patch.errorOverride : null;
  }
  state = next;
  persist();
  emit();
}

/** Restores env defaults and clears the log; used by the toolbar Reset button. */
export function resetFixtureState(): void {
  state = createInitialState();
  const storage = safeLocalStorage();
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  clearFixtureRequestLog();
  emit();
}

/** Effective scenario: an explicit failure override wins over the data scenario. */
export function getEffectiveScenario(): FixtureScenario {
  return state.errorOverride ?? state.scenario;
}

export function recordFixtureRequest(entry: {
  method: string;
  path: string;
  route: string;
  status: number;
  outcome: FixtureRequestOutcome;
}): void {
  requestSeq += 1;
  if (entry.outcome === "unmapped") unmappedCount += 1;
  if (entry.outcome === "handled") handledCount += 1;
  if (entry.outcome === "blocked") blockedCount += 1;
  requestLog.push({
    id: requestSeq,
    at: new Date().toISOString(),
    method: entry.method,
    path: entry.path,
    route: entry.route,
    scenario: getEffectiveScenario(),
    identity: state.identity,
    status: entry.status,
    outcome: entry.outcome,
  });
  if (requestLog.length > REQUEST_LOG_LIMIT) {
    requestLog.splice(0, requestLog.length - REQUEST_LOG_LIMIT);
  }
  emit();
}

/** Newest first, so the toolbar can render the tail without reversing. */
export function getFixtureRequestLog(): FixtureRequestLogEntry[] {
  return [...requestLog].reverse();
}

export function getFixtureRequestCounts(): FixtureRequestCounts {
  return {
    handled: handledCount,
    unmapped: unmappedCount,
    blocked: blockedCount,
    total: requestSeq,
  };
}

export function clearFixtureRequestLog(): void {
  requestLog.length = 0;
  requestSeq = 0;
  unmappedCount = 0;
  handledCount = 0;
  blockedCount = 0;
  emit();
}

/** Test-only escape hatch so specs can start from a known state. */
export function __resetFixtureStateForTests(): void {
  state = createInitialState();
  listeners.clear();
  clearFixtureRequestLog();
}
