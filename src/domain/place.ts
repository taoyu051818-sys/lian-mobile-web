import type { PlaceStatus } from "../types/place";

const PLACE_STATUS_LABELS: Record<PlaceStatus, string> = {
  confirmed: "已确认",
  pending: "待确认",
  disputed: "有争议",
  expired: "可能过期",
  "ai-organized": "AI 整理",
  official: "官方",
};

export function placeStatusLabel(status?: PlaceStatus): string {
  return status ? PLACE_STATUS_LABELS[status] || "地点" : "地点";
}

const PLACE_TYPE_LABELS: Record<string, string> = {
  canteen: "食堂",
  cafeteria: "食堂",
  food_court: "食堂",
  dining: "食堂",
  library: "图书馆",
  building: "教学楼",
  academic: "教学楼",
  classroom: "教学楼",
  dormitory: "宿舍",
  dorm: "宿舍",
  residence: "宿舍",
  transit: "交通站点",
  transportation: "交通站点",
  stop: "交通站点",
  sports: "体育场馆",
  gym: "体育场馆",
  stadium: "体育场馆",
  lab: "实验室",
  laboratory: "实验室",
  office: "办公楼",
  garden: "校园绿地",
  park: "校园绿地",
  green: "校园绿地",
  shop: "商店",
  store: "商店",
  market: "商店",
};

const PLACE_TYPE_FALLBACK = "校园地点";

export function placeTypeLabel(primary?: string | null, secondary?: string | null): string {
  const raw = primary?.trim() || secondary?.trim() || "";
  if (!raw) return PLACE_TYPE_FALLBACK;
  const normalized = raw.toLowerCase();
  return PLACE_TYPE_LABELS[normalized] || raw;
}
