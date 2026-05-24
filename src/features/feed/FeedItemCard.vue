<script setup lang="ts">
/**
 * FeedItemCard - Feed item display component with interaction handling.
 *
 * Renders a feed item card with support for multiple presentation templates
 * (image, text, activity, place, merchant, help). Handles pointer interactions,
 * long-press context menus, and keyboard navigation. Delegates visual rendering
 * to FeedItemCardShell.
 *
 * @component
 * @example
 * ```vue
 * <FeedItemCard :item="feedItem" @open="handleOpen" />
 * ```
 *
 * @fires open - Emitted when the card is activated (click/keyboard)
 *   @param {FeedItemId} id - The topic ID of the opened item
 *   @param {Object} [payload] - Optional payload with item data and bounding rect
 *   @param {FeedItem} payload.item - The full feed item object
 *   @param {Object} payload.rect - Bounding rectangle for transition animations
 */
import { computed, ref } from "vue";
import {
  DEFAULT_USER_LABEL,
  UNTITLED_CONTENT,
  FEED_TIME_JUST_NOW,
  FEED_CARD_MARK_MERCHANT,
} from "../../config/brand";
import { actorAvatarText, actorAvatarUrl, actorDisplayName } from "../../domain/actor";
import type { FeedItem, FeedItemId, FeedItemShellCardTemplate } from "../../types/feed";
import FeedItemCardShell from "./FeedItemCardShell.vue";
import FeedContextMenu from "./FeedContextMenu.vue";
import { useCardPointerInteraction } from "./useCardPointerInteraction";
import { useLongPress } from "../../composables/useLongPress";
import { hapticMedium } from "../../composables/useHapticFeedback";

type CardTemplate = FeedItemShellCardTemplate;

const MAX_VISIBLE_TITLE_CHARS = 42;
const MAX_VISIBLE_AUTHOR_CHARS = 10;

const props = defineProps<{ item: FeedItem }>();
const emit = defineEmits<{
  open: [
    id: FeedItemId,
    payload?: {
      item: FeedItem;
      rect: { top: number; left: number; width: number; height: number };
    },
  ];
}>();

const CARD_TEMPLATES: ReadonlySet<CardTemplate> = new Set([
  "image",
  "text",
  "activity",
  "place",
  "merchant",
  "help",
]);

const TEMPLATE_MARKS: Readonly<Record<CardTemplate, string>> = {
  image: "◐",
  text: "✎",
  activity: "◦",
  place: "⌖",
  merchant: FEED_CARD_MARK_MERCHANT,
  help: "＋",
};

function normalizePresentationIntent(
  value: FeedItem["cardTemplate"] | FeedItem["presentationIntent"],
): CardTemplate | null {
  return typeof value === "string" && CARD_TEMPLATES.has(value as CardTemplate)
    ? (value as CardTemplate)
    : null;
}

// Performance: consolidate computed properties to reduce reactivity overhead.
// Instead of 13 separate computed properties that each trigger their own
// dependency tracking, derive all card display data in a single pass.
// This reduces Vue's reactivity bookkeeping and avoids redundant recalculations
// when multiple properties depend on the same source data (e.g., actor).
const cardDisplayData = computed(() => {
  const item = props.item;
  const actor = item.actor || {};
  const title = item.title || UNTITLED_CONTENT;
  const authorName = actorDisplayName(actor, DEFAULT_USER_LABEL);
  const coverUrl = item.cover || "";

  const normalizedTemplate = normalizePresentationIntent(item.cardTemplate);
  const serverIntent = normalizePresentationIntent(item.presentationIntent);
  const cardTemplate: CardTemplate =
    normalizedTemplate || serverIntent || (coverUrl ? "image" : "text");

  const warnings: string[] = [];
  if (title.length > MAX_VISIBLE_TITLE_CHARS) warnings.push("title-clamped");
  if (authorName.length > MAX_VISIBLE_AUTHOR_CHARS) warnings.push("author-ellipsized");

  return {
    title,
    coverUrl,
    primaryTag: item.primaryTag || "",
    timeLabel: item.timeLabel || FEED_TIME_JUST_NOW,
    authorName,
    authorAvatarUrl: actorAvatarUrl(actor),
    authorInitial: actorAvatarText(actor, authorName),
    cardTemplate,
    templateMark: TEMPLATE_MARKS[cardTemplate],
    bodyPreview: item.bodyPreview || "",
    visibility: item.visibility || "public",
    cardWarning: warnings.length ? warnings.join(" ") : undefined,
  };
});

// Context menu state for long press
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const isBookmarked = ref(false); // TODO: integrate with actual bookmark state

function emitOpen(target: HTMLElement | null) {
  const bounds = target?.getBoundingClientRect();
  emit(
    "open",
    props.item.tid,
    bounds
      ? {
          item: props.item,
          rect: {
            top: bounds.top,
            left: bounds.left,
            width: bounds.width,
            height: bounds.height,
          },
        }
      : undefined,
  );
}

const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleContextMenu,
  openCard,
  openCardFromKeyboard,
} = useCardPointerInteraction(emitOpen);

// Long press handling for context menu
function handleLongPress(event: TouchEvent | PointerEvent) {
  // Get touch/pointer position for menu placement
  if ("touches" in event && event.touches.length > 0) {
    contextMenuX.value = event.touches[0].clientX;
    contextMenuY.value = event.touches[0].clientY;
  } else if ("clientX" in event) {
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
  }
  showContextMenu.value = true;
}

function handleShare() {
  // TODO: Implement share functionality
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({
      title: cardDisplayData.value.title,
      url: `${window.location.origin}/#/post/${props.item.tid}`,
    }).catch(() => {
      // User cancelled or share failed
    });
  }
}

function handleBookmark() {
  // TODO: Integrate with actual bookmark API
  isBookmarked.value = !isBookmarked.value;
  hapticMedium();
}

function handleReport() {
  // TODO: Navigate to report flow
  // For now, just close the menu
}

function closeContextMenu() {
  showContextMenu.value = false;
}

// Override context menu to show our custom menu
function handleCustomContextMenu(event: MouseEvent) {
  handleContextMenu(event);
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  showContextMenu.value = true;
}
</script>

<template>
  <div class="feed-item-card-wrapper">
    <FeedItemCardShell
      :title="cardDisplayData.title"
      :cover-url="cardDisplayData.coverUrl"
      :primary-tag="cardDisplayData.primaryTag"
      :time-label="cardDisplayData.timeLabel"
      :author-name="cardDisplayData.authorName"
      :author-avatar-url="cardDisplayData.authorAvatarUrl"
      :author-initial="cardDisplayData.authorInitial"
      :card-template="cardDisplayData.cardTemplate"
      :template-mark="cardDisplayData.templateMark"
      :body-preview="cardDisplayData.bodyPreview"
      :card-warning="cardDisplayData.cardWarning"
      :tid="props.item.tid"
      :liked="Boolean(props.item.liked)"
      :like-count="Math.max(0, Number(props.item.likeCount || 0))"
      :visibility="cardDisplayData.visibility"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @contextmenu="handleCustomContextMenu"
      @click="openCard"
      @keydown.enter.prevent="openCardFromKeyboard"
      @keydown.space.prevent="openCardFromKeyboard"
    />

    <!-- Context menu for long press -->
    <FeedContextMenu
      :visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :bookmarked="isBookmarked"
      @share="handleShare"
      @bookmark="handleBookmark"
      @report="handleReport"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped>
.feed-item-card-wrapper {
  display: contents;
}
</style>
