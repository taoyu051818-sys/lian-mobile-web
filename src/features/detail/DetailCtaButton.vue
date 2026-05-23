<script setup lang="ts">
/**
 * DetailCtaButton — wave 3-A wrapper around `LianButton` (Apple gap, mw#827).
 *
 * Every detail-page CTA derives the visual + ARIA contract for its 6 states
 * (enabled / disabled / loading / success / failure / reason) from the same
 * shared button base. The wrapper:
 *
 *   - resolves the public `state` prop via `resolveDetailCtaPresentation`
 *   - feeds the resolved `buttonState` to `LianButton` so the `.is-*` class
 *     and click gate match the rest of the design system
 *   - explicitly binds aria-disabled / aria-busy / aria-pressed via the
 *     toggle-aware ARIA hooks LianButton exposes (also added in mw#827)
 *   - exposes a stable `data-cta-cause` attribute on the wrapper so
 *     follow-up wrappers (and structure tests) can disambiguate
 *     permission-blocked vs state-blocked vs error reasons without
 *     rendering a different class set
 *
 * Wrappers should NEVER reach inside this component to flip aria-pressed
 * by hand — call sites pass the high-level `state` and the wrapper does
 * the right thing. That is what makes the contract auditable.
 */
import { computed } from "vue";
import LianButton from "../../ui/LianButton.vue";
import { resolveDetailCtaPresentation, type DetailCtaState } from "./detailCtaState";

const props = withDefaults(
  defineProps<{
    label: string;
    message?: string;
    messageTestId?: string;
    state?: DetailCtaState;
    testId?: string;
    /**
     * Optional human-readable string surfaced via the native `title`
     * attribute when the CTA is in a disabled state. Useful for the
     * "needs认证商家" tooltip the spec calls out — empty string disables
     * the attribute (no `title=""`) so non-blocked states don't render
     * a stray tooltip placeholder.
     */
    titleHint?: string;
  }>(),
  {
    message: "",
    messageTestId: "",
    state: "enabled",
    testId: "detail-cta-button",
    titleHint: "",
  },
);

defineEmits<{
  click: [];
}>();

const presentation = computed(() => resolveDetailCtaPresentation(props.state));

// Native `title` only renders when (a) the caller supplied a hint AND
// (b) the CTA is in a disabled-ish state where the user might be
// hovering looking for "why can't I click this?". Showing the title on
// `enabled` would create a spurious tooltip on the happy path.
const titleAttr = computed<string | undefined>(() => {
  if (!props.titleHint) return undefined;
  const cause = presentation.value.ariaCause;
  if (cause === "permission" || cause === "state") return props.titleHint;
  return undefined;
});
</script>

<template>
  <div
    class="detail-cta-button"
    :class="[`is-${presentation.state}`, `detail-cta-button--tone-${presentation.tone}`]"
    :data-state="presentation.state"
    :data-cta-cause="presentation.ariaCause"
  >
    <LianButton
      :variant="presentation.tone === 'danger' ? 'danger' : 'primary'"
      size="md"
      :state="presentation.buttonState"
      :pressed="presentation.ariaPressed ? true : undefined"
      :aria-busy="presentation.ariaBusy"
      :data-testid="testId"
      :title="titleAttr"
      class="detail-cta-button__control"
      @click="$emit('click')"
    >
      {{ label }}
    </LianButton>
    <p v-if="message" class="detail-cta-button__message" :data-testid="messageTestId || undefined">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
.detail-cta-button {
  display: grid;
  gap: 4px;
  justify-items: start;
}

.detail-cta-button__control {
  justify-self: start;
}

/*
 * Tone overrides ride on top of LianButton's primary/danger variants so the
 * wrapper can shift the colour swap per state without touching LianButton's
 * own CSS. Properties are explicit (background-color / color / opacity) and
 * stay inside the §3.2 motion allowlist.
 */
.detail-cta-button--tone-muted .lian-button {
  background: rgba(120, 120, 120, 0.32);
  color: rgba(24, 24, 24, 0.84);
}

.detail-cta-button--tone-success .lian-button {
  background: rgba(31, 167, 160, 0.18);
  color: #166b67;
  box-shadow: inset 0 0 0 1px rgba(31, 167, 160, 0.24);
}

.detail-cta-button.is-error .lian-button {
  /*
   * Error state shake animation. Uses transform only so it stays inside
   * the §3.2 allowlist; honours prefers-reduced-motion globally.
   */
  animation: detail-cta-button-shake 220ms var(--motion-ease-emphasized) 1;
}

@media (prefers-reduced-motion: reduce) {
  .detail-cta-button.is-error .lian-button {
    animation: none;
  }
}

@keyframes detail-cta-button-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}

.detail-cta-button__message {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
