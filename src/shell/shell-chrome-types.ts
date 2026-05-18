export type ShellRegionKey = "top" | "bottom";

/**
 * Named slot kinds rendered inside a shell region. The slot value drives
 * which sub-component (tabs / detail topbar / reply dock / ...) the shell
 * renders at the corresponding edge. Adding a new kind requires updating
 * ShellChrome's render branches and the docs in floating-chrome.css.
 */
export type ChromeSlotKind = "tabs" | "detail-topbar" | "reply-dock";

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

export interface ChromeFilterSpec {
  id: string;
  label: string;
  active: boolean;
}

export interface ChromeIdentitySpec {
  avatarText: string;
  name: string;
  meta?: string;
}

export interface ShellChromeRegionSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  /** Named slot rendered by ShellChrome. See ChromeSlotKind for valid values. */
  slot?: ChromeSlotKind;
  /** Typed tab spec. When set, ShellChrome renders the tab nav directly. */
  tabs?: ChromeTabSpec | null;
  /** Filter toggle buttons (e.g. map layers). */
  filters?: ChromeFilterSpec[];
  /** Compact identity display (avatar + name). */
  identity?: ChromeIdentitySpec | null;
  /** Callback invoked when a tab is selected. */
  onTabSelect?: ((tabId: string) => void) | null;
  /** Callback invoked when a button is clicked. */
  onButtonClick?: ((buttonId: string) => void) | null;
  /** Callback invoked when a filter is toggled. */
  onFilterToggle?: ((id: string) => void) | null;
}

export type ShellChromeRegionMap = Partial<Record<ShellRegionKey, ShellChromeRegionSpec>>;

export interface ShellChromeState {
  top: ShellChromeRegionSpec;
  bottom: ShellChromeRegionSpec;
}

export function createEmptyRegionSpec(): ShellChromeRegionSpec {
  return { buttons: [], visible: true, identity: null, tabs: null, filters: [] };
}

export function createDefaultChromeState(): ShellChromeState {
  return {
    top: createEmptyRegionSpec(),
    bottom: createEmptyRegionSpec(),
  };
}
