import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";
import { normalizeFeedItem } from "../../src/api/feed";
import { useCardPointerInteraction } from "../../src/features/feed/useCardPointerInteraction";
import { ERROR_SAVE_ACTION, SHARE_LINK_COPIED } from "../../src/config/brand";
import type { FeedItem, FeedItemId } from "../../src/types/feed";

const lifecycle = vi.hoisted(() => ({
  beforeUnmount: [] as Array<() => void>,
  scopeDispose: [] as Array<() => void>,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onBeforeUnmount: (callback: () => void) => {
      lifecycle.beforeUnmount.push(callback);
    },
    onScopeDispose: (callback: () => void) => {
      lifecycle.scopeDispose.push(callback);
    },
  };
});

type Bounds = Readonly<{
  top: number;
  left: number;
  width: number;
  height: number;
}>;

interface ContextMenuRequest {
  x: number;
  y: number;
  target: HTMLElement | null;
  ownerToken: unknown;
}

interface PointerInteraction {
  handlePointerDown(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handlePointerCancel(event: PointerEvent): void;
  handleContextMenu(event: MouseEvent): void;
  openCard(event?: MouseEvent): void;
  openCardFromKeyboard(event: KeyboardEvent): void;
}

type UsePointerInteraction = (
  emitOpen: (target: HTMLElement | null) => void,
  contextMenu?: {
    ownerToken?: () => unknown;
    openContextMenu?: (request: ContextMenuRequest) => void;
  },
) => PointerInteraction;

const usePointerInteraction = useCardPointerInteraction as unknown as UsePointerInteraction;

interface TestRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

class TestElement {
  readonly tagName: string;
  readonly parentElement: TestElement | null;
  readonly cardControl: boolean;
  readonly children: TestElement[] = [];

  constructor(tagName = "div", parentElement: TestElement | null = null, cardControl = false) {
    this.tagName = tagName.toLowerCase();
    this.parentElement = parentElement;
    this.cardControl = cardControl;
  }

