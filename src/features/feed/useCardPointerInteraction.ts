import { onBeforeUnmount, watch } from "vue";

const CARD_CLICK_MAX_DURATION_MS = 360;
const CARD_CLICK_MOVE_TOLERANCE_PX = 8;
const CARD_CONTROL_SELECTOR = "button, a, input, textarea, select, [data-card-control]";

export interface CardContextMenuRequest {
  x: number;
  y: number;
  target: HTMLElement | null;
  ownerToken: unknown;
}

interface CardContextMenuOptions {
  ownerToken?: () => unknown;
  openContextMenu?: (request: CardContextMenuRequest) => void;
}

interface PointerCandidate {
  pointerId: number;
  startedAt: number;
  x: number;
  y: number;
  target: HTMLElement | null;
  ownerToken: unknown;
  moved: boolean;
  acceptedLongPress: boolean;
}

function isElement(value: EventTarget | null): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

function isHtmlElement(value: EventTarget | null): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function isControlTarget(target: EventTarget | null): boolean {
  return isElement(target) && Boolean(target.closest(CARD_CONTROL_SELECTOR));
}

function monotonicNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useCardPointerInteraction(
  emitOpen: (target: HTMLElement | null) => void,
  contextMenu: CardContextMenuOptions = {},
) {
  let candidate: PointerCandidate | null = null;
  let suppressNextClick = false;
  let hasPendingClick = false;
  let pendingClickOwnerToken: unknown;
  let ignoreContextMenuUntilNextIntent = false;
  let longPressTimer: number | null = null;
  let timerGeneration = 0;
  let disposed = false;

  function clearLongPressTimer(): void {
    timerGeneration += 1;
    if (longPressTimer === null) return;
    if (typeof window !== "undefined") window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function currentOwnerToken(): unknown {
    return contextMenu.ownerToken?.();
  }

  function candidateStillOwns(candidateSnapshot: PointerCandidate): boolean {
    return (
      !disposed &&
      candidate === candidateSnapshot &&
      (!contextMenu.ownerToken || currentOwnerToken() === candidateSnapshot.ownerToken)
    );
  }

  function acceptLongPress(candidateSnapshot: PointerCandidate): void {
    if (
      candidateSnapshot.moved ||
      candidateSnapshot.acceptedLongPress ||
      !candidateStillOwns(candidateSnapshot)
    ) {
      return;
    }

    clearLongPressTimer();
    candidateSnapshot.acceptedLongPress = true;
    suppressNextClick = true;
    contextMenu.openContextMenu?.({
      x: candidateSnapshot.x,
      y: candidateSnapshot.y,
      target: candidateSnapshot.target,
      ownerToken: candidateSnapshot.ownerToken,
    });
  }

  function startLongPressTimer(candidateSnapshot: PointerCandidate): void {
    clearLongPressTimer();
    if (typeof window === "undefined") return;
    const generation = ++timerGeneration;
    longPressTimer = window.setTimeout(() => {
      if (generation !== timerGeneration) return;
      longPressTimer = null;
      acceptLongPress(candidateSnapshot);
    }, CARD_CLICK_MAX_DURATION_MS);
  }

  function discardCandidate(options: { suppressClick: boolean }): void {
    clearLongPressTimer();
    candidate = null;
    if (options.suppressClick) suppressNextClick = true;
  }

  function resetPointerIntent(): void {
    clearLongPressTimer();
    candidate = null;
    suppressNextClick = false;
    hasPendingClick = false;
    pendingClickOwnerToken = undefined;
    ignoreContextMenuUntilNextIntent = false;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (disposed || isControlTarget(event.target)) return;
    if (event.isPrimary === false || event.button !== 0) return;

    clearLongPressTimer();
    // A fresh primary down starts a new physical intent. Any click-suppression
    // latch left by a completed move/cancel/long-press sequence belongs to the
    // prior intent and must not consume this one. Owner changes still suppress
    // the old trailing click until another primary intent actually begins.
    suppressNextClick = false;
    hasPendingClick = false;
    pendingClickOwnerToken = undefined;
    ignoreContextMenuUntilNextIntent = false;
    const ownerToken = currentOwnerToken();
    const candidateSnapshot: PointerCandidate = {
      pointerId: event.pointerId,
      startedAt: monotonicNow(),
      x: event.clientX,
      y: event.clientY,
      target: isHtmlElement(event.currentTarget) ? event.currentTarget : null,
      ownerToken,
      moved: false,
      acceptedLongPress: false,
    };
    candidate = candidateSnapshot;
    startLongPressTimer(candidateSnapshot);
  }

  function handlePointerMove(event: PointerEvent): void {
    const candidateSnapshot = candidate;
    if (!candidateSnapshot || candidateSnapshot.pointerId !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - candidateSnapshot.x);
    const deltaY = Math.abs(event.clientY - candidateSnapshot.y);
    if (deltaX <= CARD_CLICK_MOVE_TOLERANCE_PX && deltaY <= CARD_CLICK_MOVE_TOLERANCE_PX) {
      return;
    }

    candidateSnapshot.moved = true;
    clearLongPressTimer();
    suppressNextClick = true;
  }

  function handlePointerUp(event: PointerEvent): void {
    const candidateSnapshot = candidate;
    if (!candidateSnapshot || candidateSnapshot.pointerId !== event.pointerId) return;

    if (candidateSnapshot.moved) {
      clearLongPressTimer();
      suppressNextClick = true;
      return;
    }
    if (candidateSnapshot.acceptedLongPress) {
      clearLongPressTimer();
      suppressNextClick = true;
      return;
    }

    const elapsed = monotonicNow() - candidateSnapshot.startedAt;
    if (elapsed >= CARD_CLICK_MAX_DURATION_MS) {
      acceptLongPress(candidateSnapshot);
      return;
    }
    clearLongPressTimer();
    candidate = null;
    hasPendingClick = true;
    pendingClickOwnerToken = candidateSnapshot.ownerToken;
    ignoreContextMenuUntilNextIntent = true;
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    discardCandidate({ suppressClick: true });
  }

  function handleContextMenu(event: MouseEvent): void {
    if (disposed || isControlTarget(event.target)) return;

    const candidateSnapshot = candidate;
    event.preventDefault();
    if (suppressNextClick || ignoreContextMenuUntilNextIntent) return;
    if (candidateSnapshot && !candidateStillOwns(candidateSnapshot)) {
      discardCandidate({ suppressClick: true });
      return;
    }

    if (candidateSnapshot) {
      if (
        !candidateSnapshot.moved &&
        monotonicNow() - candidateSnapshot.startedAt >= CARD_CLICK_MAX_DURATION_MS
      ) {
        acceptLongPress(candidateSnapshot);
      }
      return;
    }

    contextMenu.openContextMenu?.({
      x: event.clientX,
      y: event.clientY,
      target: isHtmlElement(event.currentTarget) ? event.currentTarget : null,
      ownerToken: currentOwnerToken(),
    });
  }

  function openCard(event?: MouseEvent): void {
    if (disposed || isControlTarget(event?.target ?? null)) return;

    const candidateSnapshot = candidate;
    const ownerToken = currentOwnerToken();
    const ownerChanged = Boolean(
      candidateSnapshot && contextMenu.ownerToken && ownerToken !== candidateSnapshot.ownerToken,
    );
    const pendingClickOwnerChanged = Boolean(
      hasPendingClick && contextMenu.ownerToken && ownerToken !== pendingClickOwnerToken,
    );
    const shouldSuppress = Boolean(
      suppressNextClick ||
      ownerChanged ||
      pendingClickOwnerChanged ||
      candidateSnapshot?.moved ||
      candidateSnapshot?.acceptedLongPress,
    );
    const currentTarget = event?.currentTarget ?? null;
    const target = isHtmlElement(currentTarget) ? currentTarget : null;
    resetPointerIntent();
    if (!shouldSuppress) emitOpen(target);
  }

  function openCardFromKeyboard(event: KeyboardEvent): void {
    if (disposed || isControlTarget(event.target)) return;
    const target = isHtmlElement(event.currentTarget) ? event.currentTarget : null;
    resetPointerIntent();
    emitOpen(target);
  }

  const stopOwnerWatch = contextMenu.ownerToken
    ? watch(
        contextMenu.ownerToken,
        () => {
          if (candidate) discardCandidate({ suppressClick: true });
          else if (hasPendingClick) suppressNextClick = true;
        },
        { flush: "sync" },
      )
    : () => undefined;

  onBeforeUnmount(() => {
    disposed = true;
    stopOwnerWatch();
    clearLongPressTimer();
    candidate = null;
    hasPendingClick = false;
    pendingClickOwnerToken = undefined;
    ignoreContextMenuUntilNextIntent = false;
  });

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleContextMenu,
    openCard,
    openCardFromKeyboard,
  };
}
