import { ref, computed, type ComputedRef } from "vue";
import { reportPost } from "../../api/posts";
import {
  buildReportPayload,
  getReportReasonPlaceholder,
  getReportSubmissionMessage,
  REPORT_CATEGORIES,
  shouldShowReportReasonField,
} from "./reportFlow";

export function usePostReport(options: {
  postId: ComputedRef<number | null>;
  clearMessages: () => void;
  showActionMessage: (message: string) => void;
  setActionError: (message: string) => void;
}) {
  const reportBusy = ref(false);
  const reportOpen = ref(false);
  const reportReason = ref("");
  const reportFollowUpVisible = ref(false);
  const locallyHidden = ref(false);
  const reportCategory = ref(REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1].value);

  const reportReasonVisible = computed(() => shouldShowReportReasonField(reportCategory.value));
  const reportReasonPlaceholder = computed(() => getReportReasonPlaceholder(reportCategory.value));

  function toggleReport() {
    options.clearMessages();
    reportFollowUpVisible.value = false;
    reportOpen.value = !reportOpen.value;
  }

  function handleHideReportedPost() {
    locallyHidden.value = true;
    reportFollowUpVisible.value = false;
    options.clearMessages();
  }

  function undoHideReportedPost() {
    locallyHidden.value = false;
    reportFollowUpVisible.value = false;
    options.showActionMessage("这条内容已经恢复显示。");
  }

  async function handleReport() {
    if (options.postId.value == null || reportBusy.value) return;
    reportBusy.value = true;
    options.clearMessages();
    try {
      await reportPost(
        options.postId.value,
        buildReportPayload(reportCategory.value, reportReason.value),
      );
      reportOpen.value = false;
      reportReason.value = "";
      reportFollowUpVisible.value = true;
      options.showActionMessage("举报已提交。你也可以先暂时隐藏这条内容。");
    } catch (error) {
      options.setActionError(getReportSubmissionMessage(error));
    } finally {
      reportBusy.value = false;
    }
  }

  function resetReport() {
    reportOpen.value = false;
    reportReason.value = "";
    reportFollowUpVisible.value = false;
    locallyHidden.value = false;
  }

  return {
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
  };
}
