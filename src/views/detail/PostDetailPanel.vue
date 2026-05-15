<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { fetchPlaceSheet } from "../../api/places";
import { reportPost, sendPostReply, togglePostLike, togglePostSave } from "../../api/posts";
import { InlineError, LianButton } from "../../ui";
import type { PlaceSheet } from "../../types/place";
import type { PostDetail } from "../../types/post";
import { sharePost } from "../../platform/share";
import PostDetailTopbar from "./PostDetailTopbar.vue";
import PostDetailContent from "./PostDetailContent.vue";
import PostReplies from "./PostReplies.vue";
import PostReplyDock from "./PostReplyDock.vue";
import {
  buildReportPayload,
  getReportReasonPlaceholder,
  getReportSubmissionMessage,
  REPORT_CATEGORIES,
  shouldShowReportReasonField,
} from "./reportFlow";
import { usePostDetailPresentation } from "./usePostDetailPresentation";

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

useVisualViewport();

const liked = ref(false);
const saved = ref(false);
const likeCount = ref(0);
const likeBusy = ref(false);
const saveBusy = ref(false);
const reportBusy = ref(false);
const reportOpen = ref(false);
const reportReason = ref("");
const reportFollowUpVisible = ref(false);
const locallyHidden = ref(false);
const replyBusy = ref(false);
const replyExpanded = ref(false);
const fullscreenImage = ref("");
const actionError = ref("");
const actionMessage = ref("");
const reportCategory = ref(REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1].value);
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
const reportReasonVisible = computed(() => shouldShowReportReasonField(reportCategory.value));
const reportReasonPlaceholder = computed(() => getReportReasonPlaceholder(reportCategory.value));
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
  reportReason.value = "";
  reportFollowUpVisible.value = false;
  locallyHidden.value = false;
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

function setActionError(message: string) {
  actionMessage.value = "";
  actionError.value = message;
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
  reportFollowUpVisible.value = false;
  reportOpen.value = !reportOpen.value;
}

function handleHideReportedPost() {
  locallyHidden.value = true;
  reportFollowUpVisible.value = false;
  actionError.value = "";
  actionMessage.value = "";
}

function undoHideReportedPost() {
  locallyHidden.value = false;
  reportFollowUpVisible.value = false;
  showActionMessage("这条内容已经恢复显示。");
}

async function handleReport() {
  if (postId.value == null || reportBusy.value) return;
  reportBusy.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await reportPost(postId.value, buildReportPayload(reportCategory.value, reportReason.value));
    reportOpen.value = false;
    reportReason.value = "";
    reportFollowUpVisible.value = true;
    showActionMessage("举报已提交。你也可以先暂时隐藏这条内容。");
  } catch (error) {
    setActionError(getReportSubmissionMessage(error));
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
        <section
          v-if="locallyHidden"
          class="post-detail-panel__hidden-state"
          aria-label="当前会话已隐藏内容"
          @click.stop
        >
          <h2>这条内容已在当前会话中隐藏</h2>
          <p>这只是当前设备上的临时隐藏，不会替代平台审核，也不会同步到其他设备。</p>
          <LianButton size="sm" variant="ghost" @click="undoHideReportedPost">撤销隐藏</LianButton>
        </section>

        <template v-else>
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
            :report-categories="REPORT_CATEGORIES"
            :report-reason="reportReason"
            :report-reason-visible="reportReasonVisible"
            :report-reason-placeholder="reportReasonPlaceholder"
            :report-follow-up-visible="reportFollowUpVisible"
            :action-error="actionError"
            :action-message="actionMessage"
            @gallery-pointer-down="handleGalleryPointerDown"
            @gallery-pointer-move="handleGalleryPointerMove"
            @open-gallery-image="openGalleryImage"
            @open-place-sheet="openPlaceSheet"
            @toggle-report="toggleReport"
            @submit-report="handleReport"
            @hide-reported-post="handleHideReportedPost"
            @update:report-category="reportCategory = $event"
            @update:report-reason="reportReason = $event"
            @update:place-sheet-open="placeSheetOpen = $event"
          />

          <PostReplies :replies="replies" />
        </template>
      </template>
    </div>

    <PostReplyDock
      v-if="post && !loading && !error && !locallyHidden"
      :liked="liked"
      :saved="saved"
      :like-count="likeCount"
      :like-busy="likeBusy"
      :save-busy="saveBusy"
      :reply-busy="replyBusy"
      :reply-expanded="replyExpanded"
      :reply-content="replyContent"
      :reply-identity-label="replyIdentityLabel"
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
  transition: transform var(--motion-return) var(--motion-ease-standard), border-radius var(--motion-return) var(--motion-ease-standard);
}

.post-detail-panel__state {
  color: var(--lian-muted);
  text-align: center;
}

.post-detail-panel__hidden-state {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-panel__hidden-state h2,
.post-detail-panel__hidden-state p {
  margin: 0;
}

.post-detail-panel__hidden-state p {
  color: var(--lian-muted);
  line-height: 1.6;
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
