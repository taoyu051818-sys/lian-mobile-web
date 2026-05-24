import { ref, onMounted, onUnmounted } from "vue";

/**
 * Reactive network status composable.
 * Tracks online/offline state and provides a reactive `isOnline` ref.
 */
export function useNetworkStatus() {
  const isOnline = ref(typeof navigator !== "undefined" ? navigator.onLine : true);

  function handleOnline() {
    isOnline.value = true;
  }

  function handleOffline() {
    isOnline.value = false;
  }

  onMounted(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  });

  onUnmounted(() => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  });

  return { isOnline };
}
