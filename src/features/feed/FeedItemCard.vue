<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { DEFAULT_USER_LABEL, UNTITLED_CONTENT, FEED_PLACE_CAMPUS, FEED_TIME_JUST_NOW, FEED_COLLAPSE, FEED_EXPAND } from "../../config/brand";
import { actorAvatarText, actorAvatarUrl, actorDisplayName } from "../../domain/actor";
import type { FeedItem, FeedItemId, FeedPresentationIntent } from "../../types/feed";
import FeedItemCardFooter from "./FeedItemCardFooter.vue";
import { useCardPointerInteraction } from "./useCardPointerInteraction";

type CardTemplate = FeedPresentationIntent;

const MAX_VISIBLE_TITLE_CHARS = 42;
const MAX_VISIBLE_AUTHOR_CHARS = 10;

const props = defineProps<{ item: FeedItem }>();
const emit = defineEmits<{
  open: [id: FeedItemId, payload?: {
    item: FeedItem;
    rect: { top: number; left: number; width: number; height: number };
  }];
}>();

const CARD_TEMPLATES: ReadonlySet<CardTemplate> = new Set(["image", "text", "activity", "place", "merchant", "help"]);

function normalizePresentationIntent(value: FeedItem["cardTemplate"] | FeedItem["presentationIntent"]): CardTemplate | null {
  return typeof value === "string" && CARD_TEMPLATES.has(value as CardTemplate) ? value as CardTemplate : null;
}

const title = computed(() => props.item.title || UNTITLED_CONTENT);
const coverUrl = computed(() => props.item.cover || "");
const primaryTag = computed(() => props.item.primaryTag || "");
const placeLabel = computed(() => props.item.locationArea || FEED_PLACE_CAMPUS);
const timeLabel = computed(() => props.item.timeLabel || FEED_TIME_JUST_NOW);
const actor = computed(() => props.item.actor || {});
const authorName = computed(() => actorDisplayName(actor.value, DEFAULT_USER_LABEL));
const authorAvatarUrl = computed(() => actorAvatarUrl(actor.value));
const authorInitial = computed(() => actorAvatarText(actor.value, authorName.value));
const normalizedCardTemplate = computed(() => normalizePresentationIntent(props.item.cardTemplate));
const serverPresentationIntent = computed(() => normalizePresentationIntent(props.item.presentationIntent));
const cardWarning = computed(() => [
  title.value.length > MAX_VISIBLE_TITLE_CHARS ? "title-clamped" : "",
  authorName.value.length > MAX_VISIBLE_AUTHOR_CHARS ? "author-ellipsized" : "",
].filter(Boolean).join(" ") || undefined);

const cardTemplate = computed<CardTemplate>(() => {
  if (normalizedCardTemplate.value) return normalizedCardTemplate.value;
  if (serverPresentationIntent.value) return serverPresentationIntent.value;
  return coverUrl.value ? "image" : "text";
});

const templateMark = computed(() => ({
  image: "◐",
  text: "✎",
  activity: "◦",
  place: "⌖",
  merchant: "食",
  help: "＋",
})[cardTemplate.value]);

const bodyPreview = computed(() => props.item.bodyPreview || "");
const bodyExpanded = ref(false);
const needsBodyClamp = ref(false);
const bodyPreviewEl = ref<HTMLParagraphElement | null>(null);

function checkBodyClamp() {
  const el = bodyPreviewEl.value;
  if (!el) { needsBodyClamp.value = false; return; }
  needsBodyClamp.value = el.scrollHeight > el.clientHeight + 2;
}

function toggleBody() {
  bodyExpanded.value = !bodyExpanded.value;
  if (!bodyExpanded.value) nextTick(checkBodyClamp);
}

watch(() => props.item.tid, () => {
  bodyExpanded.value = false;
  nextTick(checkBodyClamp);
});

