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
  /**
   * Optional pickup-label seed handed in by the merchant detail CTA so the
   * order form opens with the merchant identity already filled (PR2, issue
   * #609). The merchant DTO does not ship a structured address — `name` is the
   * pickup hint runners actually need ("到 海大食堂西餐窗口 取 …"). Stored as a
   * string only; coords / placeId stay null until the V0.2 map picker lands.
   *
   * Empty string means "no hint" — the form leaves pickup blank and the user
   * fills it themselves.
   */
  pickupHint: Ref<string>;
  enterForMerchant: (merchantPostId: number, origin?: AppViewKey, pickupHint?: string) => void;
  enterForOrder: (orderId: string, origin?: AppViewKey) => void;
  reset: () => void;
}

const DEFAULT_ORIGIN: AppViewKey = "feed";

const merchantPostId = ref<number | null>(null);
const orderId = ref<string>("");
const origin = ref<AppViewKey>(DEFAULT_ORIGIN);
const pickupHint = ref<string>("");

export function useErrandOrderRoute(): ErrandOrderRouteState {
  return {
    merchantPostId,
    orderId,
    origin,
    pickupHint,
    enterForMerchant(id: number, from?: AppViewKey, hint?: string) {
      merchantPostId.value = id;
      orderId.value = "";
      // Trim defensively so a stray-whitespace hint never sneaks past the
      // draft's "label is non-empty" gate without actually carrying content.
      pickupHint.value = (hint || "").trim();
      if (from) origin.value = from;
    },
    enterForOrder(id: string, from?: AppViewKey) {
      orderId.value = id;
      merchantPostId.value = null;
      pickupHint.value = "";
      if (from) origin.value = from;
    },
    reset() {
      merchantPostId.value = null;
      orderId.value = "";
      origin.value = DEFAULT_ORIGIN;
      pickupHint.value = "";
    },
  };
}
