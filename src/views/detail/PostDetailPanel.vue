<script setup lang="ts">
import { computed } from "vue";
import { GlassPanel, IdentityBadge, InlineError, LianButton, LocationChip, TrustBadge, TypeChip } from "../../ui";
import type { PostDetail } from "../../types/post";

type TrustTone = "confirmed" | "pending" | "disputed" | "expired" | "ai" | "official";
type TypeTone = "experience" | "discussion" | "hot" | "food" | "place" | "ai" | "official" | "trade" | "contribution" | "default";

const props = withDefaults(defineProps<{
  post: PostDetail | null;
  loading?: boolean;
  error?: string;
}>(), {
  loading: false,
  error: "",
});

const emit = defineEmits<{
  close: [];
  retry: [];
}>();

const title = computed(() => props.post?.title || "帖子详情");
const authorLabel = computed(() => props.post?.author || "同学");
const avatarText = computed(() => props.post?.authorAvatarText || authorLabel.value.slice(0, 2) || "同");
const identityMeta = computed(() => props.post?.authorIdentityTag || props.post?.contributionTag || "校园身份");
const placeLabel = computed(() => props.post?.placeName || props.post?.locationName || "校园");
const bodyHtml = computed(() => props.post?.contentHtml || "");
const plainBody = computed(() => props.post?.content || props.post?.summary || stripHtml(bodyHtml.value) || "暂无正文");
const replies = computed(() => Array.isArray(props.post?.replies) ? props.post?.replies || [] : []);

const images = computed(() => {
  const urls: string[] = [];
  if (props.post?.cover) urls.push(props.post.cover);
  if (props.post?.imageUrl) urls.push(props.post.imageUrl);
  if (bodyHtml.value && typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = bodyHtml.value;
    container.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src) urls.push(src);
    });
  }
  return Array.from(new Set(urls)).slice(0, 8);
});

const typeTone = computed<TypeTone>(() => {
  const raw = String(props.post?.type || props.post?.tag || "").toLowerCase();
  if (raw.includes("食") || raw.includes("food")) return "food";
  if (raw.includes("地点") || raw.includes("place")) return "place";
  if (raw.includes("ai")) return "ai";
  if (raw.includes("official") || raw.includes("官方")) return "official";
  if (raw.includes("trade") || raw.includes("二手")) return "trade";
  if (raw.includes("问") || raw.includes("discussion")) return "discussion";
  return "experience";
});

const typeLabel = computed(() => props.post?.tag || "校园内容");

const trustTone = computed<TrustTone>(() => {
  if (props.post?.expired) return "expired";
  if (props.post?.aiGenerated) return "ai";
  if (props.post?.confirmed) return "confirmed";
  return "pending";
});

const trustLabel = computed(() => {
  if (props.post?.expired) return "已过期";
  if (props.post?.aiGenerated) return "AI辅助";
  if (props.post?.confirmed) return "已确认";
  return "待确认";
});

const statLine = computed(() => {
  const likes = Number(props.post?.likeCount || 0);
  const replyCount = replies.value.length || Number(props.post?.replyCount || props.post?.commentCount || 0);
  return `${formatRelativeTime(props.post?.timestampISO) || props.post?.timeLabel || "刚刚"} · ${replyCount} 回复 · ${likes} 喜欢`;
});

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
</script>

