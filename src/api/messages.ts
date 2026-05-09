import { apiGet, apiSend } from "./http";
import { ensureClientId } from "../utils/client-id";
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
