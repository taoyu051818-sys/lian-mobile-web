import { type ComputedRef } from "vue";
import { sharePost } from "../../platform/share";

export function usePostShare(options: {
  postId: ComputedRef<number | null>;
  title: ComputedRef<string>;
  showActionMessage: (message: string) => void;
  showError: (error: unknown, fallback: string) => void;
}) {
  async function handleShare() {
    if (options.postId.value == null) return;
    const result = await sharePost({ tid: options.postId.value, title: options.title.value });
    if (result.outcome === "shared" || result.outcome === "cancelled") return;
    if (result.outcome === "copied") {
      options.showActionMessage("链接已复制");
      return;
    }
    options.showError(null, result.message);
  }

  return {
    handleShare,
  };
}
