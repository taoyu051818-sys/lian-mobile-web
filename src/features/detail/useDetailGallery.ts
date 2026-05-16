import { ref, type ComputedRef } from "vue";

export function useDetailGallery(options: {
  images: ComputedRef<string[]>;
  fullResolutionImages: ComputedRef<string[]>;
}) {
  const fullscreenImage = ref("");
  const galleryPointerDownX = ref(0);
  const galleryPointerDownY = ref(0);
  const galleryPointerMoved = ref(false);

  function handleGalleryPointerDown(event: PointerEvent) {
    galleryPointerDownX.value = event.clientX;
    galleryPointerDownY.value = event.clientY;
    galleryPointerMoved.value = false;
  }

  function handleGalleryPointerMove(event: PointerEvent) {
    const deltaX = Math.abs(event.clientX - galleryPointerDownX.value);
    const deltaY = Math.abs(event.clientY - galleryPointerDownY.value);
    if (deltaX > 8 || deltaY > 8) {
      galleryPointerMoved.value = true;
    }
  }

  function openGalleryImage(index: number) {
    if (galleryPointerMoved.value) {
      galleryPointerMoved.value = false;
      return;
    }
    fullscreenImage.value =
      options.fullResolutionImages.value[index] || options.images.value[index] || "";
  }

  function resetGallery() {
    fullscreenImage.value = "";
    galleryPointerMoved.value = false;
  }

  return {
    fullscreenImage,
    handleGalleryPointerDown,
    handleGalleryPointerMove,
    openGalleryImage,
    resetGallery,
  };
}
