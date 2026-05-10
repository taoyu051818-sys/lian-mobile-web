<script setup lang="ts">
import { InlineError } from "../../ui";

defineProps<{
  loading: boolean;
  errorMessage: string;
}>();
</script>

<template>
  <div v-if="loading" class="map-status__loading" role="status">正在加载校园地图…</div>
  <InlineError v-if="errorMessage" class="map-status__error">{{ errorMessage }}</InlineError>
</template>

<style scoped>
.map-status__loading,
.map-status__error {
  position: absolute;
  inset: 0;
  z-index: 700;
  display: grid;
  place-items: center;
  color: var(--lian-muted);
  background: rgba(247, 244, 236, 0.58);
  backdrop-filter: blur(8px);
}

.map-status__error {
  inset: auto var(--space-3) var(--space-3) var(--space-3);
  place-items: start;
}
</style>
