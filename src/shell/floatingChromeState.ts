import { computed, reactive } from "vue";

export type ChromePhase = "idle" | "opening" | "open" | "dragging" | "returning";

const state = reactive({ detailPhase: "idle" as ChromePhase });

const shellVisible = computed(() => state.detailPhase === "idle");

function setDetailPhase(phase: ChromePhase) {
  state.detailPhase = phase;
}

export function useFloatingChromeState() {
  return {
    detailPhase: computed(() => state.detailPhase),
    shellVisible,
    setDetailPhase,
  };
}
