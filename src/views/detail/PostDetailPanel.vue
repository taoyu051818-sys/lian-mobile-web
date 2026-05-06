<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { reportPost, sendPostReply, togglePostLike, togglePostSave } from "../../api/posts";
import { InlineError, LianButton } from "../../ui";
import type { PostDetail } from "../../types/post";

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
const reportOpen = ref(false);
const replyBusy = ref(false);
const replyExpanded = ref(false);
const fullscreenImage = ref("");
const actionError = ref("");
const actionMessage = ref("");
const reportCategory = ref(reportCategories[reportCategories.length - 1].value);
const replyContent = ref("");

const postId = computed(() => props.post?.tid ?? null);
const title = computed(() => props.post?.title || "帖子详情");
const authorLabel = computed(() => props.post?.author || "同学");
const authorAvatarUrl = computed(() => props.post?.authorAvatarUrl || "");
const authorInitial = computed(() => authorLabel.value.slice(0, 1) || "同");
const placeLabel = computed(() => props.post?.locationArea || "");
const primaryTag = computed(() => normalizePostTag(props.post?.primaryTag || ""));
const rawBodyHtml = computed(() => props.post?.contentHtml || "");
const bodyHtml = computed(() => stripDecorativeContentFromHtml(rawBodyHtml.value));
const replies = computed(() => props.post?.replies || []);
const images = computed(() => {
  const urls = [props.post?.cover || "", ...(props.post?.imageUrls || [])].filter(Boolean);
  return Array.from(new Set(urls)).slice(0, 8);
});
const timeLabel = computed(() => formatRelativeTime(props.post?.timestampISO || "") || props.post?.timeLabel || "刚刚");
const replyIdentityLabel = computed(() => `以当前身份回复`);

watch(() => props.post, (post) => {
  liked.value = Boolean(post?.liked);
  saved.value = Boolean(post?.bookmarked);
  likeCount.value = Math.max(0, Number(post?.likeCount || 0));
  actionError.value = "";
  actionMessage.value = "";
  reportOpen.value = false;
  replyExpanded.value = false;
  replyContent.value = "";
  fullscreenImage.value = "";
}, { immediate: true });

function normalizePostTag(value: string) {
  const text = String(value || "").trim().replace(/^#+/, "");
  return text ? `#${text}` : "";
}

function stripDecorativeContentFromHtml(value: string) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<p>\s*<strong>\s*#+[^<]+\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<p>\s*#+[^<]+\s*<\/p>/gi, "")
    .trim();
}

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

async function handleShare() {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const data = { title: title.value, text: title.value, url: shareUrl };
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share(data);
      return;
    }
    if (navigator.clipboard && shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      showActionMessage("链接已复制");
    }
  } catch {
    showActionError(null, "分享没有完成，可以稍后再试。");
  }
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
  } catch (error) {
    saved.value = previousSaved;
    showActionError(error, "收藏操作没有成功，可以稍后再试。");
  } finally {
    saveBusy.value = false;
  }
}

function toggleReport() {
  actionError.value = "";
  actionMessage.value = "";
  reportOpen.value = !reportOpen.value;
}

