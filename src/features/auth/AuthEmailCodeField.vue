<script setup lang="ts">
import { AUTH_EMAIL_CODE_LENGTH } from "../../domain/validation/forms";
import { AUTH_EMAIL_CODE_LABEL, AUTH_CODE_SUFFIX } from "../../config/brand";

defineProps<{
  modelValue: string;
  canRequest: boolean;
  buttonLabel: string;
  hint: string;
  hasError: boolean;
  formErrorId: string;
  hintId: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  requestCode: [];
}>();
</script>

<template>
  <label>
    <span>{{ AUTH_EMAIL_CODE_LABEL }}</span>
    <div class="auth-email-code">
      <input
        :value="modelValue"
        inputmode="numeric"
        :maxlength="AUTH_EMAIL_CODE_LENGTH"
        pattern="[0-9]*"
        autocomplete="one-time-code"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="next"
        :aria-invalid="hasError"
        :aria-describedby="[hintId, hasError ? formErrorId : null].filter(Boolean).join(' ')"
        :placeholder="`${AUTH_EMAIL_CODE_LENGTH}${AUTH_CODE_SUFFIX}`"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :disabled="!canRequest"
        :aria-describedby="hintId"
        @click="$emit('requestCode')"
      >
        {{ buttonLabel }}
      </button>
    </div>
    <small :id="hintId" class="auth-panel__hint" aria-live="polite">{{ hint }}</small>
  </label>
</template>

<style scoped>
.auth-email-code {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.auth-email-code input {
  flex: 1;
  min-width: 0;
}

.auth-email-code button {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font-weight: 900;
}

.auth-email-code button:disabled {
  opacity: 0.62;
}
</style>
