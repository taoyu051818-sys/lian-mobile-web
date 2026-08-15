/**
 * Messages fixtures: the campus channel plus the notification inbox, shaped by
 * `src/types/messages.ts`.
 *
 * This family exists because 消息 is a bottom-nav destination — leaving it
 * unmapped meant the tab failed closed with 501 on every visit.
 *
 * Two contract details are mirrored deliberately:
 *   - `/api/channel` and `/api/messages` are offset paginated, and the client
 *     derives `nextOffset` itself when the server omits it. Fixtures return it
 *     explicitly and honour the incoming `offset`/`limit`, so "load more" is
 *     exercised rather than short-circuited.
 *   - POST `/api/channel/messages` returns no body. `useChannelMessages`
 *     replaces its optimistic item by re-fetching, so the send path is only
 *     realistic if the message is appended to the write store first.
 */

import { fixtureJson, fixtureNoContent } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureRequestContext, FixtureScenario, FixtureVolume } from "../types";
import { appendChannelMessage, getChannelMessages, markNotificationRead } from "../writes";
import {
  bodyPreview,
  displayName,
  identityProfile,
  isPartial,
  itemCount,
  pick,
  seededCount,
  sentenceFor,
  timeLabelFor,
  timestampFor,
} from "./support";

const FAMILY = "messages";

const VISIBILITIES = ["public", "campus", "school"] as const;
// From `NotificationKind` in src/types/messages.ts. Note `order` is the kind;
// `errand-order` is a *target* kind, not a notification kind.
const NOTIFICATION_KINDS = [
  "reply",
  "verification",
  "order",
  "event-completed",
  "moderation",
  "generic",
] as const;

function readPaging(query: URLSearchParams): { offset: number; limit: number } {
  const offset = Math.max(0, Number(query.get("offset") ?? 0) || 0);
  const rawLimit = Number(query.get("limit") ?? 30) || 30;
  return { offset, limit: Math.min(Math.max(1, rawLimit), 100) };
}

function channelMessage(index: number, scenario: FixtureScenario, selfId: string) {
  const partial = isPartial(scenario, index);
  // Every 4th message is the current user's, so bubble alignment, read counts
  // and the "self" styling branch all appear without switching identity.
  const isSelf = index % 4 === 3;
  const name = isSelf ? "我" : displayName(index);
  return {
    id: `channel-${index}`,
    content: bodyPreview(index, scenario),
    plainText: bodyPreview(index, scenario),
    visibility: pick(VISIBILITIES, index),
    actor: {
      id: isSelf ? selfId : `peer-${index}`,
      name,
      displayName: name,
      avatarText: name.slice(0, 2),
      authoritative: true,
    },
    timestampISO: timestampFor(index),
    time: timeLabelFor(index),
    // `partial-data` drops the optional read counter.
    readCount: partial ? undefined : seededCount(index, 0, 48),
    deliveryState: "sent" as const,
    isSelf,
  };
}

function notificationItem(index: number, scenario: FixtureScenario) {
  const partial = isPartial(scenario, index);
  const kind = pick(NOTIFICATION_KINDS, index);
  const name = displayName(index);
  return {
    id: `notification-${index}`,
    tid: 52_000 + index,
    kind,
    title: sentenceFor(index, 18),
    // `partial-data` drops the excerpt so the fallback text path renders.
    excerpt: partial ? undefined : sentenceFor(index + 7, 46),
    actor: { name, displayName: name, avatarText: name.slice(0, 2) },
    read: index % 3 === 0,
    timestampISO: timestampFor(index),
    time: timeLabelFor(index),
    // Covers all four NotificationTarget variants, including the `none` case
    // that renders a non-navigable row.
    target:
      kind === "order"
        ? ({ kind: "errand-order", orderId: `errand-${index}` } as const)
        : kind === "verification"
          ? ({ kind: "verification" } as const)
          : kind === "moderation"
            ? ({ kind: "none", reason: "内容已被移除" } as const)
            : ({ kind: "detail", tid: 52_000 + index } as const),
  };
}

/** Slices a generated page and reports `hasMore`/`nextOffset` like the API. */
function page<T>(items: T[], offset: number, limit: number) {
  const slice = items.slice(offset, offset + limit);
  return {
    items: slice,
    hasMore: offset + slice.length < items.length,
    nextOffset: offset + slice.length,
  };
}

function channelCorpus(scenario: FixtureScenario, volume: FixtureVolume, selfId: string) {
  const generated = Array.from({ length: itemCount(scenario, volume) }, (_, index) =>
    channelMessage(index, scenario, selfId),
  );
  // Sent messages live in the write store so a send survives the re-fetch.
  return [...generated, ...getChannelMessages()];
}

export function registerMessagesFixtures(): void {
  registerFixtureFamily(FAMILY, [
    [
      "GET",
      "/api/channel",
      ({ query, scenario, volume, identity }: FixtureRequestContext) => {
        const { offset, limit } = readPaging(query);
        const selfId = identityProfile(identity).id;
        return fixtureJson(page(channelCorpus(scenario, volume, selfId), offset, limit));
      },
    ],
    [
      "POST",
      "/api/channel/messages",
      ({ body, identity }: FixtureRequestContext) => {
        const payload = (body ?? {}) as {
          content?: string;
          visibility?: string;
          clientNonce?: string;
        };
        const profile = identityProfile(identity);
        const label = profile.username || "我";
        appendChannelMessage({
          id: `channel-sent-${Date.now().toString(36)}`,
          // Echoed back so `replacePendingWithLatest` can match the optimistic
          // item by nonce instead of falling back to content equality.
          clientNonce: payload.clientNonce || "",
          content: payload.content || "",
          plainText: payload.content || "",
          visibility: payload.visibility || "public",
          actor: {
            id: profile.id,
            name: label,
            displayName: label,
            avatarText: label.slice(0, 2),
            authoritative: true,
          },
          timestampISO: new Date().toISOString(),
          time: "刚刚",
          readCount: 0,
          deliveryState: "sent",
          isSelf: true,
        });
        // Real endpoint returns no content; the client re-fetches to reconcile.
        return fixtureNoContent();
      },
    ],
    ["POST", "/api/channel/read", () => fixtureNoContent()],
    [
      "GET",
      "/api/messages",
      ({ query, scenario, volume }: FixtureRequestContext) => {
        const { offset, limit } = readPaging(query);
        const items = Array.from({ length: itemCount(scenario, volume) }, (_, index) =>
          notificationItem(index, scenario),
        );
        return fixtureJson(page(items, offset, limit));
      },
    ],
    [
      "POST",
      "/api/notifications/:notificationId/read",
      ({ params }: FixtureRequestContext) => {
        markNotificationRead(String(params.notificationId));
        return fixtureNoContent();
      },
    ],
  ]);
}
