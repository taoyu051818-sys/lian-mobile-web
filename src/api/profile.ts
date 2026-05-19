import { apiGet, apiSend, apiUpload } from "./http";
import type { FeedItemId } from "../types/feed";
import type {
  ProfileListResponse,
  ProfileRewards,
  ProfileSettings,
  ProfileSettingsPatch,
  ProfileStats,
  ProfileTabKey,
  ProfileUser,
  ProfileWallet,
} from "../types/profile";

export async function fetchAuthMe(): Promise<ProfileUser | null> {
  const data = await apiGet<{ user?: ProfileUser | null }>("/api/auth/me");
  return data.user || null;
}

export async function fetchProfileStats(): Promise<ProfileStats> {
  return apiGet<ProfileStats>("/api/me/stats");
}

export async function fetchProfileRewards(): Promise<ProfileRewards> {
  return apiGet<ProfileRewards>("/api/me/rewards");
}

export async function fetchProfileWallet(): Promise<ProfileWallet> {
  return apiGet<ProfileWallet>("/api/wallet/me");
}

export async function fetchProfileSettings(): Promise<ProfileSettings> {
  return apiGet<ProfileSettings>("/api/me/settings");
}

export async function patchProfileSettings(patch: ProfileSettingsPatch): Promise<ProfileSettings> {
  return apiSend<ProfileSettings>("/api/me/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function fetchProfileTab(
  tab: ProfileTabKey,
  tids: FeedItemId[] = [],
): Promise<ProfileListResponse> {
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

  const data = await apiUpload<{ url?: string }>(
    "/api/upload/image?purpose=avatar",
    form,
    "头像上传失败，可以换一张图片或稍后再试。",
  );
  if (!data.url) throw new Error("头像上传成功但没有返回地址，请稍后再试。");
  return data.url;
}

export async function updateProfileAvatar(avatarUrl: string): Promise<void> {
  await apiSend("/api/auth/avatar", {
    method: "POST",
    body: JSON.stringify({ avatarUrl }),
  });
}

export async function activateProfileAlias(
  aliasId: string,
): Promise<{ activeAliasId?: string | null }> {
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
