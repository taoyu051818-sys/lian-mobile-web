<script setup lang="ts">
// Pure-presentation skeleton for the feed/publish card.
// Step A of PRD_POST_CREATION_REVOLUTION_V0.2 — feed and publish share this shell so
// the publish page (step G) can mount it without dragging FeedItem domain types or
// `useCardPointerInteraction` along with it. Therefore: only primitives in props,
// no domain/composables/api imports here.
//
// Event-binding strategy: attribute-fallthrough.
// The shell renders a single-root <article>, so pointer/keyboard listeners attached
// by the wrapper (`<FeedItemCardShell @pointerdown="…" @click="…" …>`) fall through
// to that <article> automatically. `event.currentTarget` resolves to the <article>
// element, which is what `useCardPointerInteraction` reads for `getBoundingClientRect`.
// Publish (step G) can mount this shell without registering any listeners.
import { computed, nextTick, ref, watch } from "vue";
import { FEED_COLLAPSE, FEED_EXPAND } from "../../config/brand";
import FeedItemCardFooter from "./FeedItemCardFooter.vue";
import FeedItemCardMedia from "./FeedItemCardMedia.vue";

type CardTemplate = "image" | "text" | "activity" | "place" | "merchant" | "help";

const props = defineProps<{
  title: string;
  coverUrl: string;
  primaryTag: string;
  timeLabel: string;
  authorName: string;
  authorAvatarUrl: string;
  authorInitial: string;
  cardTemplate: CardTemplate;
  templateMark: string;
  bodyPreview: string;
  cardWarning?: string;
  // Forwarded to FeedItemCardFooter — the footer remains the owner of like behavior
  // (issue #647 / V0.1 §7.1.2). Shell stays presentation-only by *forwarding*, not
  // *implementing*.
  tid: number;
  liked?: boolean;
  likeCount?: number;
}>();

const ariaLabel = computed(() => `${props.title}，${props.authorName}`);

// Body expand/collapse is purely visual — kept internal so no app state escapes.
const bodyExpanded = ref(false);
const needsBodyClamp = ref(false);
const bodyPreviewEl = ref<HTMLParagraphElement | null>(null);

function checkBodyClamp() {
  const el = bodyPreviewEl.value;
  if (!el) {
    needsBodyClamp.value = false;
    return;
  }
  needsBodyClamp.value = el.scrollHeight > el.clientHeight + 2;
}

function toggleBody() {
  bodyExpanded.value = !bodyExpanded.value;
  if (!bodyExpanded.value) nextTick(checkBodyClamp);
}

watch(
  () => props.tid,
  () => {
    bodyExpanded.value = false;
    nextTick(checkBodyClamp);
  },
);
</script>

<template>
  <article
    class="feed-item-card"
    :class="[`feed-item-card--${cardTemplate}`, { 'feed-item-card--with-cover': coverUrl }]"
    :data-card-warning="cardWarning"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
  >
    <FeedItemCardMedia
      :cover-url="coverUrl"
      :title="title"
      :primary-tag="primaryTag"
      :card-template="cardTemplate"
      :template-mark="templateMark"
    />

    <div class="feed-item-card__body">
      <span v-if="cardTemplate === 'text' && primaryTag" class="feed-item-card__inline-tag">{{
        primaryTag
      }}</span>

      <h3 :title="title">{{ title }}</h3>

      <template v-if="cardTemplate === 'text' && bodyPreview">
        <p
          ref="bodyPreviewEl"
          class="feed-item-card__body-preview"
          :class="{ 'is-expanded': bodyExpanded }"
        >
          {{ bodyPreview }}
        </p>
        <button
          v-if="needsBodyClamp || bodyExpanded"
          class="feed-item-card__body-toggle"
          type="button"
          @click.stop="toggleBody"
        >
          {{ bodyExpanded ? FEED_COLLAPSE : FEED_EXPAND }}
        </button>
      </template>

      <FeedItemCardFooter
        :tid="tid"
        :author-name="authorName"
        :author-avatar-url="authorAvatarUrl"
        :author-initial="authorInitial"
        :time-label="timeLabel"
        :liked="Boolean(liked)"
        :like-count="Math.max(0, Number(likeCount || 0))"
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
  transition:
    transform var(--motion-fast) var(--motion-ease-standard),
    box-shadow var(--motion-fast) var(--motion-ease-standard);
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
  background:
    radial-gradient(circle at top left, rgba(31, 167, 160, 0.12), transparent 42%),
    var(--lian-card-strong);
}

.feed-item-card--activity {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(255, 247, 237, 0.82)),
    var(--lian-card-strong);
}

.feed-item-card--place {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(236, 253, 245, 0.82)),
    var(--lian-card-strong);
}

.feed-item-card--merchant {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 251, 235, 0.86)),
    var(--lian-card-strong);
}

.feed-item-card--help {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(245, 243, 255, 0.82)),
    var(--lian-card-strong);
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
