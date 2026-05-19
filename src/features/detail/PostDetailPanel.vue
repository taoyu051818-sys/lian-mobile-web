<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
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

// Shell chrome slots (`top: detail-topbar`, `bottom: reply-dock`) are now
// driven by the detail-navigation FSM at the app level, not by this component.
// The teleport targets are guaranteed to be mounted whenever the FSM is in any
// non-closed state — which is exactly when this panel is rendered.

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
</script>

<template>
  <aside class="post-detail-panel" aria-labelledby="post-detail-title">
    <Teleport defer to="#lian-shell-top-slot">
      <PostDetailTopbar
        :author-label="authorLabel"
        :avatar-url="authorAvatarUrl"
        :author-initial="authorInitial"
        :has-author-identity="hasAuthorIdentity"
        @close="emit('close')"
        @share="handleShare"
      />
    </Teleport>
    <div class="post-detail-panel__stage" @click="collapseReplyIfOpen">
      <div
        v-if="loading"
        class="post-detail-panel__state"
        data-testid="post-detail-loading"
        role="status"
      >
        {{ LOADING_DETAIL }}
      </div>

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
            :merchant="post?.merchant"
            :errand-entry-available="post?.errandEntryAvailable"
            :errand-unavailable-reason="post?.errandUnavailableReason"
            :errand-unavailable-reason-text="post?.errandUnavailableReasonText"
            :trade="post?.trade"
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

    <Teleport defer to="#lian-shell-bottom-slot">
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
    </Teleport>

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
</style>
