<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { InlineError } from "../../ui";
import {
  LOADING_DETAIL,
  DETAIL_RELOAD,
  REPLY_IDENTITY_LABEL,
  SERVERCHAN_DIALOG_EVENT_BODY,
  SERVERCHAN_DIALOG_EVENT_PRIMARY,
  SERVERCHAN_DIALOG_EVENT_SECONDARY,
  SERVERCHAN_DIALOG_EVENT_TITLE,
  SERVERCHAN_DIALOG_REMINDER_ENABLED,
  SERVERCHAN_DIALOG_REMINDER_FAILED,
  TRUST_SIGNAL_IDENTITY_PREFIX,
  TRUST_SIGNAL_UNKNOWN,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PostDetail } from "../../types/post";
import PostDetailTopbar from "./PostDetailTopbar.vue";
import PostDetailContent from "./PostDetailContent.vue";
import PostDetailHiddenState from "./PostDetailHiddenState.vue";
import PostDetailLightbox from "./PostDetailLightbox.vue";
import PostDetailTradeManageBlock from "./PostDetailTradeManageBlock.vue";
import PostReplies from "./PostReplies.vue";
import PostReplyDock from "./PostReplyDock.vue";
import ShareCardSheet from "./ShareCardSheet.vue";
import { ServerChanOptInDialog } from "../profile";
import { usePostDetailPresentation } from "./usePostDetailPresentation";
import { usePostReactions } from "./usePostReactions";
import { usePlaceSheetLoader } from "./usePlaceSheetLoader";
import { usePostReport } from "./usePostReport";
import { usePostReplyComposer } from "./usePostReplyComposer";
import { usePostShare } from "./usePostShare";
import { useDetailGallery } from "./useDetailGallery";
import { useViewerErrandPermission } from "./useViewerErrandPermission";
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

const actionError = ref("");
const actionMessage = ref("");
const post = computed(() => props.post);

function resolveDetailTrustSignal() {
  if (post.value?.source?.visible === false) return null;
  return (
    post.value?.source?.label ||
    (post.value?.actor?.identityTag
      ? `${TRUST_SIGNAL_IDENTITY_PREFIX}${post.value.actor.identityTag}`
      : "") ||
    (post.value?.source ? TRUST_SIGNAL_UNKNOWN : null)
  );
}

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
} = usePostReactions({ clearMessages, showError: showActionError, showMessage: showActionMessage });

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
    showActionMessage,
    setActionError,
    onReplySuccess: () => emit("retry"),
  });

