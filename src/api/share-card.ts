/**
 * Share-card V1 envelope client (lian-platform-server PR #484, ps#484).
 *
 * Backend route: `GET /api/posts/:tid/share-card`. Auth policy is
 * `viewer_optional` so anonymous viewers can read public posts; audience-gated
 * posts return 404 to non-authorized viewers (the existing audience policy
 * from PR #138 — not re-implemented here).
 *
 * Response envelope (V1):
 *
 *   {
 *     ok: true,
 *     card: {
 *       tid, title, summary, thumbnailUrl, url, kind, authorName,
 *       audienceLabel,
 *       channel: { wechat?: { title, description, imageUrl } }
 *     }
 *   }
 *
 * Error mapping (frontend):
 *   - HTTP 404 → ShareCardError("not-found"). Covers both "post does not
 *     exist" and "audience-gated post hidden from this viewer" — the backend
 *     deliberately collapses the two so the existence of a private post does
 *     not leak.
 *   - Any other non-2xx → ShareCardError("network").
 *   - fetch rejection (offline, DNS) → ShareCardError("network").
 */

import { apiGet, LianApiError } from "./http";
import { asNumber, asRecord, asString } from "../platform/api-normalizers";
import type { FeedItemId } from "../types/feed";

export interface ShareCardChannelWechat {
  title: string;
  description: string;
  imageUrl: string;
}

export interface ShareCardChannels {
  wechat?: ShareCardChannelWechat;
}

export interface ShareCard {
  tid: FeedItemId;
  title: string;
  summary: string;
  thumbnailUrl: string;
  url: string;
  kind: string;
  authorName: string;
  audienceLabel: string;
  channel: ShareCardChannels;
}

export type ShareCardErrorReason = "not-found" | "network";

export class ShareCardError extends Error {
  reason: ShareCardErrorReason;
  status: number;

  constructor(reason: ShareCardErrorReason, status: number, message = "") {
    super(message || reason);
    this.name = "ShareCardError";
    this.reason = reason;
    this.status = status;
  }
}

interface ShareCardEnvelope {
  ok?: unknown;
  card?: unknown;
}

function normalizeWechatChannel(raw: unknown): ShareCardChannelWechat | undefined {
  const record = asRecord(raw);
  const title = asString(record.title);
  const description = asString(record.description);
  const imageUrl = asString(record.imageUrl);
  if (!title && !description && !imageUrl) return undefined;
  return { title, description, imageUrl };
}

function normalizeCard(raw: unknown, fallbackTid: FeedItemId): ShareCard {
  const record = asRecord(raw);
  const channelRecord = asRecord(record.channel);
  const wechat = normalizeWechatChannel(channelRecord.wechat);
  return {
    tid: Math.trunc(asNumber(record.tid, fallbackTid)),
    title: asString(record.title),
    summary: asString(record.summary),
    thumbnailUrl: asString(record.thumbnailUrl),
    url: asString(record.url),
    kind: asString(record.kind, "post"),
    authorName: asString(record.authorName),
    audienceLabel: asString(record.audienceLabel),
    channel: wechat ? { wechat } : {},
  };
}

/**
 * Fetch and normalize the share-card envelope for a post.
 *
 * Throws `ShareCardError` on failure so callers can branch on `.reason`
 * (not-found vs network) without repeating status checks.
 */
export async function fetchShareCard(tid: FeedItemId): Promise<ShareCard> {
  try {
    const data = await apiGet<ShareCardEnvelope>(
      `/api/posts/${encodeURIComponent(String(tid))}/share-card`,
    );
    return normalizeCard(data?.card, tid);
  } catch (error) {
    if (error instanceof LianApiError) {
      if (error.status === 404) {
        throw new ShareCardError("not-found", 404, error.message);
      }
      throw new ShareCardError("network", error.status, error.message);
    }
    // fetch rejection (no network), JSON parse failure, etc.
    throw new ShareCardError("network", 0, error instanceof Error ? error.message : "");
  }
}
