<script setup lang="ts">
import type { AudienceVisibility } from "../types/audience";
import { FEED_VISIBILITY_LABELS } from "../config/brand";

const props = defineProps<{
  visibility?: AudienceVisibility;
}>();

function visibilityLabel(v?: AudienceVisibility): string | null {
  if (!v || v === "public") return null;
  return FEED_VISIBILITY_LABELS[v] || null;
}
</script>

<template>
  <span v-if="visibilityLabel(props.visibility)" class="visibility-badge">
    {{ visibilityLabel(props.visibility) }}
  </span>
</template>

<style scoped>
.visibility-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-chip, 4px);
  background: rgba(31, 41, 51, 0.08);
  color: var(--lian-muted, #6b7280);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
