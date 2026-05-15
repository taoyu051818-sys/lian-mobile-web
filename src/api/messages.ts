import { apiGet, apiSend } from "./http";
import { ensureClientId } from "../platform/clientIdentity";
import type { ChannelMessage, ChannelReadPayload, ChannelResponse, NotificationResponse, SendChannelMessagePayload } from "../types/messages";

export function extractChannelMessagePlainText(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveChannelMessagePlainText(message: Pick<ChannelMessage, "content" | "contentHtml" | "plainText">): string {
  return message.plainText?.trim() || message.content?.trim() || extractChannelMessagePlainText(message.contentHtml);
}

export function normalizeChannelMessage(raw: ChannelMessage): ChannelMessage {
  const clientId = ensureClientId();
  const actor = raw.actor
    ? {
        ...raw.actor,
        ...(raw.actor.id ? { id: raw.actor.id, authoritative: true } : {}),
      }
    : undefined;
  const plainText = resolveChannelMessagePlainText(raw);
  return {
    ...raw,
    actor,
    plainText,
    deliveryState: raw.deliveryState || "sent",
    isSelf: raw.isSelf ?? (actor?.authoritative ? actor.id === clientId : false),
  };
}

function channelMessageSortValue(item: ChannelMessage) {
  return item.timestampISO || item.time || "";
}

function compareChannelMessagesChronologically(a: ChannelMessage, b: ChannelMessage) {
  const aTime = channelMessageSortValue(a);
  const bTime = channelMessageSortValue(b);
  if (aTime !== bTime) {
    if (!aTime) return -1;
    if (!bTime) return 1;
    return aTime < bTime ? -1 : 1;
  }
  return String(a.id).localeCompare(String(b.id));
}

export function mergeChannelMessagesChronologically(existing: ChannelMessage[], incoming: ChannelMessage[]): ChannelMessage[] {
  const merged = new Map<string, ChannelMessage>();
  for (const item of existing) merged.set(String(item.id), item);
  for (const item of incoming) merged.set(String(item.id), item);
  return Array.from(merged.values()).sort(compareChannelMessagesChronologically);
}

export function normalizeChannelResponse(response: ChannelResponse, requestedOffset = 0): ChannelResponse {
  const rawItems = response.items || [];
  const normalizedItems = mergeChannelMessagesChronologically([], rawItems.map(normalizeChannelMessage));
  return {
    ...response,
    items: normalizedItems,
    nextOffset: response.nextOffset ?? Math.max(0, requestedOffset) + rawItems.length,
  };
}

export async function fetchChannelMessages(offset = 0, limit = 30): Promise<ChannelResponse> {
  const params = new URLSearchParams();
  const requestedOffset = Math.max(0, offset);
  params.set("limit", String(limit));
  params.set("offset", String(requestedOffset));
  const response = await apiGet<ChannelResponse>(`/api/channel?${params.toString()}`);
  return normalizeChannelResponse(response, requestedOffset);
}

export async function fetchNotifications(): Promise<NotificationResponse> {
  return apiGet<NotificationResponse>("/api/messages");
}

export function buildPendingChannelMessage(
  content: string,
  identityTag: string | undefined,
  currentUser: { username?: string; displayName?: string; avatarText?: string; id?: string } | null,
): ChannelMessage {
  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const name = currentUser?.displayName || currentUser?.username || "同学";
  return {
    id,
    content,
    plainText: content,
    actor: {
      id: currentUser?.id || "",
      name,
      displayName: name,
      avatarText: currentUser?.avatarText || name.slice(0, 2) || "同",
      authoritative: false,
    },
    timestampISO: now,
    time: now,
    deliveryState: "sending",
    isSelf: true,
  };
}

export async function sendChannelMessage(payload: SendChannelMessagePayload): Promise<void> {
  const readerId = ensureClientId();
  await apiSend("/api/channel/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": readerId,
    },
    body: JSON.stringify({
      readerId,
      content: payload.content,
      identityTag: payload.identityTag || "",
    }),
  });
}

export function buildChannelReadPayload(messageIds: Array<string | number>): ChannelReadPayload {
  return { messageIds, readerId: ensureClientId() };
}

export async function markChannelMessagesRead(messageIds: Array<string | number>): Promise<void> {
  if (!messageIds.length) return;
  const payload = buildChannelReadPayload(messageIds);
  await apiSend("/api/channel/read", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": payload.readerId,
    },
    body: JSON.stringify(payload),
  });
}
