/**
 * Offline fixture transport — a DEV-only global `fetch` wrapper.
 *
 * Audit result that shaped this file: the app's only network transport is
 * `fetch`. There is no XMLHttpRequest, WebSocket, EventSource, sendBeacon,
 * axios or ky anywhere in `src/`, and every business call funnels through
 * `apiRequest()` in src/api/http.ts. Wrapping `fetch` is therefore sufficient
 * and nothing else needed refactoring.
 *
 * Routing policy:
 *   - any URL whose pathname starts with `/api/` -> fixture registry, and a
 *     miss is a local `UNMAPPED_FIXTURE_REQUEST` error, never a real request;
 *   - cross-origin URLs -> blocked locally (no LIAN, GDPlatform, NodeBB,
 *     image proxy, tile server or any third party is contacted);
 *   - same-origin non-API URLs (Vite modules, HMR, `/assets/*`, icons) ->
 *     passed through untouched so the dev server keeps working.
 */

import {
  blockedExternalResponse,
  fixtureJson,
  fixtureError,
  resolveTransportFailure,
  unmappedFixtureResponse,
} from "./contract";
import { isOfflineFixtureRuntimeEnabled } from "./env";
import { matchFixtureRoute } from "./registry";
import { getEffectiveScenario, getFixtureState, recordFixtureRequest } from "./state";
import type { FixtureRequestContext } from "./types";
import { isTransportScenario } from "./types";

const API_PREFIX = "/api/";
const TIMEOUT_SCENARIO_DELAY_MS = 1200;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

let originalFetch: typeof fetch | null = null;

/** Single source of truth for "what counts as our own origin". */
const FALLBACK_BASE = "http://localhost/";

function resolveBase(): string {
  return typeof window !== "undefined" && window.location ? window.location.href : FALLBACK_BASE;
}

function resolveBaseOrigin(): string {
  return new URL(resolveBase()).origin;
}

function resolveUrl(input: FetchInput): URL {
  const base = resolveBase();
  if (typeof input === "string") return new URL(input, base);
  if (input instanceof URL) return new URL(input.href);
  if (typeof Request !== "undefined" && input instanceof Request) {
    return new URL(input.url, base);
  }
  return new URL(String(input), base);
}

function resolveMethod(input: FetchInput, init: FetchInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

/**
 * Compared against the same base `resolveUrl()` uses, so external traffic is
 * still blocked in non-browser contexts (tests, tooling). Returning `true`
 * whenever `window` is absent would have punched a hole in the isolation
 * guarantee exactly where it is hardest to notice.
 */
function isSameOrigin(url: URL): boolean {
  return url.origin === resolveBaseOrigin();
}

async function resolveBody(input: FetchInput, init: FetchInit): Promise<unknown> {
  const raw = init?.body ?? null;
  if (raw) {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    if (typeof FormData !== "undefined" && raw instanceof FormData) {
      return Object.fromEntries(
        [...raw.entries()].map(([key, value]) => [
          key,
          value instanceof File ? { name: value.name, size: value.size, type: value.type } : value,
        ]),
      );
    }
    return null;
  }
  if (typeof Request !== "undefined" && input instanceof Request && input.body) {
    try {
      return await input.clone().json();
    } catch {
      return null;
    }
  }
  return null;
}

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(makeAbortError());
    }
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(makeAbortError());
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/** Hangs until the caller's own AbortSignal fires — mirrors a stalled request. */
function hangUntilAborted(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(makeAbortError());
      return;
    }
    signal.addEventListener("abort", () => reject(makeAbortError()), { once: true });
  });
}

function makeAbortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function resolveSignal(input: FetchInput, init: FetchInit): AbortSignal | null {
  if (init?.signal) return init.signal;
  if (typeof Request !== "undefined" && input instanceof Request) return input.signal;
  return null;
}

async function toResponse(result: unknown): Promise<Response> {
  if (result instanceof Response) return result;
  return fixtureJson(result ?? {});
}

