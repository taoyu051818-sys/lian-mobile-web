import { onBeforeUnmount, ref } from "vue";

const CARD_CLICK_MAX_DURATION_MS = 360;
const CARD_CLICK_MOVE_TOLERANCE_PX = 8;

function isControlTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, input, textarea, select, [data-card-control]"))
  );
}

export function useCardPointerInteraction(emitOpen: (target: HTMLElement | null) => void) {
  const pointerDownAt = ref(0);
  const pointerDownX = ref(0);
  const pointerDownY = ref(0);
  const pointerMoved = ref(false);
  const pointerWasLongPress = ref(false);
  const pointerCandidateId = ref<number | null>(null);
  let longPressTimer = 0;

  function clearLongPressTimer() {
    if (!longPressTimer || typeof window === "undefined") return;
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;
  }

  function startLongPressTimer(pointerId: number) {
    clearLongPressTimer();
    if (typeof window === "undefined") return;
    longPressTimer = window.setTimeout(() => {
      if (pointerCandidateId.value === pointerId) {
        pointerWasLongPress.value = true;
      }
      longPressTimer = 0;
    }, CARD_CLICK_MAX_DURATION_MS);
  }

  function resetPointerIntent() {
    clearLongPressTimer();
    pointerCandidateId.value = null;
    pointerDownAt.value = 0;
    pointerDownX.value = 0;
    pointerDownY.value = 0;
    pointerMoved.value = false;
    pointerWasLongPress.value = false;
  }

  function handlePointerDown(event: PointerEvent) {
    if (isControlTarget(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerCandidateId.value = event.pointerId;
    pointerDownAt.value = performance.now();
    pointerDownX.value = event.clientX;
    pointerDownY.value = event.clientY;
    pointerMoved.value = false;
    pointerWasLongPress.value = false;
    startLongPressTimer(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (pointerCandidateId.value !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - pointerDownX.value);
    const deltaY = Math.abs(event.clientY - pointerDownY.value);
    if (deltaX > CARD_CLICK_MOVE_TOLERANCE_PX || deltaY > CARD_CLICK_MOVE_TOLERANCE_PX) {
      pointerMoved.value = true;
      clearLongPressTimer();
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (pointerCandidateId.value !== event.pointerId) return;
    clearLongPressTimer();
    pointerWasLongPress.value =
      performance.now() - pointerDownAt.value > CARD_CLICK_MAX_DURATION_MS;
  }

  function handlePointerCancel(event: PointerEvent) {
    if (pointerCandidateId.value === event.pointerId) resetPointerIntent();
  }

  function handleContextMenu(event: MouseEvent) {
    if (isControlTarget(event.target)) return;
    pointerWasLongPress.value = true;
    clearLongPressTimer();
    event.preventDefault();
  }

  function openCard(event?: MouseEvent) {
    if (isControlTarget(event?.target || null)) return;
    const shouldSuppress = pointerMoved.value || pointerWasLongPress.value;
    const target = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    resetPointerIntent();
    if (shouldSuppress) return;
    emitOpen(target);
  }

  function openCardFromKeyboard(event: KeyboardEvent) {
    if (isControlTarget(event.target)) return;
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    resetPointerIntent();
    emitOpen(target);
  }

  onBeforeUnmount(() => {
    clearLongPressTimer();
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
