import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleHooks = vi.hoisted(() => ({
  mounted: [] as Array<() => void>,
  beforeUnmount: [] as Array<() => void>,
  watchStops: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (hook: () => void) => {
      lifecycleHooks.mounted.push(hook);
    },
    onBeforeUnmount: (hook: () => void) => {
      lifecycleHooks.beforeUnmount.push(hook);
    },
    watch: (...args: Parameters<typeof actual.watch>) => {
      const stop = actual.watch(...args);
      const ownedStop = vi.fn(stop);
      lifecycleHooks.watchStops.push(ownedStop);
      return ownedStop;
    },
  };
});

import { nextTick, ref, type Ref } from "vue";
import { useAutoLoadSentinel } from "../../src/composables/useAutoLoadSentinel";

const DEFAULT_COOLDOWN_MS = 900;
const originalIntersectionObserver = globalThis.IntersectionObserver;

class ObserverDouble {
  static instances: ObserverDouble[] = [];

  readonly observed: Element[] = [];
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    ObserverDouble.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  emit(states: boolean[], target: Element = this.observed[0]): void {
    const entries = states.map(
      (isIntersecting) =>
        ({
          isIntersecting,
          target,
          intersectionRatio: isIntersecting ? 1 : 0,
        }) as IntersectionObserverEntry,
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function installIntersectionObserver(): void {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: ObserverDouble,
  });
}

function removeIntersectionObserver(): void {
  Reflect.deleteProperty(globalThis, "IntersectionObserver");
}

function element(id: string): HTMLElement {
  return { id } as HTMLElement;
}

interface HarnessOptions {
  enabled?: boolean;
  autoMount?: boolean;
  target?: HTMLElement | null;
  onIntersect?: () => void;
  rootMargin?: string;
  threshold?: number;
  cooldownMs?: number;
}

interface SentinelHarness {
  targetRef: Ref<HTMLElement | null>;
  enabled: Ref<boolean>;
  onIntersect: ReturnType<typeof vi.fn>;
  api: ReturnType<typeof useAutoLoadSentinel>;
  mount: () => void;
  unmount: () => void;
}

function createHarness(options: HarnessOptions = {}): SentinelHarness {
  const mountIndex = lifecycleHooks.mounted.length;
  const unmountIndex = lifecycleHooks.beforeUnmount.length;
  const targetRef = ref<HTMLElement | null>(options.target ?? element("sentinel"));
  const enabled = ref(options.enabled ?? true);
  const onIntersect = vi.fn(options.onIntersect ?? (() => undefined));
  const api = useAutoLoadSentinel(targetRef, onIntersect, {
    enabled: () => enabled.value,
    rootMargin: options.rootMargin,
    threshold: options.threshold,
    cooldownMs: options.cooldownMs,
  });
  const mount = lifecycleHooks.mounted[mountIndex];
  const unmount = lifecycleHooks.beforeUnmount[unmountIndex];

  expect(mount).toBeTypeOf("function");
  expect(unmount).toBeTypeOf("function");
  if (options.autoMount !== false) mount();

  return { targetRef, enabled, onIntersect, api, mount, unmount };
}

function latestObserver(): ObserverDouble {
  const observer = ObserverDouble.instances.at(-1);
  expect(observer).toBeDefined();
  return observer as ObserverDouble;
}

beforeEach(() => {
  lifecycleHooks.mounted.length = 0;
  lifecycleHooks.beforeUnmount.length = 0;
  lifecycleHooks.watchStops.length = 0;
  ObserverDouble.instances.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  installIntersectionObserver();
});

afterEach(async () => {
  for (const unmount of [...lifecycleHooks.beforeUnmount].reverse()) unmount();
  await nextTick();
  vi.clearAllTimers();
  vi.useRealTimers();
  if (originalIntersectionObserver === undefined) removeIntersectionObserver();
  else {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
  }
});

describe("useAutoLoadSentinel residency recovery", () => {
  it("#1 consumes one eligible residency and never level-retriggers it", async () => {
    const harness = createHarness();
    const observer = latestObserver();

    observer.emit([true]);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS * 2);
    observer.emit([true, true]);

    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#2 recovers a disabled first entry when enabled becomes true", async () => {
    const harness = createHarness({ enabled: false });
    const observer = latestObserver();

    observer.emit([true]);
    expect(harness.onIntersect).not.toHaveBeenCalled();

    harness.enabled.value = true;
    await nextTick();

    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#3 does not chain another page from enabled recovery after success", async () => {
    const harness = createHarness();
    const observer = latestObserver();
    observer.emit([true]);

    harness.enabled.value = false;
    await nextTick();
    harness.enabled.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS * 2);

    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#4 reconciles a genuine cooldown-blocked re-entry at its deadline", async () => {
    const harness = createHarness();
    const observer = latestObserver();
    observer.emit([true]);
    observer.emit([false]);

    await vi.advanceTimersByTimeAsync(400);
    observer.emit([true]);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(499);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#5 cancels on disable and reconciles once on later re-enable", async () => {
    const harness = createHarness();
    const observer = latestObserver();
    observer.emit([true]);
    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);
    expect(vi.getTimerCount()).toBe(1);

    harness.enabled.value = false;
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    harness.enabled.value = true;
    await nextTick();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(699);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);

    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);
    harness.enabled.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS);
    harness.enabled.value = true;
    await nextTick();

    expect(harness.onIntersect).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#6 cancels pending recovery on exit and target removal", async () => {
    const harness = createHarness();
    let observer = latestObserver();
    observer.emit([true]);
    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);
    expect(vi.getTimerCount()).toBe(1);

    observer.emit([false]);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);

    observer.emit([true]);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);
    expect(vi.getTimerCount()).toBe(1);

    harness.targetRef.value = null;
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    harness.targetRef.value = element("replacement");
    await nextTick();
    observer = latestObserver();
    observer.emit([true]);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(699);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.onIntersect).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#7 owns one timer across repeated cooldown-blocked callbacks", async () => {
    const harness = createHarness();
    const observer = latestObserver();
    observer.emit([true]);
    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);

    observer.emit([true]);
    observer.emit([true, true]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(800);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#8 isolates replacement targets from old observers and timers", async () => {
    const harness = createHarness();
    const oldObserver = latestObserver();
    oldObserver.emit([true]);
    oldObserver.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    oldObserver.emit([true]);

    harness.targetRef.value = element("replacement");
    await nextTick();
    const newObserver = latestObserver();
    expect(newObserver).not.toBe(oldObserver);
    expect(oldObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    newObserver.emit([true]);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      oldObserver.emit([false, true]);
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(harness.onIntersect).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    }

    await vi.advanceTimersByTimeAsync(200);
    newObserver.emit([true, true]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(599);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);

    oldObserver.emit([true]);
    expect(harness.onIntersect).toHaveBeenCalledTimes(2);
  });

  it("#9 makes explicit disconnect and unmount idempotent and terminal", async () => {
    const harness = createHarness();
    const ownedWatchStops = [...lifecycleHooks.watchStops];
    expect(ownedWatchStops).toHaveLength(2);
    const observer = latestObserver();
    observer.emit([true]);
    observer.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);

    harness.api.disconnect();
    expect(vi.getTimerCount()).toBe(0);
    harness.api.disconnect();
    harness.targetRef.value = element("must-not-revive");
    harness.enabled.value = false;
    await nextTick();
    harness.enabled.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS);
    observer.emit([true]);

    expect(ObserverDouble.instances).toHaveLength(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    for (const stop of ownedWatchStops) expect(stop).toHaveBeenCalledTimes(1);
    harness.unmount();
    harness.unmount();
    for (const stop of ownedWatchStops) expect(stop).toHaveBeenCalledTimes(1);

    const watchersBeforeUnmountOnly = lifecycleHooks.watchStops.length;
    const unmountOnly = createHarness();
    const unmountOnlyStops = lifecycleHooks.watchStops.slice(watchersBeforeUnmountOnly);
    expect(unmountOnlyStops).toHaveLength(2);
    const unmountOnlyObserver = latestObserver();
    unmountOnlyObserver.emit([true]);
    unmountOnlyObserver.emit([false]);
    await vi.advanceTimersByTimeAsync(100);
    unmountOnlyObserver.emit([true]);
    expect(vi.getTimerCount()).toBe(1);

    unmountOnly.unmount();
    expect(vi.getTimerCount()).toBe(0);
    unmountOnly.unmount();
    expect(unmountOnlyObserver.disconnect).toHaveBeenCalledTimes(1);
    for (const stop of unmountOnlyStops) expect(stop).toHaveBeenCalledTimes(1);
    const observersAfterUnmount = ObserverDouble.instances.length;
    unmountOnly.targetRef.value = element("unmounted-must-not-revive");
    unmountOnly.enabled.value = false;
    await nextTick();
    unmountOnly.enabled.value = true;
    await nextTick();
    unmountOnlyObserver.emit([true]);
    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS);
    expect(unmountOnly.onIntersect).toHaveBeenCalledTimes(1);
    expect(ObserverDouble.instances).toHaveLength(observersAfterUnmount);
    expect(vi.getTimerCount()).toBe(0);

    const beforePreMount = ObserverDouble.instances.length;
    const watchersBeforePreMount = lifecycleHooks.watchStops.length;
    const preMount = createHarness({ autoMount: false });
    preMount.api.disconnect();
    expect(lifecycleHooks.watchStops).toHaveLength(watchersBeforePreMount);
    preMount.mount();
    expect(ObserverDouble.instances).toHaveLength(beforePreMount);
    expect(lifecycleHooks.watchStops).toHaveLength(watchersBeforePreMount);
  });

  it("#10 is mount-gated, IO-optional, and preserves observer options", () => {
    const setupOnly = createHarness({ autoMount: false });
    expect(ObserverDouble.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    setupOnly.api.disconnect();

    removeIntersectionObserver();
    const unavailable = createHarness();
    expect(ObserverDouble.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    unavailable.unmount();

    installIntersectionObserver();
    const defaults = createHarness();
    expect(latestObserver().options).toEqual({
      root: null,
      rootMargin: "720px 0px 720px 0px",
      threshold: 0.01,
    });
    defaults.unmount();

    const custom = createHarness({
      rootMargin: "24px 0px",
      threshold: 0.5,
      cooldownMs: 0,
    });
    const customObserver = latestObserver();
    expect(customObserver.options).toEqual({
      root: null,
      rootMargin: "24px 0px",
      threshold: 0.5,
    });
    customObserver.emit([true]);
    expect(custom.onIntersect).toHaveBeenCalledTimes(1);
    customObserver.emit([false]);
    customObserver.emit([true]);
    expect(custom.onIntersect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("#11 processes entry batches in order and terminally invalidates old callbacks", async () => {
    const duplicateTrue = createHarness();
    latestObserver().emit([true, true]);
    expect(duplicateTrue.onIntersect).toHaveBeenCalledTimes(1);
    duplicateTrue.unmount();

    const endingOutside = createHarness();
    let observer = latestObserver();
    observer.emit([true, false]);
    await vi.advanceTimersByTimeAsync(100);
    observer.emit([true]);
    expect(endingOutside.onIntersect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(799);
    expect(endingOutside.onIntersect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(endingOutside.onIntersect).toHaveBeenCalledTimes(2);
    endingOutside.unmount();

    const endingInside = createHarness();
    observer = latestObserver();
    observer.emit([false, true]);
    expect(endingInside.onIntersect).toHaveBeenCalledTimes(1);
    endingInside.unmount();

    let disconnect: () => void = () => undefined;
    const terminalCallback = vi.fn(() => disconnect());
    const terminal = createHarness({ onIntersect: terminalCallback });
    disconnect = terminal.api.disconnect;
    observer = latestObserver();
    observer.emit([true, false, true]);
    expect(terminalCallback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DEFAULT_COOLDOWN_MS);
    observer.emit([true]);
    expect(terminalCallback).toHaveBeenCalledTimes(1);
  });
});
