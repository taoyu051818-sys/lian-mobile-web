import { nextTick, type WatchStopHandle } from "vue";
import { useShellChrome } from "../../shell/useShellChrome";
import type { ChromeButtonSpec } from "../../shell/shell-chrome-types";

export interface PublishChromeActions {
  setup(): void;
  updateDisabled(disabled: boolean): void;
  cleanup(): void;
}

export function usePublishChromeActions(handlers: {
  onPublish: () => void;
  onClear: () => void;
}): PublishChromeActions {
  const { setRegion, resetRegions } = useShellChrome();
  let observer: MutationObserver | null = null;
  let stopWatch: WatchStopHandle | null = null;

  function buildButtons(publishDisabled: boolean): ChromeButtonSpec[] {
    return [
      { id: "publish-clear", label: "清空", variant: "ghost" },
      { id: "publish-submit", label: "发布", variant: "primary", disabled: publishDisabled },
    ];
  }

  function detachHandlers() {
    const container = document.querySelector(".shell-chrome--bottom .shell-chrome__buttons");
    if (!container) return;
    container.querySelectorAll("button").forEach((btn) => {
      btn.removeEventListener("click", handleButtonClick);
    });
  }

  function handleButtonClick(event: Event) {
    const target = event.currentTarget as HTMLElement;
    const label = target.textContent?.trim();
    if (label === "发布") {
      handlers.onPublish();
    } else if (label === "清空") {
      handlers.onClear();
    }
  }

  function attachHandlers() {
    const container = document.querySelector(".shell-chrome--bottom .shell-chrome__buttons");
    if (!container) return;
    container.querySelectorAll("button").forEach((btn) => {
      btn.removeEventListener("click", handleButtonClick);
      btn.addEventListener("click", handleButtonClick);
    });
  }

  function observeButtons() {
    if (observer) return;
    observer = new MutationObserver(() => {
      const container = document.querySelector(".shell-chrome--bottom .shell-chrome__buttons");
      if (container) {
        attachHandlers();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setup() {
    setRegion("bottom", { buttons: buildButtons(false) });
    observeButtons();
    nextTick(() => {
      attachHandlers();
    });
  }

  function updateDisabled(disabled: boolean) {
    detachHandlers();
    setRegion("bottom", { buttons: buildButtons(disabled) });
    nextTick(() => {
      attachHandlers();
    });
  }

  function cleanup() {
    detachHandlers();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (stopWatch) {
      stopWatch();
      stopWatch = null;
    }
    resetRegions();
  }

  return { setup, updateDisabled, cleanup };
}
