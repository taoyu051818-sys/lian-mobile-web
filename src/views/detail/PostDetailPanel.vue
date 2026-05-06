<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchPlaceSheet } from "../../api/places";
import { reportPost, sendPostReply, togglePostLike, togglePostSave } from "../../api/posts";
import { InlineError, LianButton } from "../../ui";
import type { DisplayActor } from "../../types/feed";
import type { PlaceSheet, PlaceStatus } from "../../types/place";
import type { PostDetail, PostReply } from "../../types/post";

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
const galleryPointerDownX = ref(0);
const galleryPointerDownY = ref(0);
const galleryPointerMoved = ref(false);
const placeSheet = ref<PlaceSheet | null>(null);
const placeSheetOpen = ref(false);
const placeSheetLoading = ref(false);
const placeSheetError = ref("");

const postId = computed(() => props.post?.tid ?? null);
const title = computed(() => props.post?.title || "帖子详情");
const authorLabel = computed(() => actorDisplayName(props.post?.actor));
const authorAvatarUrl = computed(() => actorAvatarUrl(props.post?.actor));
const authorInitial = computed(() => actorAvatarText(props.post?.actor, authorLabel.value));
const structuredPlace = computed(() => props.post?.place || null);
const placeLabel = computed(() => structuredPlace.value?.name || props.post?.locationArea || "");
const primaryTag = computed(() => normalizePostTag(props.post?.primaryTag || ""));
const rawBodyHtml = computed(() => props.post?.contentHtml || "");
const bodyHtml = computed(() => stripDecorativeContentFromHtml(rawBodyHtml.value));
const replies = computed(() => props.post?.replies || []);
const images = computed(() => uniqueGalleryImages([props.post?.cover || "", ...(props.post?.imageUrls || [])]).slice(0, 8));
const fullResolutionImages = computed(() => images.value.map(toFullResolutionImageUrl));
const timeLabel = computed(() => formatRelativeTime(props.post?.timestampISO || "") || props.post?.timeLabel || "刚刚");
const replyIdentityLabel = computed(() => `以当前身份回复`);
const placeStatusText = computed(() => placeStatusLabel(placeSheet.value?.status || structuredPlace.value?.status));

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
  galleryPointerMoved.value = false;
  placeSheet.value = null;
  placeSheetOpen.value = false;
  placeSheetLoading.value = false;
  placeSheetError.value = "";
}, { immediate: true });

watch(fullResolutionImages, (urls) => {
  preloadImages(urls);
}, { immediate: true });

function actorDisplayName(actor?: DisplayActor | null) {
  return actor?.displayName || actor?.username || actor?.name || "同学";
}

function actorAvatarUrl(actor?: DisplayActor | null) {
  return actor?.avatarUrl || "";
}

function actorAvatarText(actor?: DisplayActor | null, labelFallback = "") {
  return actor?.avatarText || labelFallback.slice(0, 1) || actorDisplayName(actor).slice(0, 1) || "同";
}

function replyAuthorLabel(reply: PostReply) {
  return actorDisplayName(reply.actor);
}

function normalizePostTag(value: string) {
  const text = String(value || "").trim().replace(/^#+/, "");
  return text ? `#${text}` : "";
}

function galleryImageKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://lian.invalid");
    const pathname = url.pathname.replace(/^\/+/, "");
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex >= 0) {
      return pathname
        .slice(uploadIndex + "/upload/".length)
        .replace(/^(?:[^/]+\/)*v\d+\//, "")
        .replace(/^v\d+\//, "")
        .replace(/\.[a-z0-9]+$/i, "");
    }
    return pathname.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return raw.replace(/\?.*$/, "").replace(/\.[a-z0-9]+$/i, "");
  }
}

function uniqueGalleryImages(urls: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const value = String(url || "").trim();
    if (!value) continue;
    const key = galleryImageKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function toFullResolutionImageUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://lian.invalid");
    if (!url.hostname.includes("cloudinary.com") || !url.pathname.includes("/upload/")) return raw;
    url.pathname = url.pathname.replace(/\/upload\/[^/]+\//, "/upload/f_auto,q_auto/");
    return url.toString();
  } catch {
    return raw;
  }
}

function preloadImages(urls: string[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }
}

function stripDecorativeContentFromHtml(value: string) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<p[^>]*>\s*<strong>\s*#+[^<]+\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<p[^>]*>\s*#+[^<]+\s*<\/p>/gi, "")
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

