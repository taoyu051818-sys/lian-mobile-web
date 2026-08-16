/**
 * feed + detail + reactions + events + help fixtures.
 *
 * Envelopes match the real adapters:
 *   - `/api/feed` -> `{ items, hasMore, nextPage }`. `tabs` is deliberately
 *     omitted so `normalizeTabs(undefined)` falls back to DEFAULT_TABS instead
 *     of this fixture inventing a competing tab contract.
 *   - `/api/posts/:id` -> the post record at the top level with `replies`
 *     inline (see normalizePostDetail in src/api/posts.ts).
 *   - like -> `{ liked, likeCount }`, save -> `{ saved }`,
 *     reactions -> `{ tid, count, liked|voted|active }`.
 *
 * Like/save/vote/reply state is read from and written to the in-memory write
 * store, so toggling in the UI survives a re-fetch within the session and is
 * wiped by Reset. Nothing is persisted server-side.
 */

import { fixtureJson, fixtureNoContent } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureRequestContext } from "../types";
import {
  addReply,
  getPostVote,
  getReplies,
  isPostLiked,
  isPostSaved,
  setPostVote,
  togglePostLike,
  togglePostSave,
  isEventJoined,
  toggleEventJoin,
} from "../writes";
import {
  area,
  bodyPreview,
  buildList,
  countFor,
  displayName,
  isPartial,
  localCover,
  postTitle,
  timeLabelFor,
  timestampFor,
} from "./support";

const CONTENT_TYPES = ["photo", "event", "trade", "help", "club", "project", "review"] as const;
const BASE_TID = 90_000;

function actorFor(index: number) {
  const name = displayName(index);
  return {
    id: `u-actor-${index}`,
    name,
    username: name,
    displayName: name,
    identityTags: index % 3 === 0 ? ["在校生"] : [],
  };
}

function feedItem(context: FixtureRequestContext, index: number) {
  const partial = isPartial(context.scenario, index);
  const contentType = CONTENT_TYPES[index % CONTENT_TYPES.length] as string;
  const tid = BASE_TID + index;
  const id = String(tid);
  return {
    tid,
    title: postTitle(index, context.scenario),
    // `partial-data` drops the summary so the "no preview" branch renders.
    bodyPreview: partial ? "" : bodyPreview(index, context.scenario),
    cover: partial || contentType === "help" ? "" : localCover(index),
    primaryTag: partial ? "" : contentType,
    actor: partial ? null : actorFor(index),
    timeLabel: timeLabelFor(index),
    timestampISO: timestampFor(index),
    likeCount: countFor(index, context.scenario),
    liked: isPostLiked(id, index % 5 === 0),
    bookmarked: isPostSaved(id, index % 7 === 0),
    locationArea: partial ? "" : area(index),
    contentType,
    visibility: index % 6 === 0 ? "campus" : "public",
  };
}

function postDetail(context: FixtureRequestContext, id: string) {
  const numeric = Number(id);
  const index = Number.isFinite(numeric) ? Math.max(0, numeric - BASE_TID) : 0;
  const base = feedItem(context, index);
  const extraReplies = getReplies(id);
  const seededReplies =
    context.scenario === "empty"
      ? []
      : buildList(context.scenario, context.volume, (replyIndex) => ({
          id: `seed-reply-${index}-${replyIndex}`,
          body: bodyPreview(replyIndex + index, context.scenario),
          actor: actorFor(replyIndex + 1),
          timeLabel: timeLabelFor(replyIndex),
          timestampISO: timestampFor(replyIndex),
          likeCount: countFor(replyIndex, context.scenario),
        })).slice(0, 12);

  return {
    ...base,
    tid: Number.isFinite(numeric) ? numeric : base.tid,
    body: context.scenario === "empty" ? "" : bodyPreview(index, context.scenario),
    replies: [
      ...seededReplies,
      ...extraReplies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        actor: actorFor(0),
        timeLabel: "刚刚",
        timestampISO: reply.createdAt,
        likeCount: 0,
      })),
    ],
    replyCount: seededReplies.length + extraReplies.length,
  };
}

