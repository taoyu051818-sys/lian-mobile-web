import { computed, ref } from "vue";

export type FloatingChromePhase = "visible" | "exiting" | "hidden" | "entering" | "progress";

export type FloatingChromeCommand = boolean | {
  hidden?: boolean;
  progress?: number;
  phase?: FloatingChromePhase;
  reason?: string;
  bump?: boolean;
};

export function normalizeChromeProgress(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, numberValue));
}

export function useFloatingChromeController(options: {
  initialPhase?: FloatingChromePhase;
  phaseMs?: number;
} = {}) {
  const phaseState = ref<FloatingChromePhase>(options.initialPhase ?? "visible");
  const progress = ref(
    phaseState.value === "hidden" || phaseState.value === "exiting" ? 0 : 1,
  );

  function setVisible() {
    phaseState.value = "visible";
    progress.value = 1;
  }

  function setHidden() {
    phaseState.value = "hidden";
    progress.value = 0;
  }

  function activate() {
    setVisible();
  }

  function deactivate() {
    setHidden();
  }

  function show() {
    setVisible();
  }

  function hide() {
    setHidden();
  }

  function transitionTo(nextPhase: FloatingChromePhase) {
    if (nextPhase === "hidden" || nextPhase === "exiting") {
      setHidden();
      return;
    }

    if (nextPhase === "progress") {
      phaseState.value = "progress";
      return;
    }

    setVisible();
  }

  function setProgress(value: unknown) {
    phaseState.value = "progress";
    progress.value = normalizeChromeProgress(value);
  }

  function apply(command: FloatingChromeCommand) {
    if (typeof command === "boolean") {
      command ? setHidden() : setVisible();
      return;
    }

    if (command.phase === "progress") {
      setProgress(command.progress);
      return;
    }

    if (command.phase === "hidden" || command.phase === "exiting" || command.hidden) {
      setHidden();
      return;
    }

    setVisible();
  }

  const phase = computed(() => phaseState.value);

  const style = computed(() => {
    const isHidden = phaseState.value === "hidden" || phaseState.value === "exiting";
    const visibilityProgress = isHidden ? 0 : 1;

    return {
      "--floating-chrome-visibility-progress": String(visibilityProgress),
      "--bottom-chrome-visibility-progress": String(visibilityProgress),
      "--floating-chrome-drag-progress": String(progress.value),
      "--floating-chrome-progress-y": "0px",
    };
  });

  function settle(nextPhase: FloatingChromePhase) {
    transitionTo(nextPhase);
  }

  function dispose() {
    // No timers, frames, or listeners.
  }

  return {
    phase,
    progress,
    style,
    apply,
    transitionTo,
    show,
    hide,
    activate,
    deactivate,
    setProgress,
    settle,
    dispose,
  };
}