  closest(selector: string): TestElement | null {
    const selectors = selector
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const matches = (element: TestElement): boolean =>
      selectors.includes(element.tagName) ||
      (selectors.includes("[data-card-control]") && element.cardControl);
    if (matches(this)) return this;

    let current = this.parentElement;
    while (current) {
      if (matches(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  getAttributeNames(): string[] {
    return [];
  }

  getAttribute(_name: string): string | null {
    return null;
  }
}

class TestHTMLElement extends TestElement {
  private rect: TestRect;

  constructor(
    tagName = "article",
    parentElement: TestElement | null = null,
    cardControl = false,
    rect: TestRect = { top: 10, left: 20, width: 180, height: 120 },
  ) {
    super(tagName, parentElement, cardControl);
    this.rect = { ...rect };
  }

  setRect(rect: TestRect): void {
    this.rect = { ...rect };
  }

  getBoundingClientRect(): DOMRect {
    return {
      ...this.rect,
      right: this.rect.left + this.rect.width,
      bottom: this.rect.top + this.rect.height,
      x: this.rect.left,
      y: this.rect.top,
      toJSON: () => ({ ...this.rect }),
    } as DOMRect;
  }
}

class TestSVGElement extends TestElement {}

function installDomGlobals(): void {
  vi.stubGlobal("Element", TestElement);
  vi.stubGlobal("HTMLElement", TestHTMLElement);
  vi.stubGlobal("SVGElement", TestSVGElement);
  vi.stubGlobal("window", {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  });
}

function pointerEvent(
  target: TestElement,
  currentTarget: TestHTMLElement,
  overrides: Partial<{
    pointerId: number;
    pointerType: string;
    button: number;
    isPrimary: boolean;
    clientX: number;
    clientY: number;
  }> = {},
): PointerEvent {
  return {
    pointerId: overrides.pointerId ?? 1,
    pointerType: overrides.pointerType ?? "touch",
    button: overrides.button ?? 0,
    isPrimary: overrides.isPrimary ?? true,
    clientX: overrides.clientX ?? 40,
    clientY: overrides.clientY ?? 60,
    target,
    currentTarget,
  } as unknown as PointerEvent;
}

function mouseEvent(
  target: TestElement,
  currentTarget: TestHTMLElement,
  overrides: Partial<{ clientX: number; clientY: number }> = {},
): MouseEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  return {
    clientX: overrides.clientX ?? 40,
    clientY: overrides.clientY ?? 60,
    target,
    currentTarget,
    preventDefault: vi.fn(),
  } as unknown as MouseEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

function keyboardEvent(target: TestElement, currentTarget: TestHTMLElement): KeyboardEvent {
  return { target, currentTarget, key: "Enter" } as unknown as KeyboardEvent;
}

function runBeforeUnmount(): void {
  for (const callback of lifecycle.beforeUnmount.splice(0).reverse()) callback();
}

function runScopeDispose(): void {
  for (const callback of lifecycle.scopeDispose.splice(0).reverse()) callback();
}

beforeEach(() => {
  lifecycle.beforeUnmount.length = 0;
  lifecycle.scopeDispose.length = 0;
  vi.useFakeTimers();
  installDomGlobals();
});

afterEach(() => {
  runBeforeUnmount();
  runScopeDispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCardPointerInteraction context ownership", () => {
  it.each(["touch", "pen"])(
    "#1 opens a primary %s hold exactly at 360 ms from captured pointer data",
    (pointerType) => {
      const owner = ref<object>({ id: "A" });
      const card = new TestHTMLElement();
      const leaf = new TestHTMLElement("span", card);
      const openCard = vi.fn();
      const openMenu = vi.fn();
      const interaction = usePointerInteraction(openCard, {
        ownerToken: () => owner.value,
        openContextMenu: openMenu,
      });

      const pointer = pointerEvent(leaf, card, {
        pointerId: 7,
        pointerType,
        clientX: 33,
        clientY: 44,
      });
      interaction.handlePointerDown(pointer);
      Object.assign(pointer, { currentTarget: null, clientX: 999, clientY: 999 });
      vi.advanceTimersByTime(359);
      expect(openMenu).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(openMenu).toHaveBeenCalledTimes(1);
      expect(openMenu).toHaveBeenCalledWith({
        x: 33,
        y: 44,
        target: card,
        ownerToken: owner.value,
      });

      interaction.openCard(mouseEvent(leaf, card));
      expect(openCard).not.toHaveBeenCalled();
    },
  );

  it("#1 rejects non-primary pointers without arming a timer or opening a surface", () => {
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => card,
      openContextMenu: openMenu,
    });

    interaction.handlePointerDown(pointerEvent(card, card, { isPrimary: false }));
    interaction.handlePointerDown(pointerEvent(card, card, { pointerType: "mouse", button: 1 }));

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(openMenu).not.toHaveBeenCalled();
    expect(openCard).not.toHaveBeenCalled();
  });

  it("#2 preserves short tap while movement and cancel suppress their trailing click", () => {
    const card = new TestHTMLElement();

    const shortOpen = vi.fn();
    const short = usePointerInteraction(shortOpen, {
      ownerToken: () => card,
      openContextMenu: vi.fn(),
    });
    short.handlePointerDown(pointerEvent(card, card, { pointerId: 1 }));
    vi.advanceTimersByTime(100);
    short.handlePointerUp(pointerEvent(card, card, { pointerId: 1 }));
    short.openCard(mouseEvent(card, card));
    expect(shortOpen).toHaveBeenCalledTimes(1);

    const movedOpen = vi.fn();
    const movedMenu = vi.fn();
    const moved = usePointerInteraction(movedOpen, {
      ownerToken: () => card,
      openContextMenu: movedMenu,
    });
    moved.handlePointerDown(pointerEvent(card, card, { pointerId: 2, clientX: 10, clientY: 10 }));
    moved.handlePointerMove(pointerEvent(card, card, { pointerId: 2, clientX: 19, clientY: 10 }));
    expect(vi.getTimerCount()).toBe(0);
    moved.openCard(mouseEvent(card, card));
    expect(movedOpen).not.toHaveBeenCalled();
    expect(movedMenu).not.toHaveBeenCalled();

    const cancelledOpen = vi.fn();
    const cancelledMenu = vi.fn();
    const cancelled = usePointerInteraction(cancelledOpen, {
      ownerToken: () => card,
      openContextMenu: cancelledMenu,
    });
    cancelled.handlePointerDown(pointerEvent(card, card, { pointerId: 3 }));
    cancelled.handlePointerCancel(pointerEvent(card, card, { pointerId: 3 }));
    expect(vi.getTimerCount()).toBe(0);
    cancelled.openCard(mouseEvent(card, card));
    expect(cancelledOpen).not.toHaveBeenCalled();
    expect(cancelledMenu).not.toHaveBeenCalled();
  });

  it("#2 unmount clears the active timer and rejects its stale callback", () => {
    const card = new TestHTMLElement();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(vi.fn(), {
      ownerToken: () => card,
      openContextMenu: openMenu,
    });

    interaction.handlePointerDown(pointerEvent(card, card));
    expect(vi.getTimerCount()).toBe(1);
    runBeforeUnmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(openMenu).not.toHaveBeenCalled();
  });

  it("#2 keeps a released short click while rejecting its queued context menu", () => {
    const owner = ref<object>({ id: "A" });
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => owner.value,
      openContextMenu: openMenu,
    });
    const pointer = pointerEvent(card, card, { pointerId: 4 });

    interaction.handlePointerDown(pointer);
    vi.advanceTimersByTime(100);
    interaction.handlePointerUp(pointer);
    expect(vi.getTimerCount()).toBe(0);

    const queuedContext = mouseEvent(card, card);
    interaction.handleContextMenu(queuedContext);
    expect(queuedContext.preventDefault).toHaveBeenCalledTimes(1);
    expect(openMenu).not.toHaveBeenCalled();

    interaction.openCard(mouseEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(1);
  });

  it("#2 suppresses a released A click after its owner changes to B", () => {
    const owner = ref<object>({ id: "A" });
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => owner.value,
      openContextMenu: vi.fn(),
    });
    const pointer = pointerEvent(card, card, { pointerId: 5 });

    interaction.handlePointerDown(pointer);
    vi.advanceTimersByTime(100);
    interaction.handlePointerUp(pointer);
    owner.value = { id: "B" };
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).not.toHaveBeenCalled();
  });

