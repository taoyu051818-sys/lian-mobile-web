import type { Ref } from "vue";

const SWIPE_THRESHOLD = 96;
const SWIPE_VERTICAL_GUARD = 52;
const DETAIL_DRAG_EDGE_GUARD = 28;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".post-detail-panel__gallery, .post-detail-panel__gallery-item")) return false;
  return Boolean(target.closest(".post-detail-panel__topbar, .post-detail-panel__dock, .post-detail-panel__report, .post-detail-panel__lightbox, a, button, input, textarea, select, [role='button']"));
}

export function useDetailDragGesture(deps: {
  detailOpen: Ref<boolean>;
  detailLoading: Ref<boolean>;
  detailReturning: Ref<boolean>;
  detailDragging: Ref<boolean>;
  detailDragX: Ref<number>;
  detailPointerId: Ref<number | null>;
  detailGestureLocked: Ref<"horizontal" | "vertical" | null>;
  dragStartX: Ref<number>;
  dragStartY: Ref<number>;
  viewportWidth: Ref<number>;
  updateViewport: () => void;
  closeDetailWithCardify: (opts: { direction: number }) => void;
  cardifyDistance: number;
}) {
  function isInsideDetailDragBand(x: number) {
    return x >= DETAIL_DRAG_EDGE_GUARD && x <= deps.viewportWidth.value - DETAIL_DRAG_EDGE_GUARD;
  }

  function abortDetailDrag(event: PointerEvent) {
    deps.detailDragging.value = false;
    deps.detailPointerId.value = null;
    deps.detailGestureLocked.value = null;
    deps.detailDragX.value = 0;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
  }

  function onDetailPointerDown(event: PointerEvent) {
    if (!deps.detailOpen.value || deps.detailLoading.value || deps.detailReturning.value || isInteractiveTarget(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    deps.updateViewport();
    if (!isInsideDetailDragBand(event.clientX)) return;
    deps.dragStartX.value = event.clientX;
    deps.dragStartY.value = event.clientY;
    deps.detailDragX.value = 0;
    deps.detailDragging.value = true;
    deps.detailPointerId.value = event.pointerId;
    deps.detailGestureLocked.value = null;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  function onDetailPointerMove(event: PointerEvent) {
    if (!deps.detailDragging.value || deps.detailPointerId.value !== event.pointerId) return;
    const deltaX = event.clientX - deps.dragStartX.value;
    const deltaY = event.clientY - deps.dragStartY.value;
    if (!deps.detailGestureLocked.value) {
      if (Math.abs(deltaY) > SWIPE_VERTICAL_GUARD && Math.abs(deltaY) > Math.abs(deltaX)) {
        deps.detailGestureLocked.value = "vertical";
        abortDetailDrag(event);
        return;
      }
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
        deps.detailGestureLocked.value = "horizontal";
      }
    }
    if (deps.detailGestureLocked.value !== "horizontal") return;
    event.preventDefault();
    const nextDragX = Math.max(-deps.cardifyDistance, Math.min(deps.cardifyDistance, deltaX));
    deps.detailDragX.value = nextDragX;
  }

  function onDetailPointerUp(event: PointerEvent) {
    if (!deps.detailDragging.value || deps.detailPointerId.value !== event.pointerId) return;
    const finalX = deps.detailDragX.value;
    deps.detailDragging.value = false;
    deps.detailPointerId.value = null;
    deps.detailGestureLocked.value = null;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    if (Math.abs(finalX) > SWIPE_THRESHOLD) {
      deps.closeDetailWithCardify({ direction: finalX < 0 ? -1 : 1 });
      return;
    }
    deps.detailDragX.value = 0;
  }

  function onDetailPointerCancel(event: PointerEvent) {
    if (deps.detailPointerId.value !== event.pointerId) return;
    abortDetailDrag(event);
  }

  return {
    onDetailPointerDown,
    onDetailPointerMove,
    onDetailPointerUp,
    onDetailPointerCancel,
  };
}
