import type { PlaceStatus } from "../types/place";
import {
  PLACE_STATUS_CONFIRMED,
  PLACE_STATUS_PENDING,
  PLACE_STATUS_DISPUTED,
  PLACE_STATUS_EXPIRED,
  PLACE_STATUS_AI_ORGANIZED,
  PLACE_STATUS_OFFICIAL,
  PLACE_FALLBACK_LABEL,
  PLACE_TYPE_CANTEEN,
  PLACE_TYPE_LIBRARY,
  PLACE_TYPE_BUILDING,
  PLACE_TYPE_DORMITORY,
  PLACE_TYPE_TRANSIT,
  PLACE_TYPE_SPORTS,
  PLACE_TYPE_LAB,
  PLACE_TYPE_OFFICE,
  PLACE_TYPE_GARDEN,
  PLACE_TYPE_SHOP,
  PLACE_TYPE_FALLBACK,
} from "../config/brand";

const PLACE_STATUS_LABELS: Record<PlaceStatus, string> = {
  confirmed: PLACE_STATUS_CONFIRMED,
  pending: PLACE_STATUS_PENDING,
  disputed: PLACE_STATUS_DISPUTED,
  expired: PLACE_STATUS_EXPIRED,
  "ai-organized": PLACE_STATUS_AI_ORGANIZED,
  official: PLACE_STATUS_OFFICIAL,
};

export function placeStatusLabel(status?: PlaceStatus): string {
  return status ? PLACE_STATUS_LABELS[status] || PLACE_FALLBACK_LABEL : PLACE_FALLBACK_LABEL;
}

const PLACE_TYPE_LABELS: Record<string, string> = {
  canteen: PLACE_TYPE_CANTEEN,
  cafeteria: PLACE_TYPE_CANTEEN,
  food_court: PLACE_TYPE_CANTEEN,
  dining: PLACE_TYPE_CANTEEN,
  library: PLACE_TYPE_LIBRARY,
  building: PLACE_TYPE_BUILDING,
  academic: PLACE_TYPE_BUILDING,
  classroom: PLACE_TYPE_BUILDING,
  dormitory: PLACE_TYPE_DORMITORY,
  dorm: PLACE_TYPE_DORMITORY,
  residence: PLACE_TYPE_DORMITORY,
  transit: PLACE_TYPE_TRANSIT,
  transportation: PLACE_TYPE_TRANSIT,
  stop: PLACE_TYPE_TRANSIT,
  sports: PLACE_TYPE_SPORTS,
  gym: PLACE_TYPE_SPORTS,
  stadium: PLACE_TYPE_SPORTS,
  lab: PLACE_TYPE_LAB,
  laboratory: PLACE_TYPE_LAB,
  office: PLACE_TYPE_OFFICE,
  garden: PLACE_TYPE_GARDEN,
  park: PLACE_TYPE_GARDEN,
  green: PLACE_TYPE_GARDEN,
  shop: PLACE_TYPE_SHOP,
  store: PLACE_TYPE_SHOP,
  market: PLACE_TYPE_SHOP,
};

function normalizePlaceType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function placeTypeLabel(primary?: string | null, secondary?: string | null): string {
  const raw = primary?.trim() || secondary?.trim() || "";
  if (!raw) return PLACE_TYPE_FALLBACK;
  const normalized = normalizePlaceType(raw);
  return PLACE_TYPE_LABELS[normalized] || raw;
}
