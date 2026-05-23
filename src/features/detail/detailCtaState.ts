/**
 * Shared 6-state vocabulary for the detail-page CTA surface
 * (Apple-gap wave 3-A / mw#827).
 *
 * The Apple Music album page derives a dozen+ button modifiers
 * (`.action-button--approved/declined`, `.button--text-button`,
 * `.cloud-buttons--with-platter`, `.favorite-button--platter/non-platter`)
 * from a single button base. Each modifier locks one *meaningful* state.
 * LIAN's detail surface needs the same so a CTA that *looks* clickable but
 * *isn't* (the original 帮我取 bug) has nowhere to hide.
 *
 * The six states (with the ARIA contract every wrapper must respect):
 *
 *   enabled            primary tone, full opacity. No aria-pressed; no
 *                      aria-disabled. Click fires.
 *   disabled-permission muted tone. The CTA exists but the role gate
 *                      hasn't been cleared yet (e.g. merchant_verified
 *                      missing). aria-disabled="true". Click suppressed.
 *                      Reason copy lives below the button.
 *   disabled-state     muted tone. The CTA's *target* is unavailable
 *                      (errand entry off, order claimed, expired window).
 *                      aria-disabled="true". Click suppressed. Reason copy
 *                      lives below the button.
 *   loading            primary tone + spinner. aria-busy="true",
 *                      aria-disabled="true". Click suppressed.
 *   success            confirmed-positive tone. aria-pressed="true" so
 *                      AT announces the toggle as on. Click still fires
 *                      (re-submit / un-press semantics — wrappers gate at
 *                      the handler level, not the ARIA level).
 *   error              negative tone. aria-disabled="false" — the user
 *                      can retry. Reason copy carries the failure prose.
 *
 * The 6-state contract is a superset of what shipped in PR #840: that
 * lane introduced `enabled / disabled / loading / success / failure /
 * reason` for the merchant pilot. Wave 3-A keeps the wire-shape stable
 * (callers that pass `disabled` / `failure` / `reason` keep working) and
 * layers the permission/state disambiguation on top via an explicit
 * `permissionBlocked` input — wrappers that do not care about the
 * distinction (the merchant pilot today) get the legacy mapping.
 *
 * Visual / motion contract is enforced by:
 *   - tests/structure/state-class-vocabulary.test.ts (.is-* allowlist)
 *   - tests/structure/motion-property-allowlist.test.ts (RFC §3.2)
 *   - tests/detail/detail-cta-state.test.ts (presentation contract)
 *   - tests/structure/cta-shared-base.test.ts (every detail CTA derives
 *     from LianButton or is on the grandfathered allowlist)
 *
 * No string literals leak through this module — labels live in
 * `src/config/brand` and arrive on the wrapper component as props.
 */

export type DetailCtaState = "enabled" | "disabled" | "loading" | "success" | "failure" | "reason";

export type DetailCtaTone = "primary" | "muted" | "success" | "danger";

/**
 * The vocabulary the wave 3-A wrapper resolves the `state` into when it
 * binds attributes on the underlying `LianButton`. This is *not* the same
 * as the LianButton's own `state` union — the LianButton uses `disabled`
 * for both "permission gated" and "state gated", and the wrapper picks
 * the right ARIA mapping based on the cause.
 */
export type DetailCtaAriaCause = "permission" | "state" | "none";

export type DetailCtaPresentation = {
  /** Native `:disabled` bit on the underlying <button>. */
  disabled: boolean;
  /** State key (mirror of input). Drives the `.is-*` class on the wrapper. */
  state: DetailCtaState;
  /** Visual tone resolved from the state. */
  tone: DetailCtaTone;
  /**
   * Underlying LianButton state. Mostly mirrors `state`, except that
   * wave 3-A's `reason` collapses to LianButton's `disabled` (no separate
   * .is-reason class — visually identical to .is-disabled).
   */
  buttonState: "default" | "loading" | "disabled" | "pressed" | "success" | "error";
  /**
   * Whether to render `aria-pressed="true"` on the underlying button.
   * Only the `success` state of the CTA contract sets this — it's the
   * "I confirmed this" toggle the Apple gap §5 ARIA pattern asks for.
   */
  ariaPressed: boolean;
  /** Mirrors `disabled` for `aria-disabled` exposure. */
  ariaDisabled: boolean;
  /** Loading state requires `aria-busy="true"` so AT does not flood. */
  ariaBusy: boolean;
  /** Cause classification for the disabled cases — drives downstream copy. */
  ariaCause: DetailCtaAriaCause;
};

