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

function setRegion(key: ShellRegionKey, spec: ShellChromeRegionSpec) {
  mergeRegion(state[key], spec);
  if (spec.slot !== undefined) {
    state[key].slot = spec.slot;
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
  // Slots are owned by `setSlot` (currently driven by the detail-navigation
  // FSM). A merge-state reset must leave them alone — pages don't expect
  // their own guest/clear path to wipe AppShell's bottom-tabs base or a
  // detail panel's active teleport target.
}

/**
 * Apply a page-level chrome spec. Page chrome owns tabs / buttons / identity,
 * but it MUST NOT touch `slot` — slots are written by `setSlot`, currently
 * driven by the detail-navigation FSM. This decoupling is what makes the
 * "open detail → switch tab → race" sequence safe: page chrome can repaint at
 * any time without dislodging an active teleport target.
 */
function applyPageChrome(spec: PageChromeSpec) {
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  if (spec.top) {
    const { ...topRest } = spec.top;
    mergeRegion(state.top, topRest);
  }
  if (spec.bottom) {
    const { ...bottomRest } = spec.bottom;
    mergeRegion(state.bottom, bottomRest);
  }
}

/**
 * Write a region's named slot directly. The FSM driving detail navigation is
 * the single owner of slot transitions; legacy push/pop stack semantics are
 * gone because there is exactly one component (PostDetailPanel) that needs a
 * slot at a time, and the FSM tracks that for us.
 */
function setSlot(key: ShellRegionKey, slot: ChromeSlotKind | null) {
  state[key].slot = slot;
}

function ensureBottomSlot(slot: ChromeSlotKind) {
  if (state.bottom.slot == null) {
    setSlot("bottom", slot);
  }
}

export function useShellChrome(): {
  state: Readonly<ShellChromeState>;
  setRegion: (key: ShellRegionKey, spec: ShellChromeRegionSpec) => void;
  applyRegions: (map: ShellChromeRegionMap) => void;
  resetRegions: () => void;
  applyPageChrome: (spec: PageChromeSpec) => void;
  setSlot: (key: ShellRegionKey, slot: ChromeSlotKind | null) => void;
  ensureBottomSlot: (slot: ChromeSlotKind) => void;
} {
  return {
    state: readonly(state) as Readonly<ShellChromeState>,
    setRegion,
    applyRegions,
    resetRegions,
    applyPageChrome,
    setSlot,
    ensureBottomSlot,
  };
}
