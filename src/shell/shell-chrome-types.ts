export type ShellRegionKey = "top" | "bottom";

export interface ChromeButtonSpec {
  id: string;
  label: string;
  icon?: string;
  variant?: "ghost" | "tonal" | "primary";
  disabled?: boolean;
}

export interface ChromeTabItem {
  id: string;
  label: string;
}

export interface ChromeTabSpec {
  kind: "tabs";
  items: ChromeTabItem[];
  activeKey: string;
  ariaLabel?: string;
  floatingState?: string;
}

export interface ShellChromeRegionSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  /** Opaque slot hint for future slot-based rendering. */
  slot?: string;
  /** Typed tab spec. When set, ShellChrome renders the tab nav directly. */
  tabs?: ChromeTabSpec | null;
  /** Callback invoked when a tab is selected. */
  onTabSelect?: ((tabId: string) => void) | null;
}

export type ShellChromeRegionMap = Partial<Record<ShellRegionKey, ShellChromeRegionSpec>>;

export interface ShellChromeState {
  top: ShellChromeRegionSpec;
  bottom: ShellChromeRegionSpec;
}

export function createEmptyRegionSpec(): ShellChromeRegionSpec {
  return { buttons: [], visible: true };
}

export function createDefaultChromeState(): ShellChromeState {
  return {
    top: createEmptyRegionSpec(),
    bottom: createEmptyRegionSpec(),
  };
}
