<script setup lang="ts">
import { AUTH_EMAIL_OR_NICKNAME, AUTH_EMAIL_OR_NICKNAME_HINT } from "../../config/brand";

defineProps<{
  login: string;
  hasError: boolean;
  formErrorId: string;
  hintId: string;
}>();

defineEmits<{
  "update:login": [value: string];
}>();
</script>

<template>
  <label>
    <span>{{ AUTH_EMAIL_OR_NICKNAME }}</span>
    <input
      :value="login"
      autocomplete="username"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="next"
      required
      :aria-invalid="hasError"
      :aria-describedby="[hintId, hasError ? formErrorId : null].filter(Boolean).join(' ')"
      :placeholder="AUTH_EMAIL_OR_NICKNAME"
      @input="$emit('update:login', ($event.target as HTMLInputElement).value)"
    />
    <small :id="hintId" class="auth-login-fields__hint">{{ AUTH_EMAIL_OR_NICKNAME_HINT }}</small>
  </label>
</template>
