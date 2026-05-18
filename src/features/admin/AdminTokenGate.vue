<script setup lang="ts">
import { ref } from "vue";
import { LianButton } from "../../ui";
import {
  ADMIN_TOKEN_GATE_TITLE,
  ADMIN_TOKEN_GATE_HINT,
  ADMIN_TOKEN_PLACEHOLDER,
  ADMIN_TOKEN_REQUIRED,
  ADMIN_TOKEN_SUBMIT,
} from "../../config/brand";

const emit = defineEmits<{
  submit: [token: string];
}>();

const tokenInput = ref("");
const localError = ref("");

defineProps<{ errorMessage?: string }>();

function handleSubmit() {
  const trimmed = tokenInput.value.trim();
  if (!trimmed) {
    localError.value = ADMIN_TOKEN_REQUIRED;
    return;
  }
  localError.value = "";
  emit("submit", trimmed);
}
</script>

<template>
  <section class="admin-token-gate" :aria-label="ADMIN_TOKEN_GATE_TITLE">
    <h2 class="admin-token-gate__title">{{ ADMIN_TOKEN_GATE_TITLE }}</h2>
    <p class="admin-token-gate__hint">{{ ADMIN_TOKEN_GATE_HINT }}</p>
    <label class="admin-token-gate__field">
      <input
        v-model="tokenInput"
        type="password"
        autocomplete="off"
        spellcheck="false"
        :placeholder="ADMIN_TOKEN_PLACEHOLDER"
        @keyup.enter="handleSubmit"
      />
    </label>
    <p v-if="localError || errorMessage" class="admin-token-gate__error" role="alert">
      {{ localError || errorMessage }}
    </p>
    <LianButton variant="primary" @click="handleSubmit">{{ ADMIN_TOKEN_SUBMIT }}</LianButton>
  </section>
</template>

<style scoped>
.admin-token-gate {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  max-width: 420px;
  margin: var(--space-6) auto 0;
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-token-gate__title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.admin-token-gate__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.admin-token-gate__field {
  display: grid;
  width: 100%;
  gap: var(--space-2);
}

.admin-token-gate__field input {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  box-sizing: border-box;
}

.admin-token-gate__error {
  margin: 0;
  color: var(--lian-danger, #d33);
  font-size: 13px;
  line-height: 1.5;
}
</style>
