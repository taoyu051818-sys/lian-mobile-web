<script setup lang="ts">
import { computed } from "vue";

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
 *   loading   — `.is-loading` + native :disabled + spinner. Click suppressed.
 *   disabled  — `.is-disabled` + native :disabled. Click suppressed.
 *   pressed   — `.is-pressed` + aria-pressed="true". Click still enabled.
 *   success   — `.is-success`. Click still enabled. Visual transition uses
 *               `--motion-ease-emphasized` (mw#835) for the entry.
 *   error     — `.is-error`. Same as success: emphasized ease on entry.
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
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "tonal",
    size: "md",
    state: "default",
    disabled: false,
    loading: false,
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
  emit("click", event);
}
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
    :aria-pressed="showPressedClass ? 'true' : null"
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
