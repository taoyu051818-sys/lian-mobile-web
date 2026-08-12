import type { FeedItemId } from "../../types/feed";

export type PostReactionSettlementInput =
  | Readonly<{
      kind: "like";
      tid: FeedItemId;
      liked: boolean;
      likeCount: number;
    }>
  | Readonly<{
      kind: "save";
      tid: FeedItemId;
      bookmarked: boolean;
    }>;

export type PostReactionSettlement =
  | Readonly<{
      sequence: number;
      kind: "like";
      tid: FeedItemId;
      liked: boolean;
      likeCount: number;
    }>
  | Readonly<{
      sequence: number;
      kind: "save";
      tid: FeedItemId;
      bookmarked: boolean;
    }>;

export interface PostReactionSettlementPort {
  currentSequence(): number;
  publish(input: PostReactionSettlementInput): PostReactionSettlement | null;
  subscribe(listener: (event: PostReactionSettlement) => void): () => void;
}

function normalizeLikeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function validTid(tid: FeedItemId): boolean {
  return Number.isInteger(tid) && tid > 0;
}

export function createPostReactionSettlementChannel(): PostReactionSettlementPort {
  let sequence = 0;
  const listeners = new Set<(event: PostReactionSettlement) => void>();

  return {
    currentSequence() {
      return sequence;
    },
    publish(input) {
      if (!validTid(input.tid)) return null;

      const nextSequence = ++sequence;
      const event: PostReactionSettlement =
        input.kind === "like"
          ? Object.freeze({
              sequence: nextSequence,
              kind: "like",
              tid: input.tid,
              liked: Boolean(input.liked),
              likeCount: normalizeLikeCount(input.likeCount),
            })
          : Object.freeze({
              sequence: nextSequence,
              kind: "save",
              tid: input.tid,
              bookmarked: Boolean(input.bookmarked),
            });

      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch {
          // Settlement delivery is observational. A bad listener must not turn
          // an already-successful API action into an application failure.
        }
      }
      return event;
    },
    subscribe(listener) {
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(listener);
      };
    },
  };
}

export const postReactionSettlements = createPostReactionSettlementChannel();
