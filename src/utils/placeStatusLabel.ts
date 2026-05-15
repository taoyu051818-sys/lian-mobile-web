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
