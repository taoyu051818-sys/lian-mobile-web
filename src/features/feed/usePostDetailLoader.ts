import { computed, ref } from "vue";
import { fetchPostDetail } from "../../api/posts";
import type { FeedItemId } from "../../types/feed";
import type { PostDetail } from "../../types/post";
import { ERROR_LOAD_DETAIL } from "../../config/brand";
import { normalizeFeedItemId } from "./feedItemId";

export function usePostDetailLoader() {
  const selectedPostId = ref<FeedItemId | null>(null);
  const selectedPost = ref<PostDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref("");

  const detailOpen = computed(() => selectedPostId.value !== null);

  async function loadDetail(id: FeedItemId) {
    const normalizedId = normalizeFeedItemId(id);
    detailLoading.value = true;
    detailError.value = "";
    try {
      const detail = await fetchPostDetail(id);
      if (normalizeFeedItemId(selectedPostId.value) === normalizedId) {
        selectedPost.value = detail;
      }
    } catch (error) {
      if (normalizeFeedItemId(selectedPostId.value) === normalizedId) {
        detailError.value = error instanceof Error ? error.message : ERROR_LOAD_DETAIL;
      }
    } finally {
      if (normalizeFeedItemId(selectedPostId.value) === normalizedId) {
        detailLoading.value = false;
      }
    }
  }

  function retryDetail() {
    if (selectedPostId.value == null) return;
    void loadDetail(selectedPostId.value);
  }

  function resetLoaderState() {
    selectedPostId.value = null;
    selectedPost.value = null;
    detailLoading.value = false;
    detailError.value = "";
  }

  return {
    selectedPostId,
    selectedPost,
    detailLoading,
    detailError,
    detailOpen,
    loadDetail,
    retryDetail,
    resetLoaderState,
  };
}
