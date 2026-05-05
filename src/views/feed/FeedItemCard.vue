<script setup lang="ts">
import { computed } from "vue";
import { LocationChip, TypeChip } from "../../ui";
import type { FeedItem, FeedItemId } from "../../types/feed";

type TypeChipTone = "experience" | "discussion" | "hot" | "food" | "place" | "ai" | "official" | "trade" | "contribution" | "default";
type CardTemplate = "image" | "text" | "activity" | "place" | "merchant" | "help";

const props = defineProps<{
  item: FeedItem;
}>();

const emit = defineEmits<{
  open: [id: FeedItemId];
}>();

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
const timeLabel = computed(() => props.item.timeLabel || formatRelativeTime(props.item.timestampISO) || "刚刚");
const searchText = computed(() => `${props.item.contentType} ${primaryTag.value} ${title.value} ${placeLabel.value}`.toLowerCase());

const cardTemplate = computed<CardTemplate>(() => {
  const raw = searchText.value;
  if (raw.includes("报名") || raw.includes("活动") || raw.includes("社团") || raw.includes("opportunity") || raw.includes("activity")) return "activity";
  if (raw.includes("商家") || raw.includes("优惠") || raw.includes("店") || raw.includes("merchant") || raw.includes("trade")) return "merchant";
  if (raw.includes("食") || raw.includes("饭") || raw.includes("food")) return "merchant";
  if (raw.includes("互助") || raw.includes("求助") || raw.includes("组队") || raw.includes("help")) return "help";
  if (raw.includes("地点") || raw.includes("路线") || raw.includes("图书馆") || raw.includes("map") || raw.includes("place")) return "place";
  return coverUrl.value ? "image" : "text";
});

const templateLabel = computed(() => {
  const labels: Record<CardTemplate, string> = {
    image: "现场",
    text: "文字",
    activity: "活动",
    place: "地点",
    merchant: "商家",
    help: "互助",
  };
  return labels[cardTemplate.value];
});

const templateMark = computed(() => {
  const marks: Record<CardTemplate, string> = {
    image: "◐",
    text: "✎",
    activity: "◦",
    place: "⌖",
    merchant: "食",
    help: "＋",
  };
  return marks[cardTemplate.value];
});

const typeTone = computed<TypeChipTone>(() => {
  if (cardTemplate.value === "merchant") return "food";
  if (cardTemplate.value === "place") return "place";
  if (cardTemplate.value === "help") return "trade";
  if (cardTemplate.value === "activity") return "hot";
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
  if (cardTemplate.value !== "image" && cardTemplate.value !== "text") return templateLabel.value;
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

const titleClamp = computed(() => cardTemplate.value === "text" ? 4 : 2);
const showPlaceChip = computed(() => cardTemplate.value !== "text" || Boolean(props.item.locationArea));

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
    :class="[`feed-item-card--${cardTemplate}`, { 'feed-item-card--with-cover': coverUrl }]"
    role="button"
    tabindex="0"
    :aria-label="`${title}，${authorName}，${placeLabel}`"
    @click="openCard"
    @keydown.enter.prevent="openCard"
    @keydown.space.prevent="openCard"
  >
    <div v-if="cardTemplate !== 'text' || coverUrl" class="feed-item-card__media">
      <img v-if="coverUrl" class="feed-item-card__cover" :src="coverUrl" :alt="title" loading="lazy" />
      <div v-else class="feed-item-card__placeholder" aria-hidden="true">
        <span>{{ templateMark }}</span>
        <strong>{{ templateLabel }}</strong>
      </div>
      <span v-if="primaryTag" class="feed-item-card__floating-tag">{{ primaryTag }}</span>
    </div>

    <div class="feed-item-card__body">
      <div class="feed-item-card__chips" aria-label="内容状态">
        <TypeChip :type="typeTone">{{ typeLabel }}</TypeChip>
        <LocationChip v-if="showPlaceChip">{{ placeLabel }}</LocationChip>
      </div>

      <h3 :style="{ '--card-title-clamp': String(titleClamp) }">{{ title }}</h3>

      <p v-if="cardTemplate === 'activity'" class="feed-item-card__template-line">报名、时间或地点请进详情确认</p>
      <p v-else-if="cardTemplate === 'merchant'" class="feed-item-card__template-line">菜单、优惠或店铺信息以详情为准</p>
      <p v-else-if="cardTemplate === 'place'" class="feed-item-card__template-line">地点信息可进入详情查看</p>
      <p v-else-if="cardTemplate === 'help'" class="feed-item-card__template-line">互助信息请看详情再联系</p>

      <footer class="feed-item-card__author">
        <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorName" loading="lazy" />
        <span v-else class="feed-item-card__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
        <span class="feed-item-card__author-name">{{ authorName }}</span>
        <span class="feed-item-card__dot" aria-hidden="true">·</span>
        <span>{{ timeLabel }}</span>
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
  gap: var(--space-1);
  min-height: 116px;
  place-items: center;
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.feed-item-card__placeholder span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.72);
  font-size: 18px;
}

.feed-item-card__floating-tag {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  max-width: calc(100% - var(--space-4));
  overflow: hidden;
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: var(--radius-chip);
  background: rgba(17, 24, 39, 0.64);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(8px);
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

.feed-item-card__chips,
.feed-item-card__author {
  display: flex;
  min-width: 0;
  gap: var(--space-1);
  align-items: center;
}

.feed-item-card h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--lian-ink);
  font-size: 15px;
  line-height: 1.34;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--card-title-clamp, 2);
}

.feed-item-card--text h3 {
  font-size: 16px;
  line-height: 1.42;
}

.feed-item-card__template-line {
  display: -webkit-box;
  overflow: hidden;
  margin: -2px 0 0;
  color: var(--lian-muted);
  font-size: 11px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-item-card__author {
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
  max-width: 6.5em;
  color: var(--lian-ink);
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item-card__dot {
  color: var(--lian-faint);
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