async function handleReport() {
  if (postId.value == null || reportBusy.value) return;
  const category = reportCategories.find((item) => item.value === reportCategory.value) || reportCategories[reportCategories.length - 1];
  reportBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await reportPost(postId.value, { category: category.value, reason: category.label });
    reportOpen.value = false;
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
    replyExpanded.value = true;
    return;
  }
  replyBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await sendPostReply(postId.value, content);
    replyContent.value = "";
    replyExpanded.value = false;
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
  <aside class="post-detail-panel" aria-labelledby="post-detail-title">
    <header class="post-detail-panel__topbar">
      <button class="post-detail-panel__close" type="button" aria-label="关闭详情" @click="emit('close')">‹</button>
      <div class="post-detail-panel__author-chip">
        <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorLabel" loading="lazy" />
        <span v-else class="post-detail-panel__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
        <strong>{{ authorLabel }}</strong>
      </div>
      <button class="post-detail-panel__share" type="button" aria-label="分享" @click="handleShare">分享</button>
    </header>

    <div v-if="loading" class="post-detail-panel__state" role="status">正在加载详情…</div>

    <InlineError v-else-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">重新加载</button>
    </InlineError>

    <template v-else-if="post">
      <section v-if="images.length" class="post-detail-panel__gallery" aria-label="图片">
        <button v-for="url in images" :key="url" class="post-detail-panel__gallery-item" type="button" @click="fullscreenImage = url">
          <img :src="url" :alt="title" loading="lazy" />
        </button>
      </section>

      <section class="post-detail-panel__content">
        <h2 id="post-detail-title">{{ title }}</h2>
        <div v-if="bodyHtml" class="lian-html" v-html="bodyHtml"></div>
        <p v-else class="post-detail-panel__empty-body">暂无正文</p>
      </section>

      <section class="post-detail-panel__info-strip" aria-label="帖子属性">
        <div class="post-detail-panel__info-left">
          <span v-if="primaryTag" class="post-detail-panel__pill post-detail-panel__pill--tag">{{ primaryTag }}</span>
          <span class="post-detail-panel__pill">{{ timeLabel }}</span>
          <span v-if="placeLabel" class="post-detail-panel__pill">{{ placeLabel }}</span>
        </div>
        <button class="post-detail-panel__report-entry" type="button" :disabled="reportBusy" @click="toggleReport">
          {{ reportOpen ? "收起" : "举报" }}
        </button>
      </section>

      <section v-if="reportOpen" class="post-detail-panel__report" aria-label="举报原因">
        <label>
          <span>举报原因</span>
          <select v-model="reportCategory" :disabled="reportBusy">
            <option v-for="category in reportCategories" :key="category.value" :value="category.value">{{ category.label }}</option>
          </select>
        </label>
        <LianButton size="sm" variant="danger" :loading="reportBusy" @click="handleReport">提交举报</LianButton>
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
          <div class="post-detail-panel__reply-content" v-html="stripDecorativeContentFromHtml(reply.content || '这条回复暂时没有内容。')"></div>
        </article>
        <p v-if="!replies.length" class="post-detail-panel__empty">还没有回复，来写第一条。</p>
      </section>

      <form class="post-detail-panel__dock" :class="{ 'is-expanded': replyExpanded }" @submit.prevent="submitReply">
        <button class="post-detail-panel__dock-action" :class="{ 'is-active': liked }" type="button" :disabled="likeBusy" @click="handleLike">
          {{ liked ? "♥" : "♡" }} {{ likeCount }}
        </button>
        <button class="post-detail-panel__dock-action" :class="{ 'is-active': saved }" type="button" :disabled="saveBusy" @click="handleSave">
          {{ saved ? "★" : "☆" }}
        </button>
        <div class="post-detail-panel__reply-box" @click="replyExpanded = true">
          <span v-if="!replyExpanded" class="post-detail-panel__reply-placeholder">写回复</span>
          <textarea v-else v-model="replyContent" rows="3" maxlength="2000" :placeholder="replyIdentityLabel" />
        </div>
        <button class="post-detail-panel__send" type="submit" :disabled="replyBusy || (replyExpanded && !replyContent.trim())">
          {{ replyExpanded ? "发送" : "回复" }}
        </button>
      </form>

      <div v-if="fullscreenImage" class="post-detail-panel__lightbox" role="dialog" aria-modal="true" aria-label="查看图片" @click="fullscreenImage = ''">
        <img :src="fullscreenImage" :alt="title" />
      </div>
    </template>
  </aside>
</template>

<style scoped>
.post-detail-panel {
  position: relative;
  display: grid;
  gap: var(--space-4);
  min-height: 100%;
  padding: calc(58px + var(--space-3)) var(--space-3) calc(86px + var(--space-4));
}

