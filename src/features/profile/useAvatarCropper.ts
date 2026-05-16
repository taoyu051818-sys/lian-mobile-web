import { computed, onBeforeUnmount, ref, type StyleValue } from "vue";

export interface UseAvatarCropperOptions {
  previewSize?: number;
  minScale?: number;
  maxScale?: number;
}

export function useAvatarCropper(options: UseAvatarCropperOptions = {}) {
  const previewSize = options.previewSize ?? 96;
  const minScale = options.minScale ?? 1;
  const maxScale = options.maxScale ?? 2.4;

  const file = ref<File | null>(null);
  const previewUrl = ref("");
  const scale = ref(1);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const previewRef = ref<HTMLElement | null>(null);
  const busy = ref(false);

  const dragPointerId = ref<number | null>(null);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const dragStartOffsetX = ref(0);
  const dragStartOffsetY = ref(0);
  const pinchStartDist = ref(0);
  const pinchStartScale = ref(1);

  const previewTransform = computed(
    () => `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  );

  function revokePreview() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }

  function cancel() {
    file.value = null;
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    revokePreview();
  }

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files || []).find((item) => item.type.startsWith("image/"));
    input.value = "";
    if (!picked) return;
    revokePreview();
    file.value = picked;
    previewUrl.value = URL.createObjectURL(picked);
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
  }

  function previewStyle(): StyleValue {
    return {
      transform: previewTransform.value,
      touchAction: "none",
    };
  }

  function clampOffset() {
    const s = scale.value;
    const maxOffset = ((s - 1) / s) * (previewSize / 2);
    offsetX.value = Math.max(-maxOffset, Math.min(maxOffset, offsetX.value));
    offsetY.value = Math.max(-maxOffset, Math.min(maxOffset, offsetY.value));
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (dragPointerId.value !== null) return;
    dragPointerId.value = event.pointerId;
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
    dragStartOffsetX.value = offsetX.value;
    dragStartOffsetY.value = offsetY.value;
    previewRef.value?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (dragPointerId.value !== event.pointerId) return;
    event.preventDefault();
    offsetX.value = dragStartOffsetX.value + (event.clientX - dragStartX.value);
    offsetY.value = dragStartOffsetY.value + (event.clientY - dragStartY.value);
    clampOffset();
  }

  function handlePointerUp(event: PointerEvent) {
    if (dragPointerId.value === event.pointerId) dragPointerId.value = null;
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length < 2) return;
    event.preventDefault();
    const t0 = event.touches[0];
    const t1 = event.touches[1];
    const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    if (pinchStartDist.value === 0) {
      pinchStartDist.value = dist;
      pinchStartScale.value = scale.value;
      return;
    }
    const nextScale = pinchStartScale.value * (dist / pinchStartDist.value);
    scale.value = Math.max(minScale, Math.min(maxScale, nextScale));
    clampOffset();
  }

  function handleTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      pinchStartDist.value = 0;
    }
  }

  async function createCroppedBlob(src: File, s: number, ox: number, oy: number): Promise<Blob> {
    const bitmap = await createImageBitmap(src);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器暂时不能裁剪头像，请换一个浏览器再试。");

    const pScale = previewSize / Math.min(bitmap.width, bitmap.height);
    const bitmapOx = ox / pScale;
    const bitmapOy = oy / pScale;
    const sourceSize = Math.min(bitmap.width, bitmap.height) / Math.max(1, s);
    const sourceX = (bitmap.width - sourceSize) / 2 - bitmapOx;
    const sourceY = (bitmap.height - sourceSize) / 2 - bitmapOy;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    bitmap.close?.();

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("头像裁剪失败，请换一张图片再试。"));
      }, "image/jpeg", 0.9);
    });
  }

  onBeforeUnmount(() => {
    revokePreview();
  });

  return {
    file,
    previewUrl,
    scale,
    offsetX,
    offsetY,
    previewRef,
    busy,
    previewStyle,
    handleInput,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchMove,
    handleTouchEnd,
    createCroppedBlob,
    revokePreview,
    cancel,
  };
}
