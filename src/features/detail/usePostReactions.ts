import { ref } from "vue";
import { togglePostLike, togglePostSave } from "../../api/posts";
import { ERROR_LIKE_ACTION, ERROR_SAVE_ACTION } from "../../config/brand";
import type { PostDetail } from "../../types/post";

export function usePostReactions(options: {
  clearMessages: () => void;
  showError: (error: unknown, fallback: string) => void;
}) {
  const liked = ref(false);
  const saved = ref(false);
  const likeCount = ref(0);
  const likeBusy = ref(false);
  const saveBusy = ref(false);

  async function handleLike(postId: number | null, isStillCurrent?: () => boolean) {
    if (postId == null || likeBusy.value) return;
    const previousLiked = liked.value;
    const previousCount = likeCount.value;
    const nextLiked = !previousLiked;
    liked.value = nextLiked;
    likeCount.value = Math.max(0, previousCount + (nextLiked ? 1 : -1));
    likeBusy.value = true;
    options.clearMessages();
    try {
      const response = await togglePostLike(postId, nextLiked);
      if (isStillCurrent && !isStillCurrent()) return;
      liked.value = Boolean(response.liked);
      likeCount.value = Math.max(0, Number(response.likeCount || 0));
    } catch (error) {
      if (isStillCurrent && !isStillCurrent()) return;
      liked.value = previousLiked;
      likeCount.value = previousCount;
      options.showError(error, ERROR_LIKE_ACTION);
    } finally {
      if (!isStillCurrent || isStillCurrent()) likeBusy.value = false;
    }
  }

  async function handleSave(postId: number | null, isStillCurrent?: () => boolean) {
    if (postId == null || saveBusy.value) return;
    const previousSaved = saved.value;
    const nextSaved = !previousSaved;
    saved.value = nextSaved;
    saveBusy.value = true;
    options.clearMessages();
    try {
      const response = await togglePostSave(postId, nextSaved);
      if (isStillCurrent && !isStillCurrent()) return;
      saved.value = Boolean(response.saved);
    } catch (error) {
      if (isStillCurrent && !isStillCurrent()) return;
      saved.value = previousSaved;
      options.showError(error, ERROR_SAVE_ACTION);
    } finally {
      if (!isStillCurrent || isStillCurrent()) saveBusy.value = false;
    }
  }

  function resetReactions(nextPost?: PostDetail | null) {
    liked.value = Boolean(nextPost?.liked);
    saved.value = Boolean(nextPost?.bookmarked);
    likeCount.value = Math.max(0, Number(nextPost?.likeCount || 0));
    likeBusy.value = false;
    saveBusy.value = false;
  }

  return {
    liked,
    saved,
    likeCount,
    likeBusy,
    saveBusy,
    handleLike,
    handleSave,
    resetReactions,
  };
}
