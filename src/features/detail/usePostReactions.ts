import { ref } from "vue";
import { LianApiError } from "../../api/http";
import { togglePostLike, togglePostSave } from "../../api/posts";
import type { PostDetail } from "../../types/post";

type ReactionAction = "like" | "save";

const AUTH_CODE_PATTERN = /(?:unauthorized|forbidden|auth(?:_| )?(?:required|invalid|expired)|invalid[_-]?session|session[_-]?expired)/i;
const RATE_LIMIT_CODE_PATTERN = /(?:rate[_-]?limit|too[_-]?many[_-]?requests)/i;
const NETWORK_MESSAGE_PATTERN =
  /(?:failed to fetch|fetch failed|network ?error|network request failed|load failed|timeout)/i;
const SERVICE_MESSAGE_PATTERN =
  /(?:service unavailable|upstream[_ ]error|bad gateway|gateway timeout|internal server error|temporarily unavailable)/i;

const REACTION_SUCCESS_COPY: Record<ReactionAction, { active: string; inactive: string }> = {
  like: {
    active: "已标记喜欢。",
    inactive: "已取消喜欢。",
  },
  save: {
    active: "已加入收藏。",
    inactive: "已取消收藏。",
  },
};

const REACTION_ERROR_COPY: Record<
  ReactionAction,
  { auth: string; rateLimit: string; network: string; fallback: string }
> = {
  like: {
    auth: "登录状态已失效，喜欢状态已恢复，请重新登录后再试。",
    rateLimit: "操作太频繁了，喜欢状态已恢复，请稍后再试。",
    network: "网络有点不稳，喜欢状态已恢复，请检查连接后重试。",
    fallback: "喜欢操作没成功，已恢复原状态，请稍后再试。",
  },
  save: {
    auth: "登录状态已失效，收藏状态已恢复，请重新登录后再试。",
    rateLimit: "操作太频繁了，收藏状态已恢复，请稍后再试。",
    network: "网络有点不稳，收藏状态已恢复，请检查连接后重试。",
    fallback: "收藏操作没成功，已恢复原状态，请稍后再试。",
  },
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.trim() : "";
}

function getErrorStatus(error: unknown): number {
  return error instanceof LianApiError ? error.status : 0;
}

function getErrorCode(error: unknown): string {
  return error instanceof LianApiError ? error.code.trim() : "";
}

function resolveReactionErrorMessage(action: ReactionAction, error: unknown): string {
  const copy = REACTION_ERROR_COPY[action];
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (status === 401 || status === 403 || AUTH_CODE_PATTERN.test(code)) {
    return copy.auth;
  }

  if (status === 429 || RATE_LIMIT_CODE_PATTERN.test(code)) {
    return copy.rateLimit;
  }

  if ((status === 0 && NETWORK_MESSAGE_PATTERN.test(message)) || SERVICE_MESSAGE_PATTERN.test(message)) {
    return copy.network;
  }

  return copy.fallback;
}

export function usePostReactions(options: {
  clearMessages: () => void;
  showError: (error: unknown, fallback: string) => void;
  showMessage: (message: string) => void;
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
      const settledLiked = Boolean(response.liked);
      liked.value = settledLiked;
      likeCount.value = Math.max(0, Number(response.likeCount || 0));
      options.showMessage(
        settledLiked ? REACTION_SUCCESS_COPY.like.active : REACTION_SUCCESS_COPY.like.inactive,
      );
    } catch (error) {
      if (isStillCurrent && !isStillCurrent()) return;
      liked.value = previousLiked;
      likeCount.value = previousCount;
      options.showError(new Error(resolveReactionErrorMessage("like", error)), "");
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
      const settledSaved = Boolean(response.saved);
      saved.value = settledSaved;
      options.showMessage(
        settledSaved ? REACTION_SUCCESS_COPY.save.active : REACTION_SUCCESS_COPY.save.inactive,
      );
    } catch (error) {
      if (isStillCurrent && !isStillCurrent()) return;
      saved.value = previousSaved;
      options.showError(new Error(resolveReactionErrorMessage("save", error)), "");
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
