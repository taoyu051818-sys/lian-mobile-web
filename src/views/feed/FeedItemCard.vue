<script setup lang="ts">
import { computed } from "vue";
import { LocationChip, TagChip, TrustBadge, TypeChip } from "../../ui";
import type { FeedItem, FeedItemId } from "../../types/feed";

type TypeChipTone = "experience" | "discussion" | "hot" | "food" | "place" | "ai" | "official" | "trade" | "contribution" | "default";
type TrustTone = "confirmed" | "pending" | "disputed" | "expired" | "ai" | "official";

const props = defineProps<{
  item: FeedItem;
}>();

const emit = defineEmits<{
  open: [id: FeedItemId];
}>();

const title = computed(() => props.item.title || "未命名内容");
const coverUrl = computed(() => props.item.cover || props.item.imageUrl || "");
const placeLabel = computed(() => props.item.placeName || props.item.locationName || "校园");
const authorLabel = computed(() => props.item.author || "同学");
const identityMeta = computed(() => props.item.authorIdentityTag || props.item.contributionTag || "校园身份");
const timeLabel = computed(() => props.item.timeLabel || formatRelativeTime(props.item.timestampISO) || "刚刚");
const tags = computed(() => {
  const rawTags = Array.isArray(props.item.tags) ? props.item.tags : [];
  const merged = [props.item.tag, ...rawTags]
    .filter(Boolean)
    .map((tag) => String(tag))
    .filter((tag) => tag !== typeLabel.value);
  return Array.from(new Set(merged)).slice(0, 2);
});

const summary = computed(() => {
  const value = props.item.summary || props.item.content || stripHtml(props.item.contentHtml || "");
  return value.trim();
});

const typeTone = computed<TypeChipTone>(() => {
  const raw = String(props.item.type || props.item.tag || "").toLowerCase();
  if (raw.includes("食") || raw.includes("food") || raw.includes("饭堂")) return "food";
  if (raw.includes("地图") || raw.includes("地点") || raw.includes("place") || raw.includes("附近")) return "place";
  if (raw.includes("ai")) return "ai";
  if (raw.includes("official") || raw.includes("官方")) return "official";
  if (raw.includes("trade") || raw.includes("二手")) return "trade";
  if (raw.includes("hot") || raw.includes("热")) return "hot";
  if (raw.includes("问") || raw.includes("discussion") || raw.includes("讨论")) return "discussion";
  return "experience";
});

const typeLabel = computed(() => {
  if (props.item.tag) return props.item.tag;
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

const trustTone = computed<TrustTone>(() => {
  if (props.item.expired) return "expired";
  if (props.item.aiGenerated) return "ai";
  if (props.item.confirmed) return "confirmed";
  return "pending";
});

const trustLabel = computed(() => {
  if (props.item.expired) return "已过期";
  if (props.item.aiGenerated) return "AI辅助";
  if (props.item.confirmed) return "已确认";
  return "待确认";
});

const shouldShowTrust = computed(() => trustTone.value !== "pending");

const metaLine = computed(() => {
  const replies = Number(props.item.replyCount ?? props.item.commentCount ?? 0);
  const likes = Number(props.item.likeCount ?? 0);
  return `${timeLabel.value} · ${replies} 回复${likes ? ` · ${likes} 喜欢` : ""}`;
});

const sourceLine = computed(() => `${authorLabel.value} · ${identityMeta.value}`);

function stripHtml(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent || container.innerText || "";
}

function formatRelativeTime(value?: string) {
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
    :aria-label="`${title}，${placeLabel}，${trustLabel}`"
    @click="openCard"
    @keydown.enter.prevent="openCard"
    @keydown.space.prevent="openCard"
  >
    <img v-if="coverUrl" class="feed-item-card__cover" :src="coverUrl" :alt="title" loading="lazy" />

    <div class="feed-item-card__body">
      <div class="feed-item-card__chips" aria-label="内容状态">
        <TypeChip :type="typeTone">{{ typeLabel }}</TypeChip>
        <LocationChip>{{ placeLabel }}</LocationChip>
        <TrustBadge v-if="shouldShowTrust" :tone="trustTone">{{ trustLabel }}</TrustBadge>
      </div>

      <h3>{{ title }}</h3>
      <p v-if="summary">{{ summary }}</p>

      <div class="feed-item-card__meta">
        <span>{{ sourceLine }}</span>
        <span>{{ metaLine }}</span>
      </div>

      <div v-if="tags.length" class="feed-item-card__tags" aria-label="标签">
        <TagChip v-for="tag in tags" :key="tag" :tag="tag" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.feed-item-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  overflow: hidden;
  padding: var(--space-3);
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

.feed-item-card__cover {
  width: 100%;
  aspect-ratio: 1.78;
  border-radius: calc(var(--radius-card) - 4px);
  object-fit: cover;
  background: rgba(31, 41, 51, 0.06);
}

.feed-item-card__body {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.feed-item-card__chips,
.feed-item-card__tags,
.feed-item-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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
  font-size: 16px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-item-card p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-muted);
  font-size: 14px;
  line-height: 1.48;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-item-card__meta {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.35;
}

.feed-item-card__meta span + span::before {
  color: var(--lian-faint);
  content: "·";
  margin-right: var(--space-2);
}

.feed-item-card__tags {
  gap: var(--space-1);
}

@media (min-width: 560px) {
  .feed-item-card--with-cover {
    grid-template-columns: 156px 1fr;
    align-items: stretch;
  }

  .feed-item-card__cover {
    height: 100%;
    min-height: 126px;
    aspect-ratio: auto;
  }
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
