import { readonly, ref, shallowRef } from "vue";
import {
  CommerceApiError,
  fetchCommerceStoreDetail,
  fetchCommerceStoreList,
  type CommerceApiErrorKind,
} from "../../api/commerce";
import type { CommerceRoute } from "../../app/commerce-route";
import type { CommerceStore, CommerceStoreListResult } from "../../types/commerce";

export type CommerceReadStatus =
  | "closed"
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "not-found"
  | "error";

export type CommerceReadErrorKind = "generic" | "rate-limited" | "timeout" | "malformed";

export interface CommerceReadTransport {
  list(signal: AbortSignal): Promise<CommerceStoreListResult>;
  detail(storeId: string, signal: AbortSignal): Promise<{ store: CommerceStore }>;
}

export interface CommerceStoreReadOptions {
  timeoutMs?: number;
  visible?: () => boolean;
}

const DEFAULT_TIMEOUT_MS = 12_000;

const defaultTransport: CommerceReadTransport = {
  list: fetchCommerceStoreList,
  detail: fetchCommerceStoreDetail,
};

export function isCommerceCatalogVisible(): boolean {
  return import.meta.env.VITE_COMMERCE_CATALOG_VISIBLE === "true";
}

function mapErrorKind(kind: CommerceApiErrorKind): CommerceReadErrorKind {
  if (kind === "rate-limited") return "rate-limited";
  if (kind === "timeout") return "timeout";
  if (kind === "malformed") return "malformed";
  return "generic";
}

/**
 * Route-scoped read owner. Every load advances a generation and aborts the
 * previous transport; only the generation that still owns the exact route may
 * publish data. The accepted projection is anonymous, so no account epoch is
 * needed for this first slice.
 */
export function useCommerceStoreRead(
  transport: CommerceReadTransport = defaultTransport,
  options: CommerceStoreReadOptions = {},
) {
  const status = ref<CommerceReadStatus>("idle");
  const errorKind = ref<CommerceReadErrorKind>("generic");
  const items = ref<CommerceStore[]>([]);
  const store = ref<CommerceStore | null>(null);
  const activeRoute = shallowRef<CommerceRoute | null>(null);
  const generation = ref(0);

  let activeController: AbortController | null = null;
  let activeTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearActiveTimeout() {
    if (activeTimeout !== null) clearTimeout(activeTimeout);
    activeTimeout = null;
  }

  function advanceGeneration(): number {
    clearActiveTimeout();
    activeController?.abort();
    activeController = null;
    generation.value += 1;
    return generation.value;
  }

  function owns(requestGeneration: number, route: CommerceRoute): boolean {
    if (generation.value !== requestGeneration) return false;
    if (route.name === "catalog") return activeRoute.value?.name === "catalog";
    return activeRoute.value?.name === "store" && activeRoute.value.storeId === route.storeId;
  }

  async function loadRoute(route: CommerceRoute | null): Promise<void> {
    const requestGeneration = advanceGeneration();
    activeRoute.value = route;
    items.value = [];
    store.value = null;
    errorKind.value = "generic";

    const visible = options.visible ?? isCommerceCatalogVisible;
    if (!visible()) {
      status.value = "closed";
      return;
    }
    if (!route) {
      status.value = "not-found";
      return;
    }

    status.value = "loading";
    const controller = new AbortController();
    activeController = controller;
    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    activeTimeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      if (route.name === "catalog") {
        const result = await transport.list(controller.signal);
        if (!owns(requestGeneration, route)) return;
        items.value = result.items;
        status.value = result.items.length === 0 ? "empty" : "ready";
      } else {
        const result = await transport.detail(route.storeId, controller.signal);
        if (!owns(requestGeneration, route)) return;
        store.value = result.store;
        status.value = "ready";
      }
    } catch (error) {
      if (!owns(requestGeneration, route)) return;
      if (timedOut) {
        errorKind.value = "timeout";
        status.value = "error";
      } else if (error instanceof CommerceApiError && error.kind === "not-found") {
        status.value = "not-found";
      } else if (error instanceof CommerceApiError && error.kind === "aborted") {
        // An owned abort is possible only through an external AbortController
        // implementation. Fail safely instead of leaving a permanent spinner.
        errorKind.value = "generic";
        status.value = "error";
      } else {
        errorKind.value = error instanceof CommerceApiError ? mapErrorKind(error.kind) : "generic";
        status.value = "error";
      }
    } finally {
      if (generation.value === requestGeneration) {
        clearActiveTimeout();
        activeController = null;
      }
    }
  }

  function retry(): Promise<void> {
    return loadRoute(activeRoute.value);
  }

  function dispose() {
    advanceGeneration();
    activeRoute.value = null;
    status.value = "idle";
    items.value = [];
    store.value = null;
  }

  return {
    status: readonly(status),
    errorKind: readonly(errorKind),
    items: readonly(items),
    store: readonly(store),
    activeRoute: readonly(activeRoute),
    generation: readonly(generation),
    loadRoute,
    retry,
    dispose,
  };
}
