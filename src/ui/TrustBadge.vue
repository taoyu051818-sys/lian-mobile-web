<script setup lang="ts">
type TrustTone = "confirmed" | "pending" | "disputed" | "expired" | "ai" | "official";

withDefaults(defineProps<{
  tone?: TrustTone;
}>(), {
  tone: "pending"
});
</script>

<template>
  <span class="trust-badge" :class="`trust-badge--${tone}`">
    <slot />
  </span>
</template>
