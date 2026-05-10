import { apiGet, apiSend } from "./http";
import { ensureClientId } from "../platform/browser-storage";
import type { ChannelMessage, ChannelReadPayload, ChannelResponse, NotificationResponse, SendChannelMessagePayload } from "../types/messages";

export function normalizeChannelMessage(raw: ChannelMessage): ChannelMessage {
  const clientId = ensureClientId();
  const actor = raw.actor
    ? {
        ...raw.actor,
        id: raw.actor.id || `legacy:${raw.actor.identityTag || raw.actor.displayName || "unknown"}`,
      }
    : undefined;
  return {
    ...raw,
    actor,
    deliveryState: raw.deliveryState || "sent",
    isSelf: raw.isSelf ?? (actor?.id === clientId),
  };
}

export async function fetchChannelMessages(offset = 0, limit = 30): Promise<ChannelResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(Math.max(0, offset)));
  const response = await apiGet<ChannelResponse>(`/api/channel?${params.toString()}`);
  return {
    ...response,
    items: response.items?.map(normalizeChannelMessage),
  };
}

export async function fetchNotifications(): Promise<NotificationResponse> {
  return apiGet<NotificationResponse>("/api/messages");
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
