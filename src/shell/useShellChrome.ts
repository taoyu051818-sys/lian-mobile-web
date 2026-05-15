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
let autoHideActive = false;
let savedTopVisible: boolean | undefined;
let savedBottomVisible: boolean | undefined;

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

function applyRegions(map: ShellChromeRegionMap) {
  if (map.top) setRegion("top", map.top);
  if (map.bottom) setRegion("bottom", map.bottom);
}

function resetRegions() {
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  autoHideActive = false;
  savedTopVisible = undefined;
  savedBottomVisible = undefined;
}

function applyPageChrome(spec: PageChromeSpec) {
  // Reset top region before applying new spec so stale fields from previous
  // view (tabs, buttons, identity, filters) don't persist.
  if (spec.top) {
    const defaults = createDefaultChromeState();
    mergeRegion(state.top, defaults.top);
    setRegion("top", spec.top);
  }
  if (spec.bottom) setRegion("bottom", spec.bottom);

  if (spec.autoHideOnDetail !== undefined) {
    if (spec.autoHideOnDetail && !autoHideActive) {
      savedTopVisible = state.top.visible;
      savedBottomVisible = state.bottom.visible;
      state.top.visible = false;
      state.bottom.visible = false;
      autoHideActive = true;
    } else if (!spec.autoHideOnDetail && autoHideActive) {
      state.top.visible = savedTopVisible ?? true;
      state.bottom.visible = savedBottomVisible ?? true;
      autoHideActive = false;
      savedTopVisible = undefined;
      savedBottomVisible = undefined;
    }
  }
}

export function useShellChrome(): {
  state: Readonly<ShellChromeState>;
  setRegion: (key: ShellRegionKey, spec: ShellChromeRegionSpec) => void;
  applyRegions: (map: ShellChromeRegionMap) => void;
  resetRegions: () => void;
  applyPageChrome: (spec: PageChromeSpec) => void;
} {
  return {
    state: readonly(state) as Readonly<ShellChromeState>,
    setRegion,
    applyRegions,
    resetRegions,
    applyPageChrome,
  };
}
