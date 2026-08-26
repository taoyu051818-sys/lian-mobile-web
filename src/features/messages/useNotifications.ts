import { ref } from "vue";
import { fetchNotifications, markNotificationRead } from "../../api/notifications";
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
  const merged = new Map<string, NotificationItem>();
  for (const item of existing) {
    merged.set(notificationIdentityKey(item), item);
  }
  for (const item of incoming) {
    const key = notificationIdentityKey(item);
    const current = merged.get(key);
    merged.set(key, current?.read ? { ...item, read: true } : item);
  }
  return [...merged.values()];
}

export function notificationIdentityKey(item: NotificationItem): string {
  const source = item.source ?? "legacy";
  if (item.id !== undefined && item.id !== null && String(item.id)) {
    return `source:${source}:id:${String(item.id)}`;
  }
  // NodeBB notifications are appended to every LIAN page and some legacy
  // rows do not carry ids. A stable content fingerprint prevents an exact
  // repeat from accumulating while still keeping rows with distinct targets.
  return `source:${source}:fallback:${JSON.stringify([
    item.type,
    item.kind,
    item.tid,
    item.title,
    item.excerpt,
    item.timestampISO,
    item.time,
    item.actor?.id,
    item.target,
  ])}`;
}

function applyLocalReadMarks(
  items: NotificationItem[],
  locallyReadNotificationKeys: Set<string>,
): NotificationItem[] {
  return items.map((item) =>
    item.id !== undefined &&
    item.id !== null &&
    locallyReadNotificationKeys.has(notificationIdentityKey(item))
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
  const locallyReadNotificationKeys = new Set<string>();

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
      const requestedOffset = reset ? 0 : notificationOffset.value;
      const response = await fetchNotifications(requestedOffset, NOTIFICATION_PAGE_SIZE);
      const nextItems = applyLocalReadMarks(response.items || [], locallyReadNotificationKeys);
      notificationItems.value = reset
        ? mergeNotificationItems([], nextItems)
        : mergeNotificationItems(notificationItems.value, nextItems);
      notificationHasMore.value = Boolean(response.hasMore);
      notificationOffset.value = response.nextOffset ?? requestedOffset + nextItems.length;
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

  function markNotificationReadLocally(notification: NotificationItem) {
    const identityKey = notificationIdentityKey(notification);
    locallyReadNotificationKeys.add(identityKey);
    notificationItems.value = notificationItems.value.map((item) =>
      notificationIdentityKey(item) === identityKey ? { ...item, read: true } : item,
    );
  }

  function openNotification(item: NotificationItem) {
    if (item.read || item.id === undefined || item.id === null) return;
    const identityKey = notificationIdentityKey(item);
    markNotificationReadLocally(item);
    const readRequest = item.source
      ? markNotificationRead(item.id, item.source)
      : markNotificationRead(item.id);
    void readRequest.catch((error) => {
      // Keep the optimistic update only when the backend accepts it. Rolling
      // back makes the row retryable instead of hiding a failed mutation until
      // the next full refresh.
      locallyReadNotificationKeys.delete(identityKey);
      notificationItems.value = notificationItems.value.map((entry) =>
        notificationIdentityKey(entry) === identityKey ? { ...entry, read: false } : entry,
      );
      // Read failures are independent from inbox-fetch state, but must remain
      // observable for diagnostics.
      // eslint-disable-next-line no-console -- explicit mark-read failure handling
      console.error("notification mark-read failed", error);
    });
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
