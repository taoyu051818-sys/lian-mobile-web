<script setup lang="ts">
import { AUTH_PROCESSING } from "../../config/brand";
import { InlineError } from "../../ui";

defineProps<{
  errorMessage: string;
  successMessage: string;
  submitting: boolean;
  primaryLabel: string;
  formErrorId: string;
}>();
</script>

<template>
  <InlineError v-if="errorMessage" :id="formErrorId">{{ errorMessage }}</InlineError>
  <p v-if="successMessage" class="auth-submit-state__success">{{ successMessage }}</p>
  <button class="auth-submit-state__submit" type="submit" :disabled="submitting">
    {{ submitting ? AUTH_PROCESSING : primaryLabel }}
  </button>
</template>

<style scoped>
.auth-submit-state__submit {
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--lian-ink);
  color: #fff;
  font-weight: 900;
}

.auth-submit-state__submit:disabled {
  opacity: 0.62;
}

.auth-submit-state__success {
  color: var(--lian-primary);
  font-weight: 850;
}
</style>
