import { ref } from "vue";
import { fetchNotifications, markNotificationsRead } from "../../api/notifications";
import { LianApiError } from "../../api/http";
import type { NotificationItem } from "../../types/messages";

/**
 * Notification fetch state — discriminated so the messages view can render
 * three different surfaces:
 *
 *   - `error`: 5xx / timeout / JSON malformed. Fail-loud (#828): renders a
 *     distinct surface AND keeps `console.error` so a 5xx is never silently
 *     downgraded to an empty inbox.
 *   - `auth-required`: 401 / 403. The CTA routes back to the profile view's
 *     AuthPanel; we deliberately do NOT show "暂无通知" here — that would
 *     make a session-expired user think they have no messages.
 *   - `idle`: ready (possibly empty) — the consumer renders the per-tab
 *     empty state via brand copy.
 */
export type NotificationFetchState = "idle" | "error" | "auth-required";

function isAuthError(error: unknown): boolean {
  return error instanceof LianApiError && (error.status === 401 || error.status === 403);
}

const NOTIFICATION_PAGE_SIZE = 30;

export function mergeNotificationItems(
  existing: NotificationItem[],
  incoming: NotificationItem[],
): NotificationItem[] {
  const merged = new Map<string | number, NotificationItem>();
  for (const item of existing) {
    if (item.id === undefined || item.id === null) continue;
    merged.set(item.id, item);
  }
  const itemsWithoutIds = existing.filter((item) => item.id === undefined || item.id === null);
  for (const item of incoming) {
    if (item.id === undefined || item.id === null) {
      itemsWithoutIds.push(item);
      continue;
    }
    const current = merged.get(item.id);
    merged.set(item.id, current?.read ? { ...item, read: true } : item);
  }
  return [...merged.values(), ...itemsWithoutIds];
}

function applyLocalReadMarks(
  items: NotificationItem[],
  locallyReadNotificationIds: Set<string>,
): NotificationItem[] {
  return items.map((item) =>
    item.id !== undefined && item.id !== null && locallyReadNotificationIds.has(String(item.id))
      ? { ...item, read: true }
      : item,
  );
}

export function useNotifications() {
  const notificationItems = ref<NotificationItem[]>([]);
  const notificationLoading = ref(false);
  const notificationFetchState = ref<NotificationFetchState>("idle");
  const notificationHasMore = ref(false);
  const notificationOffset = ref(0);
  const notificationLastFailedReset = ref(true);
  const locallyReadNotificationIds = new Set<string>();

  async function loadNotifications(reset = true) {
    if (notificationLoading.value) return;
    notificationLoading.value = true;
    notificationFetchState.value = "idle";

    if (reset) {
      notificationItems.value = [];
      notificationOffset.value = 0;
      notificationHasMore.value = false;
    }

    try {
      const response = await fetchNotifications(
        reset ? 0 : notificationOffset.value,
        NOTIFICATION_PAGE_SIZE,
      );
      const nextItems = applyLocalReadMarks(response.items || [], locallyReadNotificationIds);
      notificationItems.value = reset
        ? nextItems
        : mergeNotificationItems(notificationItems.value, nextItems);
      notificationHasMore.value = Boolean(response.hasMore);
      notificationOffset.value = response.nextOffset ?? notificationItems.value.length;
    } catch (error) {
      notificationLastFailedReset.value = reset;
      // Fail-loud (#828): preserve the diagnostic in console.error so the
      // Playwright contract can assert it AND humans get a real signal in
      // the browser devtools. Never swallow this into an "暂无通知" branch.
      // eslint-disable-next-line no-console -- fail-loud contract for #828
      console.error("messages fetch failed", error);
      if (reset) notificationItems.value = [];
      notificationFetchState.value = isAuthError(error) ? "auth-required" : "error";
    } finally {
      notificationLoading.value = false;
    }
  }

  async function loadMoreNotifications() {
    if (!notificationHasMore.value) return;
    await loadNotifications(false);
  }

  async function retryNotifications() {
    await loadNotifications(notificationLastFailedReset.value);
  }

  function markNotificationReadLocally(notificationId: string | number) {
    locallyReadNotificationIds.add(String(notificationId));
    notificationItems.value = notificationItems.value.map((item) =>
      String(item.id) === String(notificationId) ? { ...item, read: true } : item,
    );
  }

  function openNotification(item: NotificationItem) {
    if (item.read || item.id === undefined || item.id === null) return;
    markNotificationReadLocally(item.id);
    void markNotificationsRead([item.id]).catch(() => {});
  }

  return {
    notificationItems,
    notificationLoading,
    notificationFetchState,
    notificationHasMore,
    loadNotifications,
    loadMoreNotifications,
    retryNotifications,
    openNotification,
  };
}
