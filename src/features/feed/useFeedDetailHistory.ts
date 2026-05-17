import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { FeedItemId } from "../../types/feed";

interface DetailHistoryState {
  lianDetail?: boolean;
  tid?: string;
}

export interface UseFeedDetailHistoryOptions {
  detailOpen: Ref<boolean>;
  onPopState: () => void;
}

export function useFeedDetailHistory(options: UseFeedDetailHistoryOptions) {
  const detailHistoryActive = ref(false);
  const ignoreNextPopState = ref(false);

  function currentHistoryState(): DetailHistoryState {
    if (typeof window === "undefined") return {} as DetailHistoryState;
    return (window.history.state || {}) as DetailHistoryState;
  }

  function pushDetailHistory(id: FeedItemId) {
    if (typeof window === "undefined" || detailHistoryActive.value) return;
    try {
      window.history.pushState(
        { ...currentHistoryState(), lianDetail: true, tid: String(id) },
        "",
        window.location.href,
      );
      detailHistoryActive.value = true;
    } catch {
      detailHistoryActive.value = false;
    }
  }

  function clearDetailHistory() {
    if (typeof window === "undefined" || !detailHistoryActive.value) return;
    detailHistoryActive.value = false;
    try {
      if (currentHistoryState().lianDetail) {
        ignoreNextPopState.value = true;
        window.history.back();
      }
    } catch {
      ignoreNextPopState.value = false;
    }
  }

  function onWindowPopState() {
    if (ignoreNextPopState.value) {
      ignoreNextPopState.value = false;
      return;
    }
    if (!options.detailOpen.value && !detailHistoryActive.value) return;
    detailHistoryActive.value = false;
    options.onPopState();
  }

  function resetHistoryState() {
    detailHistoryActive.value = false;
  }

  onMounted(() => {
    window.addEventListener("popstate", onWindowPopState);
  });

  onBeforeUnmount(() => {
    clearDetailHistory();
    window.removeEventListener("popstate", onWindowPopState);
  });

  return {
    detailHistoryActive,
    pushDetailHistory,
    clearDetailHistory,
    resetHistoryState,
  };
}
