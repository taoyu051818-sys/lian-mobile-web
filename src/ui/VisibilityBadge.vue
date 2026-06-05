<script setup lang="ts">
import { FEED_VISIBILITY_LABELS, FEED_VISIBILITY_ICONS } from "../config/brand";
import type { LianIconName } from "./icons/paths";
import LianIcon from "./icons/LianIcon.vue";

const props = defineProps<{
  visibility?: string;
  showIcon?: boolean;
}>();

function visibilityLabel(v?: string): string | null {
  const value = v?.trim();
  if (!value || value === "public") return null;
  return FEED_VISIBILITY_LABELS[value] || null;
}

function visibilityIcon(v?: string): LianIconName | null {
  const value = v?.trim();
  if (!value || value === "public") return null;
  return (FEED_VISIBILITY_ICONS[value] as LianIconName) || null;
}
</script>

<template>
  <span
    v-if="visibilityLabel(props.visibility)"
    class="visibility-badge"
    :aria-label="visibilityLabel(props.visibility) ?? undefined"
  >
    <LianIcon
      v-if="props.showIcon && visibilityIcon(props.visibility)"
      :name="visibilityIcon(props.visibility)!"
      :size="12"
      aria-hidden="true"
    />
    {{ visibilityLabel(props.visibility) }}
  </span>
</template>

<style scoped>
.visibility-badge {
  display: inline-flex;
  gap: 4px;
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
