import { ref, type Ref } from "vue";
import { fetchPlaceSheet } from "../../api/places";
import { fetchPostDetail } from "../../api/posts";
import type { FeedItemId } from "../../types/feed";
import type { MapLocation, MapPost } from "../../types/map";
import type { PlaceSheet } from "../../types/place";
import type { PostDetail } from "../../types/post";
import { ERROR_LOAD_PLACE, ERROR_LOAD_DETAIL } from "../../config/brand";

export type MapTarget = { kind: "location"; item: MapLocation } | { kind: "post"; item: MapPost };

export function placeIdForLocation(location: MapLocation) {
  return location.place?.id || location.placeId || "";
}

export function hasStablePlaceRef(location: MapLocation) {
  return Boolean(placeIdForLocation(location));
}

export function useMapSelection(getPosts: () => MapPost[]) {
  const selectedTarget = ref<MapTarget | null>(null);
  const selectedPostId = ref<FeedItemId | null>(null);
  const selectedPost = ref<PostDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref("");
  const selectedPlaceSheet = ref<PlaceSheet | null>(null);
  const placeSheetLoading = ref(false);
  const placeSheetError = ref("");
  const openPlaceId = ref("");

  function selectLocation(item: MapLocation) {
    selectedTarget.value = { kind: "location", item };
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    openPlaceId.value = "";
  }

  async function openPlaceSheet(location: MapLocation) {
    const placeId = placeIdForLocation(location);
    if (!placeId) return;
    openPlaceId.value = placeId;
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    placeSheetLoading.value = true;
    try {
      const sheet = await fetchPlaceSheet(placeId);
      if (openPlaceId.value === placeId) {
        selectedPlaceSheet.value = sheet;
      }
    } catch (error) {
      if (openPlaceId.value === placeId) {
        placeSheetError.value = error instanceof Error ? error.message : ERROR_LOAD_PLACE;
      }
    } finally {
      if (openPlaceId.value === placeId) {
        placeSheetLoading.value = false;
      }
    }
  }

  async function openPost(item: MapPost) {
    selectedTarget.value = { kind: "post", item };
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    openPlaceId.value = "";
    selectedPostId.value = item.tid;
    selectedPost.value = null;
    detailError.value = "";
    detailLoading.value = true;
    try {
      const detail = await fetchPostDetail(item.tid);
      if (String(selectedPostId.value) === String(item.tid)) {
        selectedPost.value = detail;
      }
    } catch (error) {
      detailError.value = error instanceof Error ? error.message : ERROR_LOAD_DETAIL;
    } finally {
      if (String(selectedPostId.value) === String(item.tid)) {
        detailLoading.value = false;
      }
    }
  }

  function retryDetail() {
    const target = selectedTarget.value;
    if (target?.kind !== "post") return;
    void openPost(target.item);
  }

  function closeDetail() {
    selectedPostId.value = null;
    selectedPost.value = null;
    detailLoading.value = false;
    detailError.value = "";
  }

  function closePlaceSheet() {
    openPlaceId.value = "";
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
  }

  function selectNearestPostForLocation(location: MapLocation) {
    const posts = getPosts();
    const nearby = posts
      .map((post) => ({ post, distance: Math.hypot((post.lat - location.lat) * 100000, (post.lng - location.lng) * 100000) }))
      .sort((a, b) => a.distance - b.distance)[0]?.post;
    if (nearby) void openPost(nearby);
  }

  return {
    selectedTarget,
    selectedPostId,
    selectedPost,
    detailLoading,
    detailError,
    selectedPlaceSheet,
    placeSheetLoading,
    placeSheetError,
    openPlaceId,
    selectLocation,
    openPlaceSheet,
    openPost,
    retryDetail,
    closeDetail,
    closePlaceSheet,
    selectNearestPostForLocation,
  };
}
