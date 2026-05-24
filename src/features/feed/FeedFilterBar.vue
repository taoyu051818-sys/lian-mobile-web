<script setup lang="ts">
import {
  FEED_FILTER_BAR_LABEL,
  FEED_FILTER_VISIBILITY_ALL,
  FEED_FILTER_VISIBILITY_PUBLIC,
  FEED_FILTER_VISIBILITY_CAMPUS,
  FEED_FILTER_VISIBILITY_SCHOOL,
  FEED_FILTER_VISIBILITY_PRIVATE,
  FEED_FILTER_VISIBILITY_LINK_ONLY,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";

const props = defineProps<{
  selectedVisibilities: Set<AudienceVisibility>;
}>();

const emit = defineEmits<{
  "update:selectedVisibilities": [value: Set<AudienceVisibility>];
}>();

interface VisibilityChip {
  value: AudienceVisibility | "all";
  label: string;
}

const visibilityChips: readonly VisibilityChip[] = [
  { value: "all", label: FEED_FILTER_VISIBILITY_ALL },
  { value: "public", label: FEED_FILTER_VISIBILITY_PUBLIC },
  { value: "campus", label: FEED_FILTER_VISIBILITY_CAMPUS },
  { value: "school", label: FEED_FILTER_VISIBILITY_SCHOOL },
  { value: "private", label: FEED_FILTER_VISIBILITY_PRIVATE },
  { value: "linkOnly", label: FEED_FILTER_VISIBILITY_LINK_ONLY },
];

function isAllSelected(): boolean {
  return props.selectedVisibilities.size === 0;
}

function isSelected(value: AudienceVisibility | "all"): boolean {
  if (value === "all") return isAllSelected();
  return props.selectedVisibilities.has(value);
}

function toggleVisibility(value: AudienceVisibility | "all") {
  if (value === "all") {
    // Clear all selections to show all
    emit("update:selectedVisibilities", new Set());
    return;
  }

  const next = new Set(props.selectedVisibilities);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  emit("update:selectedVisibilities", next);
}
</script>

<template>
  <div
    class="feed-filter-bar"
    :aria-label="FEED_FILTER_BAR_LABEL"
    data-testid="feed-filter-bar"
  >
    <nav
      class="feed-filter-bar__chips"
      role="group"
      :aria-label="FEED_FILTER_BAR_LABEL"
    >
      <button
        v-for="chip in visibilityChips"
        :key="chip.value"
        type="button"
        class="feed-filter-bar__chip"
        :class="{ 'is-active': isSelected(chip.value) }"
        :aria-pressed="isSelected(chip.value)"
        :data-filter-value="chip.value"
        data-testid="feed-filter-chip"
        @click="toggleVisibility(chip.value)"
      >
        {{ chip.label }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.feed-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.feed-filter-bar__chips {
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}

.feed-filter-bar__chips::-webkit-scrollbar {
  display: none;
}

.feed-filter-bar__chip {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.feed-filter-bar__chip:hover,
.feed-filter-bar__chip:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.feed-filter-bar__chip.is-active {
  background: var(--lian-primary, #1fa7a0);
  border-color: var(--lian-primary, #1fa7a0);
  color: #fff;
}

.feed-filter-bar__chip:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}
</style>