  it.each(["move", "cancel", "longpress"] as const)(
    "#2 lets a fresh physical intent recover after %s without a trailing click",
    (ending) => {
      const card = new TestHTMLElement();
      const openCard = vi.fn();
      const openMenu = vi.fn();
      const interaction = usePointerInteraction(openCard, {
        ownerToken: () => card,
        openContextMenu: openMenu,
      });
      const firstPointer = pointerEvent(card, card, {
        pointerId: 6,
        clientX: 10,
        clientY: 10,
      });

      interaction.handlePointerDown(firstPointer);
      if (ending === "move") {
        interaction.handlePointerMove(
          pointerEvent(card, card, { pointerId: 6, clientX: 30, clientY: 30 }),
        );
      } else if (ending === "cancel") {
        interaction.handlePointerCancel(firstPointer);
      } else {
        vi.advanceTimersByTime(360);
        expect(openMenu).toHaveBeenCalledTimes(1);
      }

      const nextPointer = pointerEvent(card, card, { pointerId: 7 });
      interaction.handlePointerDown(nextPointer);
      vi.advanceTimersByTime(20);
      interaction.handlePointerUp(nextPointer);
      interaction.openCard(mouseEvent(card, card));

      expect(openCard).toHaveBeenCalledTimes(1);
    },
  );

  it("#2 ignores move, up, and cancel events owned by another pointer", () => {
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => card,
      openContextMenu: openMenu,
    });

