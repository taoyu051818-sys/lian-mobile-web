import { computed, reactive } from "vue";

export type ChromePhase = "idle" | "opening" | "open" | "dragging" | "returning";

const state = reactive({ detailPhase: "idle" as ChromePhase });

const shellVisible = computed(() => state.detailPhase === "idle");

const detailTopChromeOpacity = computed(() => (state.detailPhase === "returning" ? 0 : 1));

const detailBottomChromeOpacity = computed(() => (state.detailPhase === "returning" ? 0 : 1));

const detailPointerEvents = computed(() => (state.detailPhase === "returning" ? "none" : "auto"));

function setDetailPhase(phase: ChromePhase) {
  state.detailPhase = phase;
}

export function useFloatingChromeState() {
  return {
    detailPhase: computed(() => state.detailPhase),
    shellVisible,
    detailTopChromeOpacity,
    detailBottomChromeOpacity,
    detailPointerEvents,
    setDetailPhase,
  };
}
