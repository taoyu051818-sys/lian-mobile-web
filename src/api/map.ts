import { apiGet } from "./http";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../types/map";

export async function fetchMapV2Items(): Promise<MapV2ItemsResponse> {
  return apiGet<MapV2ItemsResponse>("/api/map/v2/items");
}

export async function fetchRoadNetworkPreview(): Promise<MapRoadNetworkPreview | null> {
  const response = await fetch("/assets/road-network-preview.json", { cache: "force-cache" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Road network preview failed to load (${response.status})`);
  return response.json() as Promise<MapRoadNetworkPreview>;
}
