import { computed, ref } from "vue";

/**
 * Floating chrome phase model.
 *
 * Phases drive the shell chrome transition lifecycle:
 *
 *   visible → exiting → [swap content/spec] → entering → visible
 *
 * - `visible` -- chrome fully shown, no transition active.
 * - `exiting` -- chrome is animating out (opacity → 0). Duration controlled
 *   by the CSS custom property `--floating-chrome-motion-duration` or the
 *   `transitionDuration` option. Pointer events are disabled.
 * - `hidden` -- chrome fully hidden, no transition active.
 * - `entering` -- chrome is animating in (opacity → 1) after a content/spec
 *   swap. Pointer events are disabled during this phase.
 * - `progress` -- continuous gesture-driven interpolation (e.g., drag).
 *   Uses `--bottom-chrome-visibility-progress` with `transition: none`.
 *
 * Reduced-motion mode preserves the full phase sequence (visible → exiting →
 * swap → entering → visible) but uses zero-duration transitions so no
 * movement or blur is perceptible.
 */
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

  let pendingTimer: ReturnType<typeof setTimeout> | undefined;

  // Guard against double-dispose
  let disposed = false;

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

  /**
   * Drive the exit-swap-enter transition lifecycle.
   *
   * Sequence: visible → exiting → [callback fires] → entering → visible
   *
   * The callback receives no arguments and fires after the exiting phase
   * completes. The caller is responsible for swapping chrome specs or
   * content during this callback.
   *
   * If the controller is already in an exiting/entering transition, the
   * call is a no-op and returns `false`. Returns `true` when the
   * transition starts.
   *
   * Top and bottom regions may transition independently: each controller
   * instance owns its own lifecycle. When both regions must transition
   * together, the caller should invoke `transitionSpec` on both
   * controllers in the same tick.
   *
   * Reduced-motion mode preserves the full phase sequence but uses
   * zero-duration transitions, so no movement or blur is perceptible.
   */
  function transitionSpec(
    nextSpec: Record<string, unknown>,
    onSwap?: () => void,
  ): boolean {
    if (disposed) return false;

    // No-op if already transitioning or in progress gesture
    if (
      phaseState.value === "exiting"
      || phaseState.value === "entering"
      || phaseState.value === "progress"
    ) {
      return false;
    }

    cancelPendingTimer();

    // Phase 1: exiting
    phaseState.value = "exiting";
    progress.value = 0;

    const duration = options.phaseMs ?? 220;

    pendingTimer = setTimeout(() => {
      if (disposed) return;

      // Swap phase: caller updates specs/content
      onSwap?.();
      Object.assign(pendingSpec, nextSpec);

      // Phase 3: entering
      phaseState.value = "entering";
      progress.value = 1;

      pendingTimer = setTimeout(() => {
        if (disposed) return;

        // Phase 4: visible
        setVisible();
        pendingTimer = undefined;
      }, duration);
    }, duration);

    return true;
  }

  // Internal spec buffer for transitionSpec swaps
  const pendingSpec: Record<string, unknown> = {};

  function cancelPendingTimer() {
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      pendingTimer = undefined;
    }
  }

  function dispose() {
    disposed = true;
    cancelPendingTimer();
  }

  return {
    phase,
    progress,
    style,
    apply,
    transitionTo,
    transitionSpec,
    show,
    hide,
    activate,
    deactivate,
    setProgress,
    settle,
    dispose,
  };
}
