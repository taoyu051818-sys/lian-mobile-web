import type { ChromeButtonSpec, ChromeTabSpec } from "./shell-chrome-types";

export interface PageChromeTopSpec {
  tabs?: ChromeTabSpec | null;
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  onTabSelect?: (tabId: string) => void;
  onButtonClick?: (buttonId: string) => void;
}

export interface PageChromeBottomSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
}

export interface PageChromeSpec {
  top?: PageChromeTopSpec;
  bottom?: PageChromeBottomSpec;
  /** When true, shell hides chrome while a detail overlay is open. */
  autoHideOnDetail?: boolean;
}
