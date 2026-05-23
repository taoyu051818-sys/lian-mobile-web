import { ref } from "vue";
import { fetchNotifications } from "../../api/notifications";
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

export function useNotifications() {
  const notificationItems = ref<NotificationItem[]>([]);
  const notificationLoading = ref(false);
  const notificationFetchState = ref<NotificationFetchState>("idle");

  async function loadNotifications() {
    if (notificationLoading.value) return;
    notificationLoading.value = true;
    notificationFetchState.value = "idle";

    try {
      const response = await fetchNotifications();
      notificationItems.value = response.items || [];
    } catch (error) {
      // Fail-loud (#828): preserve the diagnostic in console.error so the
      // Playwright contract can assert it AND humans get a real signal in
      // the browser devtools. Never swallow this into an "暂无通知" branch.
      // eslint-disable-next-line no-console -- fail-loud contract for #828
      console.error("messages fetch failed", error);
      notificationItems.value = [];
      notificationFetchState.value = isAuthError(error) ? "auth-required" : "error";
    } finally {
      notificationLoading.value = false;
    }
  }

  return {
    notificationItems,
    notificationLoading,
    notificationFetchState,
    loadNotifications,
  };
}
