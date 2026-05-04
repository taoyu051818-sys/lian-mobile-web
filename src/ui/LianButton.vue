<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "primary" | "tonal" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}>(), {
  variant: "tonal",
  size: "md",
  disabled: false,
  loading: false,
  type: "button"
});
</script>

<template>
  <button
    class="lian-button"
    :class="[`lian-button--${variant}`, `lian-button--${size}`, { 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="lian-button__spinner" aria-hidden="true"></span>
    <span class="lian-button__content"><slot /></span>
  </button>
</template>
