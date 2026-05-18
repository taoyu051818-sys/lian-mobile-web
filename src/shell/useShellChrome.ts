import { reactive, readonly } from "vue";
import {
  createDefaultChromeState,
  type ChromeSlotKind,
  type ShellChromeRegionMap,
  type ShellChromeRegionSpec,
  type ShellChromeState,
  type ShellRegionKey,
} from "./shell-chrome-types";
import type { PageChromeSpec } from "./page-model";

const state: ShellChromeState = reactive(createDefaultChromeState());

interface SlotEntry {
  token: symbol;
  slot: ChromeSlotKind | null;
}

/**
 * Per-region slot stack. The base entry is owned by AppShell/page chrome;
 * pushed entries are owned by mounted children such as PostDetailPanel.
 */
const slotStacks: Record<ShellRegionKey, SlotEntry[]> = {
  top: [],
  bottom: [],
};

function syncSlot(key: ShellRegionKey) {
  const stack = slotStacks[key];
  state[key].slot = stack.length ? stack[stack.length - 1].slot : null;
}

function mergeRegion(target: ShellChromeRegionSpec, patch: ShellChromeRegionSpec) {
  if (patch.buttons !== undefined) target.buttons = patch.buttons;
  if (patch.visible !== undefined) target.visible = patch.visible;
  if (patch.tabs !== undefined) target.tabs = patch.tabs;
  if (patch.filters !== undefined) target.filters = patch.filters;
  if (patch.identity !== undefined) target.identity = patch.identity;
  if (patch.onTabSelect !== undefined) target.onTabSelect = patch.onTabSelect;
  if (patch.onButtonClick !== undefined) target.onButtonClick = patch.onButtonClick;
  if (patch.onFilterToggle !== undefined) target.onFilterToggle = patch.onFilterToggle;
}

function writeSlotBase(key: ShellRegionKey, slot: ChromeSlotKind | null) {
  if (slotStacks[key].length === 0) {
    slotStacks[key].push({ token: Symbol(`${key}:base`), slot });
  } else {
    slotStacks[key][0].slot = slot;
  }
  syncSlot(key);
}

function setRegion(key: ShellRegionKey, spec: ShellChromeRegionSpec) {
  mergeRegion(state[key], spec);
  if (spec.slot !== undefined) {
    writeSlotBase(key, spec.slot);
  }
}

function applyRegions(map: ShellChromeRegionMap) {
  if (map.top) setRegion("top", map.top);
  if (map.bottom) setRegion("bottom", map.bottom);
}

function resetRegions() {
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);

  // Top chrome is always page-owned, so reset clears any leftover base/detail
  // slot. Bottom preserves AppShell's tabs base while dropping child-owned
  // entries so a missed unmount cleanup cannot leak into the next view/test.
  slotStacks.top.splice(0);
  slotStacks.bottom.splice(1);
  syncSlot("top");
  syncSlot("bottom");
}

function applyPageChrome(spec: PageChromeSpec) {
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  if (spec.top) setRegion("top", spec.top);
  if (spec.bottom) setRegion("bottom", spec.bottom);
  // Slots are owned by setRegion({ slot }) or pushSlot(); page chrome updates
  // must not remove active child-owned Teleport targets.
  syncSlot("top");
  syncSlot("bottom");
}

function pushSlot(key: ShellRegionKey, slot: ChromeSlotKind): () => void {
  const token = Symbol(`${key}:${slot}`);
  slotStacks[key].push({ token, slot });
  syncSlot(key);

  return () => {
    const stack = slotStacks[key];
    const index = stack.findIndex((entry) => entry.token === token);
    if (index >= 0) stack.splice(index, 1);
    syncSlot(key);
  };
}

export function useShellChrome(): {
  state: Readonly<ShellChromeState>;
  setRegion: (key: ShellRegionKey, spec: ShellChromeRegionSpec) => void;
  applyRegions: (map: ShellChromeRegionMap) => void;
  resetRegions: () => void;
  applyPageChrome: (spec: PageChromeSpec) => void;
  pushSlot: (key: ShellRegionKey, slot: ChromeSlotKind) => () => void;
} {
  return {
    state: readonly(state) as Readonly<ShellChromeState>,
    setRegion,
    applyRegions,
    resetRegions,
    applyPageChrome,
    pushSlot,
  };
}