    interaction.handlePointerDown(
      pointerEvent(card, card, { pointerId: 7, clientX: 10, clientY: 10 }),
    );
    interaction.handlePointerMove(
      pointerEvent(card, card, { pointerId: 8, clientX: 100, clientY: 100 }),
    );
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 8 }));
    interaction.handlePointerCancel(pointerEvent(card, card, { pointerId: 8 }));
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(360);
    expect(openMenu).toHaveBeenCalledTimes(1);
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).not.toHaveBeenCalled();
  });

  it.each(["timer-context-up-click", "timer-up-context-click"] as const)(
    "#3 deduplicates browser order %s and suppresses its click",
    (order) => {
      const owner = { id: "A" };
      const card = new TestHTMLElement();
      const openCard = vi.fn();
      const openMenu = vi.fn();
      const interaction = usePointerInteraction(openCard, {
        ownerToken: () => owner,
        openContextMenu: openMenu,
      });
      const pointer = pointerEvent(card, card, { pointerId: 9 });
      const context = mouseEvent(card, card);

      interaction.handlePointerDown(pointer);
      vi.advanceTimersByTime(360);
      if (order === "timer-context-up-click") {
        interaction.handleContextMenu(context);
        interaction.handlePointerUp(pointer);
      } else {
        interaction.handlePointerUp(pointer);
        interaction.handleContextMenu(context);
      }
      interaction.openCard(mouseEvent(card, card));

      expect(openMenu).toHaveBeenCalledTimes(1);
      expect(context.preventDefault).toHaveBeenCalledTimes(1);
      expect(openCard).not.toHaveBeenCalled();

      const standalone = mouseEvent(card, card, { clientX: 81, clientY: 92 });
      interaction.handleContextMenu(standalone);
      expect(standalone.preventDefault).toHaveBeenCalledTimes(1);
      expect(openMenu).toHaveBeenCalledTimes(2);
      expect(openMenu).toHaveBeenLastCalledWith({
        x: 81,
        y: 92,
        target: card,
        ownerToken: owner,
      });

      interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 10 }));
      vi.advanceTimersByTime(20);
      interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 10 }));
      interaction.openCard(mouseEvent(card, card));
      expect(openCard).toHaveBeenCalledTimes(1);
    },
  );

  it("#3 accepts pointer up at exactly 360 ms before the timer callback runs", () => {
    const owner = { id: "A" };
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => owner,
      openContextMenu: openMenu,
    });
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(1_000).mockReturnValue(1_360);
    const pointer = pointerEvent(card, card, { pointerId: 9 });

    interaction.handlePointerDown(pointer);
    interaction.handlePointerUp(pointer);
    expect(vi.getTimerCount()).toBe(0);
    expect(openMenu).toHaveBeenCalledTimes(1);

    const context = mouseEvent(card, card);
    interaction.handleContextMenu(context);
    interaction.openCard(mouseEvent(card, card));
    expect(openMenu).toHaveBeenCalledTimes(1);
    expect(context.preventDefault).toHaveBeenCalledTimes(1);
    expect(openCard).not.toHaveBeenCalled();
  });

  it("#4 admits a standalone desktop context menu once without contaminating the next click", () => {
    const owner = { id: "A" };
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => owner,
      openContextMenu: openMenu,
    });
    const context = mouseEvent(card, card, { clientX: 71, clientY: 83 });

    interaction.handleContextMenu(context);
    expect(context.preventDefault).toHaveBeenCalledTimes(1);
    expect(openMenu).toHaveBeenCalledTimes(1);
    expect(openMenu).toHaveBeenCalledWith({
      x: 71,
      y: 83,
      target: card,
      ownerToken: owner,
    });

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 10 }));
    vi.advanceTimersByTime(20);
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 10 }));
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(1);
  });

  it("#4 rejects HTML controls, data controls, and SVG descendants without preventDefault", () => {
    const card = new TestHTMLElement();
    const targets: TestElement[] = [
      new TestHTMLElement("button", card),
      new TestHTMLElement("a", card),
      new TestHTMLElement("input", card),
      new TestHTMLElement("textarea", card),
      new TestHTMLElement("select", card),
      new TestHTMLElement("div", card, true),
    ];
    const button = new TestHTMLElement("button", card);
    targets.push(new TestSVGElement("path", button));

    for (const target of targets) {
      const openCard = vi.fn();
      const openMenu = vi.fn();
      const interaction = usePointerInteraction(openCard, {
        ownerToken: () => card,
        openContextMenu: openMenu,
      });
      const context = mouseEvent(target, card);

      interaction.handlePointerDown(pointerEvent(target, card));
      interaction.handleContextMenu(context);
      interaction.openCard(mouseEvent(target, card));

      expect(context.preventDefault, target.tagName).not.toHaveBeenCalled();
      expect(openMenu, target.tagName).not.toHaveBeenCalled();
      expect(openCard, target.tagName).not.toHaveBeenCalled();
      expect(vi.getTimerCount(), target.tagName).toBe(0);
    }
  });

  it("#5 synchronously cancels A ownership and suppresses the old click after replacement", () => {
    const owner = ref<object>({ id: "A" });
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(openCard, {
      ownerToken: () => owner.value,
      openContextMenu: openMenu,
    });

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 1 }));
    expect(vi.getTimerCount()).toBe(1);
    owner.value = { id: "B" };
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(openMenu).not.toHaveBeenCalled();

    const staleContext = mouseEvent(card, card);
    interaction.handleContextMenu(staleContext);
    expect(staleContext.preventDefault).toHaveBeenCalledTimes(1);
    expect(openMenu).not.toHaveBeenCalled();

    interaction.openCard(mouseEvent(card, card));
    expect(openCard).not.toHaveBeenCalled();

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 2 }));
    vi.advanceTimersByTime(50);
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 2 }));
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(1);
  });

  it("#5 rejects A context against a fresh B candidate without cancelling B's timer", () => {
    const owner = ref<object>({ id: "A" });
    const card = new TestHTMLElement();
    const openMenu = vi.fn();
    const interaction = usePointerInteraction(vi.fn(), {
      ownerToken: () => owner.value,
      openContextMenu: openMenu,
    });

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 1 }));
    owner.value = { id: "B" };
    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 2 }));
    vi.advanceTimersByTime(100);

    const staleContext = mouseEvent(card, card);
    interaction.handleContextMenu(staleContext);
    expect(staleContext.preventDefault).toHaveBeenCalledTimes(1);
    expect(openMenu).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(260);
    expect(openMenu).toHaveBeenCalledTimes(1);
    expect(openMenu).toHaveBeenLastCalledWith({
      x: 40,
      y: 60,
      target: card,
      ownerToken: owner.value,
    });
  });

  it("#6 preserves the one-argument Club interaction contract", () => {
    const card = new TestHTMLElement();
    const openCard = vi.fn();
    const interaction = usePointerInteraction(openCard);

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 1 }));
    vi.advanceTimersByTime(50);
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 1 }));
    interaction.openCard(mouseEvent(card, card));
    interaction.openCardFromKeyboard(keyboardEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(2);

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 2 }));
    vi.advanceTimersByTime(360);
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 2 }));
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(2);

    const context = mouseEvent(card, card);
    interaction.handleContextMenu(context);
    expect(context.preventDefault).toHaveBeenCalledTimes(1);

    interaction.handlePointerDown(pointerEvent(card, card, { pointerId: 3 }));
    vi.advanceTimersByTime(50);
    interaction.handlePointerUp(pointerEvent(card, card, { pointerId: 3 }));
    interaction.openCard(mouseEvent(card, card));
    expect(openCard).toHaveBeenCalledTimes(3);
  });
});

