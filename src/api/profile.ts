import { apiGet, apiSend } from "./http";
import type { FeedItemId } from "../types/feed";
import type { ProfileListResponse, ProfileTabKey, ProfileUser } from "../types/profile";

declare global {
  interface Window {
    LIAN_API_BASE_URL?: string;
  }
}

const API_BASE = typeof window !== "undefined" ? window.LIAN_API_BASE_URL || "" : "";

function withApiBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

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

export async function uploadProfileAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file, file.name || "avatar.jpg");

  const response = await fetch(withApiBase("/api/upload/image?purpose=avatar"), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await response.json().catch(() => ({} as { url?: string; error?: string }));
  if (!response.ok) {
    throw new Error(data.error || "头像上传失败，可以换一张图片或稍后再试。");
  }
  if (!data.url) throw new Error("头像上传成功但没有返回地址，请稍后再试。");
  return data.url;
}

export async function updateProfileAvatar(avatarUrl: string): Promise<void> {
  await apiSend("/api/auth/avatar", {
    method: "POST",
    body: JSON.stringify({ avatarUrl }),
  });
}

export async function activateProfileAlias(aliasId: string): Promise<{ activeAliasId?: string | null }> {
  return apiSend<{ activeAliasId?: string | null }>("/api/auth/aliases/activate", {
    method: "POST",
    body: JSON.stringify({ aliasId }),
  });
}

export async function deactivateProfileAlias(): Promise<void> {
  await apiSend("/api/auth/aliases/deactivate", { method: "POST" });
}

export async function createInviteCode(): Promise<{ code?: string }> {
  return apiSend<{ code?: string }>("/api/auth/invites", { method: "POST" });
}

export async function logoutAuth(): Promise<void> {
  await apiSend("/api/auth/logout", { method: "POST" });
}
