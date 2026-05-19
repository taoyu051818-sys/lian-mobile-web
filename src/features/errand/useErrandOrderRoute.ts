/**
 * Singleton routing context for the errand-order secret view.
 *
 * The order flow is a multi-screen detour from the merchant detail page:
 * 1. Detail "帮我取" CTA → setActiveView("errand-order") for a merchantPostId.
 * 2. Form submit succeeds → setActiveView("errand-order") again with the new
 *    orderId → the same view pivots into the timeline branch.
 *
 * `useActiveView` only carries the view key, so we use a tiny shared store
 * (mirroring the detail-navigation singleton) to remember "what is the user
 * here for". Setting either field clears the other so the view never tries
 * to render both branches at once.
 */
import { ref, type Ref } from "vue";

interface ErrandOrderRouteState {
  merchantPostId: Ref<number | null>;
  orderId: Ref<string>;
  enterForMerchant: (merchantPostId: number) => void;
  enterForOrder: (orderId: string) => void;
  reset: () => void;
}

const merchantPostId = ref<number | null>(null);
const orderId = ref<string>("");

export function useErrandOrderRoute(): ErrandOrderRouteState {
  return {
    merchantPostId,
    orderId,
    enterForMerchant(id: number) {
      merchantPostId.value = id;
      orderId.value = "";
    },
    enterForOrder(id: string) {
      orderId.value = id;
      merchantPostId.value = null;
    },
    reset() {
      merchantPostId.value = null;
      orderId.value = "";
    },
  };
}
