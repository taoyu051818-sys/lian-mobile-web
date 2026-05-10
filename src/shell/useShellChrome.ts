import { reactive, readonly } from "vue";
import {
  createDefaultChromeState,
  type ShellChromeRegionMap,
  type ShellChromeRegionSpec,
  type ShellChromeState,
  type ShellRegionKey,
} from "./shell-chrome-types";

const state: ShellChromeState = reactive(createDefaultChromeState());

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
  if (patch.onTabSelect !== undefined) {
    target.onTabSelect = patch.onTabSelect;
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
}

export function useShellChrome(): {
  state: Readonly<ShellChromeState>;
  setRegion: (key: ShellRegionKey, spec: ShellChromeRegionSpec) => void;
  applyRegions: (map: ShellChromeRegionMap) => void;
  resetRegions: () => void;
} {
  return {
    state: readonly(state) as Readonly<ShellChromeState>,
    setRegion,
    applyRegions,
    resetRegions,
  };
}
