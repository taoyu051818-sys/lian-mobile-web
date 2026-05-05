import { apiGet, apiSend } from "./http";
import type { FeedItemId } from "../types/feed";
import type { ProfileListResponse, ProfileTabKey, ProfileUser } from "../types/profile";

export async function fetchAuthMe(): Promise<ProfileUser | null> {
  const data = await apiGet<{ user?: ProfileUser | null }>("/api/auth/me");
  return data.user || null;
}

export async function fetchProfileTab(tab: ProfileTabKey, tids: FeedItemId[] = []): Promise<ProfileListResponse> {
  if (tab === "history") {
    if (!tids.length) return { items: [] };
    return apiSend<ProfileListResponse>("/api/me/history", {
      method: "POST",
      body: JSON.stringify({ tids }),
    });
  }

  if (tab === "saved") {
    return apiGet<ProfileListResponse>("/api/me/saved");
  }

  return apiGet<ProfileListResponse>("/api/me/liked");
}

export async function logoutAuth(): Promise<void> {
  await apiSend("/api/auth/logout", { method: "POST" });
}
