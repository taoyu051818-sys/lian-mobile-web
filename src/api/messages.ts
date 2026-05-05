import { apiGet, apiSend } from "./http";
import type { ChannelResponse, NotificationResponse, SendChannelMessagePayload } from "../types/messages";

export async function fetchChannelMessages(offset = 0, limit = 30): Promise<ChannelResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(Math.max(0, offset)));
  return apiGet<ChannelResponse>(`/api/channel?${params.toString()}`);
}

export async function fetchNotifications(): Promise<NotificationResponse> {
  return apiGet<NotificationResponse>("/api/messages");
}

function ensureClientId() {
  const key = "lian.clientId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
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
