<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { reportPost, sendPostReply, togglePostLike, togglePostSave } from "../../api/posts";
import { GlassPanel, IdentityBadge, InlineError, LianButton, LocationChip, TypeChip } from "../../ui";
import type { PostDetail } from "../../types/post";

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

const reportCategories = [
  { value: "privacy", label: "隐私问题" },
  { value: "false_info", label: "虚假信息" },
  { value: "abuse", label: "违规内容" },
  { value: "wrong_location", label: "位置错误" },
  { value: "expired", label: "过期内容" },
  { value: "other", label: "其他" },
];

const liked = ref(false);
const saved = ref(false);
const likeCount = ref(0);
const likeBusy = ref(false);
const saveBusy = ref(false);
const reportBusy = ref(false);
const replyBusy = ref(false);
const actionError = ref("");
const actionMessage = ref("");
const reportCategory = ref(reportCategories[reportCategories.length - 1].value);
const replyContent = ref("");

const postId = computed(() => props.post?.tid ?? null);
const title = computed(() => props.post?.title || "帖子详情");
const authorLabel = computed(() => props.post?.author || "同学");
const identityMeta = computed(() => props.post?.authorIdentityTag || "校园身份");
const placeLabel = computed(() => props.post?.locationArea || "校园");
const bodyHtml = computed(() => props.post?.contentHtml || "");
const replies = computed(() => props.post?.replies || []);
const images = computed(() => {
  const urls = [props.post?.cover || "", ...(props.post?.imageUrls || [])].filter(Boolean);
  return Array.from(new Set(urls)).slice(0, 8);
});

const typeTone = computed<TypeTone>(() => {
  const raw = String(props.post?.contentType || "").toLowerCase();
  if (raw.includes("food") || raw.includes("食") || raw.includes("饭")) return "food";
  if (raw.includes("place") || raw.includes("map") || raw.includes("地点")) return "place";
  if (raw.includes("ai")) return "ai";
  if (raw.includes("official") || raw.includes("官方")) return "official";
  if (raw.includes("trade") || raw.includes("二手")) return "trade";
  if (raw.includes("discussion") || raw.includes("问") || raw.includes("讨论")) return "discussion";
  return "experience";
});

const typeLabel = computed(() => {
  const labels: Record<TypeTone, string> = {
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

const statLine = computed(() => `${formatRelativeTime(props.post?.timestampISO || "") || props.post?.timeLabel || "刚刚"} · ${replies.value.length} 回复 · ${likeCount.value} 喜欢`);

watch(() => props.post, (post) => {
  liked.value = Boolean(post?.liked);
  saved.value = Boolean(post?.bookmarked);
  likeCount.value = Math.max(0, Number(post?.likeCount || 0));
  actionError.value = "";
  actionMessage.value = "";
  replyContent.value = "";
}, { immediate: true });

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

function showActionMessage(message: string) {
  actionError.value = "";
  actionMessage.value = message;
}

function showActionError(error: unknown, fallback: string) {
  actionMessage.value = "";
  actionError.value = error instanceof Error ? error.message : fallback;
}

async function handleLike() {
  if (postId.value == null || likeBusy.value) return;
  const previousLiked = liked.value;
  const previousCount = likeCount.value;
  const nextLiked = !previousLiked;
  liked.value = nextLiked;
  likeCount.value = Math.max(0, previousCount + (nextLiked ? 1 : -1));
  likeBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    const response = await togglePostLike(postId.value, nextLiked);
    liked.value = Boolean(response.liked);
    likeCount.value = Math.max(0, Number(response.likeCount || 0));
    showActionMessage(liked.value ? "已喜欢" : "已取消喜欢");
  } catch (error) {
    liked.value = previousLiked;
    likeCount.value = previousCount;
    showActionError(error, "喜欢操作没有成功，可以稍后再试。");
  } finally {
    likeBusy.value = false;
  }
}

async function handleSave() {
  if (postId.value == null || saveBusy.value) return;
  const previousSaved = saved.value;
  const nextSaved = !previousSaved;
  saved.value = nextSaved;
  saveBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    const response = await togglePostSave(postId.value, nextSaved);
    saved.value = Boolean(response.saved);
    showActionMessage(saved.value ? "已收藏" : "已取消收藏");
  } catch (error) {
    saved.value = previousSaved;
    showActionError(error, "收藏操作没有成功，可以稍后再试。");
  } finally {
    saveBusy.value = false;
  }
}

async function handleReport() {
  if (postId.value == null || reportBusy.value) return;
  const category = reportCategories.find((item) => item.value === reportCategory.value) || reportCategories[reportCategories.length - 1];
  reportBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await reportPost(postId.value, { category: category.value, reason: category.label });
    showActionMessage("举报已提交，感谢反馈。");
  } catch (error) {
    showActionError(error, "举报没有提交成功，可以稍后再试。");
  } finally {
    reportBusy.value = false;
  }
}

