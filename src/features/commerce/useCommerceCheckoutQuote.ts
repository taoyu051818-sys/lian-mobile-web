import { readonly, ref, shallowRef } from "vue";
import {
  CommerceApiError,
  fetchCommerceCheckoutQuote,
  type CommerceApiErrorKind,
} from "../../api/commerce";
import type { CommerceCheckoutQuoteResult } from "../../types/commerce";
import { isCommerceCartVisible } from "./useCommerceCart";

export type CommerceCheckoutQuoteStatus =
  | "closed"
  | "idle"
  | "loading"
  | "ready"
  | "login-required"
  | "cart-invalid"
  | "error";

export interface CommerceCheckoutQuoteTransport {
  quote(signal: AbortSignal): Promise<CommerceCheckoutQuoteResult>;
}

export function isCommerceCheckoutQuoteVisible(): boolean {
  return isCommerceCartVisible() && import.meta.env.VITE_COMMERCE_CHECKOUT_QUOTE_VISIBLE === "true";
}

const defaultTransport: CommerceCheckoutQuoteTransport = { quote: fetchCommerceCheckoutQuote };

function errorKind(error: unknown): CommerceApiErrorKind | "generic" {
  return error instanceof CommerceApiError ? error.kind : "generic";
}

/** Page-scoped owner. The opaque quote token stays in memory and is never rendered or persisted. */
export function useCommerceCheckoutQuote(
  transport: CommerceCheckoutQuoteTransport = defaultTransport,
  visible: () => boolean = isCommerceCheckoutQuoteVisible,
) {
  const status = ref<CommerceCheckoutQuoteStatus>("idle");
  const result = shallowRef<CommerceCheckoutQuoteResult | null>(null);
  const failure = ref<CommerceApiErrorKind | "generic">("generic");
  let controller: AbortController | null = null;
  let generation = 0;

  function clear() {
    generation += 1;
    controller?.abort();
    controller = null;
    result.value = null;
    failure.value = "generic";
    status.value = visible() ? "idle" : "closed";
  }

  async function create(): Promise<void> {
    clear();
    if (!visible()) return;
    const ownGeneration = generation;
    controller = new AbortController();
    status.value = "loading";
    try {
      const next = await transport.quote(controller.signal);
      if (generation !== ownGeneration) return;
      result.value = next;
      status.value = "ready";
    } catch (error) {
      if (generation !== ownGeneration) return;
      const kind = errorKind(error);
      failure.value = kind;
      status.value =
        kind === "login-required"
          ? "login-required"
          : kind === "quote-cart-invalid"
            ? "cart-invalid"
            : "error";
    } finally {
      if (generation === ownGeneration) controller = null;
    }
  }

  function dispose() {
    generation += 1;
    controller?.abort();
    controller = null;
  }

  return {
    status: readonly(status),
    result: readonly(result),
    failure: readonly(failure),
    create,
    clear,
    dispose,
  };
}
