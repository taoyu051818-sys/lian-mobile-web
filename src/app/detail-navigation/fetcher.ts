/**
 * Side-effect helper that bridges the reducer's `fetch` effect to the network.
 *
 * The reducer is pure; it never holds a Promise. When it emits a fetch effect
 * with a tid + token, this function resolves that to a `fetch-result` action
 * and dispatches it back. Stale results (token mismatch) are dropped inside
 * the reducer, not here — keeping the staleness check in one place.
 */

import { fetchPostDetail } from "../../api/posts";
import {
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../features/reactions";
import type { PostDetail } from "../../types/post";
import type { DetailAction } from "./state";

export type DetailDispatch = (action: DetailAction) => void;

export interface FetchDetailWithTokenOptions {
  settlements?: PostReactionSettlementPort;
  signal?: AbortSignal;
}

type LikeSettlement = Extract<PostReactionSettlement, { kind: "like" }>;
type SaveSettlement = Extract<PostReactionSettlement, { kind: "save" }>;

export async function fetchDetailWithToken(
  tid: number,
  token: number,
  dispatch: DetailDispatch,
  options?: FetchDetailWithTokenOptions,
): Promise<void> {
  const settlements = options?.settlements ?? postReactionSettlements;
  const signal = options?.signal;
  if (signal?.aborted) return;

  let terminal = false;
  let collecting = false;
  let boundary = 0;
  const latestSettlements: {
    like: LikeSettlement | null;
    save: SaveSettlement | null;
  } = { like: null, save: null };
  let unsubscribe: (() => void) | null = null;

  const releaseSubscription = (): void => {
    const release = unsubscribe;
    unsubscribe = null;
    release?.();
  };

  const terminate = (): void => {
    if (terminal) return;
    terminal = true;
    collecting = false;
    latestSettlements.like = null;
    latestSettlements.save = null;
    releaseSubscription();
  };

  const collectSettlement = (event: PostReactionSettlement): void => {
    if (terminal || !collecting || !Object.is(event.tid, tid)) return;

    if (event.kind === "like") {
      if (
        event.sequence <= boundary ||
        event.sequence <= (latestSettlements.like?.sequence ?? boundary)
      ) {
        return;
      }
      latestSettlements.like = event;
      return;
    }

    if (
      event.sequence <= boundary ||
      event.sequence <= (latestSettlements.save?.sequence ?? boundary)
    ) {
      return;
    }
    latestSettlements.save = event;
  };

  unsubscribe = settlements.subscribe(collectSettlement);
  const handleAbort = (): void => terminate();
  signal?.addEventListener("abort", handleAbort, { once: true });

  if (signal?.aborted || terminal) {
    terminate();
    signal?.removeEventListener("abort", handleAbort);
    releaseSubscription();
    return;
  }

  boundary = settlements.currentSequence();
  if (signal?.aborted || terminal) {
    terminate();
    signal?.removeEventListener("abort", handleAbort);
    releaseSubscription();
    return;
  }

  collecting = true;

  try {
    let post: PostDetail;
    try {
      post = await fetchPostDetail(tid);
    } catch (err) {
      if (!terminal && !signal?.aborted) {
        dispatch({ type: "fetch-result", token, result: { err } });
      }
      return;
    }

    if (terminal || signal?.aborted) return;

    const latestLike = latestSettlements.like;
    const latestSave = latestSettlements.save;
    let projectedPost = post;
    if (Object.is(post.tid, tid) && (latestLike || latestSave)) {
      projectedPost = {
        ...post,
        ...(latestLike ? { liked: latestLike.liked, likeCount: latestLike.likeCount } : undefined),
        ...(latestSave ? { bookmarked: latestSave.bookmarked } : undefined),
      };
    }

    if (terminal || signal?.aborted) return;
    dispatch({ type: "fetch-result", token, result: { ok: projectedPost } });
  } finally {
    signal?.removeEventListener("abort", handleAbort);
    terminate();
    releaseSubscription();
  }
}
