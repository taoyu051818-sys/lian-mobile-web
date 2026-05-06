import { computed, ref } from "vue";

export type FloatingChromePhase = "visible" | "exiting" | "hidden" | "entering" | "progress";

export type FloatingChromeCommand = boolean | {
  hidden?: boolean;
  progress?: number;
  phase?: FloatingChromePhase;
  reason?: string;
};

const DEFAULT_FLOATING_CHROME_PHASE_MS = 260;

export function normalizeChromeProgress(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, numberValue));
}

export function useFloatingChromeController(options: {
  initialPhase?: FloatingChromePhase;
  phaseMs?: number;
} = {}) {
  const phaseMs = options.phaseMs ?? DEFAULT_FLOATING_CHROME_PHASE_MS;
  const phaseState = ref<FloatingChromePhase>(options.initialPhase ?? "visible");
  const progress = ref(
    phaseState.value === "hidden" || phaseState.value === "exiting" ? 0 : 1,
  );

  let phaseTimer: number | undefined;

  function clearTimer() {
    if (phaseTimer == null) return;
    window.clearTimeout(phaseTimer);
    phaseTimer = undefined;
  }

  function settle(nextPhase: FloatingChromePhase) {
    clearTimer();
    phaseState.value = nextPhase;
    progress.value = nextPhase === "hidden" || nextPhase === "exiting" ? 0 : 1;
  }

  function transitionTo(nextPhase: FloatingChromePhase) {
    clearTimer();

    if (nextPhase === "progress") {
      phaseState.value = "progress";
      return;
    }

    if (nextPhase === "hidden" || nextPhase === "exiting") {
      if (phaseState.value === "hidden") {
        settle("hidden");
        return;
      }

      phaseState.value = "exiting";
      progress.value = 0;
      phaseTimer = window.setTimeout(() => settle("hidden"), phaseMs);
      return;
    }

    if (nextPhase === "visible" || nextPhase === "entering") {
      if (phaseState.value === "visible") {
        settle("visible");
        return;
      }

      phaseState.value = "entering";
      progress.value = 1;
      phaseTimer = window.setTimeout(() => settle("visible"), phaseMs);
    }
  }

  function show() {
    transitionTo("visible");
  }

  function hide() {
    transitionTo("hidden");
  }

  function setProgress(value: unknown) {
    clearTimer();
    phaseState.value = "progress";
    progress.value = normalizeChromeProgress(value);
  }

  function apply(command: FloatingChromeCommand) {
    if (typeof command === "boolean") {
      command ? hide() : show();
      return;
    }

    if (command.phase && command.phase !== "progress") {
      transitionTo(command.phase);
      return;
    }

    if (command.phase === "progress") {
      setProgress(command.progress);
      return;
    }

    const hidden = Boolean(command.hidden);
    const progressValue = normalizeChromeProgress(command.progress);

    if (hidden && progressValue > 0 && progressValue < 1) {
      setProgress(progressValue);
      return;
    }

    hidden ? hide() : show();
  }

  const phase = computed(() => phaseState.value);

  const style = computed(() => {
    const visibilityProgress = phaseState.value === "progress"
      ? progress.value
      : phaseState.value === "hidden" || phaseState.value === "exiting"
        ? 0
        : 1;

    return {
      "--floating-chrome-visibility-progress": String(visibilityProgress),
      "--bottom-chrome-visibility-progress": String(visibilityProgress),
    };
  });

  function dispose() {
    clearTimer();
  }

  return {
    phase,
    progress,
    style,
    apply,
    transitionTo,
    show,
    hide,
    setProgress,
    settle,
    dispose,
  };
}
