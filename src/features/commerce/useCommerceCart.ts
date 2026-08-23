import { readonly, ref, shallowRef } from "vue";
import {
  CommerceApiError,
  deleteCommerceCartItem,
  fetchCommerceActorInitialize,
  fetchCommerceCart,
  setCommerceCartItem,
  type CommerceApiErrorKind,
} from "../../api/commerce";
import { isCanonicalCommerceProductId } from "../../app/commerce-route";
import type {
  CommerceActorInitializeResult,
  CommerceCartItem,
  CommerceCartResult,
} from "../../types/commerce";

export type CommerceCartStatus =
  | "closed"
  | "idle"
  | "loading"
  | "empty"
  | "ready"
  | "login-required"
  | "item-unavailable"
  | "error";

export type CommerceCartErrorKind =
  | "generic"
  | "rate-limited"
  | "timeout"
  | "malformed"
  | "limit"
  | "conflict";

export type CommerceCartTarget =
  | { name: "read" }
  | { name: "set"; skuId: string; quantity: number }
  | { name: "delete"; skuId: string };

export interface CommerceCartTransport {
  read(signal: AbortSignal): Promise<CommerceCartResult>;
  initializeActor(signal: AbortSignal): Promise<CommerceActorInitializeResult>;
  set(skuId: string, quantity: number, signal: AbortSignal): Promise<CommerceCartResult>;
  delete(skuId: string, signal: AbortSignal): Promise<CommerceCartResult>;
}

export interface CommerceCartOptions {
  timeoutMs?: number;
  visible?: () => boolean;
}

const DEFAULT_TIMEOUT_MS = 12_000;

const defaultTransport: CommerceCartTransport = {
  read: fetchCommerceCart,
  initializeActor: fetchCommerceActorInitialize,
  set: setCommerceCartItem,
  delete: deleteCommerceCartItem,
};

export function isCommerceCartVisible(): boolean {
  return (
    import.meta.env.VITE_COMMERCE_CATALOG_VISIBLE === "true" &&
    import.meta.env.VITE_COMMERCE_PRODUCT_VISIBLE === "true" &&
    import.meta.env.VITE_COMMERCE_CART_VISIBLE === "true"
  );
}

function sameTarget(left: CommerceCartTarget | null, right: CommerceCartTarget): boolean {
  if (!left || left.name !== right.name) return false;
  if (left.name === "read" && right.name === "read") return true;
  if (left.name === "delete" && right.name === "delete") return left.skuId === right.skuId;
  return (
    left.name === "set" &&
    right.name === "set" &&
    left.skuId === right.skuId &&
    left.quantity === right.quantity
  );
}

function mapErrorKind(kind: CommerceApiErrorKind): CommerceCartErrorKind {
  if (kind === "rate-limited") return "rate-limited";
  if (kind === "timeout") return "timeout";
  if (kind === "malformed") return "malformed";
  if (kind === "cart-limit-exceeded") return "limit";
  if (kind === "idempotency-conflict") return "conflict";
  return "generic";
}

/** Instance-scoped owner for the authenticated cart projection and mutations. */
export function useCommerceCart(
  transport: CommerceCartTransport = defaultTransport,
  options: CommerceCartOptions = {},
) {
  const status = ref<CommerceCartStatus>("idle");
  const errorKind = ref<CommerceCartErrorKind>("generic");
  const items = ref<CommerceCartItem[]>([]);
  const activeTarget = shallowRef<CommerceCartTarget | null>(null);
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

  function owns(requestGeneration: number, target: CommerceCartTarget): boolean {
    return generation.value === requestGeneration && sameTarget(activeTarget.value, target);
  }

  function adopt(result: CommerceCartResult) {
    items.value = result.cart.items;
    status.value = result.cart.items.length === 0 ? "empty" : "ready";
  }

  function projectError(error: unknown) {
    if (error instanceof CommerceApiError && error.kind === "login-required") {
      items.value = [];
      status.value = "login-required";
      return;
    }
    if (error instanceof CommerceApiError && error.kind === "item-unavailable") {
      status.value = "item-unavailable";
      return;
    }
    errorKind.value = error instanceof CommerceApiError ? mapErrorKind(error.kind) : "generic";
    status.value = "error";
  }

  async function run(target: CommerceCartTarget): Promise<void> {
    const requestGeneration = advanceGeneration();
    activeTarget.value = target;
    errorKind.value = "generic";

    const visible = options.visible ?? isCommerceCartVisible;
    if (!visible()) {
      items.value = [];
      status.value = "closed";
      return;
    }
    if (
      (target.name !== "read" && !isCanonicalCommerceProductId(target.skuId)) ||
      (target.name === "set" &&
        (!Number.isInteger(target.quantity) || target.quantity < 1 || target.quantity > 99))
    ) {
      status.value = "error";
      errorKind.value = "malformed";
      return;
    }

    if (target.name === "read") items.value = [];
    status.value = "loading";
    const controller = new AbortController();
    activeController = controller;
    let timedOut = false;
    activeTimeout = setTimeout(() => {
      activeTimeout = null;
      if (!owns(requestGeneration, target)) return;
      timedOut = true;
      controller.abort();
      errorKind.value = "timeout";
      status.value = "error";
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      let result: CommerceCartResult;
      if (target.name === "read") {
        result = await transport.read(controller.signal);
      } else if (target.name === "delete") {
        result = await transport.delete(target.skuId, controller.signal);
      } else {
        try {
          result = await transport.set(target.skuId, target.quantity, controller.signal);
        } catch (error) {
          if (
            !(error instanceof CommerceApiError) ||
            error.kind !== "actor-initialization-required"
          ) {
            throw error;
          }
          if (!owns(requestGeneration, target) || timedOut) return;
          await transport.initializeActor(controller.signal);
          if (!owns(requestGeneration, target) || timedOut) return;
          result = await transport.set(target.skuId, target.quantity, controller.signal);
        }
      }
      if (!owns(requestGeneration, target) || timedOut) return;
      adopt(result);
    } catch (error) {
      if (!owns(requestGeneration, target)) return;
      if (timedOut) {
        errorKind.value = "timeout";
        status.value = "error";
      } else if (error instanceof CommerceApiError && error.kind === "aborted") {
        errorKind.value = "generic";
        status.value = "error";
      } else {
        projectError(error);
      }
    } finally {
      if (generation.value === requestGeneration) {
        clearActiveTimeout();
        activeController = null;
      }
    }
  }

  function read(): Promise<void> {
    return run({ name: "read" });
  }

  function setQuantity(skuId: string, quantity: number): Promise<void> {
    return run({ name: "set", skuId, quantity });
  }

  function deleteItem(skuId: string): Promise<void> {
    return run({ name: "delete", skuId });
  }

  function retry(): Promise<void> {
    return activeTarget.value ? run(activeTarget.value) : Promise.resolve();
  }

  function dispose() {
    advanceGeneration();
    activeTarget.value = null;
    status.value = "idle";
    errorKind.value = "generic";
    items.value = [];
  }

  return {
    status: readonly(status),
    errorKind: readonly(errorKind),
    items: readonly(items),
    activeTarget: readonly(activeTarget),
    generation: readonly(generation),
    read,
    setQuantity,
    deleteItem,
    retry,
    dispose,
  };
}
