import { apiGet } from "./http";
import { ERROR_MISSING_PLACE_ID } from "../config/brand";
import type { PlaceSheet } from "../types/place";

export async function fetchPlaceSheet(id: string): Promise<PlaceSheet> {
  const placeId = String(id || "").trim();
  if (!placeId) throw new Error(ERROR_MISSING_PLACE_ID);
  return apiGet<PlaceSheet>(`/api/place-sheets/${encodeURIComponent(placeId)}`);
}
