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
  let stopWatchingTarget: (() => void) | null = null;
  let lastTriggeredAt = 0;

  function disconnect() {
    observer?.disconnect();
    observer = null;
  }

  function canTrigger() {
    return options.enabled ? options.enabled() : true;
  }

  function trigger() {
    if (!canTrigger()) return;
    const cooldownMs = options.cooldownMs ?? 900;
    const now = Date.now();
    if (now - lastTriggeredAt < cooldownMs) return;
    lastTriggeredAt = now;
    onIntersect();
  }

  function observeTarget(target: HTMLElement | null) {
    disconnect();
    if (!target || typeof IntersectionObserver === "undefined") return;

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        trigger();
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
    stopWatchingTarget = watch(
      targetRef,
      (target) => {
        observeTarget(target);
      },
      { immediate: true },
    );
  });

  onBeforeUnmount(() => {
    stopWatchingTarget?.();
    stopWatchingTarget = null;
    disconnect();
  });

  return {
    disconnect,
  };
}
