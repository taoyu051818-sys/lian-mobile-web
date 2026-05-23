<script setup lang="ts">
import { computed } from "vue";
import { resolveDetailCtaPresentation, type DetailCtaState } from "./detailCtaState";

const props = withDefaults(
  defineProps<{
    label: string;
    message?: string;
    messageTestId?: string;
    state?: DetailCtaState;
    testId?: string;
  }>(),
  {
    message: "",
    messageTestId: "",
    state: "enabled",
    testId: "detail-cta-button",
  },
);

const presentation = computed(() => resolveDetailCtaPresentation(props.state));

defineEmits<{
  click: [];
}>();
</script>

<template>
  <div
    class="detail-cta-button"
    :class="`is-${presentation.state}`"
    :data-state="presentation.state"
  >
    <button
      type="button"
      class="detail-cta-button__control"
      :class="`is-${presentation.tone}`"
      :disabled="presentation.disabled"
      :aria-disabled="presentation.disabled"
      :data-testid="testId"
      @click="$emit('click')"
    >
      {{ label }}
    </button>
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
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  font-weight: 800;
  height: 36px;
  padding: 0 var(--space-3);
  transition:
    background-color 120ms ease,
    color 120ms ease,
    opacity 120ms ease,
    transform 120ms ease;
}

.detail-cta-button__control.is-primary {
  background: var(--lian-primary, #1fa7a0);
  color: rgba(255, 255, 255, 0.94);
}

.detail-cta-button__control.is-muted {
  background: rgba(120, 120, 120, 0.32);
  color: rgba(24, 24, 24, 0.84);
}

.detail-cta-button__control.is-success {
  background: rgba(31, 167, 160, 0.18);
  color: #166b67;
}

.detail-cta-button__control.is-danger {
  background: rgba(209, 83, 83, 0.14);
  color: #8c2d2d;
}

.detail-cta-button__control:not(:disabled) {
  cursor: pointer;
}

.detail-cta-button__control:disabled {
  cursor: not-allowed;
}

.detail-cta-button.is-loading .detail-cta-button__control {
  opacity: 0.78;
}

.detail-cta-button.is-success .detail-cta-button__control {
  box-shadow: inset 0 0 0 1px rgba(31, 167, 160, 0.24);
}

.detail-cta-button__message {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
