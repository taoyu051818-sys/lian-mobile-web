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

  async function openPlaceSheet() {
    const placeId = post.value?.place?.id;
    if (!placeId) return;
    placeSheetOpen.value = true;
    placeSheetError.value = "";
    if (placeSheet.value?.id === placeId) return;
    placeSheetLoading.value = true;
    try {
      placeSheet.value = await fetchPlaceSheet(placeId);
    } catch (error) {
      placeSheetError.value = extractErrorMessage(error, ERROR_LOAD_PLACE);
    } finally {
      placeSheetLoading.value = false;
    }
  }

  function resetPlaceSheet() {
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
