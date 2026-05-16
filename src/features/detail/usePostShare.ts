import { watch, type ComputedRef, type Ref } from "vue";
import { sharePost, buildCanonicalPostUrl } from "../../platform/share";
import { configureWeChatShare } from "../../platform/wechatShare";
import type { PostDetail } from "../../types/post";

export function usePostShare(options: {
  postId: ComputedRef<number | null>;
  title: ComputedRef<string>;
  post: Ref<PostDetail | null> | ComputedRef<PostDetail | null>;
  showActionMessage: (message: string) => void;
  showError: (error: unknown, fallback: string) => void;
}) {
  // Configure WeChat right-menu share when post data loads
  watch(
    options.post,
    (nextPost) => {
      if (!nextPost?.tid) return;
      const plainBody = (nextPost.contentHtml || "").replace(/<[^>]+>/g, "").trim();
      configureWeChatShare({
        title: nextPost.title || "黎安屿你",
        desc: plainBody.slice(0, 100) || undefined,
        link: buildCanonicalPostUrl(nextPost.tid),
        imgUrl: nextPost.cover || nextPost.imageUrls?.[0] || undefined,
      });
    },
    { immediate: true },
  );

  async function handleShare() {
    if (options.postId.value == null) return;
    const result = await sharePost({ tid: options.postId.value, title: options.title.value });
    if (result.outcome === "shared" || result.outcome === "cancelled") return;
    if (result.outcome === "copied") {
      options.showActionMessage("链接已复制");
      return;
    }
    // WeChat: show hint to use the right-menu share
    if (result.outcome === "use-wechat-menu") {
      options.showActionMessage(result.message);
      return;
    }
    options.showError(null, result.message);
  }

  return {
    handleShare,
  };
}
