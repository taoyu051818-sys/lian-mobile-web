import { computed, ref } from "vue";
import { fetchPostDetail } from "../../api/posts";
import type { FeedItemId } from "../../types/feed";
import type { PostDetail } from "../../types/post";
import { ERROR_LOAD_DETAIL } from "../../config/brand";

export function usePostDetailLoader() {
  const selectedPostId = ref<FeedItemId | null>(null);
  const selectedPost = ref<PostDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref("");

  const detailOpen = computed(() => selectedPostId.value !== null);

  // Each loadDetail call gets a private monotonically-increasing token. The
  // try/catch/finally checks `token === pendingToken` instead of comparing
  // against `selectedPostId.value`. This is robust against any external code
  // path that mutates selectedPostId during the fetch — the loader still
  // settles `detailLoading` correctly, so the panel never gets stuck on the
  // loading state. resetLoaderState bumps the token so any in-flight result
  // is silently dropped instead of writing back to the cleared state.
  let pendingToken = 0;

  async function loadDetail(id: FeedItemId) {
    const token = ++pendingToken;
    detailLoading.value = true;
    detailError.value = "";
    try {
      const detail = await fetchPostDetail(id);
      if (token !== pendingToken) return;
      selectedPost.value = detail;
    } catch (error) {
      if (token !== pendingToken) return;
      detailError.value = error instanceof Error ? error.message : ERROR_LOAD_DETAIL;
    } finally {
      if (token === pendingToken) {
        detailLoading.value = false;
      }
    }
  }

  function retryDetail() {
    if (selectedPostId.value == null) return;
    void loadDetail(selectedPostId.value);
  }

  function resetLoaderState() {
    pendingToken += 1;
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