export type DetailCtaStateInput = {
  blockedReason?: string;
  clickable?: boolean;
  failure?: boolean;
  loading?: boolean;
  success?: boolean;
  /**
   * Wave 3-A: when the CTA is blocked specifically because the user lacks
   * the role / capability (e.g. not merchant_verified, not campus_verified),
   * mark this `true`. The disabled visual is identical to `disabled-state`,
   * but downstream wrappers can route to a different reason copy and the
   * accessibility tree gains a `data-cta-cause="permission"` hint that
   * structure tests can lock.
   *
   * `permissionBlocked` is only honoured when no other terminal state
   * (loading / success / failure) wins — those are still the highest
   * priority signals.
   */
  permissionBlocked?: boolean;
};

export function resolveDetailCtaPresentation(state: DetailCtaState): DetailCtaPresentation {
  switch (state) {
    case "disabled":
      return {
        disabled: true,
        state,
        tone: "muted",
        buttonState: "disabled",
        ariaPressed: false,
        ariaDisabled: true,
        ariaBusy: false,
        ariaCause: "state",
      };
    case "loading":
      return {
        disabled: true,
        state,
        tone: "primary",
        buttonState: "loading",
        ariaPressed: false,
        ariaDisabled: true,
        ariaBusy: true,
        ariaCause: "none",
      };
    case "success":
      return {
        // Apple gap §5 toggle pattern: a confirmed CTA stays announced as
        // pressed-on so the AT user knows the action took. Visually the
        // button keeps its colour swap, but the click handler is not
        // suppressed at the primitive level (wrappers gate at the
        // composable level, e.g. errand-help short-circuits a re-tap).
        disabled: false,
        state,
        tone: "success",
        buttonState: "success",
        ariaPressed: true,
        ariaDisabled: false,
        ariaBusy: false,
        ariaCause: "none",
      };
    case "failure":
      return {
        disabled: false,
        state,
        tone: "danger",
        buttonState: "error",
        ariaPressed: false,
        ariaDisabled: false,
        ariaBusy: false,
        ariaCause: "none",
      };
    case "reason":
      return {
        disabled: true,
        state,
        tone: "muted",
        buttonState: "disabled",
        ariaPressed: false,
        ariaDisabled: true,
        ariaBusy: false,
        ariaCause: "permission",
      };
    case "enabled":
    default:
      return {
        disabled: false,
        state: "enabled",
        tone: "primary",
        buttonState: "default",
        ariaPressed: false,
        ariaDisabled: false,
        ariaBusy: false,
        ariaCause: "none",
      };
  }
}

/**
 * Resolve a `DetailCtaState` from the higher-level boolean inputs the
 * detail blocks actually compute.
 *
 * Precedence (highest first): loading → success → failure → permissionBlocked
 * → blockedReason → clickable=false → enabled. The order matters: a CTA
 * that is mid-flight (loading) must read as loading even if the user just
 * lost permission server-side, otherwise the spinner disappears
 * underneath the user's finger. Likewise success / failure win over the
 * disabled cases because they are *terminal* outcomes of the most recent
 * action.
 */
export function selectDetailCtaState(input: DetailCtaStateInput): DetailCtaState {
  if (input.loading) return "loading";
  if (input.success) return "success";
  if (input.failure) return "failure";
  if (input.permissionBlocked) return "reason";
  if (input.blockedReason) return "reason";
  if (input.clickable === false) return "disabled";
  return "enabled";
}
