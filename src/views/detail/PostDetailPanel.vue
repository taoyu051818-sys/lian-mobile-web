<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchPlaceSheet } from "../../api/places";
import { reportPost, sendPostReply, togglePostLike, togglePostSave } from "../../api/posts";
import { InlineError } from "../../ui";
import type { PlaceSheet } from "../../types/place";
import type { PostDetail } from "../../types/post";
import { sharePost } from "../../platform/share";
import PostDetailTopbar from "./PostDetailTopbar.vue";
import PostDetailContent from "./PostDetailContent.vue";
import PostReplies from "./PostReplies.vue";
import PostReplyDock from "./PostReplyDock.vue";
import { usePostDetailPresentation } from "./usePostDetailPresentation";

type FloatingChromePhase = "visible" | "exiting" | "hidden" | "entering" | "progress";

const props = withDefaults(defineProps<{
  post: PostDetail | null;
  loading?: boolean;
  error?: string;
  chromePhase?: FloatingChromePhase;
  chromeStyle?: Record<string, string>;
}>(), {
  loading: false,
  error: "",
  chromePhase: "visible",
  chromeStyle: () => ({}),
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

const post = computed(() => props.post);
const placeSheetState = computed(() => placeSheet.value);
const {
  postId,
  title,
  authorLabel,
  authorAvatarUrl,
  authorInitial,
  hasAuthorIdentity,
  structuredPlace,
  placeLabel,
  primaryTag,
  bodyHtml,
  replies,
  images,
  fullResolutionImages,
  timeLabel,
  placeStatusText,
} = usePostDetailPresentation(post, placeSheetState);
const replyIdentityLabel = "以当前身份回复";

watch(post, (nextPost) => {
  liked.value = Boolean(nextPost?.liked);
  saved.value = Boolean(nextPost?.bookmarked);
  likeCount.value = Math.max(0, Number(nextPost?.likeCount || 0));
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
  if (postId.value == null) return;
  const result = await sharePost({ tid: postId.value, title: title.value });
  if (result.outcome === "shared" || result.outcome === "cancelled") return;
  if (result.outcome === "copied") {
    showActionMessage("链接已复制");
    return;
  }
  showActionError(null, result.message);
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
    <PostDetailTopbar
      :author-label="authorLabel"
      :avatar-url="authorAvatarUrl"
      :author-initial="authorInitial"
      :has-author-identity="hasAuthorIdentity"
      :chrome-phase="chromePhase"
      :chrome-style="chromeStyle"
      @close="emit('close')"
      @share="handleShare"
    />

    <div class="post-detail-panel__stage" @click="collapseReplyIfOpen">
      <div v-if="loading" class="post-detail-panel__state" role="status">正在加载详情…</div>

      <InlineError v-else-if="error">
        {{ error }}
        <button type="button" @click="emit('retry')">重新加载</button>
      </InlineError>

      <template v-else-if="post">
        <PostDetailContent
          :title="title"
          :body-html="bodyHtml"
          :images="images"
          :primary-tag="primaryTag"
          :time-label="timeLabel"
          :place-label="placeLabel"
          :place-status-text="placeStatusText"
          :structured-place="structuredPlace"
          :place-sheet-open="placeSheetOpen"
          :place-sheet="placeSheet"
          :place-sheet-loading="placeSheetLoading"
          :place-sheet-error="placeSheetError"
          :report-open="reportOpen"
          :report-busy="reportBusy"
          :report-category="reportCategory"
          :action-error="actionError"
          :action-message="actionMessage"
          @gallery-pointer-down="handleGalleryPointerDown"
          @gallery-pointer-move="handleGalleryPointerMove"
          @open-gallery-image="openGalleryImage"
          @open-place-sheet="openPlaceSheet"
          @toggle-report="toggleReport"
          @submit-report="handleReport"
          @update:report-category="reportCategory = $event"
          @update:place-sheet-open="placeSheetOpen = $event"
        />

        <PostReplies :replies="replies" />
      </template>
    </div>

    <PostReplyDock
      v-if="post && !loading && !error"
      :liked="liked"
      :saved="saved"
      :like-count="likeCount"
      :like-busy="likeBusy"
      :save-busy="saveBusy"
      :reply-busy="replyBusy"
      :reply-expanded="replyExpanded"
      :reply-content="replyContent"
      :reply-identity-label="replyIdentityLabel"
      :chrome-phase="chromePhase"
      :chrome-style="chromeStyle"
      @like="handleLike"
      @save="handleSave"
      @submit-reply="submitReply"
      @update:reply-expanded="replyExpanded = $event"
      @update:reply-content="replyContent = $event"
    />

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

.post-detail-panel__state {
  color: var(--lian-muted);
  text-align: center;
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

@media (prefers-reduced-motion: reduce) {
  .post-detail-panel__stage {
    transition: none;
  }
}
</style>
