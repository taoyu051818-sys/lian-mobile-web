<script setup lang="ts">
/**
 * Apple-style context menu for long press actions.
 *
 * Displays a floating menu with scale + fade animation when triggered.
 * Respects reduced motion preference by using instant transitions.
 *
 * Usage:
 * ```vue
 * <FeedContextMenu
 *   :visible="showMenu"
 *   :x="menuX"
 *   :y="menuY"
 *   @share="handleShare"
 *   @bookmark="handleBookmark"
 *   @report="handleReport"
 *   @close="showMenu = false"
 * />
 * ```
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useReducedMotion } from "../../composables/useReducedMotion";
import { useBodyScrollLock } from "../../composables/useBodyScrollLock";
import {
  GESTURE_CONTEXT_SHARE,
  GESTURE_CONTEXT_BOOKMARK,
  GESTURE_CONTEXT_UNBOOKMARK,
  GESTURE_CONTEXT_REPORT,
} from "../../config/brand";

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  bookmarked?: boolean;
  bookmarkBusy?: boolean;
  shareBusy?: boolean;
  requestPending?: boolean;
}>();

const emit = defineEmits<{
  share: [];
  bookmark: [];
  report: [];
  close: [];
}>();

const reduced = useReducedMotion();
const menuRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function clearHideTimer() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// Lock body scroll when menu is open
useBodyScrollLock(computed(() => props.visible));

// Delayed visibility for animation
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      clearHideTimer();
      isVisible.value = true;
    } else {
      // Delay hiding for exit animation (skip if reduced motion)
      if (reduced.value) {
        clearHideTimer();
        isVisible.value = false;
      } else {
        clearHideTimer();
        hideTimer = setTimeout(() => {
          hideTimer = null;
          isVisible.value = false;
        }, 160);
      }
    }
  },
);

const menuStyle = computed(() => {
  // Position menu near the touch point, but keep it on screen
  const padding = 16;
  const menuWidth = 180;
  const menuHeight = 160;

  let left = props.x - menuWidth / 2;
  let top = props.y - menuHeight - 20;

  // Keep on screen horizontally
  if (typeof window !== "undefined") {
    const maxLeft = window.innerWidth - menuWidth - padding;
    left = Math.max(padding, Math.min(left, maxLeft));

    // If menu would go above viewport, show below touch point
    if (top < padding) {
      top = props.y + 20;
    }

    // Keep on screen vertically
    const maxTop = window.innerHeight - menuHeight - padding;
    top = Math.max(padding, Math.min(top, maxTop));
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

function handleBackdropClick(event: MouseEvent | TouchEvent) {
  if (event.target === event.currentTarget) {
    emit("close");
  }
}

function handleShareAction() {
  emit("share");
  emit("close");
}

function handleBookmarkAction() {
  emit("bookmark");
  emit("close");
}

function handleReportAction() {
  emit("report");
  emit("close");
}

// Close on escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
  }
});

onBeforeUnmount(() => {
  clearHideTimer();
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="feed-context-menu__backdrop"
      :class="{
        'is-visible': visible,
        'feed-context-menu--reduced': reduced,
      }"
      role="presentation"
      @click="handleBackdropClick"
      @touchend.prevent="(e: TouchEvent) => handleBackdropClick(e)"
    >
      <div
        ref="menuRef"
        class="feed-context-menu"
        :class="{
          'is-visible': visible,
          'feed-context-menu--reduced': reduced,
        }"
        :style="menuStyle"
        role="menu"
        aria-label="操作菜单"
        :aria-busy="requestPending"
      >
        <button
          type="button"
          class="feed-context-menu__item"
          role="menuitem"
          :disabled="shareBusy"
          @click="handleShareAction"
        >
          <span class="feed-context-menu__icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </span>
          {{ GESTURE_CONTEXT_SHARE }}
        </button>

        <button
          type="button"
          class="feed-context-menu__item"
          :class="{ 'is-active': bookmarked }"
          :aria-pressed="bookmarked"
          role="menuitem"
          :disabled="bookmarkBusy"
          @click="handleBookmarkAction"
        >
          <span class="feed-context-menu__icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              :fill="bookmarked ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          {{ bookmarked ? GESTURE_CONTEXT_UNBOOKMARK : GESTURE_CONTEXT_BOOKMARK }}
        </button>

        <button
          type="button"
          class="feed-context-menu__item feed-context-menu__item--danger"
          role="menuitem"
          @click="handleReportAction"
        >
          <span class="feed-context-menu__icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </span>
          {{ GESTURE_CONTEXT_REPORT }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.feed-context-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet, 100);
  background: rgba(0, 0, 0, 0);
  transition: background var(--motion-fast, 160ms) var(--motion-ease-standard, ease);
}

.feed-context-menu__backdrop.is-visible {
  background: rgba(0, 0, 0, 0.2);
}

.feed-context-menu__backdrop.feed-context-menu--reduced {
  transition: none;
}

.feed-context-menu {
  position: fixed;
  z-index: calc(var(--z-sheet, 100) + 1);
  min-width: 180px;
  padding: var(--space-2, 8px);
  border-radius: var(--radius-panel, 20px);
  background: var(--glass-bg-strong, rgba(255, 255, 255, 0.92));
  box-shadow: var(--shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.12));
  backdrop-filter: blur(var(--glass-blur, 18px)) saturate(var(--glass-saturate, 1.28));
  -webkit-backdrop-filter: blur(var(--glass-blur, 18px)) saturate(var(--glass-saturate, 1.28));
  opacity: 0;
  transform: scale(0.9);
  transform-origin: center bottom;
  transition:
    opacity var(--motion-fast, 160ms) var(--motion-ease-standard, ease),
    transform var(--motion-fast, 160ms)
      var(--motion-ease-overshoot, cubic-bezier(0.76, 0.665, 0.37, 1.35));
}

.feed-context-menu.is-visible {
  opacity: 1;
  transform: scale(1);
}

.feed-context-menu.feed-context-menu--reduced {
  transition: none;
  transform: scale(1);
}

.feed-context-menu__item {
  display: flex;
  gap: var(--space-3, 12px);
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border: none;
  border-radius: var(--radius-button, 12px);
  background: transparent;
  color: var(--lian-ink, #1f2933);
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion-micro, 120ms) var(--motion-ease-standard, ease);
}

.feed-context-menu__item:hover,
.feed-context-menu__item:focus-visible {
  background: rgba(0, 0, 0, 0.05);
}

.feed-context-menu__item:active {
  background: rgba(0, 0, 0, 0.1);
}

.feed-context-menu__item:disabled {
  cursor: default;
  opacity: 0.55;
}

.feed-context-menu__item.is-active {
  color: var(--lian-primary, #1fa7a0);
}

.feed-context-menu__item--danger {
  color: var(--lian-danger, #ef4444);
}

.feed-context-menu__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

@media (prefers-reduced-motion: reduce) {
  .feed-context-menu__backdrop,
  .feed-context-menu,
  .feed-context-menu__item {
    transition: none;
  }

  .feed-context-menu {
    transform: scale(1);
  }
}
</style>