<template>
  <GlassPanel class="post-detail-panel" as="aside" aria-labelledby="post-detail-title">
    <header class="post-detail-panel__header">
      <div class="post-detail-panel__title">
        <TypeChip :type="typeTone">{{ typeLabel }}</TypeChip>
        <h2 id="post-detail-title">{{ title }}</h2>
      </div>
      <button class="post-detail-panel__close" type="button" aria-label="关闭详情" @click="emit('close')">×</button>
    </header>

    <div v-if="loading" class="post-detail-panel__state" role="status">
      正在加载详情…
    </div>

    <InlineError v-else-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">重新加载</button>
    </InlineError>

    <template v-else-if="post">
      <div class="post-detail-panel__chips">
        <LocationChip>{{ placeLabel }}</LocationChip>
        <TrustBadge :tone="trustTone">{{ trustLabel }}</TrustBadge>
      </div>

      <section v-if="images.length" class="post-detail-panel__gallery" aria-label="图片">
        <img v-for="url in images" :key="url" :src="url" :alt="title" loading="lazy" />
      </section>

      <section class="post-detail-panel__body">
        <div v-if="bodyHtml" class="lian-html" v-html="bodyHtml"></div>
        <p v-else>{{ plainBody }}</p>
      </section>

      <footer class="post-detail-panel__meta">
        <IdentityBadge :avatar-text="avatarText" :label="authorLabel" :meta="identityMeta" />
        <span>{{ statLine }}</span>
      </footer>

      <section class="post-detail-panel__actions" aria-label="帖子操作">
        <LianButton size="sm" variant="ghost" disabled>喜欢稍后迁移</LianButton>
        <LianButton size="sm" variant="ghost" disabled>收藏稍后迁移</LianButton>
        <LianButton size="sm" variant="ghost" disabled>举报稍后迁移</LianButton>
      </section>

      <section class="post-detail-panel__replies" aria-labelledby="post-detail-replies-title">
        <div class="post-detail-panel__section-title">
          <h3 id="post-detail-replies-title">回复</h3>
          <span>{{ replies.length ? `${replies.length} 条` : "暂无" }}</span>
        </div>
        <article v-for="reply in replies" :key="String(reply.id || reply.timestampISO || reply.content || reply.contentHtml)" class="post-detail-panel__reply">
          <div class="post-detail-panel__reply-meta">
            <strong>{{ reply.username || "同学" }}</strong>
            <span>{{ formatRelativeTime(reply.timestampISO) }}</span>
          </div>
          <div v-if="reply.contentHtml" class="lian-html" v-html="reply.contentHtml"></div>
          <p v-else>{{ reply.content || "这条回复暂时没有内容。" }}</p>
        </article>
        <p v-if="!replies.length" class="post-detail-panel__empty">还没有回复，回复功能稍后迁移。</p>
      </section>
    </template>
  </GlassPanel>
</template>

<style scoped>
.post-detail-panel {
  display: grid;
  gap: var(--space-4);
}

.post-detail-panel__header,
.post-detail-panel__chips,
.post-detail-panel__actions,
.post-detail-panel__section-title,
.post-detail-panel__reply-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-detail-panel__title {
  display: grid;
  gap: var(--space-2);
}

.post-detail-panel h2,
.post-detail-panel h3,
.post-detail-panel p {
  margin: 0;
}

.post-detail-panel h2 {
  font-size: 20px;
  line-height: 1.32;
}

.post-detail-panel__close {
  display: grid;
  width: 42px;
  height: 42px;
  min-width: 42px;
  place-items: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.68);
  color: var(--lian-ink);
  font-size: 24px;
  line-height: 1;
}

.post-detail-panel__state,
.post-detail-panel__empty {
  color: var(--lian-muted);
  text-align: center;
}

.post-detail-panel__gallery {
  display: grid;
  grid-auto-columns: minmax(220px, 82%);
  grid-auto-flow: column;
  gap: var(--space-3);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.post-detail-panel__gallery img {
  width: 100%;
  max-height: 360px;
  border-radius: var(--radius-card);
  object-fit: cover;
  scroll-snap-align: start;
}

.post-detail-panel__body,
.post-detail-panel__reply {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-ink);
  line-height: 1.68;
}

.post-detail-panel__body p,
.post-detail-panel__reply p {
  color: var(--lian-muted);
}

.post-detail-panel__meta {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
}

.post-detail-panel__replies {
  display: grid;
  gap: var(--space-3);
}

.post-detail-panel__section-title span,
.post-detail-panel__reply-meta span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-detail-panel__reply {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.46);
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}

:deep(.lian-html) {
  color: var(--lian-ink);
  line-height: 1.68;
}

:deep(.lian-html img) {
  max-width: 100%;
  border-radius: var(--radius-card);
}
</style>
