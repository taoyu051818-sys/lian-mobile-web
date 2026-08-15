<script setup lang="ts">
import { computed } from "vue";
import {
  FEED_FILTER_BAR_LABEL,
  FEED_FILTER_VISIBILITY_ALL,
  FEED_FILTER_VISIBILITY_PUBLIC,
  FEED_FILTER_VISIBILITY_CAMPUS,
  FEED_FILTER_VISIBILITY_SCHOOL,
  FEED_FILTER_VISIBILITY_PRIVATE,
  FEED_FILTER_VISIBILITY_LINK_ONLY,
  FEED_FILTER_SHOW_TABS,
  FEED_FILTER_SHOW_VISIBILITY,
  FEED_FILTER_TABS_GROUP_LABEL,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";
import type { FeedTab } from "../../types/feed";

/**
 * Filter bar state (option C dual-state):
 * - "visibility" (State A): visibility chips + [...] toggle button
 * - "tabs" (State B): feed tab chips + [x] toggle button
 *
 * Mirrors ChannelFilterBar's visibility ↔ category pattern so the two
 * top-region filter bars share a consistent interaction language.
 */
export type FeedFilterState = "visibility" | "tabs";

const props = defineProps<{
  /** Current dual-state mode (visibility vs tabs). */
  filterState: FeedFilterState;
  /** Multi-select visibility filters (empty set === "all"). */
  selectedVisibilities: Set<AudienceVisibility>;
  /** Feed tabs (e.g. 此刻 / 精选). Single-select like the legacy chrome tabs. */
  tabs: readonly FeedTab[];
  /** Active feed tab id. */
  activeTabId: string;
}>();

const emit = defineEmits<{
  "update:filterState": [value: FeedFilterState];
  "update:selectedVisibilities": [value: Set<AudienceVisibility>];
  "update:activeTabId": [value: string];
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

function isVisibilitySelected(value: AudienceVisibility | "all"): boolean {
  if (value === "all") return isAllSelected();
  return props.selectedVisibilities.has(value);
}

const isTabsState = computed(() => props.filterState === "tabs");

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

function selectTab(tabId: string) {
  emit("update:activeTabId", tabId);
}

function toggleState() {
  emit("update:filterState", isTabsState.value ? "visibility" : "tabs");
}
</script>

<template>
  <div class="feed-filter-bar" :aria-label="FEED_FILTER_BAR_LABEL" data-testid="feed-filter-bar">
    <div class="feed-filter-bar__chips-container">
      <!-- State A: Visibility chips -->
      <Transition name="filter-slide-left">
        <nav
          v-if="filterState === 'visibility'"
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
            :class="{ 'is-active': isVisibilitySelected(chip.value) }"
            :aria-pressed="isVisibilitySelected(chip.value)"
            :data-filter-value="chip.value"
            data-testid="feed-filter-chip"
            @click="toggleVisibility(chip.value)"
          >
            {{ chip.label }}
          </button>
        </nav>
      </Transition>

      <!-- State B: Feed tab chips -->
      <Transition name="filter-slide-right">
        <nav
          v-if="filterState === 'tabs'"
          class="feed-filter-bar__chips"
          role="tablist"
          :aria-label="FEED_FILTER_TABS_GROUP_LABEL"
          data-testid="feed-filter-tabs"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="feed-filter-bar__chip feed-filter-bar__chip--tab"
            :class="{ 'is-active': activeTabId === tab.id }"
            :aria-selected="activeTabId === tab.id"
            :data-tab-value="tab.id"
            :data-testid="`feed-filter-tab-${tab.id}`"
            @click="selectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </Transition>
    </div>

    <!-- Toggle button: [...] (show tabs) or [x] (back to visibility) -->
    <button
      type="button"
      class="feed-filter-bar__toggle"
      :class="{ 'is-close': isTabsState }"
      :aria-label="isTabsState ? FEED_FILTER_SHOW_VISIBILITY : FEED_FILTER_SHOW_TABS"
      data-testid="feed-filter-toggle"
      @click="toggleState"
    >
      <svg
        class="feed-filter-bar__toggle-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <template v-if="!isTabsState">
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
  width: 100%;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
}

/* Wrapper is required by the dual-state Transition, not decoration:
   `position: relative` anchors the absolutely-positioned nav during the
   A<->B slide (both navs coexist mid-transition), and `overflow: hidden`
   clips the translateX(±100%) slide so chips never bleed past the bar.
   It also reserves a stable `--floating-bar-button-height` track so the
   bar height does not jump between the visibility and tabs states. */
.feed-filter-bar__chips-container {
  position: relative;
  flex: 1;
  min-height: var(--floating-bar-button-height);
  overflow: hidden;
  /* Center the 32px nav inside the 40px track. Block layout pinned it to
     the top, leaving 8px dead space below and reading 4px higher than the
     toggle button sitting beside it in the same bar. */
  display: flex;
  align-items: center;
}

.feed-filter-bar__chips {
  display: flex;
  /* Fill the track width as the old block child did, while `min-width: 0`
     keeps the chip row shrinkable so overflow-x can scroll instead of
     stretching the container. */
  flex: 1;
  min-width: 0;
  /* Center chips when they fit; fall back to start when scrolling kicks in. */
  justify-content: safe center;
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

/* Tab chip when active uses the deeper ink fill from the legacy
   shell-chrome__tab styling so the dual-state read remains "tab-like". */
.feed-filter-bar__chip--tab.is-active {
  background: var(--lian-ink);
  border-color: var(--lian-ink);
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
   Mirrors ChannelFilterBar so both dual-state
   bars share the same interaction language.
   ============================================ */

/* State A -> State B: visibility slides left + fades out */
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

/* State B -> State A: tabs slide right + fade out */
.filter-slide-right-enter-active,
.filter-slide-right-leave-active {
  transition:
    transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  position: absolute;
  /* `bottom: 0` alongside `top: 0` stretches the out-of-flow nav to the full
     track height so its own `align-items: center` keeps the chips centered
     mid-slide. With `top: 0` alone it collapsed to 32px at the top edge and
     the chips visibly jumped up during the transition. */
  top: 0;
  bottom: 0;
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

@media (prefers-reduced-motion: reduce) {
  .feed-filter-bar__chip,
  .feed-filter-bar__toggle,
  .feed-filter-bar__toggle-icon {
    transition: none;
  }
  .filter-slide-left-enter-active,
  .filter-slide-left-leave-active,
  .filter-slide-right-enter-active,
  .filter-slide-right-leave-active {
    transition: none;
  }
}
</style>
