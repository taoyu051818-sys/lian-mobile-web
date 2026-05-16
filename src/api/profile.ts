import { apiGet, apiSend, apiUpload } from "./http";
import { asBoolean, asNumber, asRecord, asString, normalizeFeedItemId } from "../platform/api-normalizers";
import type { FeedItemId } from "../types/feed";
import type {
  ProfileActivityStatus,
  ProfileListItem,
  ProfileListPagination,
  ProfileListResponse,
  ProfileSettings,
  ProfileTabKey,
  ProfileUser,
  ProfileVisibility,
  ProfileStats,
} from "../types/profile";

export const DEFAULT_PROFILE_STATS: ProfileStats = {
  posts: 0,
  replies: 0,
  saved: 0,
  liked: 0,
  drafts: 0,
  mapContributions: 0,
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  notificationEnabled: true,
  profileVisibility: "campus",
  allowMessageMentions: true,
};

const DEFAULT_PROFILE_LIST_PAGINATION: ProfileListPagination = {
  totalCount: 0,
  count: 0,
  limit: 20,
  hasMore: false,
};

const PROFILE_ACTIVITY_STATUSES = new Set<ProfileActivityStatus>([
  "published",
  "draft",
  "pending",
  "hidden",
]);

const PROFILE_VISIBILITIES = new Set<ProfileVisibility>(["public", "campus", "private"]);

const PROFILE_TAB_PATHS: Record<Exclude<ProfileTabKey, "history">, string> = {
  saved: "/api/me/saved",
  liked: "/api/me/liked",
  posts: "/api/me/posts",
  replies: "/api/me/replies",
  drafts: "/api/me/drafts",
  "map-contributions": "/api/me/map-contributions",
};

function normalizeProfileVisibility(value: unknown): ProfileVisibility {
  const visibility = asString(value, DEFAULT_PROFILE_SETTINGS.profileVisibility).toLowerCase();
  return PROFILE_VISIBILITIES.has(visibility as ProfileVisibility)
    ? (visibility as ProfileVisibility)
    : DEFAULT_PROFILE_SETTINGS.profileVisibility;
}

function normalizeProfileActivityStatus(value: unknown): ProfileActivityStatus | undefined {
  const status = asString(value).toLowerCase();
  return PROFILE_ACTIVITY_STATUSES.has(status as ProfileActivityStatus)
    ? (status as ProfileActivityStatus)
    : undefined;
}

function normalizeProfileListPagination(
  value: unknown,
  itemCount: number,
  fallbackLimit = DEFAULT_PROFILE_LIST_PAGINATION.limit,
): ProfileListPagination {
  const record = asRecord(value);
  const count = Math.max(asNumber(record.count, itemCount), itemCount);
  const totalCount = Math.max(asNumber(record.totalCount, count), count);
  const limit = Math.max(asNumber(record.limit, fallbackLimit), 0);

  return {
    totalCount,
    count,
    limit,
    hasMore: asBoolean(record.hasMore, totalCount > count),
  };
}

export function normalizeProfileStats(value: unknown): ProfileStats {
  const record = asRecord(value);
  return {
    posts: Math.max(asNumber(record.posts, DEFAULT_PROFILE_STATS.posts), 0),
    replies: Math.max(asNumber(record.replies, DEFAULT_PROFILE_STATS.replies), 0),
    saved: Math.max(asNumber(record.saved, DEFAULT_PROFILE_STATS.saved), 0),
    liked: Math.max(asNumber(record.liked, DEFAULT_PROFILE_STATS.liked), 0),
    drafts: Math.max(asNumber(record.drafts, DEFAULT_PROFILE_STATS.drafts), 0),
    mapContributions: Math.max(
      asNumber(record.mapContributions, DEFAULT_PROFILE_STATS.mapContributions),
      0,
    ),
  };
}

export function normalizeProfileSettings(value: unknown): ProfileSettings {
  const record = asRecord(value);
  return {
    notificationEnabled: asBoolean(
      record.notificationEnabled,
      DEFAULT_PROFILE_SETTINGS.notificationEnabled,
    ),
    profileVisibility: normalizeProfileVisibility(record.profileVisibility),
    allowMessageMentions: asBoolean(
      record.allowMessageMentions,
      DEFAULT_PROFILE_SETTINGS.allowMessageMentions,
    ),
  };
}

export function normalizeProfileListItem(value: unknown): ProfileListItem {
  const record = asRecord(value);
  const tid = normalizeFeedItemId(record.tid, 0);
  const item: ProfileListItem = {};

  if (tid > 0) item.tid = tid;

  const id = asString(record.id);
  if (id) item.id = id;

  const title = asString(record.title);
  if (title) item.title = title;

  const cover = asString(record.cover);
  if (cover) item.cover = cover;

  const timeLabel = asString(record.timeLabel);
  if (timeLabel) item.timeLabel = timeLabel;

  const timestampISO = asString(record.timestampISO);
  if (timestampISO) item.timestampISO = timestampISO;

  const lastViewedAt = asString(record.lastViewedAt);
  if (lastViewedAt) item.lastViewedAt = lastViewedAt;

  const locationArea = asString(record.locationArea);
  if (locationArea) item.locationArea = locationArea;

  const status = normalizeProfileActivityStatus(record.status);
  if (status) item.status = status;

  return item;
}

export function normalizeProfileListResponse(
  value: unknown,
  fallbackLimit = DEFAULT_PROFILE_LIST_PAGINATION.limit,
): ProfileListResponse {
  const record = asRecord(value);
  const items = Array.isArray(record.items)
    ? record.items
        .map((entry) => normalizeProfileListItem(entry))
        .filter((entry) => Object.keys(entry).length > 0)
    : [];

  return {
    items,
    pagination: normalizeProfileListPagination(record.pagination, items.length, fallbackLimit),
  };
}

export async function fetchAuthMe(): Promise<ProfileUser | null> {
  const data = await apiGet<{ user?: ProfileUser | null }>("/api/auth/me");
  return data.user || null;
}

export async function fetchProfileStats(): Promise<ProfileStats> {
  return normalizeProfileStats(await apiGet<unknown>("/api/me/stats"));
}

export async function fetchProfileSettings(): Promise<ProfileSettings> {
  return normalizeProfileSettings(await apiGet<unknown>("/api/me/settings"));
}

export async function updateProfileSettings(
  patch: Partial<ProfileSettings>,
): Promise<ProfileSettings> {
  return normalizeProfileSettings(
    await apiSend<unknown>("/api/me/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  );
}

export async function fetchProfileTab(
  tab: ProfileTabKey,
  tids: FeedItemId[] = [],
): Promise<ProfileListResponse> {
  if (tab === "history") {
    if (!tids.length) {
      return {
        items: [],
        pagination: { ...DEFAULT_PROFILE_LIST_PAGINATION, limit: 0 },
      };
    }

    return normalizeProfileListResponse(
      await apiSend<unknown>("/api/me/history", {
        method: "POST",
        body: JSON.stringify({ tids }),
      }),
      tids.length,
    );
  }

  return normalizeProfileListResponse(await apiGet<unknown>(PROFILE_TAB_PATHS[tab]));
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
