/**
 * Server酱 (ps#504 I2) — external notification API client.
 *
 * Wraps the I1-D binding endpoints + I1-E preferences endpoints. The wire
 * envelope NEVER carries a raw sendKey on read paths — backend strips it.
 * Outbound, the sendKey only travels from the manual paste form to the POST
 * body and is forgotten by the composable immediately after the round-trip.
 *
 * I1-E preferences endpoints land in another worktree but the URL contract is
 * locked. Until I1-E merges these calls 404; the composable surfaces a
 * brand-string load failure and the toggles stay disabled.
 *
 * Backend contracts (lian-platform-server src/server/notification-routes.js):
 *   GET    /api/notifications/serverchan/binding
 *   POST   /api/notifications/serverchan/binding              { sendKey }
 *   DELETE /api/notifications/serverchan/binding
 *   GET    /api/notifications/serverchan/bind-url
 *   GET    /api/notifications/serverchan/preferences
 *   PUT    /api/notifications/serverchan/preferences          { ... }
 *   POST   /api/notifications/serverchan/preferences/errand-order/:orderId
 */

import { apiGet, apiSend } from "./http";

export interface ServerChanBinding {
  bound: boolean;
  enabled: boolean;
  /** ISO8601 timestamp; absent until binding lands. */
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerChanBindUrl {
  url: string;
}

export interface ServerChanPreferences {
  eventStartingReminder: boolean;
  rewardSettledReminder: boolean;
}

export async function fetchServerChanBinding(): Promise<ServerChanBinding> {
  const data = await apiGet<ServerChanBinding>("/api/notifications/serverchan/binding");
  return {
    bound: Boolean(data?.bound),
    enabled: Boolean(data?.enabled),
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : undefined,
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

export async function fetchServerChanBindUrl(): Promise<ServerChanBindUrl> {
  const data = await apiGet<ServerChanBindUrl>("/api/notifications/serverchan/bind-url");
  return { url: typeof data?.url === "string" ? data.url : "" };
}

/**
 * Submit a manually-pasted SendKey. The server validates format + ownership
 * and returns the new binding state without echoing the key. The composable
 * is responsible for clearing the local input ref after this call resolves.
 */
export async function bindServerChanWithSendKey(sendKey: string): Promise<ServerChanBinding> {
  return apiSend<ServerChanBinding>("/api/notifications/serverchan/binding", {
    method: "POST",
    body: JSON.stringify({ sendKey }),
  });
}

export async function unbindServerChan(): Promise<{ ok?: boolean }> {
  return apiSend<{ ok?: boolean }>("/api/notifications/serverchan/binding", {
    method: "DELETE",
  });
}

export async function fetchServerChanPreferences(): Promise<ServerChanPreferences> {
  const data = await apiGet<ServerChanPreferences>("/api/notifications/serverchan/preferences");
  return {
    eventStartingReminder: Boolean(data?.eventStartingReminder),
    rewardSettledReminder: Boolean(data?.rewardSettledReminder),
  };
}

export async function updateServerChanPreferences(
  next: ServerChanPreferences,
): Promise<ServerChanPreferences> {
  const data = await apiSend<ServerChanPreferences>("/api/notifications/serverchan/preferences", {
    method: "PUT",
    body: JSON.stringify(next),
  });
  return {
    eventStartingReminder: Boolean(data?.eventStartingReminder),
    rewardSettledReminder: Boolean(data?.rewardSettledReminder),
  };
}

export async function setErrandOrderReminderPreference(
  orderId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const data = await apiSend<{ enabled?: boolean }>(
    `/api/notifications/serverchan/preferences/errand-order/${encodeURIComponent(orderId)}`,
    {
      method: "POST",
      body: JSON.stringify({ enabled }),
    },
  );
  return { enabled: Boolean(data?.enabled) };
}
