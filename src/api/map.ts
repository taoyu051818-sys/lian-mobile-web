import { apiGet, LianApiError } from "./http";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../types/map";

export async function fetchMapV2Items(): Promise<MapV2ItemsResponse> {
  return apiGet<MapV2ItemsResponse>("/api/map/v2/items");
}

export async function fetchRoadNetworkPreview(): Promise<MapRoadNetworkPreview | null> {
  const response = await fetch("/assets/road-network-preview.json", { cache: "force-cache" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new LianApiError(`路网预览加载失败（状态码 ${response.status}）`, response.status);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new LianApiError("路网预览响应格式错误", response.status, "INVALID_CONTENT_TYPE");
  }
  try {
    return (await response.json()) as MapRoadNetworkPreview;
  } catch {
    throw new LianApiError("路网预览数据解析失败", response.status, "JSON_PARSE_ERROR");
  }
}
