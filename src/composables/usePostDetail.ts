import { computed, ref } from "vue";
import { fetchPostDetail } from "../api/posts";
import type { FeedItemId } from "../types/feed";
import type { PostDetail } from "../types/post";
import { ERROR_LOAD_DETAIL } from "../config/brand";

export function usePostDetail() {
  const selectedPostId = ref<FeedItemId | null>(null);
  const selectedPost = ref<PostDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref("");
  const savedScrollY = ref(0);

  const detailOpen = computed(() => selectedPostId.value !== null);

  async function openDetail(tid: FeedItemId) {
    savedScrollY.value = typeof window !== "undefined" ? window.scrollY : 0;
    selectedPostId.value = tid;
    selectedPost.value = null;
    detailError.value = "";
    detailLoading.value = true;
    try {
      selectedPost.value = await fetchPostDetail(tid);
    } catch (error) {
      detailError.value = error instanceof Error
        ? error.message
        : ERROR_LOAD_DETAIL;
    } finally {
      detailLoading.value = false;
    }
  }

  function closeDetail() {
    selectedPostId.value = null;
    selectedPost.value = null;
    detailLoading.value = false;
    detailError.value = "";
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY.value));
    }
  }

  function retryDetail() {
    if (selectedPostId.value != null) void openDetail(selectedPostId.value);
  }

  return {
    selectedPostId,
    selectedPost,
    detailLoading,
    detailError,
    detailOpen,
    openDetail,
    closeDetail,
    retryDetail,
  };
}
