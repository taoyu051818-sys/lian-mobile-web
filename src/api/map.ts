import { apiGet } from "./http";
import type { MapV2ItemsResponse } from "../types/map";

export async function fetchMapV2Items(): Promise<MapV2ItemsResponse> {
  return apiGet<MapV2ItemsResponse>("/api/map/v2/items");
}
