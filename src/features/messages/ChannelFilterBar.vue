<script setup lang="ts">
import { computed } from "vue";
import {
  CHANNEL_FILTER_LABEL,
  CHANNEL_FILTER_VISIBILITY_ALL,
  CHANNEL_FILTER_VISIBILITY_PUBLIC,
  CHANNEL_FILTER_VISIBILITY_CAMPUS,
  CHANNEL_FILTER_VISIBILITY_SCHOOL,
  CHANNEL_FILTER_VISIBILITY_PRIVATE,
  CHANNEL_FILTER_VISIBILITY_LINK_ONLY,
  CHANNEL_FILTER_EXPAND_CATEGORY,
  CHANNEL_FILTER_COLLAPSE_CATEGORY,
  MESSAGE_TAB_CHANNEL,
  MESSAGE_TAB_REPLIES,
  MESSAGE_TAB_SYSTEM,
  MESSAGE_TAB_ORDERS,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";
import type { MessageTabKey } from "../../types/messages";

/**
 * Filter bar state:
 * - "visibility" (State A): Shows visibility chips + [...] button
 * - "category" (State B): Shows category chips + [x] button
 */
export type FilterState = "visibility" | "category";

const props = defineProps<{
  /** Current filter state (A=visibility, B=category) */
  filterState: FilterState;
  /** Selected visibility filters */
  selectedVisibility: AudienceVisibility | "all";
  /** Current active tab/category */
  activeCategory: MessageTabKey;
  /** Whether user is a guest (limits visibility options) */
  isGuest: boolean;
}>();

const emit = defineEmits<{
  "update:filterState": [value: FilterState];
  "update:selectedVisibility": [value: AudienceVisibility | "all"];
  "update:activeCategory": [value: MessageTabKey];
}>();

interface VisibilityChip {
  value: AudienceVisibility | "all";
  label: string;
}

interface CategoryChip {
  value: MessageTabKey;
  label: string;
}

/** All visibility chips for logged-in users */
const allVisibilityChips: readonly VisibilityChip[] = [
  { value: "all", label: CHANNEL_FILTER_VISIBILITY_ALL },
  { value: "public", label: CHANNEL_FILTER_VISIBILITY_PUBLIC },
  { value: "campus", label: CHANNEL_FILTER_VISIBILITY_CAMPUS },
  { value: "school", label: CHANNEL_FILTER_VISIBILITY_SCHOOL },
  { value: "private", label: CHANNEL_FILTER_VISIBILITY_PRIVATE },
  { value: "linkOnly", label: CHANNEL_FILTER_VISIBILITY_LINK_ONLY },
];

/** Guest users only see public */
const guestVisibilityChips: readonly VisibilityChip[] = [
  { value: "public", label: CHANNEL_FILTER_VISIBILITY_PUBLIC },
];

const categoryChips: readonly CategoryChip[] = [
  { value: "channel", label: MESSAGE_TAB_CHANNEL },
  { value: "replies", label: MESSAGE_TAB_REPLIES },
  { value: "system", label: MESSAGE_TAB_SYSTEM },
  { value: "orders", label: MESSAGE_TAB_ORDERS },
];

const visibilityChips = computed(() => (props.isGuest ? guestVisibilityChips : allVisibilityChips));

/** Whether to show the toggle button (guests don't see it) */
const showToggleButton = computed(() => !props.isGuest);

/** Whether the toggle icon should be in "close" state */
const isCloseState = computed(() => props.filterState === "category");

function selectVisibility(visibility: AudienceVisibility | "all") {
  emit("update:selectedVisibility", visibility);
}

function selectCategory(category: MessageTabKey) {
  emit("update:activeCategory", category);
  // If selecting "channel", auto-switch back to visibility state (State A)
  if (category === "channel") {
    emit("update:filterState", "visibility");
  }
}

function toggleState() {
  if (props.filterState === "visibility") {
    // [...] clicked -> switch to category state (State B)
    emit("update:filterState", "category");
  } else {
    // [x] clicked -> switch back to visibility state (State A)
    emit("update:filterState", "visibility");
  }
}
</script>

<template>
  <div
    class="channel-filter-bar"
    :aria-label="CHANNEL_FILTER_LABEL"
    data-testid="channel-filter-bar"
  >
    <div class="channel-filter-bar__chips-container">
      <!-- State A: Visibility chips -->
      <Transition name="filter-slide-left">
        <nav
          v-if="filterState === 'visibility'"
          class="channel-filter-bar__chips"
          role="group"
          aria-label="可见范围筛选"
          data-testid="channel-filter-chips"
        >
          <button
            v-for="chip in visibilityChips"
            :key="chip.value"
            type="button"
            class="channel-filter-bar__chip"
            :class="{ 'is-active': selectedVisibility === chip.value }"
            :aria-pressed="selectedVisibility === chip.value"
            :data-filter-value="chip.value"
            data-testid="channel-filter-chip"
            @click="selectVisibility(chip.value)"
          >
            {{ chip.label }}
          </button>
        </nav>
      </Transition>

      <!-- State B: Category chips -->
      <Transition name="filter-slide-right">
        <nav
          v-if="filterState === 'category'"
          class="channel-filter-bar__chips"
          role="group"
          aria-label="分类筛选"
          data-testid="channel-filter-chips"
        >
          <button
            v-for="chip in categoryChips"
            :key="chip.value"
            type="button"
            class="channel-filter-bar__chip"
            :class="{
              'is-active': activeCategory === chip.value,
              'is-channel': chip.value === 'channel',
            }"
            :aria-pressed="activeCategory === chip.value"
            :data-filter-value="chip.value"
            data-testid="channel-filter-chip"
            @click="selectCategory(chip.value)"
          >
            {{ chip.label }}
          </button>
        </nav>
      </Transition>
    </div>

    <!-- Toggle button: [...] or [x] -->
    <button
      v-if="showToggleButton"
      type="button"
      class="channel-filter-bar__toggle"
      :class="{ 'is-close': isCloseState }"
      :aria-label="isCloseState ? CHANNEL_FILTER_COLLAPSE_CATEGORY : CHANNEL_FILTER_EXPAND_CATEGORY"
      data-testid="filter-state-toggle"
      @click="toggleState"
    >
      <svg
        class="channel-filter-bar__toggle-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <!-- Three dots that morph into X -->
        <template v-if="!isCloseState">
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
.channel-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
}

.channel-filter-bar__chips-container {
  position: relative;
  flex: 1;
  min-height: var(--floating-bar-button-height);
  overflow: hidden;
}

.channel-filter-bar__chips {
  display: flex;
  /* Center chips when they fit; fall back to start when scrolling kicks in. */
  justify-content: safe center;
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
    border-color var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
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

/* Special highlight for "channel" chip in category state */
.channel-filter-bar__chip.is-channel {
  font-weight: 900;
}

.channel-filter-bar__chip.is-channel.is-active {
  background: var(--lian-primary-deep, #087b78);
  border-color: var(--lian-primary-deep, #087b78);
}

.channel-filter-bar__chip:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.channel-filter-bar__toggle {
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

.channel-filter-bar__toggle:hover,
.channel-filter-bar__toggle:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.channel-filter-bar__toggle:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.channel-filter-bar__toggle-icon {
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.channel-filter-bar__toggle.is-close .channel-filter-bar__toggle-icon {
  transform: rotate(90deg);
}

/* ============================================
   Slide transitions (Apple-style spring)
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

/* State B -> State A: category slides right + fades out */
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