function emitOpen(target: HTMLElement | null) {
  const bounds = target?.getBoundingClientRect();
  emit("open", props.item.tid, bounds ? {
    item: props.item,
    rect: {
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
    },
  } : undefined);
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
  <article
    class="feed-item-card"
    :class="[`feed-item-card--${cardTemplate}`, { 'feed-item-card--with-cover': coverUrl }]"
    :data-card-warning="cardWarning"
    :data-motion-title="title"
    :data-motion-tag="primaryTag"
    :data-motion-time="timeLabel"
    :data-motion-author="authorName"
    :data-motion-place="placeLabel"
    role="button"
    tabindex="0"
    :aria-label="`${title}，${authorName}`"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @contextmenu="handleContextMenu"
    @click="openCard"
    @keydown.enter.prevent="openCardFromKeyboard"
    @keydown.space.prevent="openCardFromKeyboard"
  >
    <div v-if="cardTemplate !== 'text' || coverUrl" class="feed-item-card__media" data-motion-role="image-frame">
      <img v-if="coverUrl" class="feed-item-card__cover" :src="coverUrl" :alt="title" loading="lazy" data-motion-role="image" draggable="false" />
      <div v-else class="feed-item-card__placeholder" aria-hidden="true" data-motion-role="image-placeholder">
        <span>{{ templateMark }}</span>
      </div>
      <span v-if="primaryTag" class="feed-item-card__floating-tag" data-motion-role="tag">{{ primaryTag }}</span>
    </div>

    <div class="feed-item-card__body" data-motion-role="body">
      <span v-if="cardTemplate === 'text' && primaryTag" class="feed-item-card__inline-tag" data-motion-role="tag">{{ primaryTag }}</span>

      <h3 :title="title" data-motion-role="title">{{ title }}</h3>

      <template v-if="cardTemplate === 'text' && bodyPreview">
        <p
          ref="bodyPreviewEl"
          class="feed-item-card__body-preview"
          :class="{ 'is-expanded': bodyExpanded }"
        >{{ bodyPreview }}</p>
        <button
          v-if="needsBodyClamp || bodyExpanded"
          class="feed-item-card__body-toggle"
          type="button"
          @click.stop="toggleBody"
        >{{ bodyExpanded ? FEED_COLLAPSE : FEED_EXPAND }}</button>
      </template>

      <FeedItemCardFooter
        :tid="props.item.tid"
        :author-name="authorName"
        :author-avatar-url="authorAvatarUrl"
        :author-initial="authorInitial"
        :time-label="timeLabel"
        :liked="Boolean(props.item.liked)"
        :like-count="Math.max(0, Number(props.item.likeCount || 0))"
      />
    </div>
  </article>
</template>

<style scoped>
.feed-item-card {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.feed-item-card:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 3px;
}

.feed-item-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.feed-item-card--text {
  background: radial-gradient(circle at top left, rgba(31, 167, 160, 0.12), transparent 42%), var(--lian-card-strong);
}

.feed-item-card--activity {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(255, 247, 237, 0.82)), var(--lian-card-strong);
}

.feed-item-card--place {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(236, 253, 245, 0.82)), var(--lian-card-strong);
}

.feed-item-card--merchant {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 251, 235, 0.86)), var(--lian-card-strong);
}

.feed-item-card--help {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(245, 243, 255, 0.82)), var(--lian-card-strong);
}

.feed-item-card__media {
  position: relative;
  overflow: hidden;
}

.feed-item-card__cover,
.feed-item-card__placeholder {
  width: 100%;
  background: rgba(31, 41, 51, 0.06);
}

.feed-item-card__cover {
  display: block;
  aspect-ratio: 0.76;
  object-fit: cover;
  pointer-events: none;
  -webkit-user-drag: none;
}

.feed-item-card--activity .feed-item-card__cover,
.feed-item-card--merchant .feed-item-card__cover,
.feed-item-card--place .feed-item-card__cover {
  aspect-ratio: 0.92;
}

.feed-item-card__placeholder {
  display: grid;
  min-height: 116px;
  place-items: center;
  color: var(--lian-primary-deep);
}

.feed-item-card__placeholder span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.72);
  font-size: 18px;
  font-weight: 900;
}

.feed-item-card__floating-tag,
.feed-item-card__inline-tag {
  max-width: 100%;
  overflow: hidden;
  padding: 5px 8px;
  border-radius: var(--radius-chip);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item-card__floating-tag {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  max-width: calc(100% - var(--space-4));
  border: 1px solid rgba(255, 255, 255, 0.54);
  background: rgba(17, 24, 39, 0.64);
  color: #fff;
  backdrop-filter: blur(8px);
}

.feed-item-card__inline-tag {
  justify-self: start;
  border: 1px solid rgba(31, 41, 51, 0.08);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-primary-deep);
}

.feed-item-card__body {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
}

.feed-item-card--text .feed-item-card__body {
  padding-top: var(--space-4);
}

.feed-item-card h3 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 15px;
  line-height: 1.34;
}

.feed-item-card--text h3 {
  font-size: 16px;
  line-height: 1.42;
}

.feed-item-card__body-preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.feed-item-card__body-preview.is-expanded {
  display: block;
  -webkit-line-clamp: unset;
}

.feed-item-card__body-toggle {
  justify-self: start;
  padding: 0;
  border: none;
  background: none;
  color: var(--lian-primary-deep);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
</style>
