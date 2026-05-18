<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { useFloatingChromeState } from "../../shell/floatingChromeState";
import { InlineError } from "../../ui";
import { LOADING_DETAIL, DETAIL_RELOAD, REPLY_IDENTITY_LABEL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PostDetail } from "../../types/post";
import PostDetailTopbar from "./PostDetailTopbar.vue";
import PostDetailContent from "./PostDetailContent.vue";
import PostDetailHiddenState from "./PostDetailHiddenState.vue";
import PostDetailLightbox from "./PostDetailLightbox.vue";
import PostReplies from "./PostReplies.vue";
import PostReplyDock from "./PostReplyDock.vue";
import { usePostDetailPresentation } from "./usePostDetailPresentation";
import { usePostReactions } from "./usePostReactions";
import { usePlaceSheetLoader } from "./usePlaceSheetLoader";
import { usePostReport } from "./usePostReport";
import { usePostReplyComposer } from "./usePostReplyComposer";
import { usePostShare } from "./usePostShare";
import { useDetailGallery } from "./useDetailGallery";
import { usePostDetailExtensions } from "../../composables/usePostDetailExtensions";
import { useAudienceOptions } from "../../composables/useAudienceOptions";

const props = withDefaults(
  defineProps<{
    post: PostDetail | null;
    loading?: boolean;
    error?: string;
  }>(),
  {
    loading: false,
    error: "",
  },
);

const emit = defineEmits<{
  close: [];
  retry: [];
}>();

useVisualViewport();

const { detailTopChromeOpacity, detailBottomChromeOpacity, detailPointerEvents } =
  useFloatingChromeState();

const detailChromeStyle = computed(
  (): Record<string, string> => ({
    "--detail-top-chrome-opacity": String(detailTopChromeOpacity.value),
    "--detail-bottom-chrome-opacity": String(detailBottomChromeOpacity.value),
    "pointer-events": detailPointerEvents.value,
  }),
);

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
  liked,
  saved,
  likeCount,
  likeBusy,
  saveBusy,
  handleLike: rawHandleLike,
  handleSave: rawHandleSave,
  resetReactions,
} = usePostReactions({ clearMessages, showError: showActionError });

const {
  placeSheet,
  placeSheetOpen,
  placeSheetLoading,
  placeSheetError,
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

const { replyBusy, replyExpanded, replyContent, collapseReplyIfOpen, submitReply, resetReply } =
  usePostReplyComposer({
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
const replyIdentityLabel = REPLY_IDENTITY_LABEL;

const audience = useAudienceOptions();
const isAuthenticated = computed(() => Boolean(post.value));

const {
  liveEvent,
  eventPlan,
  eventBusy,
  eventActionError,
  handleEventAct,
  liveHelp,
  helpPlan,
  helpBusy,
  helpActionError,
  handleHelpAct,
  helpManagePlan,
  helpManageBusy,
  helpManageActionError,
  handleHelpManageLinkEvent,
  handleHelpManageUnlinkEvent,
  handleHelpManageResolve,
  handleHelpManageClose,
} = usePostDetailExtensions({
  post,
  postId,
  isAuthenticated,
  onMessage: showActionMessage,
});

function handleHelpOpenLinkedEvent(tid: number) {
  // V0.1 surface — emit retry so the panel reloads to the linked-event tid
  // by way of the parent. Until the parent owns navigation, nothing else to
  // wire. Touch the param so TS does not complain.
  void tid;
  emit("retry");
}

function handleLike() {
  const currentId = postId.value;
  return rawHandleLike(currentId, () => postId.value === currentId);
}
function handleSave() {
  const currentId = postId.value;
  return rawHandleSave(currentId, () => postId.value === currentId);
}
watch(
  post,
  (nextPost) => {
    resetReactions(nextPost);
    resetPlaceSheet();
    resetReport();
    resetReply();
    resetGallery();
    clearMessages();
  },
  { immediate: true },
);
// Touch `audience` so the load fires; gating uses it indirectly via composables.
void audience;
</script>

<template>
  <aside class="post-detail-panel" :style="detailChromeStyle" aria-labelledby="post-detail-title">
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
        <button type="button" @click="emit('retry')">{{ DETAIL_RELOAD }}</button>
      </InlineError>

      <template v-else-if="post">
        <PostDetailHiddenState v-if="locallyHidden" @undo-hide="undoHideReportedPost" />

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
            :event="liveEvent"
            :event-plan="eventPlan"
            :event-busy="eventBusy"
            :event-action-error="eventActionError"
            :help="liveHelp"
            :help-plan="helpPlan"
            :help-busy="helpBusy"
            :help-action-error="helpActionError"
            :help-manage-plan="helpManagePlan"
            :help-manage-busy="helpManageBusy"
            :help-manage-action-error="helpManageActionError"
            @gallery-pointer-down="handleGalleryPointerDown"
            @gallery-pointer-move="handleGalleryPointerMove"
            @open-gallery-image="openGalleryImage"
            @open-place-sheet="openPlaceSheet"
            @toggle-report="toggleReport"
            @submit-report="handleReport"
            @hide-reported-post="handleHideReportedPost"
            @event-act="handleEventAct"
            @help-act="handleHelpAct"
            @help-open-linked-event="handleHelpOpenLinkedEvent"
            @help-manage-link-event="handleHelpManageLinkEvent"
            @help-manage-unlink-event="handleHelpManageUnlinkEvent"
            @help-manage-resolve="handleHelpManageResolve"
            @help-manage-close="handleHelpManageClose"
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

    <PostDetailLightbox :src="fullscreenImage" :alt="title" @close="fullscreenImage = ''" />
  </aside>
</template>

<style scoped>
.post-detail-panel {
  position: relative;
  display: grid;
  gap: var(--space-4);
  min-height: 100%;
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3)
    calc(var(--floating-bar-height) + var(--space-8));
}

.post-detail-panel__stage {
  display: grid;
  gap: var(--space-4);
  overflow: hidden;
  border-radius: var(--detail-card-radius, 0px);
  transform: translate3d(
      var(--detail-card-translate-x, 0px),
      var(--detail-card-translate-y, 0px),
      0
    )
    scale(var(--detail-card-scale, 1));
  transform-origin: center center;
  will-change: transform, border-radius;
  transition: none;
}

.post-detail-panel.is-returning .post-detail-panel__stage {
  transition:
    transform var(--motion-return) var(--motion-ease-standard),
    border-radius var(--motion-return) var(--motion-ease-standard);
}

.post-detail-panel__state {
  color: var(--lian-muted);
  text-align: center;
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
