import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";

interface UseAutoLoadSentinelOptions {
  enabled?: () => boolean;
  rootMargin?: string;
  threshold?: number;
  cooldownMs?: number;
}

export function useAutoLoadSentinel(
  targetRef: Ref<HTMLElement | null>,
  onIntersect: () => void,
  options: UseAutoLoadSentinelOptions = {},
) {
  let observer: IntersectionObserver | null = null;
  let observedTarget: HTMLElement | null = null;
  let observerGeneration = 0;
  let stopWatchingTarget: (() => void) | null = null;
  let stopWatchingEnabled: (() => void) | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  let cooldownTimerGeneration = 0;
  let cooldownUntil = 0;
  let isIntersecting = false;
  let triggeredForCurrentIntersection = false;
  let disposed = false;

  function clearCooldownTimer() {
    cooldownTimerGeneration += 1;
    if (cooldownTimer === null) return;
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }

  function resetResidency() {
    clearCooldownTimer();
    isIntersecting = false;
    triggeredForCurrentIntersection = false;
  }

  function disconnectObserver() {
    observerGeneration += 1;
    observer?.disconnect();
    observer = null;
    observedTarget = null;
    resetResidency();
  }

  function disconnect() {
    if (disposed) return;
    disposed = true;
    disconnectObserver();
    stopWatchingTarget?.();
    stopWatchingTarget = null;
    stopWatchingEnabled?.();
    stopWatchingEnabled = null;
  }

  function canTrigger() {
    return options.enabled ? options.enabled() : true;
  }

  function scheduleCooldownReconciliation(delayMs: number) {
    if (cooldownTimer !== null) return;

    const generation = ++cooldownTimerGeneration;
    const timer = setTimeout(() => {
      if (disposed || generation !== cooldownTimerGeneration || cooldownTimer !== timer) {
        return;
      }
      cooldownTimer = null;
      reconcile();
    }, delayMs);
    cooldownTimer = timer;
  }

  function reconcile() {
    if (disposed || !isIntersecting || triggeredForCurrentIntersection || !canTrigger()) {
      clearCooldownTimer();
      return;
    }

    const now = Date.now();
    if (now < cooldownUntil) {
      scheduleCooldownReconciliation(cooldownUntil - now);
      return;
    }

    clearCooldownTimer();
    triggeredForCurrentIntersection = true;
    cooldownUntil = now + (options.cooldownMs ?? 900);
    onIntersect();
  }

  function updateIntersection(nextIsIntersecting: boolean) {
    if (!nextIsIntersecting) {
      resetResidency();
      return;
    }

    if (!isIntersecting) {
      isIntersecting = true;
      triggeredForCurrentIntersection = false;
    }
    reconcile();
  }

  function observeTarget(target: HTMLElement | null) {
    disconnectObserver();
    if (disposed) return;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const generation = observerGeneration;
    observedTarget = target;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (disposed || generation !== observerGeneration || observedTarget !== target) {
            return;
          }
          if (entry.target !== target) continue;
          updateIntersection(entry.isIntersecting);
        }
      },
      {
        root: null,
        rootMargin: options.rootMargin ?? "720px 0px 720px 0px",
        threshold: options.threshold ?? 0.01,
      },
    );

    observer.observe(target);
  }

  onMounted(() => {
    if (disposed) return;
    stopWatchingTarget = watch(
      targetRef,
      (target) => {
        observeTarget(target);
      },
      { immediate: true },
    );
    stopWatchingEnabled = watch(canTrigger, (enabled) => {
      if (disposed) return;
      if (!enabled) {
        clearCooldownTimer();
        return;
      }
      reconcile();
    });
  });

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    disconnect,
  };
}