async function submitReply() {
  if (postId.value == null || replyBusy.value) return;
  const content = replyContent.value.trim();
  if (!content) {
    actionError.value = "请先填写回复内容。";
    return;
  }
  replyBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await sendPostReply(postId.value, content);
    replyContent.value = "";
    showActionMessage("回复已发送，正在刷新详情。");
    emit("retry");
  } catch (error) {
    showActionError(error, "回复没有发送成功，可以稍后再试。");
  } finally {
    replyBusy.value = false;
  }
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
      </div>

      <section v-if="images.length" class="post-detail-panel__gallery" aria-label="图片">
        <img v-for="url in images" :key="url" :src="url" :alt="title" loading="lazy" />
      </section>

      <section class="post-detail-panel__body">
        <div v-if="bodyHtml" class="lian-html" v-html="bodyHtml"></div>
        <p v-else>暂无正文</p>
      </section>

      <footer class="post-detail-panel__meta">
        <IdentityBadge :avatar-text="authorLabel.slice(0, 2)" :label="authorLabel" :meta="identityMeta" />
        <span>{{ statLine }}</span>
      </footer>

      <section class="post-detail-panel__actions" aria-label="帖子操作">
        <LianButton size="sm" variant="ghost" :loading="likeBusy" @click="handleLike">
          {{ liked ? "♥ 已喜欢" : "♡ 喜欢" }} · {{ likeCount }}
        </LianButton>
        <LianButton size="sm" variant="ghost" :loading="saveBusy" @click="handleSave">
          {{ saved ? "★ 已收藏" : "☆ 收藏" }}
        </LianButton>
        <div class="post-detail-panel__report">
          <label>
            <span>举报原因</span>
            <select v-model="reportCategory" :disabled="reportBusy">
              <option v-for="category in reportCategories" :key="category.value" :value="category.value">
                {{ category.label }}
              </option>
            </select>
          </label>
          <LianButton size="sm" variant="ghost" :loading="reportBusy" @click="handleReport">举报</LianButton>
        </div>
      </section>

      <InlineError v-if="actionError">{{ actionError }}</InlineError>
      <p v-if="actionMessage" class="post-detail-panel__success">{{ actionMessage }}</p>

      <section class="post-detail-panel__replies" aria-labelledby="post-detail-replies-title">
        <div class="post-detail-panel__section-title">
          <h3 id="post-detail-replies-title">回复</h3>
          <span>{{ replies.length ? `${replies.length} 条` : "暂无" }}</span>
        </div>
        <article v-for="reply in replies" :key="String(reply.id)" class="post-detail-panel__reply">
          <div class="post-detail-panel__reply-meta">
            <strong>{{ reply.author || "同学" }}</strong>
            <span>{{ formatRelativeTime(reply.timestampISO) }}</span>
          </div>
          <div v-if="reply.content" class="lian-html" v-html="reply.content"></div>
          <p v-else>这条回复暂时没有内容。</p>
        </article>
        <p v-if="!replies.length" class="post-detail-panel__empty">还没有回复，来写第一条。</p>

        <form class="post-detail-panel__reply-form" @submit.prevent="submitReply">
          <label>
            <span>写回复</span>
            <textarea v-model="replyContent" rows="3" maxlength="2000" placeholder="写一条回复" />
          </label>
          <LianButton type="submit" size="sm" :loading="replyBusy" :disabled="!replyContent.trim()">发送回复</LianButton>
        </form>
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
.post-detail-panel__reply,
.post-detail-panel__reply-form {
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

.post-detail-panel__report {
  display: flex;
  flex: 1 1 240px;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: end;
  justify-content: flex-end;
}

.post-detail-panel__report label,
.post-detail-panel__reply-form label {
  display: grid;
  flex: 1 1 160px;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-panel__report select,
.post-detail-panel__reply-form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.post-detail-panel__report select {
  min-height: 36px;
  padding: 0 var(--space-2);
}

.post-detail-panel__reply-form textarea {
  min-height: 92px;
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.post-detail-panel__success {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
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

.post-detail-panel__reply,
.post-detail-panel__reply-form {
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
