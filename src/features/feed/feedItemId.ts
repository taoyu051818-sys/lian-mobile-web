import type { FeedItemId } from "../../types/feed";

export function normalizeFeedItemId(id: FeedItemId | string | number | null | undefined) {
  return id == null ? "" : String(id);
}
