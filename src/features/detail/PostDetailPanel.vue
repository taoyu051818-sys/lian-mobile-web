<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { InlineError, LianButton } from "../../ui";
import { LOADING_DETAIL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PostDetail } from "../../types/post";
import PostDetailTopbar from "./PostDetailTopbar.vue";
import PostDetailContent from "./PostDetailContent.vue";
import PostReplies from "./PostReplies.vue";
import PostReplyDock from "./PostReplyDock.vue";
import { usePostDetailPresentation } from "./usePostDetailPresentation";
import { usePostReactions } from "./usePostReactions";
import { usePlaceSheetLoader } from "./usePlaceSheetLoader";
import { usePostReport } from "./usePostReport";
import { usePostReplyComposer } from "./usePostReplyComposer";
import { usePostShare } from "./usePostShare";
import { useDetailGallery } from "./useDetailGallery";

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

const actionError = ref("");
const actionMessage = ref("");

const post = computed(() => props.post);

function clearMessages() {
  actionError.value = "";
  actionMessage.value = "";
}

function showActionError(error: unknown, fallback: string) {
  actionMessage.value = "";
  actionError.value = extractErrorMessage(error, fallback);
}

function showActionMessage(message: string) {
  actionError.value = "";
  actionMessage.value = message;
}

function setActionError(message: string) {
  actionMessage.value = "";
  actionError.value = message;
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

const {
  reportBusy,
  reportOpen,
  reportReason,
  reportFollowUpVisible,
  locallyHidden,
  reportCategory,
  REPORT_CATEGORIES,
  reportReasonVisible,
  reportReasonPlaceholder,
  toggleReport,
  handleHideReportedPost,
  undoHideReportedPost,
  handleReport,
  resetReport,
} = usePostReport({
  postId,
  clearMessages,
  showActionMessage,
  setActionError,
});

const {
  replyBusy,
  replyExpanded,
  replyContent,
  collapseReplyIfOpen,
  submitReply,
  resetReply,
} = usePostReplyComposer({
  postId,
  clearMessages,
  showError: showActionError,
  showActionMessage,
  setActionError,
  onReplySuccess: () => emit("retry"),
});

const { handleShare } = usePostShare({
  postId,
  title,
  post,
  showActionMessage,
  showError: showActionError,
});

const {
  fullscreenImage,
  handleGalleryPointerDown,
  handleGalleryPointerMove,
  openGalleryImage,
  resetGallery,
} = useDetailGallery({
  images,
  fullResolutionImages,
});

const replyIdentityLabel = "以当前身份回复";

function handleLike() { return rawHandleLike(postId.value); }
function handleSave() { return rawHandleSave(postId.value); }

watch(post, (nextPost) => {
  resetReactions(nextPost);
  resetPlaceSheet();
  resetReport();
  resetReply();
  resetGallery();
  clearMessages();
}, { immediate: true });
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
