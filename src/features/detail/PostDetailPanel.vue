<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { reportPost, sendPostReply } from "../../api/posts";
import { InlineError, LianButton } from "../../ui";
import { ERROR_SEND_REPLY, LOADING_DETAIL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PostDetail } from "../../types/post";
import { sharePost } from "../../platform/share";
import { configureWeChatShare } from "../../platform/wechatShare";
import { buildCanonicalPostUrl } from "../../platform/share";
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
import { usePostReactions } from "./usePostReactions";
import { usePlaceSheetLoader } from "./usePlaceSheetLoader";

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

const post = computed(() => props.post);

function clearMessages() {
  actionError.value = "";
  actionMessage.value = "";
}

function showActionError(error: unknown, fallback: string) {
  actionMessage.value = "";
  actionError.value = extractErrorMessage(error, fallback);
}

const {
  liked, saved, likeCount, likeBusy, saveBusy,
  handleLike: rawHandleLike,
  handleSave: rawHandleSave,
  resetReactions,
} = usePostReactions({ clearMessages, showError: showActionError });

const {
  placeSheet, placeSheetOpen, placeSheetLoading, placeSheetError,
  placeSheetState,
  openPlaceSheet,
  resetPlaceSheet,
} = usePlaceSheetLoader(post);

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

function handleLike() { return rawHandleLike(postId.value); }
function handleSave() { return rawHandleSave(postId.value); }

watch(post, (nextPost) => {
  resetReactions(nextPost);
  resetPlaceSheet();
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
}, { immediate: true });

// Configure WeChat share card when post data loads
watch(post, (nextPost) => {
  if (!nextPost?.tid) return;
  const plainBody = (nextPost.contentHtml || "").replace(/<[^>]+>/g, "").trim();
  configureWeChatShare({
    title: nextPost.title || "黎安屿你",
    desc: plainBody.slice(0, 100) || undefined,
    link: buildCanonicalPostUrl(nextPost.tid),
    imgUrl: nextPost.cover || nextPost.imageUrls?.[0] || undefined,
  });
});

function showActionMessage(message: string) {
  actionError.value = "";
  actionMessage.value = message;
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
    showActionError(error, ERROR_SEND_REPLY);
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
      <div v-if="loading" class="post-detail-panel__state" role="status">{{ LOADING_DETAIL }}</div>

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
