<script setup lang="ts">
import {
  CHANNEL_FILTER_LABEL,
  CHANNEL_FILTER_MODE_VISIBILITY,
  CHANNEL_FILTER_MODE_CATEGORY,
  CHANNEL_FILTER_VISIBILITY_PUBLIC,
  CHANNEL_FILTER_VISIBILITY_CAMPUS,
  CHANNEL_FILTER_VISIBILITY_SCHOOL,
  CHANNEL_FILTER_VISIBILITY_PRIVATE,
  CHANNEL_FILTER_VISIBILITY_LINK_ONLY,
  MESSAGE_TAB_CHANNEL,
  MESSAGE_TAB_REPLIES,
  MESSAGE_TAB_SYSTEM,
  MESSAGE_TAB_ORDERS,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";

type FilterMode = "visibility" | "category";

const props = defineProps<{
  filterMode: FilterMode;
  selectedVisibilities: Set<AudienceVisibility>;
  selectedCategories: Set<string>;
}>();

const emit = defineEmits<{
  "update:filterMode": [value: FilterMode];
  "update:selectedVisibilities": [value: Set<AudienceVisibility>];
  "update:selectedCategories": [value: Set<string>];
}>();

interface VisibilityChip {
  value: AudienceVisibility;
  label: string;
}

interface CategoryChip {
  value: string;
  label: string;
}

const visibilityChips: readonly VisibilityChip[] = [
  { value: "public", label: CHANNEL_FILTER_VISIBILITY_PUBLIC },
  { value: "campus", label: CHANNEL_FILTER_VISIBILITY_CAMPUS },
  { value: "school", label: CHANNEL_FILTER_VISIBILITY_SCHOOL },
  { value: "private", label: CHANNEL_FILTER_VISIBILITY_PRIVATE },
  { value: "linkOnly", label: CHANNEL_FILTER_VISIBILITY_LINK_ONLY },
];

const categoryChips: readonly CategoryChip[] = [
  { value: "channel", label: MESSAGE_TAB_CHANNEL },
  { value: "reply", label: MESSAGE_TAB_REPLIES },
  { value: "system", label: MESSAGE_TAB_SYSTEM },
  { value: "order", label: MESSAGE_TAB_ORDERS },
];

function toggleVisibility(visibility: AudienceVisibility) {
  const next = new Set(props.selectedVisibilities);
  if (next.has(visibility)) {
    next.delete(visibility);
  } else {
    next.add(visibility);
  }
  emit("update:selectedVisibilities", next);
}

function toggleCategory(category: string) {
  const next = new Set(props.selectedCategories);
  if (next.has(category)) {
    next.delete(category);
  } else {
    next.add(category);
  }
  emit("update:selectedCategories", next);
}

function toggleMode() {
  emit("update:filterMode", props.filterMode === "visibility" ? "category" : "visibility");
}
</script>

<template>
  <div
    class="channel-filter-bar"
    :aria-label="CHANNEL_FILTER_LABEL"
    data-testid="channel-filter-bar"
  >
    <nav
      class="channel-filter-bar__chips"
      role="group"
      :aria-label="
        filterMode === 'visibility' ? CHANNEL_FILTER_MODE_VISIBILITY : CHANNEL_FILTER_MODE_CATEGORY
      "
    >
      <template v-if="filterMode === 'visibility'">
        <button
          v-for="chip in visibilityChips"
          :key="chip.value"
          type="button"
          class="channel-filter-bar__chip"
          :class="{ 'is-active': selectedVisibilities.has(chip.value) }"
          :aria-pressed="selectedVisibilities.has(chip.value)"
          :data-filter-value="chip.value"
          data-testid="channel-filter-chip"
          @click="toggleVisibility(chip.value)"
        >
          {{ chip.label }}
        </button>
      </template>
      <template v-else>
        <button
          v-for="chip in categoryChips"
          :key="chip.value"
          type="button"
          class="channel-filter-bar__chip"
          :class="{ 'is-active': selectedCategories.has(chip.value) }"
          :aria-pressed="selectedCategories.has(chip.value)"
          :data-filter-value="chip.value"
          data-testid="channel-filter-chip"
          @click="toggleCategory(chip.value)"
        >
          {{ chip.label }}
        </button>
      </template>
    </nav>

    <button
      type="button"
      class="channel-filter-bar__toggle"
      :aria-label="
        filterMode === 'visibility' ? CHANNEL_FILTER_MODE_CATEGORY : CHANNEL_FILTER_MODE_VISIBILITY
      "
      data-testid="channel-filter-mode-toggle"
      @click="toggleMode"
    >
      {{
        filterMode === "visibility" ? CHANNEL_FILTER_MODE_CATEGORY : CHANNEL_FILTER_MODE_VISIBILITY
      }}
    </button>
  </div>
</template>

<style scoped>
.channel-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.channel-filter-bar__chips {
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}

.channel-filter-bar__chips::-webkit-scrollbar {
  display: none;
}

.channel-filter-bar__chip {
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

.channel-filter-bar__chip:hover,
.channel-filter-bar__chip:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.channel-filter-bar__chip.is-active {
  background: var(--lian-primary, #1fa7a0);
  border-color: var(--lian-primary, #1fa7a0);
  color: #fff;
}

.channel-filter-bar__chip:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.channel-filter-bar__toggle {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.channel-filter-bar__toggle:hover,
.channel-filter-bar__toggle:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.channel-filter-bar__toggle:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}
</style>
