<script setup lang="ts">
import { AUTH_TAB_LOGIN, AUTH_TAB_REGISTER, AUTH_MODE_LABEL } from "../../config/brand";

defineProps<{
  mode: "login" | "register";
}>();

defineEmits<{
  switchMode: [mode: "login" | "register"];
}>();
</script>

<template>
  <nav class="auth-mode-tabs" :aria-label="AUTH_MODE_LABEL">
    <button
      type="button"
      :class="{ 'is-active': mode === 'login' }"
      @click="$emit('switchMode', 'login')"
    >
      {{ AUTH_TAB_LOGIN }}
    </button>
    <button
      type="button"
      :class="{ 'is-active': mode === 'register' }"
      @click="$emit('switchMode', 'register')"
    >
      {{ AUTH_TAB_REGISTER }}
    </button>
  </nav>
</template>

<style scoped>
.auth-mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.auth-mode-tabs button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.auth-mode-tabs button.is-active {
  background: var(--lian-ink);
  color: #fff;
}
</style>
