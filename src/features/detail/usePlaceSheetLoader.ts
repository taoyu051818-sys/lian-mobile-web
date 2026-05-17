import { computed, ref, type ComputedRef } from "vue";
import { fetchPlaceSheet } from "../../api/places";
import { ERROR_LOAD_PLACE } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PlaceSheet } from "../../types/place";
import type { PostDetail } from "../../types/post";

export function usePlaceSheetLoader(post: ComputedRef<PostDetail | null>) {
  const placeSheet = ref<PlaceSheet | null>(null);
  const placeSheetOpen = ref(false);
  const placeSheetLoading = ref(false);
  const placeSheetError = ref("");

  const placeSheetState = computed(() => placeSheet.value);

  let requestSeq = 0;

  async function openPlaceSheet() {
    const placeId = post.value?.place?.id;
    if (!placeId) return;
    const seq = ++requestSeq;
    placeSheetOpen.value = true;
    placeSheetError.value = "";
    if (placeSheet.value?.id === placeId) return;
    placeSheetLoading.value = true;
    try {
      const nextSheet = await fetchPlaceSheet(placeId);
      if (seq !== requestSeq || post.value?.place?.id !== placeId) return;
      placeSheet.value = nextSheet;
    } catch (error) {
      if (seq !== requestSeq || post.value?.place?.id !== placeId) return;
      placeSheetError.value = extractErrorMessage(error, ERROR_LOAD_PLACE);
    } finally {
      if (seq === requestSeq) placeSheetLoading.value = false;
    }
  }

  function resetPlaceSheet() {
    requestSeq++;
    placeSheet.value = null;
    placeSheetOpen.value = false;
    placeSheetLoading.value = false;
    placeSheetError.value = "";
  }

  return {
    placeSheet,
    placeSheetOpen,
    placeSheetLoading,
    placeSheetError,
    placeSheetState,
    openPlaceSheet,
    resetPlaceSheet,
  };
}