export function registerContentFixtures(): void {
  registerFixtureFamily("feed", [
    [
      "GET",
      "/api/feed",
      (context) => {
        const items = buildList(context.scenario, context.volume, (index) =>
          feedItem(context, index),
        );
        const page = Number(context.query.get("page") ?? "1") || 1;
        return fixtureJson({
          items,
          hasMore: context.scenario === "many-items" && page < 3,
          nextPage: context.scenario === "many-items" && page < 3 ? page + 1 : null,
        });
      },
    ],
  ]);

  registerFixtureFamily("detail", [
    [
      "GET",
      "/api/posts/:id",
      (context) => fixtureJson(postDetail(context, context.params.id ?? "")),
    ],
    [
      "GET",
      "/api/posts/:id/replies",
      (context) => {
        const detail = postDetail(context, context.params.id ?? "");
        return fixtureJson({ items: detail.replies, hasMore: false });
      },
    ],
    [
      "POST",
      "/api/posts/:id/replies",
      (context) => {
        const body = (context.body ?? {}) as Record<string, unknown>;
        const text =
          typeof body.body === "string"
            ? body.body
            : typeof body.content === "string"
              ? body.content
              : "";
        if (!text.trim()) {
          return fixtureJson({ error: "回复内容不能为空", code: "EMPTY_REPLY" }, 400);
        }
        const reply = addReply(context.params.id ?? "", text.trim());
        return fixtureJson(
          { ok: true, reply: { ...reply, actor: actorFor(0), timeLabel: "刚刚" } },
          201,
        );
      },
    ],
    [
      "POST",
      "/api/posts/:id/like",
      (context) => {
        const id = context.params.id ?? "";
        const body = (context.body ?? {}) as Record<string, unknown>;
        const liked = typeof body.liked === "boolean" ? body.liked : togglePostLike(id, false);
        if (typeof body.liked === "boolean") togglePostLike(id, !body.liked);
        const index = Math.max(0, Number(id) - BASE_TID);
        const baseCount = countFor(index, context.scenario);
        return fixtureJson({ liked, likeCount: Math.max(0, baseCount + (liked ? 1 : 0)) });
      },
    ],
    [
      "POST",
      "/api/posts/:id/save",
      (context) => {
        const id = context.params.id ?? "";
        const body = (context.body ?? {}) as Record<string, unknown>;
        const saved = typeof body.saved === "boolean" ? body.saved : togglePostSave(id, false);
        if (typeof body.saved === "boolean") togglePostSave(id, !body.saved);
        return fixtureJson({ saved });
      },
    ],
    ["POST", "/api/posts/:id/report", () => fixtureJson({ ok: true }, 202)],
    [
      "PATCH",
      "/api/posts/:id/trade-state",
      (context) => {
        const body = (context.body ?? {}) as Record<string, unknown>;
        const state = typeof body.state === "string" ? body.state : "available";
        return fixtureJson({
          ok: true,
          tid: Number(context.params.id ?? "0"),
          state,
          trade: { state },
        });
      },
    ],
    [
      "GET",
      "/api/posts/:id/share-card",
      () => fixtureJson({ card: { title: "分享卡片", lines: [] } }),
    ],
  ]);

  registerFixtureFamily("reactions", [
    [
      "POST",
      "/api/posts/:tid/like",
      (context) => {
        const tid = context.params.tid ?? "";
        const liked = togglePostLike(tid, false);
        const index = Math.max(0, Number(tid) - BASE_TID);
        return fixtureJson({
          tid: Number(tid) || 0,
          liked,
          active: liked,
          count: Math.max(0, countFor(index, context.scenario) + (liked ? 1 : 0)),
        });
      },
    ],
    [
      "POST",
      "/api/posts/:tid/vote",
      (context) => {
        const tid = context.params.tid ?? "";
        const body = (context.body ?? {}) as Record<string, unknown>;
        const direction = body.direction === "down" ? "down" : "up";
        const next = setPostVote(tid, direction);
        const index = Math.max(0, Number(tid) - BASE_TID);
        return fixtureJson({
          tid: Number(tid) || 0,
          voted: next !== null,
          active: next !== null,
          count: Math.max(0, countFor(index, context.scenario) + (next === "up" ? 1 : 0)),
          direction: getPostVote(tid),
        });
      },
    ],
  ]);

  registerFixtureFamily("event", [
    [
      "GET",
      "/api/events",
      (context) =>
        fixtureJson({
          items: buildList(context.scenario, context.volume, (index) => ({
            id: `event-${index}`,
            tid: BASE_TID + index,
            title: postTitle(index, context.scenario),
            areaLabel: area(index),
            startAt: timestampFor(index),
            joined: isEventJoined(`event-${index}`),
            capacity: 30,
            joinedCount: countFor(index, context.scenario) % 30,
          })),
          hasMore: false,
        }),
    ],
    [
      "GET",
      "/api/events/:eventId",
      (context) => {
        const id = context.params.eventId ?? "";
        return fixtureJson({
          id,
          title: postTitle(1, context.scenario),
          areaLabel: area(1),
          startAt: timestampFor(1),
          joined: isEventJoined(id),
          capacity: 30,
          joinedCount: 12,
        });
      },
    ],
    [
      "POST",
      "/api/events/:eventId/join",
      (context) => fixtureJson({ ok: true, joined: toggleEventJoin(context.params.eventId ?? "") }),
    ],
    [
      "POST",
      "/api/events/:eventId/cancel-join",
      (context) => {
        toggleEventJoin(context.params.eventId ?? "");
        return fixtureJson({ ok: true, joined: false });
      },
    ],
    ["POST", "/api/events/:eventId/complete", () => fixtureJson({ ok: true, completed: true })],
  ]);

  registerFixtureFamily("help", [
    ["POST", "/api/help/:helpId/resolve", () => fixtureJson({ ok: true, resolved: true })],
    ["POST", "/api/help/:helpId/link-event", () => fixtureJson({ ok: true })],
    ["POST", "/api/help/:helpId/unlink-event", () => fixtureNoContent()],
  ]);
}
