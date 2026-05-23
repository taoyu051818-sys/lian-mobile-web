/**
 * useErrandHelpCta — wave 3-A capability-aware CTA state composable
 * (Apple-gap mw#827).
 *
 * The errand-help CTA on a merchant detail page is the canonical demo
 * surface for the 6-state `DetailCtaButton` vocabulary. This composable
 * derives the right `DetailCtaState` from four orthogonal signals:
 *
 *   1. `available` — does the merchant currently support errand-help?
 *      (Backend `errandEntryAvailable === true` only — `false` is the
 *      "supports it but currently turned off" branch and `undefined` is
 *      "this merchant does not support errand at all", which the wrapper
 *      handles by not rendering the CTA at all.)
 *   2. `merchantPostId` — must be a positive integer or the route
 *      singleton has nothing to dispatch into.
 *   3. capability gate — the spec calls out "needs认证商家" as a
 *      permission block. Wave 3-A routes that through the merchant
 *      verification capability rather than hard-coding the role check.
 *   4. transient action signals — `loading / success / failure` from the
 *      caller's local state machine (the click handler bumps `loading`,
 *      resolves to `success`, throws into `failure`).
 *
 * The composable does NOT decide *what to do* on click — it only
 * exposes a stable view-model and a tiny click router. Wrappers wire
 * their handler in and the composable enforces the precedence rules
 * (loading wins over permission, terminal states win over reason, etc.)
 * so every detail CTA has the same predictable behaviour.
 *
 * Per `feedback_nodebb_native_first.md`: identity / role data comes
 * from the existing `useIsMerchantVerified` capability gate. We never
 * re-implement role checking in the composable.
 */

import { computed, ref, type Ref } from "vue";
import { selectDetailCtaState, type DetailCtaState } from "../detail";

export interface ErrandHelpCtaInput {
  /**
   * Backend signal: `true` means the merchant supports errand-help and the
   * entry is currently open. `false` means supported-but-paused. `undefined`
   * means this merchant does not support errand at all and the wrapper
   * should not render the CTA — pass `undefined` through and let the
   * caller's `v-if` decide.
   */
  available: Ref<boolean | undefined>;
  /** Positive merchant post id — required for the route dispatch to work. */
  merchantPostId: Ref<number | null | undefined>;
  /**
   * Identity gate. When the user is not the right role to use the entry,
   * the CTA renders as `disabled-permission` (visually muted, click
   * suppressed, reason copy below). Passing a static `false` is fine for
   * anonymous-by-default surfaces; reactive refs are honoured.
   */
  hasPermission: Ref<boolean>;
  /**
   * Optional human reason explaining why the CTA is unavailable. Wave 3-A
   * routes anything truthy through to `reason` state regardless of the
   * permission gate, so the merchant pilot's existing "暂未开放" path keeps
   * working. Empty / undefined falls back to either permission or state.
   */
  blockedReason?: Ref<string>;
}

export interface ErrandHelpCtaModel {
  /** The derived 6-state CTA key — feeds straight into `DetailCtaButton`. */
  state: Ref<DetailCtaState>;
  /** True only when the click handler should fire — wrappers should still
   *  guard at the handler level for double-click / race protection. */
  clickable: Ref<boolean>;
  /** Local loading bit. Flipped by `runClick` while the handler is in flight. */
  loading: Ref<boolean>;
  /** Local success bit. Latched after a successful click, mirrors product
   *  spec ("保持 success" rather than auto-clearing after 5s). */
  success: Ref<boolean>;
  /** Local failure bit. Set when the click handler throws. */
  failure: Ref<boolean>;
  /** The error message captured from the most recent failed click. */
  failureMessage: Ref<string>;
  /**
   * Reset the local state machine to a clean idle. Useful when the wrapper
   * unmounts and remounts (e.g. user navigates away and back) so a stale
   * success bit doesn't latch across detail changes.
   */
  reset(): void;
  /**
   * Run the wrapper's click handler with the loading / success / failure
   * latching applied. The handler is gated on `clickable`; when blocked
   * the call is a no-op.
   */
  runClick(handler: () => void | Promise<void>): Promise<void>;
}

export function useErrandHelpCta(input: ErrandHelpCtaInput): ErrandHelpCtaModel {
  const loading = ref(false);
  const success = ref(false);
  const failure = ref(false);
  const failureMessage = ref("");

  const hasMerchantPostId = computed(() => {
    const id = input.merchantPostId.value;
    return typeof id === "number" && Number.isFinite(id) && id > 0;
  });

  const isAvailable = computed(() => input.available.value === true);

  const clickable = computed(
    () =>
      isAvailable.value &&
      hasMerchantPostId.value &&
      input.hasPermission.value &&
      !loading.value &&
      !success.value,
  );

  const state = computed<DetailCtaState>(() =>
    selectDetailCtaState({
      loading: loading.value,
      success: success.value,
      failure: failure.value,
      blockedReason: input.blockedReason?.value || "",
      // Permission gate fires only when the entry is *otherwise available*.
      // A merchant that has errand-help paused (`available === false`) reads
      // as state-blocked even if the user is not authenticated yet, because
      // that's the more accurate reason and the spec wants the most
      // specific reason copy possible.
      permissionBlocked: isAvailable.value && hasMerchantPostId.value && !input.hasPermission.value,
      clickable: clickable.value,
    }),
  );

  function reset() {
    loading.value = false;
    success.value = false;
    failure.value = false;
    failureMessage.value = "";
  }

  async function runClick(handler: () => void | Promise<void>) {
    if (!clickable.value) return;
    loading.value = true;
    failure.value = false;
    failureMessage.value = "";
    try {
      await handler();
      success.value = true;
    } catch (error) {
      failure.value = true;
      failureMessage.value = error instanceof Error ? error.message : String(error);
    } finally {
      loading.value = false;
    }
  }

  return {
    state,
    clickable,
    loading,
    success,
    failure,
    failureMessage,
    reset,
    runClick,
  };
}
