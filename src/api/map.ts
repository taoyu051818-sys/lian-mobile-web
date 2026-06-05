import { apiGet, LianApiError } from "./http";
import type { MapRoadNetworkPreview, MapV2ItemsResponse, MapViewportQuery } from "../types/map";

export type { MapViewportQuery } from "../types/map";

function appendNumberParam(params: URLSearchParams, key: string, value: number) {
  if (Number.isFinite(value)) params.set(key, String(value));
}

function buildMapV2ItemsPath(query?: MapViewportQuery): string {
  if (!query) return "/api/map/v2/items";
  const params = new URLSearchParams();
  appendNumberParam(params, "south", query.bounds.south);
  appendNumberParam(params, "west", query.bounds.west);
  appendNumberParam(params, "north", query.bounds.north);
  appendNumberParam(params, "east", query.bounds.east);
  appendNumberParam(params, "zoom", query.zoom);
  if (query.types) params.set("types", query.types.join(","));
  const search = params.toString();
  return search ? `/api/map/v2/items?${search}` : "/api/map/v2/items";
}

export async function fetchMapV2Items(query?: MapViewportQuery): Promise<MapV2ItemsResponse> {
  return apiGet<MapV2ItemsResponse>(buildMapV2ItemsPath(query));
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
