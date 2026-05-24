<script setup lang="ts">
/**
 * LianButton - Core button component with 6-state vocabulary.
 *
 * A versatile button component supporting multiple visual variants, sizes,
 * and interaction states. Implements Apple-style accessibility patterns
 * with proper ARIA attributes for toggle buttons and loading states.
 *
 * @component
 * @example
 * ```vue
 * <LianButton variant="primary" @click="handleClick">Submit</LianButton>
 * <LianButton variant="tonal" :loading="isLoading">Save</LianButton>
 * <LianButton state="pressed" :pressed="isLiked">Like</LianButton>
 * ```
 *
 * @fires click - Emitted when button is clicked (not fired when disabled/loading)
 *
 * @slot default - Button label content
 */
import { computed } from "vue";
import { hapticLight } from "../composables/useHapticFeedback";

/**
 * LianButton — Apple-gap PR-δ: 6-state vocabulary.
 *
 * The pre-existing `loading` / `disabled` props remain the source of truth
 * for every existing call site. When the new `state` prop is supplied
 * (anything other than the default `"default"`), it wins and drives both
 * the visual `.is-*` class set and the native `:disabled` / `aria-pressed`
 * attributes.
 *
 * This is purely additive: no call site needs to change to keep its
 * current behaviour. See `docs/frontend/state-vocabulary.md` for the
 * vocabulary the `.is-*` class names follow.
 *
 *   default   — rest. No `.is-*` class, no aria-pressed, click enabled.
 *   loading   — `.is-loading` + native :disabled + spinner + aria-busy.
 *   disabled  — `.is-disabled` + native :disabled + aria-disabled.
 *   pressed   — `.is-pressed` + aria-pressed="true". Click still enabled.
 *   success   — `.is-success`. Click still enabled. Visual transition uses
 *               `--motion-ease-emphasized` (mw#835) for the entry.
 *   error     — `.is-error`. Same as success: emphasized ease on entry.
 *
 * Apple-gap wave 3-A (mw#827) layered the toggle-aware ARIA hooks
 * (`pressed`, `ariaBusy`) so wrappers like `DetailCtaButton` can derive a
 * 6-state CTA vocabulary (errand-help and friends) from this base without
 * each call site having to hand-roll its own button + ARIA wiring. These
 * hooks are additive — every legacy call site is zero-edit because the
 * defaults preserve the previous attribute output exactly.
 */
const props = withDefaults(
  defineProps<{
    variant?: "primary" | "tonal" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    /**
     * 6-state vocabulary. Optional. When omitted, the legacy
     * `loading` / `disabled` props drive behaviour, preserving every
     * existing call site verbatim.
     */
    state?: "default" | "loading" | "disabled" | "pressed" | "success" | "error";
    disabled?: boolean;
    loading?: boolean;
    /**
     * Toggle-aware ARIA hook (mw#827). When set explicitly the value drives
     * `aria-pressed` independently of `state`. Pass `false` to mark this
     * button as a toggle whose pressed state is "off" (the Apple favourite-
     * button pattern). Pass `true` to assert the toggle is on. Leave
     * undefined to fall back to the legacy `state="pressed"` derivation.
     */
    pressed?: boolean;
    /**
     * Forces `aria-busy="true"` independently of `state`. `state="loading"`
     * already implies `aria-busy="true"`, so most call sites never need to
     * pass this — it exists for wrappers that visually represent "busy"
     * with a different state class.
     */
    ariaBusy?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "tonal",
    size: "md",
    state: "default",
    disabled: false,
    loading: false,
    ariaBusy: false,
    type: "button",
  },
);

const emit = defineEmits<{
  click: [event: Event];
}>();

// `state` is the single source of truth when it's not the default;
// otherwise the legacy `loading` / `disabled` props derive the state.
const stateExplicit = computed(() => props.state !== "default");

const effectiveState = computed<
  "default" | "loading" | "disabled" | "pressed" | "success" | "error"
>(() => {
  if (stateExplicit.value) return props.state;
  if (props.loading) return "loading";
  if (props.disabled) return "disabled";
  return "default";
});

