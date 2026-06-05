import { apiGet, apiSend, apiUpload, LianApiError } from "./http";
import { normalizePostAvailableActions, normalizePostRelations } from "../platform/api-normalizers";
import { extractV2Components } from "../platform/api-normalizers";
import type { AudienceVisibility } from "../types/audience";
import type { FeedItemId } from "../types/feed";
import type {
  ProfileActivityStatus,
  ProfileListItem,
  ProfileListResponse,
  ProfilePostsContentFilter,
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

function normalizeProfileActivityStatus(value: unknown): ProfileActivityStatus | undefined {
  if (value === "published" || value === "draft" || value === "pending" || value === "hidden") {
    return value;
  }
  return undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function normalizeOptionalTid(value: unknown): FeedItemId | undefined {
  const tid = Number(value);
  return Number.isFinite(tid) && tid > 0 ? tid : undefined;
}

function normalizeOptionalVisibility(value: unknown): AudienceVisibility | undefined {
  return value === "public" ||
    value === "campus" ||
    value === "school" ||
    value === "private" ||
    value === "linkOnly"
    ? value
    : undefined;
}

export function normalizeProfileListItem(item: unknown): ProfileListItem {
  const candidate = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const metadata =
    candidate.metadata &&
    typeof candidate.metadata === "object" &&
    !Array.isArray(candidate.metadata)
      ? (candidate.metadata as Record<string, unknown>)
      : undefined;
  const tid = normalizeOptionalTid(candidate.tid);
  const id = normalizeOptionalText(candidate.id) || (tid ? String(tid) : undefined);
  if (candidate.relations === undefined) candidate.relations = metadata?.relations;
  if (candidate.availableActions === undefined)
    candidate.availableActions = metadata?.availableActions;
  const relations = normalizePostRelations(candidate.relations);
  const components = extractV2Components(candidate);
  const availableActions = normalizePostAvailableActions(candidate.availableActions);
  const title = normalizeOptionalText(candidate.title);
  const cover = normalizeOptionalText(candidate.cover);
  const timestampISO = normalizeOptionalText(candidate.timestampISO);
  const lastViewedAt = normalizeOptionalText(candidate.lastViewedAt);
  const timeLabel = normalizeOptionalText(candidate.timeLabel);
  const locationArea = normalizeOptionalText(candidate.locationArea);
  const status = normalizeProfileActivityStatus(candidate.status);
  const visibility = normalizeOptionalVisibility(candidate.visibility);
  return {
    ...(tid ? { tid } : {}),
    ...(id ? { id } : {}),
    ...(title ? { title } : {}),
    ...(cover ? { cover } : {}),
    ...(timestampISO ? { timestampISO } : {}),
    ...(lastViewedAt ? { lastViewedAt } : {}),
    ...(timeLabel ? { timeLabel } : {}),
    ...(locationArea ? { locationArea } : {}),
    ...(status ? { status } : {}),
    ...(visibility ? { visibility } : {}),
    ...(components ? { components } : {}),
    ...(relations ? { relations } : {}),
    ...(availableActions ? { availableActions } : {}),
  };
}

export function normalizeProfileListResponse(data: unknown): ProfileListResponse {
  const items = Array.isArray((data as { items?: unknown[] } | null)?.items)
    ? ((data as { items: unknown[] }).items || []).map(normalizeProfileListItem)
    : [];
  return { items };
}

export interface ProfileTabRequestOptions {
  /**
   * Posts-tab content filter (issue #611, PR-C). When set to anything other
   * than `"all"` and the active tab is `"posts"`, the resolver appends
   * `?presentationIntent=<value>` so the backend's existing query parser
   * (`profile-activity-service.js#parseActivityContentFilter`) narrows the
   * collection. Filter is intentionally ignored on every other tab — chips
   * are gated on the posts tab in the view, but defending the contract here
   * keeps a stray pass from silently mutating the wrong endpoint.
   */
  contentFilter?: ProfilePostsContentFilter;
}

export function resolveProfileTabRequest(
  tab: ProfileTabKey,
  tids: FeedItemId[] = [],
  options: ProfileTabRequestOptions = {},
): { path: string; method: "GET" | "POST"; body?: string } {
  if (tab === "history") {
    return {
      path: "/api/me/history",
      method: "POST",
      body: JSON.stringify({ tids }),
    };
  }

  if (tab === "saved") return { path: "/api/me/saved", method: "GET" };
  if (tab === "liked") return { path: "/api/me/liked", method: "GET" };
  if (tab === "posts") {
    const filter =
      options.contentFilter && options.contentFilter !== "all" ? options.contentFilter : "";
    const path = filter
      ? `/api/me/posts?presentationIntent=${encodeURIComponent(filter)}`
      : "/api/me/posts";
    return { path, method: "GET" };
  }
  if (tab === "replies") return { path: "/api/me/replies", method: "GET" };
  if (tab === "drafts") return { path: "/api/me/drafts", method: "GET" };
  if (tab === "orders") {
    throw new Error(
      "Profile orders tab is fetched via /api/errands/orders/mine, not fetchProfileTab.",
    );
  }
  return { path: "/api/me/map-contributions", method: "GET" };
}

export async function fetchProfileTab(
  tab: ProfileTabKey,
  tids: FeedItemId[] = [],
  options: ProfileTabRequestOptions = {},
): Promise<ProfileListResponse> {
  const request = resolveProfileTabRequest(tab, tids, options);
  if (request.method === "POST") {
    if (tab === "history" && !tids.length) return { items: [] };
    return normalizeProfileListResponse(
      await apiSend<ProfileListResponse>(request.path, {
        method: request.method,
        body: request.body,
      }),
    );
  }

  return normalizeProfileListResponse(await apiGet<ProfileListResponse>(request.path));
}

export async function uploadProfileAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file, file.name || "avatar.jpg");

  const data = await apiUpload<{ url?: string }>(
    "/api/upload/image?purpose=avatar",
    form,
    "头像上传失败，可以换一张图片或稍后再试。",
  );
  if (!data.url)
    throw new LianApiError("头像上传成功但没有返回地址，请稍后再试。", 0, "MALFORMED_RESPONSE");
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

export async function logoutAuth(): Promise<void> {
  await apiSend("/api/auth/logout", { method: "POST" });
}
