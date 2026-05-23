<script setup lang="ts">
import { computed } from "vue";
import {
  DEFAULT_USER_LABEL,
  UNTITLED_CONTENT,
  FEED_TIME_JUST_NOW,
  FEED_CARD_MARK_MERCHANT,
} from "../../config/brand";
import { actorAvatarText, actorAvatarUrl, actorDisplayName } from "../../domain/actor";
import type { FeedItem, FeedItemId, FeedItemShellCardTemplate } from "../../types/feed";
import FeedItemCardShell from "./FeedItemCardShell.vue";
import { useCardPointerInteraction } from "./useCardPointerInteraction";

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

function normalizePresentationIntent(
  value: FeedItem["cardTemplate"] | FeedItem["presentationIntent"],
): CardTemplate | null {
  return typeof value === "string" && CARD_TEMPLATES.has(value as CardTemplate)
    ? (value as CardTemplate)
    : null;
}

const title = computed(() => props.item.title || UNTITLED_CONTENT);
const coverUrl = computed(() => props.item.cover || "");
const primaryTag = computed(() => props.item.primaryTag || "");
const timeLabel = computed(() => props.item.timeLabel || FEED_TIME_JUST_NOW);
const actor = computed(() => props.item.actor || {});
const authorName = computed(() => actorDisplayName(actor.value, DEFAULT_USER_LABEL));
const authorAvatarUrl = computed(() => actorAvatarUrl(actor.value));
const authorInitial = computed(() => actorAvatarText(actor.value, authorName.value));
const normalizedCardTemplate = computed(() => normalizePresentationIntent(props.item.cardTemplate));
const serverPresentationIntent = computed(() =>
  normalizePresentationIntent(props.item.presentationIntent),
);
const cardWarning = computed(
  () =>
    [
      title.value.length > MAX_VISIBLE_TITLE_CHARS ? "title-clamped" : "",
      authorName.value.length > MAX_VISIBLE_AUTHOR_CHARS ? "author-ellipsized" : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined,
);

const cardTemplate = computed<CardTemplate>(() => {
  if (normalizedCardTemplate.value) return normalizedCardTemplate.value;
  if (serverPresentationIntent.value) return serverPresentationIntent.value;
  return coverUrl.value ? "image" : "text";
});

const templateMark = computed(
  () =>
    ({
      image: "◐",
      text: "✎",
      activity: "◦",
      place: "⌖",
      merchant: FEED_CARD_MARK_MERCHANT,
      help: "＋",
    })[cardTemplate.value],
);

const bodyPreview = computed(() => props.item.bodyPreview || "");

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
</script>

<template>
  <FeedItemCardShell
    :title="title"
    :cover-url="coverUrl"
    :primary-tag="primaryTag"
    :time-label="timeLabel"
    :author-name="authorName"
    :author-avatar-url="authorAvatarUrl"
    :author-initial="authorInitial"
    :card-template="cardTemplate"
    :template-mark="templateMark"
    :body-preview="bodyPreview"
    :card-warning="cardWarning"
    :tid="props.item.tid"
    :liked="Boolean(props.item.liked)"
    :like-count="Math.max(0, Number(props.item.likeCount || 0))"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @contextmenu="handleContextMenu"
    @click="openCard"
    @keydown.enter.prevent="openCardFromKeyboard"
    @keydown.space.prevent="openCardFromKeyboard"
  />
</template>
