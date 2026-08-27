import { apiGet, apiSend, apiUpload, LianApiError } from "./http";
import type { MapAsset, MapBounds, MapLayerBundle, MapLocation, MapPoint } from "../types/map";

export interface AdminMapLocationDocument {
  version: number;
  coordSystem: string;
  items: MapLocation[];
  [key: string]: unknown;
}

export interface AdminMapLayerDocument extends MapLayerBundle {
  version: number;
  coordSystem: string;
  center: MapPoint;
  zoom: number;
  assets?: MapAsset[];
  [key: string]: unknown;
}

export interface AdminMapDocument {
  ok?: boolean;
  bounds: MapBounds;
  locations: AdminMapLocationDocument;
  layers: AdminMapLayerDocument;
}

function withOpsToken(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token.trim()}`);
  return { ...init, headers };
}

function assertDocument(data: AdminMapDocument): AdminMapDocument {
  if (!data?.bounds || !data.locations || !data.layers) {
    throw new LianApiError("地图后台返回的数据不完整", 0, "MALFORMED_RESPONSE");
  }
  if (!Array.isArray(data.locations.items)) data.locations.items = [];
  if (!Array.isArray(data.layers.assets)) data.layers.assets = [];
  return data;
}

export async function fetchAdminMapDocument(
  token: string,
  signal?: AbortSignal,
): Promise<AdminMapDocument> {
  return assertDocument(
    await apiGet<AdminMapDocument>("/api/admin/map-v2", withOpsToken(token, { signal })),
  );
}

export async function putAdminMapDocument(
  token: string,
  document: Pick<AdminMapDocument, "locations" | "layers">,
  signal?: AbortSignal,
): Promise<AdminMapDocument> {
  return assertDocument(
    await apiSend<AdminMapDocument>(
      "/api/admin/map-v2",
      withOpsToken(token, {
        method: "PUT",
        body: JSON.stringify({ locations: document.locations, layers: document.layers }),
        signal,
      }),
    ),
  );
}

export async function uploadAdminMapAsset(
  token: string,
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) throw new Error("仅支持 JPEG、PNG、WebP 或 GIF 图片。");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("地图素材必须大于 0 字节且不超过 5MB。");
  }

  const body = new FormData();
  body.append("image", file, file.name || "map-asset.png");
  const data = await apiUpload<{ url?: string }>(
    "/api/admin/map-v2/assets",
    body,
    "地图素材上传失败，请稍后重试。",
    withOpsToken(token, { signal }),
  );
  if (!data.url) throw new LianApiError("上传成功但没有返回素材地址", 0, "MALFORMED_RESPONSE");
  return data.url;
}
