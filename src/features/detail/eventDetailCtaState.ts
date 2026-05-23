/**
 * Event detail CTA state mapping (Apple-gap wave 3-A / mw#827 PR-2).
 *
 * Maps `EventActionPlan` + transient flags (busy / actionError) to the shared
 * 6-state CTA vocabulary that `DetailCtaButton` consumes. Keeps the policy
 * untouched — `planEventAction` still owns "can the viewer join, cancel, or
 * is the door closed and why". This module only translates that decision into
 * a render-time state token so the view doesn't sprout its own ad-hoc
 * `:disabled || busy ? "x" : "y"` ladder.
 *
 * State map (highest priority first):
 *
 *   busy === true                                 → loading
 *   plan.mode === "join" | "cancel" + enabled     → enabled
 *   plan.mode === "disabled":
 *     reasonKey ∈ {outOfScope, notSignedIn}       → reason   (permission-blocked)
 *     reasonKey ∈ {alreadyEnded, full, notOpen}   → disabled (state-blocked)
 *     reasonKey ∈ {alreadyJoined} or empty        → disabled (fallback)
 *
 * The permission/state distinction matters for `data-cta-cause` so structure
 * tests can route the right reason copy. The visuals are visually identical
 * (muted tone, click suppressed, message under the button); only the cause
 * label differs.
 *
 * `failure` and `success` are deliberately not part of this mapping in PR-2:
 *
 *   - failure: the existing block already surfaces `actionError` as a
 *     `role="alert"` prose line; latching the CTA into a permanent shake on
 *     a stale error string would be a UX regression. PR-3 / PR-4 can layer
 *     a transient failure latch via the same composable pattern the merchant
 *     pilot uses (`useErrandHelpCta.runClick`), but the event composable
 *     doesn't have that latch yet, so we don't fake one.
 *   - success: a successful join transitions the plan to `cancel + enabled`,
 *     which already reads as "I confirmed this" via the label swap. There is
 *     no separate "I just clicked" success state to latch.
 */

import type { EventActionPlan } from "../../domain/eventActionPolicy";
import { selectDetailCtaState, type DetailCtaState } from "./detailCtaState";

export interface EventDetailCtaStateInput {
  plan: EventActionPlan;
  busy: boolean;
}

const PERMISSION_REASONS: ReadonlySet<EventActionPlan["reasonKey"]> = new Set([
  "outOfScope",
  "notSignedIn",
]);

export function selectEventDetailCtaState(input: EventDetailCtaStateInput): DetailCtaState {
  const { plan, busy } = input;

  if (busy) {
    return selectDetailCtaState({ loading: true, clickable: false });
  }

  if ((plan.mode === "join" || plan.mode === "cancel") && plan.enabled) {
    return selectDetailCtaState({ clickable: true });
  }

  // plan.mode === "disabled" (terminal / blocked / not-yet-open / etc.)
  if (PERMISSION_REASONS.has(plan.reasonKey)) {
    return selectDetailCtaState({ permissionBlocked: true, clickable: false });
  }

  return selectDetailCtaState({ clickable: false });
}
