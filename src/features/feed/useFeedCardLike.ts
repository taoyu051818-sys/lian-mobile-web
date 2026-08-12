import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { togglePostLike } from "../../api/posts";
import { FEED_LIKE, FEED_UNLIKE } from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import { postReactionSettlements, type PostReactionSettlementPort } from "../reactions";

export interface FeedCardLikeDependencies {
  toggleLike?: typeof togglePostLike;
}

export interface UseFeedCardLikeOptions {
  tid: Readonly<Ref<FeedItemId>>;
  liked: Readonly<Ref<boolean | undefined>>;
  likeCount: Readonly<Ref<number | undefined>>;
  settlements?: PostReactionSettlementPort;
  dependencies?: FeedCardLikeDependencies;
}

interface FeedCardLikeAttempt {
  readonly tid: FeedItemId;
  readonly ownerGeneration: number;
  readonly ticket: number;
  readonly desiredLiked: boolean;
}

function normalizeLikeCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function isValidTid(tid: FeedItemId): boolean {
  return Number.isInteger(tid) && tid > 0;
}

export function useFeedCardLike(options: UseFeedCardLikeOptions): {
  liked: Readonly<Ref<boolean>>;
  likeCount: Readonly<Ref<number>>;
  likeBusy: Readonly<Ref<boolean>>;
  likeLabel: Readonly<Ref<string>>;
  handleLike(): Promise<void>;
  dispose(): void;
} {
  const settlements = options.settlements ?? postReactionSettlements;
  const toggleLike = options.dependencies?.toggleLike ?? togglePostLike;

  const liked = ref(false);
  const likeCount = ref(0);
  const likeBusy = ref(false);
  const likeLabel = computed(
    () => `${liked.value ? FEED_UNLIKE : FEED_LIKE}，当前 ${likeCount.value} 个喜欢`,
  );

  let baselineLiked = false;
  let baselineLikeCount = 0;
  let observedTid: FeedItemId;
  let hasObservedTid = false;
  let ownerGeneration = 0;
  let likeTicket = 0;
  let activeAttempt: FeedCardLikeAttempt | null = null;
  let disposed = false;

  const stopInputWatch = watch(
    () => [options.tid.value, options.liked.value, options.likeCount.value] as const,
    ([nextTid, nextLiked, nextLikeCount]) => {
      const ownerChanged = hasObservedTid && !Object.is(observedTid, nextTid);
      observedTid = nextTid;
      hasObservedTid = true;

      if (ownerChanged) {
        ownerGeneration += 1;
        likeTicket += 1;
        activeAttempt = null;
        likeBusy.value = false;
      }

      baselineLiked = Boolean(nextLiked);
      baselineLikeCount = normalizeLikeCount(nextLikeCount);
      liked.value = baselineLiked;
      likeCount.value = baselineLikeCount;
    },
    { flush: "sync", immediate: true },
  );

  function ownsAttempt(attempt: FeedCardLikeAttempt): boolean {
    return (
      !disposed &&
      ownerGeneration === attempt.ownerGeneration &&
      likeTicket === attempt.ticket &&
      activeAttempt === attempt
    );
  }

  async function handleLike(): Promise<void> {
    const tid = options.tid.value;
    if (disposed || likeBusy.value || !isValidTid(tid)) return;

    const desiredLiked = !liked.value;
    const attempt: FeedCardLikeAttempt = {
      tid,
      ownerGeneration,
      ticket: ++likeTicket,
      desiredLiked,
    };
    activeAttempt = attempt;
    liked.value = desiredLiked;
    likeCount.value = normalizeLikeCount(likeCount.value + (desiredLiked ? 1 : -1));
    likeBusy.value = true;

    let response: Awaited<ReturnType<typeof toggleLike>>;
    try {
      response = await toggleLike(attempt.tid, attempt.desiredLiked);
    } catch {
      if (!ownsAttempt(attempt)) return;
      liked.value = baselineLiked;
      likeCount.value = baselineLikeCount;
      activeAttempt = null;
      likeBusy.value = false;
      return;
    }

    if (!ownsAttempt(attempt)) return;
    const settledLiked = Boolean(response.liked);
    const settledLikeCount = normalizeLikeCount(response.likeCount);
    baselineLiked = settledLiked;
    baselineLikeCount = settledLikeCount;
    liked.value = settledLiked;
    likeCount.value = settledLikeCount;
    activeAttempt = null;
    likeBusy.value = false;
    settlements.publish(
      Object.freeze({
        kind: "like",
        tid: attempt.tid,
        liked: settledLiked,
        likeCount: settledLikeCount,
      }),
    );
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    ownerGeneration += 1;
    likeTicket += 1;
    activeAttempt = null;
    likeBusy.value = false;
    stopInputWatch();
  }

  onScopeDispose(dispose);

  return {
    liked,
    likeCount,
    likeBusy,
    likeLabel,
    handleLike,
    dispose,
  };
}