describe("Feed bookmark adapter compatibility", () => {
  it("#7 prefers explicit bookmarked over legacy saved and always emits a boolean", () => {
    expect(normalizeFeedItem({ tid: 1, bookmarked: true })?.bookmarked).toBe(true);
    expect(normalizeFeedItem({ tid: 2, saved: true })?.bookmarked).toBe(true);
    expect(normalizeFeedItem({ tid: 3, bookmarked: false, saved: true })?.bookmarked).toBe(false);
    expect(normalizeFeedItem({ tid: 4, bookmarked: true, saved: false })?.bookmarked).toBe(true);
    expect(normalizeFeedItem({ tid: 5, saved: false })?.bookmarked).toBe(false);
    expect(normalizeFeedItem({ tid: 6 })?.bookmarked).toBe(false);
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type ShareResult =
  | { outcome: "shared" }
  | { outcome: "copied" }
  | { outcome: "cancelled" }
  | { outcome: "use-wechat-menu"; message: string }
  | { outcome: "failed"; message: string };

interface ContextActionState {
  visible: Ref<boolean>;
  x: Ref<number>;
  y: Ref<number>;
  bookmarked: Ref<boolean>;
  bookmarkBusy: Ref<boolean>;
  shareBusy: Ref<boolean>;
  requestPending: Ref<boolean>;
  openMenu(request: ContextMenuRequest): boolean;
  closeMenu(): void;
  handleBookmark(): Promise<void>;
  handleShare(): Promise<void>;
  handleReport(): void;
  dispose(): void;
}

type SavePost = (tid: FeedItemId, saved: boolean) => Promise<{ saved: boolean }>;
type SharePost = (input: { tid: number; title: string }) => Promise<ShareResult>;

type UseContextActions = (options: {
  item: Readonly<Ref<FeedItem>>;
  title: () => string;
  emitOpen: (id: FeedItemId, payload?: { item: FeedItem; rect: Bounds }) => void;
  dependencies?: {
    savePost?: SavePost;
    share?: SharePost;
    toast?: {
      success(message: string): unknown;
      info(message: string): unknown;
      error(message: string): unknown;
    };
    haptic?: () => void;
  };
}) => ContextActionState;

async function requireContextActions(): Promise<UseContextActions> {
  const specifier = new URL(
    "../../src/features/feed/" + "useFeedCardContextActions.ts",
    import.meta.url,
  ).href;
  let loaded: { useFeedCardContextActions?: UseContextActions } | null = null;
  let loadError: unknown;
  try {
    loaded = (await import(/* @vite-ignore */ specifier)) as {
      useFeedCardContextActions?: UseContextActions;
    };
  } catch (error) {
    loadError = error;
  }
  expect(loadError, "useFeedCardContextActions runtime module must exist").toBeUndefined();
  expect(loaded?.useFeedCardContextActions).toBeTypeOf("function");
  return loaded!.useFeedCardContextActions!;
}

function makeFeedItem(
  tid: number,
  title: string,
  bookmarked = false,
  nestedLabel = `actor-${tid}`,
): FeedItem {
  return {
    tid,
    title,
    bodyPreview: `body-${tid}`,
    cover: "",
    primaryTag: "",
    actor: { id: `user-${tid}`, displayName: nestedLabel },
    timeLabel: "now",
    timestampISO: "2026-08-10T00:00:00.000Z",
    likeCount: 0,
    liked: false,
    bookmarked,
    locationArea: "campus",
    contentType: "text",
  } as FeedItem;
}

interface ActionHarness {
  item: Ref<FeedItem>;
  actions: ContextActionState;
  savePost: ReturnType<typeof vi.fn<SavePost>>;
  share: ReturnType<typeof vi.fn<SharePost>>;
  toast: {
    success: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  haptic: ReturnType<typeof vi.fn>;
  emitOpen: ReturnType<typeof vi.fn>;
}

async function makeActionHarness(
  options: {
    item?: FeedItem;
    savePost?: ReturnType<typeof vi.fn<SavePost>>;
    share?: ReturnType<typeof vi.fn<SharePost>>;
  } = {},
): Promise<ActionHarness> {
  const useContextActions = await requireContextActions();
  const item = ref(options.item ?? makeFeedItem(1, "Post A"));
  const savePost = options.savePost ?? vi.fn<SavePost>(async (_tid, saved) => ({ saved }));
  const share = options.share ?? vi.fn<SharePost>(async () => ({ outcome: "shared" }));
  const toast = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };
  const haptic = vi.fn();
  const emitOpen = vi.fn();
  const actions = useContextActions({
    item,
    title: () => item.value.title,
    emitOpen,
    dependencies: { savePost, share, toast, haptic },
  });
  return { item, actions, savePost, share, toast, haptic, emitOpen };
}

function openActions(
  harness: ActionHarness,
  target = new TestHTMLElement(),
  ownerToken: unknown = harness.item.value,
): boolean {
  return harness.actions.openMenu({
    x: 55,
    y: 66,
    target: target as unknown as HTMLElement,
    ownerToken,
  });
}

describe("useFeedCardContextActions ownership and outcomes", () => {
  it("#8 commits bookmark state only from authoritative success and remains single-flight", async () => {
    const first = deferred<{ saved: boolean }>();
    const second = deferred<{ saved: boolean }>();
    const savePost = vi
      .fn<SavePost>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const harness = await makeActionHarness({ savePost });

    expect(openActions(harness)).toBe(true);
    const firstRun = harness.actions.handleBookmark();
    const duplicate = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledTimes(1);
    expect(savePost).toHaveBeenLastCalledWith(1, true);
    expect(harness.actions.bookmarked.value).toBe(false);
    expect(harness.actions.bookmarkBusy.value).toBe(true);
    expect(harness.actions.requestPending.value).toBe(true);

    first.resolve({ saved: false });
    await Promise.all([firstRun, duplicate]);
    expect(harness.actions.bookmarked.value).toBe(false);
    expect(harness.actions.bookmarkBusy.value).toBe(false);
    expect(harness.haptic).toHaveBeenCalledTimes(1);
    expect(harness.toast.success).toHaveBeenLastCalledWith("已取消收藏。");

    expect(openActions(harness)).toBe(true);
    const secondRun = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenLastCalledWith(1, true);
    second.resolve({ saved: true });
    await secondRun;
    expect(harness.actions.bookmarked.value).toBe(true);
    expect(harness.haptic).toHaveBeenCalledTimes(2);
    expect(harness.toast.success).toHaveBeenLastCalledWith("已加入收藏。");
  });

  it("#8 preserves settled bookmark state and reports ERROR_SAVE_ACTION on current failure", async () => {
    const request = deferred<{ saved: boolean }>();
    const savePost = vi.fn<SavePost>().mockReturnValueOnce(request.promise);
    const harness = await makeActionHarness({
      item: makeFeedItem(1, "Post A", true),
      savePost,
    });

    openActions(harness);
    const run = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledWith(1, false);
    request.reject(new Error("network"));
    await run;

    expect(harness.actions.bookmarked.value).toBe(true);
    expect(harness.actions.bookmarkBusy.value).toBe(false);
    expect(harness.haptic).not.toHaveBeenCalled();
    expect(harness.toast.success).not.toHaveBeenCalled();
    expect(harness.toast.error).toHaveBeenCalledWith(ERROR_SAVE_ACTION);
  });

  it("#9 reopens during pending save and derives the next direction from live settled state", async () => {
    const first = deferred<{ saved: boolean }>();
    const second = deferred<{ saved: boolean }>();
    const savePost = vi
      .fn<SavePost>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const harness = await makeActionHarness({ savePost });
    const target = new TestHTMLElement();

    openActions(harness, target);
    const firstRun = harness.actions.handleBookmark();
    expect(harness.actions.visible.value).toBe(false);
    expect(openActions(harness, target)).toBe(true);
    expect(harness.actions.visible.value).toBe(true);

    const rejectedWhileBusy = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledTimes(1);
    expect(harness.actions.visible.value).toBe(true);

    first.resolve({ saved: true });
    await Promise.all([firstRun, rejectedWhileBusy]);
    expect(harness.actions.bookmarked.value).toBe(true);
    expect(harness.actions.bookmarkBusy.value).toBe(false);
    expect(harness.actions.visible.value).toBe(true);

    const oppositeRun = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledTimes(2);
    expect(savePost).toHaveBeenLastCalledWith(1, false);
    second.resolve({ saved: false });
    await oppositeRun;
  });

  it.each(["save-first", "share-first"] as const)(
    "#10 keeps save/share tickets independent when they settle %s",
    async (order) => {
      const saveRequest = deferred<{ saved: boolean }>();
      const shareRequest = deferred<ShareResult>();
      const harness = await makeActionHarness({
        savePost: vi.fn<SavePost>().mockReturnValueOnce(saveRequest.promise),
        share: vi.fn<SharePost>().mockReturnValueOnce(shareRequest.promise),
      });

      openActions(harness);
      const saveRun = harness.actions.handleBookmark();
      openActions(harness);
      const shareRun = harness.actions.handleShare();
      expect(harness.actions.visible.value).toBe(false);
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      expect(harness.actions.shareBusy.value).toBe(true);
      expect(harness.actions.requestPending.value).toBe(true);
      expect(openActions(harness)).toBe(true);
      const duplicateShare = harness.actions.handleShare();
      expect(harness.share).toHaveBeenCalledTimes(1);
      expect(harness.actions.visible.value).toBe(true);

      if (order === "save-first") {
        saveRequest.resolve({ saved: true });
        await saveRun;
        expect(harness.actions.bookmarkBusy.value).toBe(false);
        expect(harness.actions.shareBusy.value).toBe(true);
        shareRequest.resolve({ outcome: "shared" });
        await Promise.all([shareRun, duplicateShare]);
      } else {
        shareRequest.resolve({ outcome: "shared" });
        await Promise.all([shareRun, duplicateShare]);
        expect(harness.actions.shareBusy.value).toBe(false);
        expect(harness.actions.bookmarkBusy.value).toBe(true);
        saveRequest.resolve({ saved: true });
        await saveRun;
      }

      expect(harness.actions.bookmarkBusy.value).toBe(false);
      expect(harness.actions.shareBusy.value).toBe(false);
      expect(harness.actions.requestPending.value).toBe(false);
      expect(harness.actions.bookmarked.value).toBe(true);
    },
  );

  it.each(["resolve", "reject"] as const)(
    "#10 lets B start immediately and rejects late A %s/finally effects",
    async (oldCompletion) => {
      const saveA = deferred<{ saved: boolean }>();
      const saveB = deferred<{ saved: boolean }>();
      const shareA = deferred<ShareResult>();
      const shareB = deferred<ShareResult>();
      const savePost = vi
        .fn<SavePost>()
        .mockReturnValueOnce(saveA.promise)
        .mockReturnValueOnce(saveB.promise);
      const share = vi
        .fn<SharePost>()
        .mockReturnValueOnce(shareA.promise)
        .mockReturnValueOnce(shareB.promise);
      const harness = await makeActionHarness({ savePost, share });

      openActions(harness);
      const oldSave = harness.actions.handleBookmark();
      openActions(harness);
      const oldShare = harness.actions.handleShare();

      const itemB = makeFeedItem(2, "Post B", true);
      harness.item.value = itemB;
      expect(harness.actions.visible.value).toBe(false);
      expect(harness.actions.bookmarkBusy.value).toBe(false);
      expect(harness.actions.shareBusy.value).toBe(false);
      expect(harness.actions.bookmarked.value).toBe(true);

      openActions(harness);
      const currentSave = harness.actions.handleBookmark();
      openActions(harness);
      const currentShare = harness.actions.handleShare();
      expect(savePost).toHaveBeenLastCalledWith(2, false);
      expect(share).toHaveBeenLastCalledWith({ tid: 2, title: "Post B" });
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      expect(harness.actions.shareBusy.value).toBe(true);

      if (oldCompletion === "resolve") {
        saveA.resolve({ saved: false });
        shareA.resolve({ outcome: "copied" });
      } else {
        saveA.reject(new Error("stale save failure"));
        shareA.reject(new Error("stale share failure"));
      }
      await Promise.all([oldSave, oldShare]);
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      expect(harness.actions.shareBusy.value).toBe(true);
      expect(harness.actions.requestPending.value).toBe(true);
      expect(harness.actions.bookmarked.value).toBe(true);
      expect(harness.haptic).not.toHaveBeenCalled();
      expect(harness.toast.success).not.toHaveBeenCalled();
      expect(harness.toast.info).not.toHaveBeenCalled();
      expect(harness.toast.error).not.toHaveBeenCalled();

      shareB.resolve({ outcome: "shared" });
      saveB.resolve({ saved: false });
      await Promise.all([currentSave, currentShare]);
      expect(harness.actions.bookmarked.value).toBe(false);
      expect(harness.actions.requestPending.value).toBe(false);
    },
  );

  it.each([
    ["resolve", "explicit"],
    ["reject", "explicit"],
    ["resolve", "scope"],
    ["reject", "scope"],
  ] as const)(
    "#10 makes pending save/share %s completion silent after %s disposal",
    async (completion, disposal) => {
      const saveRequest = deferred<{ saved: boolean }>();
      const shareRequest = deferred<ShareResult>();
      const harness = await makeActionHarness({
        savePost: vi.fn<SavePost>().mockReturnValueOnce(saveRequest.promise),
        share: vi.fn<SharePost>().mockReturnValueOnce(shareRequest.promise),
      });

      openActions(harness);
      const saveRun = harness.actions.handleBookmark();
      openActions(harness);
      const shareRun = harness.actions.handleShare();
      if (disposal === "scope") runScopeDispose();
      else harness.actions.dispose();
      expect(harness.actions.bookmarkBusy.value).toBe(false);
      expect(harness.actions.shareBusy.value).toBe(false);
      expect(openActions(harness)).toBe(false);
      const rejectedSave = harness.actions.handleBookmark();
      const rejectedShare = harness.actions.handleShare();
      harness.actions.handleReport();
      await Promise.all([rejectedSave, rejectedShare]);
      expect(harness.savePost).toHaveBeenCalledTimes(1);
      expect(harness.share).toHaveBeenCalledTimes(1);
      expect(harness.emitOpen).not.toHaveBeenCalled();
      harness.item.value = makeFeedItem(2, "Disposed owner replacement", true);
      expect(harness.actions.bookmarked.value).toBe(false);

      if (completion === "resolve") {
        saveRequest.resolve({ saved: true });
        shareRequest.resolve({ outcome: "copied" });
      } else {
        saveRequest.reject(new Error("disposed save failure"));
        shareRequest.reject(new Error("disposed share failure"));
      }
      await Promise.all([saveRun, shareRun]);
      expect(harness.actions.bookmarked.value).toBe(false);
      expect(harness.haptic).not.toHaveBeenCalled();
      expect(harness.toast.success).not.toHaveBeenCalled();
      expect(harness.toast.info).not.toHaveBeenCalled();
      expect(harness.toast.error).not.toHaveBeenCalled();
    },
  );

  it("#11 keeps owner identity raw while Save uses its detached captured tid", async () => {
    const saveRequest = deferred<{ saved: boolean }>();
    const savePost = vi.fn<SavePost>().mockReturnValueOnce(saveRequest.promise);
    const original = makeFeedItem(11, "Original title", false, "Original actor");
    const harness = await makeActionHarness({ item: original, savePost });
    const liveItem = harness.item.value;
    const target = new TestHTMLElement();

    expect(openActions(harness, target, { ...liveItem })).toBe(false);
    expect(harness.actions.visible.value).toBe(false);
    expect(openActions(harness, target, liveItem)).toBe(true);
    expect(Object.isFrozen(liveItem)).toBe(false);
    expect(Object.isFrozen(liveItem.actor)).toBe(false);

    liveItem.tid = 99;
    liveItem.title = "Mutated title";
    if (liveItem.actor) liveItem.actor.displayName = "Mutated actor";
    expect(liveItem.tid).toBe(99);
    expect(liveItem.actor?.displayName).toBe("Mutated actor");

    const run = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledWith(11, true);
    saveRequest.resolve({ saved: true });
    await run;
  });

  it("#11 makes Share use detached captured tid/title after live mutation", async () => {
    const shareRequest = deferred<ShareResult>();
    const share = vi.fn<SharePost>().mockReturnValueOnce(shareRequest.promise);
    const original = makeFeedItem(12, "Captured display title", false, "Before");
    const harness = await makeActionHarness({ item: original, share });
    const liveItem = harness.item.value;

    openActions(harness);
    liveItem.tid = 1200;
    liveItem.title = "Live title changed";
    if (liveItem.actor) liveItem.actor.displayName = "After";

    const run = harness.actions.handleShare();
    expect(share).toHaveBeenCalledWith({ tid: 12, title: "Captured display title" });
    shareRequest.resolve({ outcome: "shared" });
    await run;
  });

  it("#11/#13 makes Report emit only the detached item and original bounds", async () => {
    const original = makeFeedItem(13, "Report title", false, "Before");
    const harness = await makeActionHarness({ item: original });
    const liveItem = harness.item.value;
    const target = new TestHTMLElement("article", null, false, {
      top: 1,
      left: 2,
      width: 3,
      height: 4,
    });

    openActions(harness, target);
    liveItem.tid = 1300;
    liveItem.title = "Changed report title";
    if (liveItem.actor) liveItem.actor.displayName = "After";
    target.setRect({ top: 10, left: 20, width: 30, height: 40 });
    expect(liveItem.tid).toBe(1300);

    harness.actions.handleReport();
    harness.actions.handleReport();
    expect(harness.actions.visible.value).toBe(false);
    expect(harness.emitOpen).toHaveBeenCalledTimes(1);
    expect(harness.emitOpen).toHaveBeenCalledWith(13, {
      item: expect.objectContaining({
        tid: 13,
        title: "Report title",
        actor: expect.objectContaining({ displayName: "Before" }),
      }),
      rect: { top: 1, left: 2, width: 3, height: 4 },
    });
    const payload = harness.emitOpen.mock.calls[0]?.[1] as
      | { item: FeedItem; rect: Bounds }
      | undefined;
    expect(payload).toBeDefined();
    expect(payload?.item).not.toBe(liveItem);
    expect(Object.isFrozen(payload?.item)).toBe(true);
    expect(Object.isFrozen(payload?.item.actor)).toBe(true);
    expect(Object.isFrozen(payload?.rect)).toBe(true);
  });

  it.each<{
    result: ShareResult;
    expected: "silent" | "success" | "info" | "error";
    message?: string;
  }>([
    { result: { outcome: "shared" }, expected: "silent" },
    { result: { outcome: "cancelled" }, expected: "silent" },
    { result: { outcome: "copied" }, expected: "success", message: SHARE_LINK_COPIED },
    {
      result: { outcome: "use-wechat-menu", message: "Use WeChat menu" },
      expected: "info",
      message: "Use WeChat menu",
    },
    {
      result: { outcome: "failed", message: "Share failed" },
      expected: "error",
      message: "Share failed",
    },
  ])("#12 maps $result.outcome to $expected feedback", async ({ result, expected, message }) => {
    const share = vi.fn<SharePost>().mockResolvedValueOnce(result);
    const harness = await makeActionHarness({
      item: makeFeedItem(21, "Captured share title"),
      share,
    });

    openActions(harness);
    await harness.actions.handleShare();
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ tid: 21, title: "Captured share title" });

    if (expected === "success") {
      expect(harness.toast.success).toHaveBeenCalledWith(message);
    } else {
      expect(harness.toast.success).not.toHaveBeenCalled();
    }
    if (expected === "info") {
      expect(harness.toast.info).toHaveBeenCalledWith(message);
    } else {
      expect(harness.toast.info).not.toHaveBeenCalled();
    }
    if (expected === "error") {
      expect(harness.toast.error).toHaveBeenCalledWith(message);
    } else {
      expect(harness.toast.error).not.toHaveBeenCalled();
    }
  });
});
