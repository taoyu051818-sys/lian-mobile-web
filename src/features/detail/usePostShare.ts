import { watch, type ComputedRef, type Ref } from "vue";
import { sharePost, buildCanonicalPostUrl } from "../../platform/share";
import { configureWeChatShare } from "../../platform/wechatShare";
import { APP_NAME, SHARE_LINK_COPIED } from "../../config/brand";
import type { PostDetail } from "../../types/post";
import { useShareCardPreview } from "./useShareCardPreview";

export function usePostShare(options: {
  postId: ComputedRef<number | null>;
  title: ComputedRef<string>;
  post: Ref<PostDetail | null> | ComputedRef<PostDetail | null>;
  showActionMessage: (message: string) => void;
  showError: (error: unknown, fallback: string) => void;
}) {
  const preview = useShareCardPreview();

  // Configure WeChat right-menu share when post data loads. The card preview
  // uses the V1 envelope (ps#484) which the backend already produces with
  // canonical truncation; the WeChat menu still uses post detail fields so an
  // unopened share-card sheet does not block right-menu sharing in WeChat.
  watch(
    options.post,
    (nextPost) => {
      if (!nextPost?.tid) return;
      const plainBody = (nextPost.contentHtml || "").replace(/<[^>]+>/g, "").trim();
      configureWeChatShare({
        title: nextPost.title || APP_NAME,
        desc: plainBody.slice(0, 100) || undefined,
        link: buildCanonicalPostUrl(nextPost.tid),
        imgUrl: nextPost.cover || nextPost.imageUrls?.[0] || undefined,
      });
    },
    { immediate: true },
  );

  /**
   * Share button click: open the V1 share-card preview sheet. The sheet
   * itself fetches /api/posts/:tid/share-card and shows loading/error/ready
   * states; only when the user confirms do we hand off to the
   * platform-appropriate share path (Web Share API, WeChat menu hint, or
   * clipboard fallback).
   */
  function handleShare() {
    const tid = options.postId.value;
    if (tid == null) return;
    preview.start(tid);
  }

  /**
   * Sheet "确认分享" → run the existing three-path share flow. The card
   * preview already showed the user what will be shared (title, summary,
   * thumbnail, audience), so this step only needs to invoke the OS / browser
   * share affordance. Outcome strings come from `sharePost`.
   */
  async function handleShareConfirm() {
    const tid = options.postId.value;
    if (tid == null) {
      preview.close();
      return;
    }
    const result = await sharePost({ tid, title: options.title.value });
    preview.close();
    if (result.outcome === "shared" || result.outcome === "cancelled") return;
    if (result.outcome === "copied") {
      options.showActionMessage(SHARE_LINK_COPIED);
      return;
    }
    if (result.outcome === "use-wechat-menu") {
      options.showActionMessage(result.message);
      return;
    }
    options.showError(null, result.message);
  }

  function handleShareClose() {
    preview.close();
  }

  function handleShareRetry() {
    preview.retry();
  }

  return {
    handleShare,
    handleShareConfirm,
    handleShareClose,
    handleShareRetry,
    sharePreviewOpen: preview.open,
    sharePreviewStatus: preview.status,
    sharePreviewCard: preview.card,
    sharePreviewErrorMessage: preview.errorMessage,
    sharePreviewCanRetry: preview.canRetry,
  };
}
