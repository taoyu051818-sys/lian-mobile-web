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
import type { AppViewKey } from "../../app/view-types";

interface ErrandOrderRouteState {
  merchantPostId: Ref<number | null>;
  orderId: Ref<string>;
  /**
   * Where the user was BEFORE we set their active view to "errand-order". The
   * close/back handlers restore this so a user who tapped 帮我取 from the map
   * tab does not get dropped onto feed when they cancel.
   */
  origin: Ref<AppViewKey>;
  enterForMerchant: (merchantPostId: number, origin?: AppViewKey) => void;
  enterForOrder: (orderId: string, origin?: AppViewKey) => void;
  reset: () => void;
}

const DEFAULT_ORIGIN: AppViewKey = "feed";

const merchantPostId = ref<number | null>(null);
const orderId = ref<string>("");
const origin = ref<AppViewKey>(DEFAULT_ORIGIN);

export function useErrandOrderRoute(): ErrandOrderRouteState {
  return {
    merchantPostId,
    orderId,
    origin,
    enterForMerchant(id: number, from?: AppViewKey) {
      merchantPostId.value = id;
      orderId.value = "";
      if (from) origin.value = from;
    },
    enterForOrder(id: string, from?: AppViewKey) {
      orderId.value = id;
      merchantPostId.value = null;
      if (from) origin.value = from;
    },
    reset() {
      merchantPostId.value = null;
      orderId.value = "";
      origin.value = DEFAULT_ORIGIN;
    },
  };
}
