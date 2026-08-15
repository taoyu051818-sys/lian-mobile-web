import { readonly, ref, shallowRef } from "vue";
import {
  CommerceApiError,
  fetchCommerceProductDetail,
  fetchCommerceStoreProducts,
  type CommerceApiErrorKind,
} from "../../api/commerce";
import { isCanonicalCommerceProductId, isCanonicalCommerceStoreId } from "../../app/commerce-route";
import type {
  CommerceProduct,
  CommerceProductDetailResult,
  CommerceProductListResult,
  CommerceProductPage,
  CommerceProductSummary,
} from "../../types/commerce";
import type { CommerceReadErrorKind, CommerceReadStatus } from "./useCommerceStoreRead";

export type CommerceProductReadStatus = CommerceReadStatus;
export type CommerceProductReadErrorKind = CommerceReadErrorKind;

export type CommerceProductReadTarget =
  | { name: "store-products"; storeId: string }
  | { name: "product"; productId: string };

export interface CommerceProductReadTransport {
  list(storeId: string, signal: AbortSignal): Promise<CommerceProductListResult>;
  detail(productId: string, signal: AbortSignal): Promise<CommerceProductDetailResult>;
}

export interface CommerceProductReadOptions {
  timeoutMs?: number;
  visible?: () => boolean;
}

const DEFAULT_TIMEOUT_MS = 12_000;

const defaultTransport: CommerceProductReadTransport = {
  list: fetchCommerceStoreProducts,
  detail: fetchCommerceProductDetail,
};

export function isCommerceProductVisible(): boolean {
  return (
    import.meta.env.VITE_COMMERCE_CATALOG_VISIBLE === "true" &&
    import.meta.env.VITE_COMMERCE_PRODUCT_VISIBLE === "true"
  );
}

function mapErrorKind(kind: CommerceApiErrorKind): CommerceProductReadErrorKind {
  if (kind === "rate-limited") return "rate-limited";
  if (kind === "timeout") return "timeout";
  if (kind === "malformed") return "malformed";
  return "generic";
}

function isValidTarget(target: CommerceProductReadTarget): boolean {
  return target.name === "store-products"
    ? isCanonicalCommerceStoreId(target.storeId)
    : isCanonicalCommerceProductId(target.productId);
}

/**
 * Exact-target read owner for the anonymous product list and detail projections.
 * Each instance owns one operation at a time and permanently stales prior work.
 */
export function useCommerceProductRead(
  transport: CommerceProductReadTransport = defaultTransport,
  options: CommerceProductReadOptions = {},
) {
  const status = ref<CommerceProductReadStatus>("idle");
  const errorKind = ref<CommerceProductReadErrorKind>("generic");
  const items = ref<CommerceProductSummary[]>([]);
  const page = ref<CommerceProductPage | null>(null);
  const product = ref<CommerceProduct | null>(null);
  const activeTarget = shallowRef<CommerceProductReadTarget | null>(null);
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

  function owns(requestGeneration: number, target: CommerceProductReadTarget): boolean {
    if (generation.value !== requestGeneration) return false;
    if (target.name === "store-products") {
      return (
        activeTarget.value?.name === "store-products" &&
        activeTarget.value.storeId === target.storeId
      );
    }
    return (
      activeTarget.value?.name === "product" && activeTarget.value.productId === target.productId
    );
  }

  function clearData() {
    items.value = [];
    page.value = null;
    product.value = null;
  }

  async function loadTarget(target: CommerceProductReadTarget | null): Promise<void> {
    const requestGeneration = advanceGeneration();
    activeTarget.value = target;
    clearData();
    errorKind.value = "generic";

    const visible = options.visible ?? isCommerceProductVisible;
    if (!visible()) {
      status.value = "closed";
      return;
    }
    if (!target || !isValidTarget(target)) {
      status.value = "not-found";
      return;
    }

    status.value = "loading";
    const controller = new AbortController();
    activeController = controller;
    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    activeTimeout = setTimeout(() => {
      activeTimeout = null;
      if (!owns(requestGeneration, target)) return;
      timedOut = true;
      controller.abort();
      errorKind.value = "timeout";
      status.value = "error";
    }, timeoutMs);

    try {
      if (target.name === "store-products") {
        const result = await transport.list(target.storeId, controller.signal);
        if (!owns(requestGeneration, target) || timedOut) return;
        items.value = result.items;
        page.value = result.page;
        status.value = result.items.length === 0 ? "empty" : "ready";
      } else {
        const result = await transport.detail(target.productId, controller.signal);
        if (!owns(requestGeneration, target) || timedOut) return;
        product.value = result.product;
        status.value = "ready";
      }
    } catch (error) {
      if (!owns(requestGeneration, target)) return;
      if (timedOut) {
        errorKind.value = "timeout";
        status.value = "error";
      } else if (error instanceof CommerceApiError && error.kind === "not-found") {
        status.value = "not-found";
      } else if (error instanceof CommerceApiError && error.kind === "aborted") {
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
    return loadTarget(activeTarget.value);
  }

  function dispose() {
    advanceGeneration();
    activeTarget.value = null;
    status.value = "idle";
    errorKind.value = "generic";
    clearData();
  }

  return {
    status: readonly(status),
    errorKind: readonly(errorKind),
    items: readonly(items),
    page: readonly(page),
    product: readonly(product),
    activeTarget: readonly(activeTarget),
    generation: readonly(generation),
    loadTarget,
    retry,
    dispose,
  };
}
