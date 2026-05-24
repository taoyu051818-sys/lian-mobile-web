import { ref, onMounted, onUnmounted } from "vue";

export interface PwaUpdateState {
  /** True when a new service worker is available and waiting */
  updateAvailable: boolean;
  /** Function to apply the update (reloads the page) */
  applyUpdate: () => void;
  /** Function to dismiss the update prompt */
  dismissUpdate: () => void;
}

/**
 * Composable to handle PWA update prompts.
 * Listens for the `pwa-update-available` custom event dispatched by entry-client.ts
 * when a new service worker is detected.
 */
export function usePwaUpdate() {
  const updateAvailable = ref(false);
  let updateFn: (() => Promise<void>) | null = null;

  function handleUpdateAvailable(event: Event) {
    const customEvent = event as CustomEvent<{ updateSW: () => Promise<void> }>;
    updateAvailable.value = true;
    updateFn = customEvent.detail.updateSW;
  }

  function applyUpdate() {
    if (updateFn) {
      // Calling updateSW() activates the waiting SW and reloads the page
      updateFn();
    }
  }

  function dismissUpdate() {
    updateAvailable.value = false;
  }

  onMounted(() => {
    window.addEventListener("pwa-update-available", handleUpdateAvailable);
  });

  onUnmounted(() => {
    window.removeEventListener("pwa-update-available", handleUpdateAvailable);
  });

  return {
    updateAvailable,
    applyUpdate,
    dismissUpdate,
  };
}
