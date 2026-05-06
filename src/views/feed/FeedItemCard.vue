<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { togglePostLike } from "../../api/posts";
import type { FeedItem, FeedItemId } from "../../types/feed";

type CardTemplate = "image" | "text" | "activity" | "place" | "merchant" | "help";

const MAX_VISIBLE_TITLE_CHARS = 42;
const MAX_VISIBLE_AUTHOR_CHARS = 10;

const props = defineProps<{ item: FeedItem }>();
const emit = defineEmits<{ open: [id: FeedItemId] }>();

const liked = ref(false);
const likeCount = ref(0);
const likeBusy = ref(false);

const title = computed(() => props.item.title || "未命名内容");
const coverUrl = computed(() => props.item.cover || "");
const primaryTag = computed(() => props.item.primaryTag || "");
const placeLabel = computed(() => props.item.locationArea || "校园");
const author = computed(() => props.item.author || {
  nodebbUid: 0,
  displayName: "同学",
  avatarUrl: "",
  identityTag: "",
  source: "fallback",
});
const authorName = computed(() => author.value.displayName || "同学");
const authorAvatarUrl = computed(() => author.value.avatarUrl || "");
const authorInitial = computed(() => authorName.value.slice(0, 1) || "同");
const searchText = computed(() => `${props.item.contentType} ${primaryTag.value} ${title.value} ${placeLabel.value}`.toLowerCase());
const cardWarning = computed(() => [
  title.value.length > MAX_VISIBLE_TITLE_CHARS ? "title-clamped" : "",
  authorName.value.length > MAX_VISIBLE_AUTHOR_CHARS ? "author-ellipsized" : "",
].filter(Boolean).join(" ") || undefined);

const cardTemplate = computed<CardTemplate>(() => {
  const raw = searchText.value;
  if (raw.includes("报名") || raw.includes("活动") || raw.includes("社团") || raw.includes("opportunity") || raw.includes("activity")) return "activity";
  if (raw.includes("商家") || raw.includes("优惠") || raw.includes("店") || raw.includes("merchant") || raw.includes("trade")) return "merchant";
  if (raw.includes("食") || raw.includes("饭") || raw.includes("food")) return "merchant";
  if (raw.includes("互助") || raw.includes("求助") || raw.includes("组队") || raw.includes("help")) return "help";
  if (raw.includes("地点") || raw.includes("路线") || raw.includes("图书馆") || raw.includes("map") || raw.includes("place")) return "place";
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

const likeLabel = computed(() => `${liked.value ? "取消喜欢" : "喜欢"}，当前 ${likeCount.value} 个喜欢`);

watch(() => props.item, (item) => {
  liked.value = Boolean(item.liked);
  likeCount.value = Math.max(0, Number(item.likeCount || 0));
}, { immediate: true });

function openCard() {
  emit("open", props.item.tid);
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
</script>

<template>
  <article
    class="feed-item-card"
    :class="[`feed-item-card--${cardTemplate}`, { 'feed-item-card--with-cover': coverUrl }]"
    :data-card-warning="cardWarning"
    role="button"
    tabindex="0"
    :aria-label="`${title}，${authorName}`"
    @click="openCard"
    @keydown.enter.prevent="openCard"
    @keydown.space.prevent="openCard"
  >
    <div v-if="cardTemplate !== 'text' || coverUrl" class="feed-item-card__media">
      <img v-if="coverUrl" class="feed-item-card__cover" :src="coverUrl" :alt="title" loading="lazy" />
      <div v-else class="feed-item-card__placeholder" aria-hidden="true">
        <span>{{ templateMark }}</span>
      </div>
      <span v-if="primaryTag" class="feed-item-card__floating-tag">{{ primaryTag }}</span>
    </div>

    <div class="feed-item-card__body">
      <span v-if="cardTemplate === 'text' && primaryTag" class="feed-item-card__inline-tag">{{ primaryTag }}</span>

      <h3 :title="title">{{ title }}</h3>

      <footer class="feed-item-card__footer">
        <div class="feed-item-card__author">
          <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorName" loading="lazy" />
          <span v-else class="feed-item-card__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
          <span class="feed-item-card__author-name" :title="authorName">{{ authorName }}</span>
        </div>

        <button
          class="feed-item-card__like"
          :class="{ 'is-liked': liked }"
          type="button"
          :aria-label="likeLabel"
          :aria-pressed="liked"
          :disabled="likeBusy"
          @click.stop="handleLike"
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
  display: -webkit-box;
  overflow: hidden;
  min-height: calc(15px * 1.34 * 2);
  margin: 0;
  color: var(--lian-ink);
  font-size: 15px;
  line-height: 1.34;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-item-card--text h3 {
  min-height: calc(16px * 1.42 * 2);
  font-size: 16px;
  line-height: 1.42;
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

.feed-item-card__author-name {
  overflow: hidden;
  min-width: 0;
  max-width: min(10ch, 100%);
  color: var(--lian-ink);
  font-weight: 850;
  text-overflow: ellipsis;
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

@media (prefers-reduced-motion: reduce) {
  .feed-item-card {
    transition: none;
  }

  .feed-item-card:hover {
    transform: none;
  }
}
</style>
