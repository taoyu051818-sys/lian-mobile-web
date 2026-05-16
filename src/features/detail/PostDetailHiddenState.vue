<script setup lang="ts">
import { LianButton } from "../../ui";
import {
  HIDDEN_STATE_LABEL,
  HIDDEN_STATE_TITLE,
  HIDDEN_STATE_DESCRIPTION,
  HIDDEN_STATE_UNDO,
} from "../../config/brand";

const emit = defineEmits<{
  undoHide: [];
}>();
</script>

<template>
  <section class="post-detail-hidden-state" :aria-label="HIDDEN_STATE_LABEL" @click.stop>
    <h2>{{ HIDDEN_STATE_TITLE }}</h2>
    <p>{{ HIDDEN_STATE_DESCRIPTION }}</p>
    <LianButton size="sm" variant="ghost" @click="emit('undoHide')">{{
      HIDDEN_STATE_UNDO
    }}</LianButton>
  </section>
</template>

<style scoped>
.post-detail-hidden-state {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-hidden-state h2,
.post-detail-hidden-state p {
  margin: 0;
}

.post-detail-hidden-state p {
  color: var(--lian-muted);
  line-height: 1.6;
}
</style>