// Class binding: in the legacy path we keep emitting *only* `.is-loading`
// (no `.is-disabled`) so 39 existing call sites get byte-identical class
// output. New emission only kicks in once a caller passes `state` explicitly.
const showLoadingClass = computed(() =>
  stateExplicit.value ? props.state === "loading" : props.loading,
);
const showDisabledClass = computed(() => stateExplicit.value && props.state === "disabled");
const showPressedClass = computed(() => stateExplicit.value && props.state === "pressed");
const showSuccessClass = computed(() => stateExplicit.value && props.state === "success");
const showErrorClass = computed(() => stateExplicit.value && props.state === "error");

// Click gate: the disabled / loading effective state suppresses emit. New
// `state="disabled"` / `state="loading"` callers are gated identically.
const isDisabledState = computed(() => {
  const s = effectiveState.value;
  return s === "loading" || s === "disabled";
});

// Preserved name: existing source-text contracts (lianButton.feed-ownership)
// assert that this function name still gates the click. Body now respects
// either the legacy props or the new `state` prop.
function isDisabled() {
  return isDisabledState.value;
}

function handleClick(event: MouseEvent) {
  if (isDisabled()) return;
  hapticLight();
  emit("click", event);
}

// mw#827 ARIA toggle/busy hooks. The legacy contract (state==="pressed" →
// aria-pressed="true", everything else → no attribute) is preserved when
// the wrapper does not supply explicit `pressed` / `ariaBusy`. Wrappers
// that need toggle-aware semantics (e.g. an "off" toggle for a like button
// per Apple gap §5) pass `pressed={false}` to assert "this is a toggle and
// it is currently off" — aria-pressed renders as "false", which is the
// correct ARIA semantic for an unpressed toggle. aria-busy follows the
// loading effective state by default; an explicit prop overrides.
const ariaPressedAttr = computed<"true" | "false" | undefined>(() => {
  if (typeof props.pressed === "boolean") return props.pressed ? "true" : "false";
  return showPressedClass.value ? "true" : undefined;
});
const ariaBusyAttr = computed<"true" | undefined>(() => {
  if (props.ariaBusy) return "true";
  return effectiveState.value === "loading" ? "true" : undefined;
});
// aria-disabled tracks the effective "disabled" state (mw#827 toggle-aware
// pattern: when a toggle is non-interactive but not natively disabled, e.g.
// because we still want focus + screen-reader announcement, aria-disabled
// is the right marker). Mirrors the existing native :disabled semantic so
// older callers still see "true" only when they were already gated.
const ariaDisabledAttr = computed<"true" | undefined>(() =>
  isDisabledState.value ? "true" : undefined,
);
</script>

<template>
  <button
    class="lian-button"
    :class="[
      `lian-button--${variant}`,
      `lian-button--${size}`,
      {
        'is-loading': showLoadingClass,
        'is-disabled': showDisabledClass,
        'is-pressed': showPressedClass,
        'is-success': showSuccessClass,
        'is-error': showErrorClass,
      },
    ]"
    :type="type"
    :disabled="isDisabledState"
    :aria-pressed="ariaPressedAttr"
    :aria-disabled="ariaDisabledAttr"
    :aria-busy="ariaBusyAttr"
    @click="handleClick"
  >
    <span v-if="showLoadingClass" class="lian-button__spinner" aria-hidden="true"></span>
    <span class="lian-button__content"><slot /></span>
  </button>
</template>

<style>
/*
 * Apple Music gap PR-α: continuous state transition between
 * rest / :hover / :active / :disabled. Properties are listed
 * (not `all`) so layout-affecting properties stay snappy and
 * future state-only changes pick up the easing automatically.
 * prefers-reduced-motion is handled globally in
 * src/styles/content-immersive-ui.css.
 */
.lian-button {
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    opacity var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-micro) var(--motion-ease-standard);
}

/*
 * Apple Music gap PR-δ: success / error state entry uses the emphasized
 * ease curve from mw#835 so the colour swap reads as a confirmed result
 * rather than the standard cross-fade. The default rest transition above
 * still owns hover / active / disabled, so this only changes the curve
 * when the state class is on.
 */
.lian-button.is-success,
.lian-button.is-error {
  transition:
    background-color var(--motion-fast) var(--motion-ease-emphasized),
    color var(--motion-fast) var(--motion-ease-emphasized),
    opacity var(--motion-fast) var(--motion-ease-emphasized);
}
</style>
