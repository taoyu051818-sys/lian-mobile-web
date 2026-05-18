import { reactive, readonly } from "vue";
import {
  createDefaultChromeState,
  type ShellChromeRegionMap,
  type ShellChromeRegionSpec,
  type ShellChromeState,
  type ShellRegionKey,
} from "./shell-chrome-types";
import type { PageChromeSpec } from "./page-model";

const state: ShellChromeState = reactive(createDefaultChromeState());
let detailChromeLockCount = 0;

function mergeRegion(target: ShellChromeRegionSpec, patch: ShellChromeRegionSpec) {
  if (patch.buttons !== undefined) {
    target.buttons = patch.buttons;
  }
  if (patch.visible !== undefined) {
    target.visible = patch.visible;
  }
  if (patch.slot !== undefined) {
    target.slot = patch.slot;
  }
  if (patch.tabs !== undefined) {
    target.tabs = patch.tabs;
  }
  if (patch.filters !== undefined) {
    target.filters = patch.filters;
  }
  if (patch.identity !== undefined) {
    target.identity = patch.identity;
  }
  if (patch.onTabSelect !== undefined) {
    target.onTabSelect = patch.onTabSelect;
  }
  if (patch.onButtonClick !== undefined) {
    target.onButtonClick = patch.onButtonClick;
  }
  if (patch.onFilterToggle !== undefined) {
    target.onFilterToggle = patch.onFilterToggle;
  }
}

function setRegion(key: ShellRegionKey, spec: ShellChromeRegionSpec) {
  mergeRegion(state[key], spec);
}

function forceDetailChromeSlots() {
  state.top.slot = "detail-topbar";
  state.top.visible = true;
  state.top.tabs = null;
  state.bottom.slot = "reply-dock";
  state.bottom.visible = true;
}

function beginDetailChrome() {
  detailChromeLockCount += 1;
  forceDetailChromeSlots();
}

function endDetailChrome() {
  detailChromeLockCount = Math.max(0, detailChromeLockCount - 1);
  if (detailChromeLockCount > 0) {
    forceDetailChromeSlots();
    return;
  }
  state.top.slot = null;
  state.bottom.slot = "tabs";
  state.top.visible = true;
  state.bottom.visible = true;
}

function applyRegions(map: ShellChromeRegionMap) {
  if (map.top) setRegion("top", map.top);
  if (map.bottom) setRegion("bottom", map.bottom);
}

function resetRegions() {
  detailChromeLockCount = 0;
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  // Preserve the shell-owned tab slot set once by AppShell.
  state.bottom.slot = "tabs";
}

function applyPageChrome(spec: PageChromeSpec) {
  const defaults = createDefaultChromeState();

  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  // Clear any slot left over from a previous view (e.g. detail-topbar from a
  // detail panel that closed without completing its unmount cleanup).
  state.top.slot = null;
  state.bottom.slot = "tabs";

  if (spec.top) {
    setRegion("top", spec.top);
  }
  if (spec.bottom) {
    setRegion("bottom", spec.bottom);
  }
  if (detailChromeLockCount > 0) {
    forceDetailChromeSlots();
  }
}

export function useShellChrome(): {
  state: Readonly<ShellChromeState>;
  setRegion: (key: ShellRegionKey, spec: ShellChromeRegionSpec) => void;
  applyRegions: (map: ShellChromeRegionMap) => void;
  resetRegions: () => void;
  applyPageChrome: (spec: PageChromeSpec) => void;
  beginDetailChrome: () => void;
  endDetailChrome: () => void;
} {
  return {
    state: readonly(state) as Readonly<ShellChromeState>,
    setRegion,
    applyRegions,
    resetRegions,
    applyPageChrome,
    beginDetailChrome,
    endDetailChrome,
  };
}
