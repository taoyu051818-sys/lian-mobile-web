import { ref } from "vue";
import { fetchNotifications } from "../../api/messages";
import { ERROR_LOAD_NOTIFICATION } from "../../config/brand";
import type { NotificationItem } from "../../types/messages";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

export function useNotifications() {
  const notificationItems = ref<NotificationItem[]>([]);
  const notificationLoading = ref(false);
  const notificationError = ref("");

  async function loadNotifications() {
    if (notificationLoading.value) return;
    notificationLoading.value = true;
    notificationError.value = "";

    try {
      const response = await fetchNotifications();
      notificationItems.value = response.items || [];
    } catch (error) {
      notificationError.value = extractErrorMessage(error, ERROR_LOAD_NOTIFICATION);
    } finally {
      notificationLoading.value = false;
    }
  }

  return {
    notificationItems,
    notificationLoading,
    notificationError,
    loadNotifications,
  };
}
