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

/**
 * Per-region slot stack. The top of each stack is what ShellChrome renders.
 * `setRegion({ slot })` writes the stack base (used by AppShell to install
 * the bottom-tabs default once at startup); `pushSlot` layers on top with a
 * release handle so subordinate components (detail panel, sheets) can claim
 * a slot during their lifetime without knowing what was underneath. This
 * removes the old hardcoded `state.bottom.slot = "tabs"` reset that papered
 * over leaks when a child unmount path forgot to restore the slot itself.
 */
const slotStacks: Record<ShellRegionKey, (ChromeSlotKind | null)[]> = {
  top: [],
  bottom: [],
};

function syncSlot(key: ShellRegionKey) {
  const stack = slotStacks[key];
  state[key].slot = stack.length ? stack[stack.length - 1] : null;
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
    slotStacks[key].push(slot);
  } else {
    slotStacks[key][0] = slot;
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
  // Slots are owned by the push/pop stack, not the merge state — leave them
  // alone so AppShell's bottom-tabs base survives a reset and component-pushed
  // slots (e.g. detail-topbar) don't get yanked out from under their owner.
  syncSlot("top");
  syncSlot("bottom");
}

function applyPageChrome(spec: PageChromeSpec) {
  const defaults = createDefaultChromeState();
  mergeRegion(state.top, defaults.top);
  mergeRegion(state.bottom, defaults.bottom);
  if (spec.top) setRegion("top", spec.top);
  if (spec.bottom) setRegion("bottom", spec.bottom);
  // Slots are owned by components via `pushSlot` and aren't reset here —
  // pages should not stomp a child component's active slot.
}

/**
 * Claim a region's slot for the lifetime of the caller. Returns a release
 * function that pops THIS specific entry — releasing in any order is safe
 * because the stack tracks identity, not position.
 */
function pushSlot(key: ShellRegionKey, slot: ChromeSlotKind): () => void {
  slotStacks[key].push(slot);
  syncSlot(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const stack = slotStacks[key];
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === slot) {
        stack.splice(i, 1);
        break;
      }
    }
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
