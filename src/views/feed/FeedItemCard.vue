<script setup lang="ts">
import { computed } from "vue";
import { LocationChip, TypeChip } from "../../ui";
import type { FeedItem, FeedItemId } from "../../types/feed";

type TypeChipTone = "experience" | "discussion" | "hot" | "food" | "place" | "ai" | "official" | "trade" | "contribution" | "default";

const props = defineProps<{
  item: FeedItem;
}>();

const emit = defineEmits<{
  open: [id: FeedItemId];
}>();

const title = computed(() => props.item.title || "未命名内容");
const coverUrl = computed(() => props.item.cover || "");
const placeLabel = computed(() => props.item.locationArea || "校园");
const authorLabel = computed(() => props.item.author || "同学");
const identityMeta = computed(() => props.item.authorIdentityTag || "校园身份");
const timeLabel = computed(() => props.item.timeLabel || formatRelativeTime(props.item.timestampISO) || "刚刚");
const summary = computed(() => props.item.bodyPreview.trim());

const typeTone = computed<TypeChipTone>(() => {
  const raw = props.item.contentType.toLowerCase();
  if (raw.includes("food") || raw.includes("食") || raw.includes("饭")) return "food";
  if (raw.includes("place") || raw.includes("map") || raw.includes("地点")) return "place";
  if (raw.includes("ai")) return "ai";
  if (raw.includes("official") || raw.includes("官方")) return "official";
  if (raw.includes("trade") || raw.includes("二手")) return "trade";
  if (raw.includes("hot") || raw.includes("热")) return "hot";
  if (raw.includes("discussion") || raw.includes("问") || raw.includes("讨论")) return "discussion";
  return "experience";
});

const typeLabel = computed(() => {
  const labels: Record<TypeChipTone, string> = {
    experience: "经验",
    discussion: "讨论",
    hot: "热帖",
    food: "饭堂",
    place: "地点",
    ai: "AI整理",
    official: "官方",
    trade: "互助",
    contribution: "贡献",
    default: "内容",
  };
  return labels[typeTone.value] || "内容";
});

const metaLine = computed(() => `${timeLabel.value} · ${props.item.likeCount} 喜欢`);
const sourceLine = computed(() => `${authorLabel.value} · ${identityMeta.value}`);

function formatRelativeTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 172_800_000) return "昨天";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function openCard() {
  emit("open", props.item.tid);
}
</script>

<template>
  <article
    class="feed-item-card"
    :class="{ 'feed-item-card--with-cover': coverUrl }"
    role="button"
    tabindex="0"
    :aria-label="`${title}，${placeLabel}`"
    @click="openCard"
    @keydown.enter.prevent="openCard"
    @keydown.space.prevent="openCard"
  >
    <img v-if="coverUrl" class="feed-item-card__cover" :src="coverUrl" :alt="title" loading="lazy" />
    <div v-else class="feed-item-card__placeholder" aria-hidden="true">{{ typeLabel }}</div>

    <div class="feed-item-card__body">
      <div class="feed-item-card__chips" aria-label="内容状态">
        <TypeChip :type="typeTone">{{ typeLabel }}</TypeChip>
        <LocationChip>{{ placeLabel }}</LocationChip>
      </div>

      <h3>{{ title }}</h3>
      <p v-if="summary">{{ summary }}</p>

      <div class="feed-item-card__meta">
        <span>{{ sourceLine }}</span>
        <span>{{ metaLine }}</span>
      </div>
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

.feed-item-card__cover,
.feed-item-card__placeholder {
  width: 100%;
  background: rgba(31, 41, 51, 0.06);
}

.feed-item-card__cover {
  aspect-ratio: 0.76;
  object-fit: cover;
}

.feed-item-card__placeholder {
  display: grid;
  min-height: 132px;
  place-items: center;
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.feed-item-card__body {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
}

.feed-item-card__chips,
.feed-item-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.feed-item-card h3,
.feed-item-card p {
  margin: 0;
}

.feed-item-card h3 {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-ink);
  font-size: 15px;
  line-height: 1.34;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-item-card p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.46;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.feed-item-card__meta {
  color: var(--lian-muted);
  font-size: 11px;
  line-height: 1.35;
}

.feed-item-card__meta span + span::before {
  color: var(--lian-faint);
  content: "·";
  margin-right: var(--space-1);
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