const {
  handleShare,
  handleShareConfirm,
  handleShareClose,
  handleShareRetry,
  sharePreviewOpen,
  sharePreviewStatus,
  sharePreviewCard,
  sharePreviewErrorMessage,
  sharePreviewCanRetry,
} = usePostShare({
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

const { campusVerified, isAuthenticated, refresh: refreshViewerAuth } = useViewerErrandPermission();
const viewerCanOrderErrand = computed(() => campusVerified.value);

const {
  liveEvent,
  eventPlan,
  eventBusy,
  eventActionError,
  handleEventAct,
  eventManageable,
  eventCompleteBusy,
  eventCompleteActionError,
  handleEventComplete,
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
  serverChanOptIn,
} = usePostDetailExtensions({
  post,
  postId,
  isAuthenticated,
  onMessage: showActionMessage,
});

async function handleServerChanOptInPrimary() {
  const ok = await serverChanOptIn.confirmOptIn();
  if (ok) {
    showActionMessage(SERVERCHAN_DIALOG_REMINDER_ENABLED);
  } else {
    setActionError(SERVERCHAN_DIALOG_REMINDER_FAILED);
  }
}

function handleServerChanOptInDismiss() {
  serverChanOptIn.dismiss();
}

function handleHelpOpenLinkedEvent(tid: number) {
  void tid;
  emit("retry");
}

// PRD V0.3 §2.4 / B3-1 — `availableActions[]` button click bubbles up to the
// panel as a `(type)` payload. The panel intentionally does NOT call any
// per-type RPC handler yet — the backend's authoritative action enum is still
// settling (parent issue tracks the source-of-truth ticket). When the enum
// lands, dispatch happens here; for now the click is a no-op so the data
// surface is observable end-to-end without committing to a wire contract we
// can't honor.
function handleAvailableActionInvoked(type: string) {
  void type;
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
    void refreshViewerAuth();
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
        :trust-signal="resolveDetailTrustSignal()"
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

      <InlineError
        v-else-if="error"
        :action-label="DETAIL_RELOAD"
        :action-loading="loading"
        @action="emit('retry')"
      >
        {{ error }}
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
            :post-type="post?.type"
            :event="liveEvent"
            :event-plan="eventPlan"
            :event-busy="eventBusy"
            :event-action-error="eventActionError"
            :event-manageable="eventManageable"
            :event-complete-busy="eventCompleteBusy"
            :event-complete-action-error="eventCompleteActionError"
            :help="liveHelp"
            :help-plan="helpPlan"
            :help-busy="helpBusy"
            :help-action-error="helpActionError"
            :help-manage-plan="helpManagePlan"
            :help-manage-busy="helpManageBusy"
            :help-manage-action-error="helpManageActionError"
            :merchant="post?.merchant"
            :errand-entry-available="post?.errandEntryAvailable"
            :merchant-post-id="post?.tid"
            :errand-unavailable-reason="post?.errandUnavailableReason"
            :errand-unavailable-reason-text="post?.errandUnavailableReasonText"
            :viewer-can-order-errand="viewerCanOrderErrand"
            :trade="post?.trade"
            :visibility="post?.visibility"
            :metadata="post?.metadata"
            :relations="post?.relations"
            :available-actions="post?.availableActions"
            @gallery-pointer-down="handleGalleryPointerDown"
            @gallery-pointer-move="handleGalleryPointerMove"
            @open-gallery-image="openGalleryImage"
            @open-place-sheet="openPlaceSheet"
            @toggle-report="toggleReport"
            @submit-report="handleReport"
            @hide-reported-post="handleHideReportedPost"
            @event-act="handleEventAct"
            @event-complete="handleEventComplete"
            @help-act="handleHelpAct"
            @help-open-linked-event="handleHelpOpenLinkedEvent"
            @help-manage-link-event="handleHelpManageLinkEvent"
            @help-manage-unlink-event="handleHelpManageUnlinkEvent"
            @help-manage-resolve="handleHelpManageResolve"
            @available-action-invoked="handleAvailableActionInvoked"
            @update:report-category="reportCategory = $event"
            @update:report-reason="reportReason = $event"
            @update:place-sheet-open="placeSheetOpen = $event"
          />

          <PostDetailTradeManageBlock
            :post="post"
            @retry="emit('retry')"
            @action-message="showActionMessage"
            @action-error="setActionError"
          />

          <PostReplies :replies="replies" />
        </template>
      </template>
    </div>

    <Teleport defer to="#lian-detail-surface-dock-slot">
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
    <ShareCardSheet
      :open="sharePreviewOpen"
      :status="sharePreviewStatus"
      :card="sharePreviewCard"
      :error-message="sharePreviewErrorMessage"
      :can-retry="sharePreviewCanRetry"
      @close="handleShareClose"
      @confirm="handleShareConfirm"
      @retry="handleShareRetry"
    />
    <ServerChanOptInDialog
      :open="serverChanOptIn.state.value.open && serverChanOptIn.state.value.kind === 'event-start'"
      :title="SERVERCHAN_DIALOG_EVENT_TITLE"
      :body="SERVERCHAN_DIALOG_EVENT_BODY"
      :primary-label="SERVERCHAN_DIALOG_EVENT_PRIMARY"
      :secondary-label="SERVERCHAN_DIALOG_EVENT_SECONDARY"
      :busy="serverChanOptIn.state.value.busy"
      @primary="() => void handleServerChanOptInPrimary()"
      @secondary="handleServerChanOptInDismiss"
      @close="handleServerChanOptInDismiss"
    />
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
</style>