function placeStatusLabel(status?: PlaceStatus) {
  const labels: Record<PlaceStatus, string> = {
    confirmed: "已确认",
    pending: "待确认",
    disputed: "有争议",
    expired: "可能过期",
    "ai-organized": "AI 整理",
    official: "官方",
  };
  return status ? labels[status] || "地点" : "地点";
}

function placeRecentPostActorLabel(actor?: DisplayActor) {
  return actorDisplayName(actor);
}

function showActionMessage(message: string) {
  actionError.value = "";
  actionMessage.value = message;
}

function showActionError(error: unknown, fallback: string) {
  actionMessage.value = "";
  actionError.value = error instanceof Error ? error.message : fallback;
}

function collapseReplyIfOpen() {
  if (!replyExpanded.value) return;
  replyExpanded.value = false;
}

function handleGalleryPointerDown(event: PointerEvent) {
  galleryPointerDownX.value = event.clientX;
  galleryPointerDownY.value = event.clientY;
  galleryPointerMoved.value = false;
}

function handleGalleryPointerMove(event: PointerEvent) {
  const deltaX = Math.abs(event.clientX - galleryPointerDownX.value);
  const deltaY = Math.abs(event.clientY - galleryPointerDownY.value);
  if (deltaX > 8 || deltaY > 8) {
    galleryPointerMoved.value = true;
  }
}

function openGalleryImage(index: number) {
  if (galleryPointerMoved.value) {
    galleryPointerMoved.value = false;
    return;
  }
  fullscreenImage.value = fullResolutionImages.value[index] || images.value[index] || "";
}

async function openPlaceSheet() {
  const placeId = structuredPlace.value?.id;
  if (!placeId) return;
  placeSheetOpen.value = true;
  placeSheetError.value = "";
  if (placeSheet.value?.id === placeId) return;
  placeSheetLoading.value = true;
  try {
    placeSheet.value = await fetchPlaceSheet(placeId);
  } catch (error) {
    placeSheetError.value = error instanceof Error ? error.message : "地点信息暂时没有加载出来。";
  } finally {
    placeSheetLoading.value = false;
  }
}

