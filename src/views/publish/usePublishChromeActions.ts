import { useShellChrome } from "../../shell/useShellChrome";
import type { ChromeButtonSpec } from "../../shell/shell-chrome-types";

interface ChromeButtonWithAction extends ChromeButtonSpec {
  onClick?: () => void;
}

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

  function buildButtons(publishDisabled: boolean): ChromeButtonWithAction[] {
    return [
      { id: "publish-clear", label: "清空", variant: "ghost", onClick: handlers.onClear },
      { id: "publish-submit", label: "发布", variant: "primary", disabled: publishDisabled, onClick: handlers.onPublish },
    ];
  }

  function setup() {
    setRegion("bottom", { buttons: buildButtons(false) as ChromeButtonSpec[] });
  }

  function updateDisabled(disabled: boolean) {
    setRegion("bottom", { buttons: buildButtons(disabled) as ChromeButtonSpec[] });
  }

  function cleanup() {
    resetRegions();
  }

  return { setup, updateDisabled, cleanup };
}
