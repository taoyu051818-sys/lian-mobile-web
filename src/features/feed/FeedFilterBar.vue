<script setup lang="ts">
import { ref, computed } from "vue";
import {
  FEED_FILTER_BAR_LABEL,
  FEED_FILTER_VISIBILITY_ALL,
  FEED_FILTER_VISIBILITY_PUBLIC,
  FEED_FILTER_VISIBILITY_CAMPUS,
  FEED_FILTER_VISIBILITY_SCHOOL,
  FEED_FILTER_VISIBILITY_PRIVATE,
  FEED_FILTER_VISIBILITY_LINK_ONLY,
  FEED_FILTER_EXPAND,
  FEED_FILTER_COLLAPSE,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";

const props = defineProps<{
  selectedVisibilities: Set<AudienceVisibility>;
}>();

const emit = defineEmits<{
  "update:selectedVisibilities": [value: Set<AudienceVisibility>];
}>();

const expanded = ref(false);

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

/** Summary label for collapsed state */
const collapsedLabel = computed(() => {
  if (isAllSelected()) return FEED_FILTER_VISIBILITY_ALL;
  const selected = visibilityChips
    .filter(
      (chip) =>
        chip.value !== "all" && props.selectedVisibilities.has(chip.value as AudienceVisibility),
    )
    .map((chip) => chip.label);
  return selected.length ? selected.join("、") : FEED_FILTER_VISIBILITY_ALL;
});

function toggleVisibility(value: AudienceVisibility | "all") {
  if (value === "all") {
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

function toggleExpanded() {
  expanded.value = !expanded.value;
}
</script>

<template>
  <div class="feed-filter-bar" :aria-label="FEED_FILTER_BAR_LABEL" data-testid="feed-filter-bar">
    <div class="feed-filter-bar__chips-container">
      <!-- Collapsed state: show summary chip -->
      <Transition name="filter-slide-left">
        <div
          v-if="!expanded"
          class="feed-filter-bar__collapsed"
          data-testid="feed-filter-collapsed"
        >
          <button
            type="button"
            class="feed-filter-bar__chip is-active"
            :aria-label="collapsedLabel"
            data-testid="feed-filter-summary"
            @click="toggleExpanded"
          >
            {{ collapsedLabel }}
          </button>
        </div>
      </Transition>

      <!-- Expanded state: show all visibility chips -->
      <Transition name="filter-slide-right">
        <nav
          v-if="expanded"
          class="feed-filter-bar__chips"
          role="group"
          :aria-label="FEED_FILTER_BAR_LABEL"
          data-testid="feed-filter-chips"
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
      </Transition>
    </div>

    <!-- Toggle button: [...] or [x] -->
    <button
      type="button"
      class="feed-filter-bar__toggle"
      :class="{ 'is-close': expanded }"
      :aria-label="expanded ? FEED_FILTER_COLLAPSE : FEED_FILTER_EXPAND"
      data-testid="feed-filter-toggle"
      @click="toggleExpanded"
    >
      <svg
        class="feed-filter-bar__toggle-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <template v-if="!expanded">
          <!-- Ellipsis dots -->
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
        </template>
        <template v-else>
          <!-- X icon -->
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </template>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.feed-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.feed-filter-bar__chips-container {
  position: relative;
  flex: 1;
  min-height: 32px;
  overflow: hidden;
}

.feed-filter-bar__collapsed {
  display: flex;
  align-items: center;
}

.feed-filter-bar__chips {
  display: flex;
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
    border-color var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
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

.feed-filter-bar__toggle {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--lian-muted);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.feed-filter-bar__toggle:hover,
.feed-filter-bar__toggle:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.feed-filter-bar__toggle:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.feed-filter-bar__toggle-icon {
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.feed-filter-bar__toggle.is-close .feed-filter-bar__toggle-icon {
  transform: rotate(90deg);
}

/* ============================================
   Slide transitions (Apple-style spring)
   ============================================ */

/* Collapsed -> Expanded: collapsed slides left + fades out */
.filter-slide-left-enter-active,
.filter-slide-left-leave-active {
  transition:
    transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.filter-slide-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.filter-slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Expanded -> Collapsed: chips slide right + fade out */
.filter-slide-right-enter-active,
.filter-slide-right-leave-active {
  transition:
    transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.filter-slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.filter-slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
