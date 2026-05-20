import { ref, type ComputedRef } from "vue";
import { sendPostReply } from "../../api/posts";
import { resolveWriteActionErrorMessage } from "../../utils/writeActionErrors";

export function usePostReplyComposer(options: {
  postId: ComputedRef<number | null>;
  clearMessages: () => void;
  showActionMessage: (message: string) => void;
  setActionError: (message: string) => void;
  onReplySuccess: () => void;
}) {
  const replyBusy = ref(false);
  const replyExpanded = ref(false);
  const replyContent = ref("");

  function collapseReplyIfOpen() {
    if (!replyExpanded.value) return;
    replyExpanded.value = false;
  }

  async function submitReply() {
    if (options.postId.value == null || replyBusy.value) return;
    const content = replyContent.value.trim();
    if (!content) {
      options.setActionError("请先填写回复内容。");
      replyExpanded.value = true;
      return;
    }
    replyBusy.value = true;
    options.clearMessages();
    try {
      await sendPostReply(options.postId.value, content);
      replyContent.value = "";
      replyExpanded.value = false;
      options.showActionMessage("回复已发送，正在刷新详情。");
      options.onReplySuccess();
    } catch (error) {
      options.setActionError(resolveWriteActionErrorMessage("reply", error));
      replyExpanded.value = true;
    } finally {
      replyBusy.value = false;
    }
  }

  function resetReply() {
    replyExpanded.value = false;
    replyContent.value = "";
  }

  return {
    replyBusy,
    replyExpanded,
    replyContent,
    collapseReplyIfOpen,
    submitReply,
    resetReply,
  };
}
