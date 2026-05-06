import { apiGet } from "./http";
import type { PlaceSheet } from "../types/place";

export async function fetchPlaceSheet(id: string): Promise<PlaceSheet> {
  const placeId = String(id || "").trim();
  if (!placeId) throw new Error("缺少地点 ID");
  return apiGet<PlaceSheet>(`/api/place-sheets/${encodeURIComponent(placeId)}`);
}
