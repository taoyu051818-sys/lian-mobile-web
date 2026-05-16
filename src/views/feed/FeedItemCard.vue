<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { togglePostLike } from "../../api/posts";
import { DEFAULT_USER_LABEL, UNTITLED_CONTENT, FEED_PLACE_CAMPUS, FEED_TIME_JUST_NOW, FEED_LIKE, FEED_UNLIKE, FEED_COLLAPSE, FEED_EXPAND } from "../../config/brand";
import { actorAvatarText, actorAvatarUrl, actorDisplayName } from "../../domain/actor";
import type { FeedItem, FeedItemId, FeedPresentationIntent } from "../../types/feed";

type CardTemplate = FeedPresentationIntent;

const MAX_VISIBLE_TITLE_CHARS = 42;
const MAX_VISIBLE_AUTHOR_CHARS = 10;
const CARD_CLICK_MAX_DURATION_MS = 360;
const CARD_CLICK_MOVE_TOLERANCE_PX = 8;

const props = defineProps<{ item: FeedItem }>();
const emit = defineEmits<{
  open: [id: FeedItemId, payload?: {
    item: FeedItem;
    rect: { top: number; left: number; width: number; height: number };
  }];
}>();

const liked = ref(false);
const likeCount = ref(0);
const likeBusy = ref(false);
const pointerDownAt = ref(0);
const pointerDownX = ref(0);
const pointerDownY = ref(0);
const pointerMoved = ref(false);
const pointerWasLongPress = ref(false);
const pointerCandidateId = ref<number | null>(null);
let longPressTimer = 0;

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

const likeLabel = computed(() => `${liked.value ? FEED_UNLIKE : FEED_LIKE}，当前 ${likeCount.value} 个喜欢`);

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

watch(() => props.item, (item) => {
  liked.value = Boolean(item.liked);
  likeCount.value = Math.max(0, Number(item.likeCount || 0));
}, { immediate: true });

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

function isControlTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select, [data-card-control]"));
}

function clearLongPressTimer() {
  if (!longPressTimer || typeof window === "undefined") return;
  window.clearTimeout(longPressTimer);
  longPressTimer = 0;
}

function startLongPressTimer(pointerId: number) {
  clearLongPressTimer();
  if (typeof window === "undefined") return;
  longPressTimer = window.setTimeout(() => {
    if (pointerCandidateId.value === pointerId) {
      pointerWasLongPress.value = true;
    }
    longPressTimer = 0;
  }, CARD_CLICK_MAX_DURATION_MS);
}

function resetPointerIntent() {
  clearLongPressTimer();
  pointerCandidateId.value = null;
  pointerDownAt.value = 0;
  pointerDownX.value = 0;
  pointerDownY.value = 0;
  pointerMoved.value = false;
  pointerWasLongPress.value = false;
}

function handlePointerDown(event: PointerEvent) {
  if (isControlTarget(event.target)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  pointerCandidateId.value = event.pointerId;
  pointerDownAt.value = performance.now();
  pointerDownX.value = event.clientX;
  pointerDownY.value = event.clientY;
  pointerMoved.value = false;
  pointerWasLongPress.value = false;
  startLongPressTimer(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (pointerCandidateId.value !== event.pointerId) return;
  const deltaX = Math.abs(event.clientX - pointerDownX.value);
  const deltaY = Math.abs(event.clientY - pointerDownY.value);
  if (deltaX > CARD_CLICK_MOVE_TOLERANCE_PX || deltaY > CARD_CLICK_MOVE_TOLERANCE_PX) {
    pointerMoved.value = true;
    clearLongPressTimer();
  }
}

function handlePointerUp(event: PointerEvent) {
  if (pointerCandidateId.value !== event.pointerId) return;
  clearLongPressTimer();
  pointerWasLongPress.value = performance.now() - pointerDownAt.value > CARD_CLICK_MAX_DURATION_MS;
}

function handlePointerCancel(event: PointerEvent) {
  if (pointerCandidateId.value === event.pointerId) resetPointerIntent();
}

function handleContextMenu(event: MouseEvent) {
  if (isControlTarget(event.target)) return;
  pointerWasLongPress.value = true;
  clearLongPressTimer();
  event.preventDefault();
}

function openCard(event?: MouseEvent) {
  if (isControlTarget(event?.target || null)) return;
  const shouldSuppress = pointerMoved.value || pointerWasLongPress.value;
  const target = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  resetPointerIntent();
  if (shouldSuppress) return;
  emitOpen(target);
}

function openCardFromKeyboard(event: KeyboardEvent) {
  if (isControlTarget(event.target)) return;
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  resetPointerIntent();
  emitOpen(target);
}

async function handleLike() {
  if (likeBusy.value) return;
  const previousLiked = liked.value;
  const previousCount = likeCount.value;
  const nextLiked = !previousLiked;
  liked.value = nextLiked;
  likeCount.value = Math.max(0, previousCount + (nextLiked ? 1 : -1));
  likeBusy.value = true;
  try {
    const response = await togglePostLike(props.item.tid, nextLiked);
    liked.value = Boolean(response.liked);
    likeCount.value = Math.max(0, Number(response.likeCount || 0));
  } catch {
    liked.value = previousLiked;
    likeCount.value = previousCount;
  } finally {
    likeBusy.value = false;
  }
}

onBeforeUnmount(() => {
  clearLongPressTimer();
});
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

      <footer class="feed-item-card__footer" data-motion-role="meta-row">
        <div class="feed-item-card__author" data-motion-role="author">
          <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorName" loading="lazy" data-motion-role="avatar" draggable="false" />
          <span v-else class="feed-item-card__avatar-text" aria-hidden="true" data-motion-role="avatar">{{ authorInitial }}</span>
          <span class="feed-item-card__author-name" :title="authorName">{{ authorName }}</span>
        </div>

        <span class="feed-item-card__motion-time" data-motion-role="time" aria-hidden="true">{{ timeLabel }}</span>

        <button
          class="feed-item-card__like"
          :class="{ 'is-liked': liked }"
          type="button"
          :aria-label="likeLabel"
          :aria-pressed="liked"
          :disabled="likeBusy"
          data-card-control="like"
          data-motion-role="like"
          @click.stop="handleLike"
          @pointerdown.stop
          @pointerup.stop
          @keydown.enter.stop
          @keydown.space.stop
        >
          <span aria-hidden="true">{{ liked ? "♥" : "♡" }}</span>
          <span>{{ likeCount }}</span>
        </button>
      </footer>
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

.feed-item-card__footer {
  display: flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.feed-item-card__author {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  max-width: calc(100% - 50px);
  gap: var(--space-1);
  align-items: center;
  color: var(--lian-muted);
  font-size: 11px;
  line-height: 1.2;
}

.feed-item-card__author img,
.feed-item-card__avatar-text {
  display: grid;
  width: 20px;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border-radius: var(--radius-orb);
  object-fit: cover;
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
  font-size: 10px;
  font-weight: 900;
}

.feed-item-card__author img {
  pointer-events: none;
  -webkit-user-drag: none;
}

.feed-item-card__author-name {
  overflow: hidden;
  min-width: 0;
  max-width: min(10ch, 100%);
  color: var(--lian-ink);
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item-card__motion-time {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  color: var(--lian-muted);
  font-size: 11px;
  white-space: nowrap;
}

.feed-item-card__like {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.feed-item-card__like.is-liked {
  background: rgba(255, 236, 236, 0.82);
  color: #c2410c;
}

.feed-item-card__like:disabled {
  opacity: 0.64;
}
</style>
