import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { PUBLISH_DRAFT_RECOVERED } from "../../config/brand";
import type { MapLocation } from "../../types/map";
import type { PublishVisibility } from "../../types/publish";
import {
  hasMeaningfulPublishDraft,
  readPublishDraft,
  restorePublishDraftLocation,
  savePublishDraft,
} from "./publishDraftSession";

export interface UsePublishDraftSessionOptions {
  title: Ref<string>;
  body: Ref<string>;
  tagInput: Ref<string>;
  placeName: Ref<string>;
  visibility: Ref<PublishVisibility>;
  selectedFiles: Ref<File[]>;
  selectedMapLocation: Ref<MapLocation | null>;
  locationSearch: Ref<string>;
  locationPanelOpen: Ref<boolean>;
  publishing: Ref<boolean>;
  loadIdentity: () => void;
  loadMapLocations: () => void;
}

export function usePublishDraftSession(options: UsePublishDraftSessionOptions) {
  const {
    title,
    body,
    tagInput,
    placeName,
    visibility,
    selectedFiles,
    selectedMapLocation,
    locationSearch,
    locationPanelOpen,
    publishing,
    loadIdentity,
    loadMapLocations,
  } = options;

  const draftNotice = ref("");

  const hasUnsavedDraft = computed(() =>
    hasMeaningfulPublishDraft({
      title: title.value,
      body: body.value,
      tagInput: tagInput.value,
      placeName: placeName.value,
      visibility: visibility.value,
      selectedMapLocation: selectedMapLocation.value,
      selectedFileCount: selectedFiles.value.length,
    }),
  );

  function persistPublishDraft() {
    savePublishDraft({
      title: title.value,
      body: body.value,
      tagInput: tagInput.value,
      placeName: placeName.value,
      visibility: visibility.value,
      selectedMapLocation: selectedMapLocation.value,
      selectedFileCount: selectedFiles.value.length,
    });
  }

  function restoreDraftFromSession() {
    const snapshot = readPublishDraft();
    if (!snapshot) return;

    title.value = snapshot.title;
    body.value = snapshot.body;
    tagInput.value = snapshot.tagInput;
    placeName.value = snapshot.placeName;
    visibility.value = snapshot.visibility;
    selectedMapLocation.value = restorePublishDraftLocation(snapshot.selectedMapLocation);
    locationSearch.value = snapshot.selectedMapLocation?.name || snapshot.placeName;
    locationPanelOpen.value = Boolean(snapshot.selectedMapLocation || snapshot.placeName.trim());
    draftNotice.value = snapshot.pendingImageCount
      ? `${PUBLISH_DRAFT_RECOVERED}，${snapshot.pendingImageCount} 张图片需要重新选择。`
      : PUBLISH_DRAFT_RECOVERED;
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!hasUnsavedDraft.value || publishing.value) return;
    event.preventDefault();
    event.returnValue = "";
  }

  watch(
    [
      title,
      body,
      tagInput,
      placeName,
      visibility,
      selectedMapLocation,
      () => selectedFiles.value.length,
    ],
    persistPublishDraft,
  );

  onMounted(() => {
    restoreDraftFromSession();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }
    void loadIdentity();
    void loadMapLocations();
  });

  onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

  return {
    draftNotice,
    hasUnsavedDraft,
    restoreDraftFromSession,
  };
}