.post-detail-panel__topbar,
.post-detail-panel__dock {
  position: fixed;
  right: max(var(--space-3), env(safe-area-inset-right));
  left: max(var(--space-3), env(safe-area-inset-left));
  z-index: 70;
  width: min(calc(100vw - var(--space-6)), 760px);
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.post-detail-panel__topbar {
  top: calc(var(--space-2) + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 64px;
  gap: var(--space-1);
  align-items: center;
  min-height: 58px;
  padding: var(--space-2);
}

.post-detail-panel__close,
.post-detail-panel__share,
.post-detail-panel__dock-action,
.post-detail-panel__send,
.post-detail-panel__report-entry,
.post-detail-panel__gallery-item {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.post-detail-panel__close,
.post-detail-panel__share {
  display: grid;
  height: 40px;
  place-items: center;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.post-detail-panel__close {
  width: 40px;
  font-size: 24px;
}

.post-detail-panel__share {
  min-width: 56px;
  padding: 0 var(--space-3);
  background: var(--lian-ink);
  color: #fff;
  font-size: 13px;
}

.post-detail-panel__author-chip {
  display: flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: center;
  justify-self: center;
}

.post-detail-panel__author-chip img,
.post-detail-panel__avatar-text {
  display: grid;
  width: 32px;
  min-width: 32px;
  height: 32px;
  place-items: center;
  border-radius: var(--radius-orb);
  object-fit: cover;
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.post-detail-panel__author-chip strong {
  overflow: hidden;
  max-width: 38vw;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-detail-panel__gallery {
  display: grid;
  grid-auto-columns: minmax(260px, 88%);
  grid-auto-flow: column;
  gap: var(--space-3);
  overflow-x: auto;
  margin-inline: calc(var(--space-3) * -1);
  padding-inline: var(--space-3);
  scroll-snap-type: x mandatory;
}

.post-detail-panel__gallery-item {
  overflow: hidden;
  padding: 0;
  border-radius: var(--radius-card);
  scroll-snap-align: center;
}

.post-detail-panel__gallery img {
  display: block;
  width: 100%;
  max-height: 420px;
  aspect-ratio: 0.9;
  object-fit: cover;
}

.post-detail-panel__content,
.post-detail-panel__replies,
.post-detail-panel__report {
  display: grid;
  gap: var(--space-3);
}

.post-detail-panel h2,
.post-detail-panel h3,
.post-detail-panel p {
  margin: 0;
}

.post-detail-panel h2 {
  color: var(--lian-ink);
  font-size: 22px;
  line-height: 1.32;
}

.post-detail-panel__empty-body,
.post-detail-panel__empty,
.post-detail-panel__state {
  color: var(--lian-muted);
  text-align: center;
}

.post-detail-panel__info-strip {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg);
}

.post-detail-panel__info-left {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.post-detail-panel__pill,
.post-detail-panel__report-entry {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-chip);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-panel__pill {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.58);
}

.post-detail-panel__pill--tag {
  color: var(--lian-primary-deep);
  font-weight: 900;
}

.post-detail-panel__report-entry {
  background: transparent;
}

.post-detail-panel__report {
  justify-items: end;
  padding: var(--space-3);
  border: 1px solid rgba(239, 68, 68, 0.16);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-panel__report label {
  display: grid;
  width: 100%;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-panel__report select,
.post-detail-panel__reply-box textarea {
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

.post-detail-panel__success {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
}

.post-detail-panel__section-title,
.post-detail-panel__reply-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-detail-panel__section-title span,
.post-detail-panel__reply-meta span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-detail-panel__reply {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.46);
}

.post-detail-panel__reply-content {
  color: var(--lian-muted);
  line-height: 1.62;
}

.post-detail-panel__dock {
  bottom: max(var(--space-3), env(safe-area-inset-bottom));
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: 58px;
  padding: var(--space-2);
  transition: min-height 180ms ease, align-items 180ms ease;
}

.post-detail-panel__dock.is-expanded {
  align-items: flex-end;
  min-height: 132px;
}

.post-detail-panel__dock-action,
.post-detail-panel__send {
  min-width: 42px;
  min-height: 38px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
}

.post-detail-panel__dock-action.is-active {
  background: rgba(255, 236, 236, 0.82);
  color: #c2410c;
}

.post-detail-panel__reply-box {
  display: grid;
  flex: 1;
  min-width: 0;
}

.post-detail-panel__reply-placeholder {
  display: flex;
  min-height: 38px;
  align-items: center;
  padding: 0 var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-chip);
  background: rgba(31, 41, 51, 0.04);
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-panel__reply-box textarea {
  min-height: 92px;
  resize: none;
  padding: var(--space-3);
  line-height: 1.5;
}

.post-detail-panel__lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.82);
}

.post-detail-panel__lightbox img {
  max-width: 100%;
  max-height: 92vh;
  border-radius: var(--radius-card);
  object-fit: contain;
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
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .post-detail-panel__dock {
    transition: none;
  }
}
</style>