async function handleApiRequest(
  url: URL,
  method: string,
  input: FetchInput,
  init: FetchInit,
): Promise<Response> {
  const signal = resolveSignal(input, init);
  const path = url.pathname;
  const match = matchFixtureRoute(method, path);
  const state = getFixtureState();
  const scenario = getEffectiveScenario();

  await delay(state.latencyMs, signal);

  if (scenario === "loading") {
    recordFixtureRequest({
      method,
      path,
      route: match?.route.pattern ?? "",
      status: 0,
      outcome: "handled",
    });
    await hangUntilAborted(signal);
  }

  if (scenario === "timeout") {
    recordFixtureRequest({
      method,
      path,
      route: match?.route.pattern ?? "",
      status: 0,
      outcome: "handled",
    });
    await delay(TIMEOUT_SCENARIO_DELAY_MS, signal);
    throw makeAbortError();
  }

  if (!match) {
    const response = unmappedFixtureResponse(method, path, "");
    recordFixtureRequest({ method, path, route: "", status: response.status, outcome: "unmapped" });
    // eslint-disable-next-line no-console
    console.warn(
      `[v0][ui-fixtures] UNMAPPED_FIXTURE_REQUEST method=${method} path=${path} route=unmatched scenario=${scenario}`,
    );
    return response;
  }

  const failure = isTransportScenario(scenario) ? resolveTransportFailure(scenario) : null;
  if (failure) {
    const response = fixtureError(
      failure.status,
      failure.message,
      failure.code,
      failure.headers ?? {},
    );
    recordFixtureRequest({
      method,
      path,
      route: match.route.pattern,
      status: response.status,
      outcome: "handled",
    });
    return response;
  }

  const context: FixtureRequestContext = {
    method,
    path,
    route: match.route.pattern,
    params: match.params,
    query: url.searchParams,
    body: await resolveBody(input, init),
    state,
    scenario,
    identity: state.identity,
    volume: state.volume,
  };

  let response: Response;
  try {
    response = await toResponse(await match.route.handler(context));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    response = fixtureError(
      500,
      `Fixture handler 抛出异常：${error instanceof Error ? error.message : String(error)}`,
      "FIXTURE_HANDLER_ERROR",
    );
  }

  recordFixtureRequest({
    method,
    path,
    route: match.route.pattern,
    status: response.status,
    outcome: "handled",
  });
  return response;
}

/**
 * Installs the wrapper. Idempotent, and a no-op unless the offline switch is
 * on, so importing this module from the client entry is always safe.
 */
export function installOfflineFixtureTransport(): boolean {
  if (!isOfflineFixtureRuntimeEnabled()) return false;
  if (typeof globalThis.fetch !== "function") return false;
  if (originalFetch) return true;

  // Keep the untouched reference so uninstall restores exactly what was there
  // (binding here would hand back a different function than we replaced).
  originalFetch = globalThis.fetch;
  const target = originalFetch;
  const passthrough = (input: FetchInput, init?: FetchInit) =>
    target.call(globalThis, input as never, init as never);

  globalThis.fetch = async function offlineFixtureFetch(
    input: FetchInput,
    init?: FetchInit,
  ): Promise<Response> {
    let url: URL;
    try {
      url = resolveUrl(input);
    } catch {
      return passthrough(input, init);
    }
    const method = resolveMethod(input, init);

    if (url.pathname.startsWith(API_PREFIX)) {
      return handleApiRequest(url, method, input, init);
    }

    if (!isSameOrigin(url)) {
      const response = blockedExternalResponse(url.href);
      recordFixtureRequest({
        method,
        path: url.href,
        route: "",
        status: response.status,
        outcome: "blocked",
      });
      // eslint-disable-next-line no-console
      console.warn(`[v0][ui-fixtures] blocked external request ${method} ${url.href}`);
      return response;
    }

    // Same-origin, non-API: Vite modules, HMR pings, /assets/**, PWA icons.
    return passthrough(input, init);
  } as typeof fetch;

  return true;
}

export function uninstallOfflineFixtureTransport(): void {
  if (!originalFetch) return;
  globalThis.fetch = originalFetch;
  originalFetch = null;
}

export function isOfflineFixtureTransportInstalled(): boolean {
  return originalFetch !== null;
}
