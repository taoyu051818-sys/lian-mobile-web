import { onBeforeUnmount, onMounted, watch } from "vue";
import { useShellChrome } from "./useShellChrome";
import type { ChromeSlotKind } from "./shell-chrome-types";
import { useDetailNavigation } from "../app/detail-navigation";

/**
 * Page-owned top slot lifecycle. Stake the named kind on mount, release on
 * unmount, and yield to the detail FSM while a detail panel is open
 * (re-staking when it closes). Without the unmount release, switching to
 * another view would leave the previous page's slot on `state.top.slot`,
 * suppressing tabs/identity/buttons everywhere — the bug behind PR #943 and
 * #945's hand-rolled patterns.
 */
export function usePageChromeSlot(kind: ChromeSlotKind): void {
  const chrome = useShellChrome();
  const detail = useDetailNavigation();

  function claim() {
    if (!detail.detailOpen.value) chrome.setSlot("top", kind);
  }
  function release() {
    if (chrome.state.top.slot === kind) chrome.setSlot("top", null);
  }

  onMounted(claim);
  onBeforeUnmount(release);
  watch(
    () => detail.detailOpen.value,
    (open, wasOpen) => {
      if (wasOpen && !open) claim();
    },
  );
}