async function handleShare() {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const browserNavigator = typeof navigator !== "undefined" ? navigator : null;
  const data = { title: title.value, text: title.value, url: shareUrl };
  try {
    if (browserNavigator && "share" in browserNavigator && typeof browserNavigator.share === "function") {
      await browserNavigator.share(data);
      return;
    }
    const clipboard = browserNavigator?.clipboard;
    if (clipboard && shareUrl) {
      await clipboard.writeText(shareUrl);
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
    <header
      class="post-detail-panel__topbar lian-floating-chrome lian-floating-chrome--top"
      data-floating-chrome="top"
    >
      <button class="post-detail-panel__close" type="button" aria-label="关闭详情" @click="emit('close')">‹</button>
      <div class="post-detail-panel__author-chip">
        <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorLabel" loading="lazy" />
        <span v-else class="post-detail-panel__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
        <strong>{{ authorLabel }}</strong>
      </div>
      <button class="post-detail-panel__share" type="button" aria-label="分享" @click="handleShare">分享</button>
    </header>

    <div class="post-detail-panel__stage" @click="collapseReplyIfOpen">
      <div v-if="loading" class="post-detail-panel__state" role="status">正在加载详情…</div>

      <InlineError v-else-if="error">
        {{ error }}
        <button type="button" @click="emit('retry')">重新加载</button>
      </InlineError>

      <template v-else-if="post">
        <section
          v-if="images.length"
          class="post-detail-panel__gallery"
          :class="{ 'is-single': images.length === 1 }"
          aria-label="图片"
        >
          <button
            v-for="(url, index) in images"
            :key="url"
            class="post-detail-panel__gallery-item"
            type="button"
            @pointerdown="handleGalleryPointerDown"
            @pointermove="handleGalleryPointerMove"
            @click="openGalleryImage(index)"
          >
            <img :src="url" :alt="title" loading="eager" decoding="async" />
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
            <button
              v-if="structuredPlace?.id"
              class="post-detail-panel__pill post-detail-panel__pill-button"
              type="button"
              :aria-expanded="placeSheetOpen"
              @click.stop="openPlaceSheet"
            >
              {{ placeLabel }} · {{ placeStatusText }}
            </button>
            <span v-else-if="placeLabel" class="post-detail-panel__pill">{{ placeLabel }}</span>
          </div>
          <button class="post-detail-panel__report-entry" type="button" :disabled="reportBusy" @click.stop="toggleReport">
            {{ reportOpen ? "收起" : "举报" }}
          </button>
        </section>

        <section v-if="placeSheetOpen" class="post-detail-panel__place-sheet" aria-label="地点信息" @click.stop>
          <div class="post-detail-panel__section-title">
            <h3>{{ placeSheet?.name || structuredPlace?.name || placeLabel }}</h3>
            <button type="button" @click="placeSheetOpen = false">收起</button>
          </div>
          <p v-if="placeSheetLoading" class="post-detail-panel__state">正在加载地点信息…</p>
          <InlineError v-else-if="placeSheetError">
            {{ placeSheetError }}
            <button type="button" @click="openPlaceSheet">重试</button>
          </InlineError>
          <template v-else>
            <div class="post-detail-panel__place-meta">
              <span>{{ placeStatusText }}</span>
              <span v-if="placeSheet?.type || structuredPlace?.type">{{ placeSheet?.type || structuredPlace?.type }}</span>
              <span v-if="placeSheet?.updatedAt">更新于 {{ formatRelativeTime(placeSheet.updatedAt) || placeSheet.updatedAt }}</span>
            </div>
            <p v-if="placeSheet?.summary?.text" class="post-detail-panel__place-summary">{{ placeSheet.summary.text }}</p>
            <p v-else class="post-detail-panel__empty">这个地点还在沉淀信息。</p>
            <div v-if="placeSheet?.stats" class="post-detail-panel__place-stats" aria-label="地点统计">
              <span v-if="placeSheet.stats.postCount != null">{{ placeSheet.stats.postCount }} 条内容</span>
              <span v-if="placeSheet.stats.correctionCount != null">{{ placeSheet.stats.correctionCount }} 条修正</span>
              <span v-if="placeSheet.stats.savedCount != null">{{ placeSheet.stats.savedCount }} 次收藏</span>
            </div>
            <div v-if="placeSheet?.recentPosts?.length" class="post-detail-panel__place-posts">
              <article v-for="recent in placeSheet.recentPosts.slice(0, 3)" :key="String(recent.tid)">
                <strong>{{ recent.title || "相关内容" }}</strong>
                <p v-if="recent.excerpt">{{ recent.excerpt }}</p>
                <small>{{ placeRecentPostActorLabel(recent.actor) }} · {{ formatRelativeTime(recent.timestampISO || "") || "刚刚" }}</small>
              </article>
            </div>
          </template>
        </section>

        <section v-if="reportOpen" class="post-detail-panel__report" aria-label="举报原因" @click.stop>
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
              <strong>{{ replyAuthorLabel(reply) }}</strong>
              <span>{{ formatRelativeTime(reply.timestampISO) }}</span>
            </div>
            <div class="post-detail-panel__reply-content" v-html="stripDecorativeContentFromHtml(reply.content || '这条回复暂时没有内容。')"></div>
          </article>
          <p v-if="!replies.length" class="post-detail-panel__empty">还没有回复，来写第一条。</p>
        </section>
      </template>
    </div>

    <form
      v-if="post && !loading && !error"
      class="post-detail-panel__dock lian-floating-chrome lian-floating-chrome--bottom"
      :class="{ 'is-expanded': replyExpanded }"
      data-floating-chrome="bottom"
      @submit.prevent="submitReply"
      @click.stop
    >
      <button v-if="!replyExpanded" class="post-detail-panel__dock-action" :class="{ 'is-active': liked }" type="button" :disabled="likeBusy" @click="handleLike">
        {{ liked ? "♥" : "♡" }} {{ likeCount }}
      </button>
      <button v-if="!replyExpanded" class="post-detail-panel__dock-action" :class="{ 'is-active': saved }" type="button" :disabled="saveBusy" @click="handleSave">
        {{ saved ? "★" : "☆" }}
      </button>
      <div class="post-detail-panel__reply-box" @click="replyExpanded = true">
        <span v-if="!replyExpanded" class="post-detail-panel__reply-placeholder">写回复</span>
        <textarea v-else v-model="replyContent" rows="3" maxlength="2000" :placeholder="replyIdentityLabel" autofocus />
      </div>
      <button class="post-detail-panel__send" type="submit" :disabled="replyBusy || (replyExpanded && !replyContent.trim())">
        {{ replyExpanded ? "发送" : "回复" }}
      </button>
    </form>

    <div v-if="fullscreenImage" class="post-detail-panel__lightbox" role="dialog" aria-modal="true" aria-label="查看图片" @click="fullscreenImage = ''">
      <img :src="fullscreenImage" :alt="title" />
    </div>
  </aside>
</template>

<style scoped>
.post-detail-panel {
  position: relative;
  display: grid;
  gap: var(--space-4);
  min-height: 100%;
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) calc(var(--floating-bar-height) + var(--space-8));
}

.post-detail-panel__stage {
  display: grid;
  gap: var(--space-4);
  overflow: hidden;
  border-radius: var(--detail-card-radius, 0px);
  transform: translate3d(var(--detail-card-translate-x, 0px), var(--detail-card-translate-y, 0px), 0) scale(var(--detail-card-scale, 1));
  transform-origin: center center;
  will-change: transform, border-radius;
  transition: none;
}

.post-detail-panel.is-returning .post-detail-panel__stage {
  transition: transform 380ms var(--motion-ease-standard), border-radius 380ms var(--motion-ease-standard);
}

.post-detail-panel__topbar,
.post-detail-panel__dock {
  position: fixed;
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  z-index: var(--floating-bar-z);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--floating-bar-radius);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  transition: transform var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    opacity var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    filter var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    min-height 180ms ease,
    align-items 180ms ease;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.post-detail-panel__topbar {
  top: var(--floating-bar-top-offset);
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 64px;
  gap: var(--space-1);
  align-items: center;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
  opacity: var(--detail-top-chrome-opacity, 1);
  transform: translateY(var(--detail-top-chrome-translate-y, 0px));
}

.post-detail-panel__dock {
  bottom: var(--floating-bar-bottom-offset);
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
  opacity: var(--detail-bottom-chrome-opacity, 1);
  transform: translateY(var(--detail-bottom-chrome-translate-y, 0px));
}

.post-detail-panel__close,
.post-detail-panel__share,
.post-detail-panel__dock-action,
.post-detail-panel__send,
.post-detail-panel__report-entry,
.post-detail-panel__gallery-item,
.post-detail-panel__pill-button,
.post-detail-panel__place-sheet button {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.post-detail-panel__close,
.post-detail-panel__share {
  display: grid;
  height: var(--floating-bar-button-height);
  place-items: center;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.post-detail-panel__close {
  width: var(--floating-bar-button-height);
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
  justify-self: start;
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
  display: flex;
  gap: var(--space-3);
  overflow: hidden;
  margin-inline: calc(var(--space-3) * -1);
  padding-inline: max(var(--space-3), 6vw);
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.post-detail-panel__gallery::-webkit-scrollbar {
  display: none;
}

.post-detail-panel__gallery.is-single {
  justify-content: center;
}

.post-detail-panel__gallery-item {
  flex: 0 0 min(88vw, 420px);
  overflow: hidden;
  padding: 0;
  border-radius: var(--radius-card);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-drag: none;
}

.post-detail-panel__gallery img {
  display: block;
  width: 100%;
  height: min(62vh, 460px);
  aspect-ratio: 0.9;
  object-fit: cover;
  pointer-events: none;
}

.post-detail-panel__content,
.post-detail-panel__replies,
.post-detail-panel__report,
.post-detail-panel__place-sheet,
.post-detail-panel__place-posts {
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

.post-detail-panel__pill-button {
  cursor: pointer;
}

.post-detail-panel__pill-button:hover {
  color: var(--lian-primary-deep);
}

.post-detail-panel__pill--tag {
  color: var(--lian-primary-deep);
  font-weight: 900;
}

.post-detail-panel__report-entry {
  background: transparent;
}

.post-detail-panel__report,
.post-detail-panel__place-sheet {
  padding: var(--space-3);
  border-radius: var(--radius-card);
}

.post-detail-panel__report {
  justify-items: end;
  border: 1px solid rgba(239, 68, 68, 0.16);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-panel__place-sheet {
  border: 1px solid rgba(31, 167, 160, 0.18);
  background: rgba(255, 255, 255, 0.52);
}

.post-detail-panel__place-meta,
.post-detail-panel__place-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-panel__place-meta span,
.post-detail-panel__place-stats span {
  padding: 4px 8px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
}

.post-detail-panel__place-summary,
.post-detail-panel__place-posts p,
.post-detail-panel__place-posts small {
  color: var(--lian-muted);
  line-height: 1.6;
}

.post-detail-panel__place-posts article {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.46);
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

.post-detail-panel__section-title button {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
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

.post-detail-panel__dock.is-expanded {
  align-items: flex-end;
  min-height: 132px;
}

.post-detail-panel__dock-action,
.post-detail-panel__send {
  flex: 0 0 auto;
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
  flex: 1 1 auto;
  min-width: 0;
}

.post-detail-panel__dock.is-expanded .post-detail-panel__reply-box {
  width: 100%;
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
  .post-detail-panel__stage,
  .post-detail-panel__topbar,
  .post-detail-panel__dock {
    transition: none;
  }
}
</style>
