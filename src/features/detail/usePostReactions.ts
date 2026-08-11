import { onScopeDispose, ref } from "vue";
import { LianApiError } from "../../api/http";
import { togglePostLike, togglePostSave } from "../../api/posts";
import type { PostDetail } from "../../types/post";
import {
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../features/reactions";

type ReactionAction = "like" | "save";

interface LikeAttempt {
  readonly tid: number;
  readonly generation: number;
  readonly ticket: number;
  readonly desiredLiked: boolean;
  readonly admissionSequence: number;
}

interface SaveAttempt {
  readonly tid: number;
  readonly generation: number;
  readonly ticket: number;
  readonly desiredSaved: boolean;
  readonly admissionSequence: number;
}

const AUTH_CODE_PATTERN =
  /(?:unauthorized|forbidden|auth(?:_| )?(?:required|invalid|expired)|invalid[_-]?session|session[_-]?expired)/i;
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

  if (
    (status === 0 && NETWORK_MESSAGE_PATTERN.test(message)) ||
    SERVICE_MESSAGE_PATTERN.test(message)
  ) {
    return copy.network;
  }

  return copy.fallback;
}

export function usePostReactions(options: {
  clearMessages: () => void;
  showError: (error: unknown, fallback: string) => void;
  showMessage: (message: string) => void;
  settlements?: PostReactionSettlementPort;
}) {
  const settlements = options.settlements ?? postReactionSettlements;
  const liked = ref(false);
  const saved = ref(false);
  const likeCount = ref(0);
  const likeBusy = ref(false);
  const saveBusy = ref(false);

  let currentTid: number | null = null;
  let baselineLiked = false;
  let baselineLikeCount = 0;
  let baselineSaved = false;
  let generation = 0;
  let likeTicket = 0;
  let saveTicket = 0;
  let likeAttempt: LikeAttempt | null = null;
  let saveAttempt: SaveAttempt | null = null;
  let latestLikeSequence = 0;
  let latestSaveSequence = 0;
  let disposed = false;

  function normalizedLikeCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  }

  function externalOwnerIsCurrent(predicate?: () => boolean): boolean {
    return predicate ? predicate() : true;
  }

  function validTid(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) > 0;
  }

  function ownsLike(attempt: LikeAttempt, predicate?: () => boolean): boolean {
    return (
      !disposed &&
      currentTid === attempt.tid &&
      generation === attempt.generation &&
      likeTicket === attempt.ticket &&
      likeAttempt === attempt &&
      externalOwnerIsCurrent(predicate)
    );
  }

  function ownsSave(attempt: SaveAttempt, predicate?: () => boolean): boolean {
    return (
      !disposed &&
      currentTid === attempt.tid &&
      generation === attempt.generation &&
      saveTicket === attempt.ticket &&
      saveAttempt === attempt &&
      externalOwnerIsCurrent(predicate)
    );
  }

  function consumeSettlement(event: PostReactionSettlement): void {
    if (disposed || !validTid(event.tid) || event.tid !== currentTid) return;

    if (event.kind === "like") {
      if (!Number.isInteger(event.sequence) || event.sequence <= latestLikeSequence) return;
      latestLikeSequence = event.sequence;
      baselineLiked = Boolean(event.liked);
      baselineLikeCount = normalizedLikeCount(event.likeCount);
      if (!likeAttempt || event.sequence > likeAttempt.admissionSequence) {
        liked.value = baselineLiked;
        likeCount.value = baselineLikeCount;
      }
      return;
    }

    if (!Number.isInteger(event.sequence) || event.sequence <= latestSaveSequence) return;
    latestSaveSequence = event.sequence;
    baselineSaved = Boolean(event.bookmarked);
    if (!saveAttempt || event.sequence > saveAttempt.admissionSequence) {
      saved.value = baselineSaved;
    }
  }

  const unsubscribe = settlements.subscribe(consumeSettlement);

  async function handleLike(postId: number | null, isStillCurrent?: () => boolean) {
    if (
      disposed ||
      !validTid(postId) ||
      postId !== currentTid ||
      likeBusy.value ||
      !externalOwnerIsCurrent(isStillCurrent)
    ) {
      return;
    }

    const desiredLiked = !liked.value;
    const attempt: LikeAttempt = {
      tid: postId,
      generation,
      ticket: ++likeTicket,
      desiredLiked,
      admissionSequence: settlements.currentSequence(),
    };
    likeAttempt = attempt;
    liked.value = desiredLiked;
    likeCount.value = Math.max(0, likeCount.value + (desiredLiked ? 1 : -1));
    likeBusy.value = true;
    options.clearMessages();
    try {
      const response = await togglePostLike(attempt.tid, attempt.desiredLiked);
      if (!ownsLike(attempt, isStillCurrent)) return;
      const settledLiked = Boolean(response.liked);
      const settledLikeCount = normalizedLikeCount(response.likeCount);
      baselineLiked = settledLiked;
      baselineLikeCount = settledLikeCount;
      liked.value = baselineLiked;
      likeCount.value = baselineLikeCount;
      likeAttempt = null;
      likeBusy.value = false;
      try {
        options.showMessage(
          settledLiked ? REACTION_SUCCESS_COPY.like.active : REACTION_SUCCESS_COPY.like.inactive,
        );
      } catch {
        // Feedback is observational and cannot reinterpret an authoritative success.
      }
      settlements.publish({
        kind: "like",
        tid: attempt.tid,
        liked: settledLiked,
        likeCount: settledLikeCount,
      });
    } catch (error) {
      if (!ownsLike(attempt, isStillCurrent)) return;
      liked.value = baselineLiked;
      likeCount.value = baselineLikeCount;
      likeAttempt = null;
      likeBusy.value = false;
      try {
        options.showError(new Error(resolveReactionErrorMessage("like", error)), "");
      } catch {
        // Feedback is observational and cannot keep a failed action active.
      }
    }
  }

  async function handleSave(postId: number | null, isStillCurrent?: () => boolean) {
    if (
      disposed ||
      !validTid(postId) ||
      postId !== currentTid ||
      saveBusy.value ||
      !externalOwnerIsCurrent(isStillCurrent)
    ) {
      return;
    }

    const desiredSaved = !saved.value;
    const attempt: SaveAttempt = {
      tid: postId,
      generation,
      ticket: ++saveTicket,
      desiredSaved,
      admissionSequence: settlements.currentSequence(),
    };
    saveAttempt = attempt;
    saved.value = desiredSaved;
    saveBusy.value = true;
    options.clearMessages();
    try {
      const response = await togglePostSave(attempt.tid, attempt.desiredSaved);
      if (!ownsSave(attempt, isStillCurrent)) return;
      const settledSaved = Boolean(response.saved);
      baselineSaved = settledSaved;
      saved.value = baselineSaved;
      saveAttempt = null;
      saveBusy.value = false;
      try {
        options.showMessage(
          settledSaved ? REACTION_SUCCESS_COPY.save.active : REACTION_SUCCESS_COPY.save.inactive,
        );
      } catch {
        // Feedback is observational and cannot reinterpret an authoritative success.
      }
      settlements.publish({ kind: "save", tid: attempt.tid, bookmarked: settledSaved });
    } catch (error) {
      if (!ownsSave(attempt, isStillCurrent)) return;
      saved.value = baselineSaved;
      saveAttempt = null;
      saveBusy.value = false;
      try {
        options.showError(new Error(resolveReactionErrorMessage("save", error)), "");
      } catch {
        // Feedback is observational and cannot keep a failed action active.
      }
    }
  }

  function resetReactions(nextPost?: PostDetail | null) {
    if (disposed) return;
    generation += 1;
    likeTicket += 1;
    saveTicket += 1;
    likeAttempt = null;
    saveAttempt = null;
    likeBusy.value = false;
    saveBusy.value = false;
    currentTid = validTid(nextPost?.tid) ? nextPost.tid : null;
    baselineLiked = Boolean(nextPost?.liked);
    baselineLikeCount = normalizedLikeCount(nextPost?.likeCount);
    baselineSaved = Boolean(nextPost?.bookmarked);
    liked.value = baselineLiked;
    likeCount.value = baselineLikeCount;
    saved.value = baselineSaved;
    const sequenceFloor = settlements.currentSequence();
    latestLikeSequence = sequenceFloor;
    latestSaveSequence = sequenceFloor;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    try {
      unsubscribe();
    } catch {
      // The terminal state must still retire local work if a custom port misbehaves.
    }
    generation += 1;
    likeTicket += 1;
    saveTicket += 1;
    likeAttempt = null;
    saveAttempt = null;
    likeBusy.value = false;
    saveBusy.value = false;
  }

  onScopeDispose(dispose);

  return {
    liked,
    saved,
    likeCount,
    likeBusy,
    saveBusy,
    handleLike,
    handleSave,
    resetReactions,
    dispose,
  };
}
