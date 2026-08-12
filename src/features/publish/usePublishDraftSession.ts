import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { PUBLISH_DRAFT_RECOVERED } from "../../config/brand";
import type { MapLocation } from "../../types/map";
import type { PublishVisibility } from "../../types/publish";
import type { PublishMapPickerLocationHandoff } from "./usePublishLocationHandoff";
import {
  PUBLISH_DRAFT_SCOPE_ANONYMOUS,
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
  mapPickerBinding: Ref<PublishMapPickerLocationHandoff | null>;
  locationSearch: Ref<string>;
  locationPanelOpen: Ref<boolean>;
  publishing: Ref<boolean>;
  loadIdentity: () => void | Promise<void>;
  loadMapLocations: () => void;
  /**
   * Synchronously clears page-owned transient state before an already-owned
   * form moves to another account scope. Initial adoption intentionally skips
   * this callback because no outgoing form owner exists yet.
   */
  resetTransientState?: () => void;
  /**
   * Stable identifier for the signed-in account, or null when the identity
   * has not been resolved yet (e.g. while /api/auth/me is in flight). The
   * scope is recomputed every time this changes so a draft authored by user
   * A cannot leak into user B's form (issue #692).
   */
  userId?: Ref<string | null>;
  /**
   * Becomes true once `loadIdentity` has finished — even on auth failure. The
   * draft session waits for this signal before reading from storage so the
   * default anonymous scope cannot temporarily prefill the form for a user
   * whose `/api/auth/me` call is still pending.
   */
  identityLoaded?: Ref<boolean>;
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
    mapPickerBinding,
    locationSearch,
    locationPanelOpen,
    publishing,
    loadIdentity,
    loadMapLocations,
    resetTransientState,
    userId,
    identityLoaded,
  } = options;

  const draftNotice = ref("");

  const currentScope = computed(() => {
    const id = userId?.value;
    if (typeof id === "string" && id.trim()) return `u:${id.trim()}`;
    return PUBLISH_DRAFT_SCOPE_ANONYMOUS;
  });
  // Track which scope the in-memory form fields were last persisted under so
  // an account switch never accidentally writes user A's typed text to user
  // B's storage slot. Starts unset — we only persist after restore has run.
  const persistedScope = ref<string | null>(null);
  const restoreGeneration = ref(0);
  const restoreSettled = computed(
    () =>
      (identityLoaded ? identityLoaded.value : true) && persistedScope.value === currentScope.value,
  );

  const hasUnsavedDraft = computed(() =>
    hasMeaningfulPublishDraft({
      title: title.value,
      body: body.value,
      tagInput: tagInput.value,
      placeName: placeName.value,
      visibility: visibility.value,
      selectedMapLocation: selectedMapLocation.value,
      mapPickerBinding: mapPickerBinding.value,
      selectedFileCount: selectedFiles.value.length,
    }),
  );

  function persistPublishDraft() {
    if (persistedScope.value === null) return;
    savePublishDraft(
      {
        title: title.value,
        body: body.value,
        tagInput: tagInput.value,
        placeName: placeName.value,
        visibility: visibility.value,
        selectedMapLocation: selectedMapLocation.value,
        mapPickerBinding: mapPickerBinding.value,
        selectedFileCount: selectedFiles.value.length,
      },
      persistedScope.value,
    );
  }

  function clearFormFields() {
    title.value = "";
    body.value = "";
    tagInput.value = "";
    placeName.value = "";
    visibility.value = "public";
    selectedMapLocation.value = null;
    mapPickerBinding.value = null;
    locationSearch.value = "";
    locationPanelOpen.value = false;
  }

  function restoreDraftFromSession(scope: string) {
    const snapshot = readPublishDraft(scope);
    if (!snapshot) {
      // Every scope entry is a fresh read. An empty target must stay empty,
      // even when this scope had been visited earlier in the same mount.
      clearFormFields();
      draftNotice.value = "";
      return;
    }

    title.value = snapshot.title;
    body.value = snapshot.body;
    tagInput.value = snapshot.tagInput;
    placeName.value = snapshot.placeName;
    visibility.value = snapshot.visibility;
    selectedMapLocation.value = restorePublishDraftLocation(snapshot.selectedMapLocation);
    mapPickerBinding.value = snapshot.mapPickerBinding;
    const bindingLabel =
      snapshot.mapPickerBinding?.kind === "place"
        ? snapshot.mapPickerBinding.name
        : snapshot.mapPickerBinding?.label || "";
    locationSearch.value = snapshot.selectedMapLocation?.name || bindingLabel || snapshot.placeName;
    locationPanelOpen.value = Boolean(
      snapshot.selectedMapLocation || snapshot.mapPickerBinding || snapshot.placeName.trim(),
    );
    draftNotice.value = snapshot.pendingImageCount
      ? `${PUBLISH_DRAFT_RECOVERED}，${snapshot.pendingImageCount} 张图片需要重新选择。`
      : PUBLISH_DRAFT_RECOVERED;
  }

  function adoptScope(scope: string) {
    if (persistedScope.value === scope) return;

    const outgoingScope = persistedScope.value;
    if (outgoingScope !== null) persistPublishDraft();

    // Remove ownership across the entire synchronous reset/restore window.
    // The form-source watcher may be queued by these mutations, but it cannot
    // target the outgoing account while ownership is null.
    persistedScope.value = null;
    if (outgoingScope !== null) resetTransientState?.();
    restoreDraftFromSession(scope);
    persistedScope.value = scope;
    restoreGeneration.value += 1;
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
      mapPickerBinding,
      () => selectedFiles.value.length,
    ],
    persistPublishDraft,
  );

  // Wait for the identity round-trip to settle before deciding which scope to
  // restore. If the host did not provide identityLoaded, fall back to the
  // legacy behaviour so unit tests that don't wire identity still work.
  if (identityLoaded) {
    watch(
      [identityLoaded, currentScope],
      ([loaded, scope]) => {
        if (!loaded) return;
        adoptScope(scope);
      },
      { immediate: true, flush: "sync" },
    );
  } else {
    watch(currentScope, (scope) => adoptScope(scope), { immediate: true, flush: "sync" });
  }

  onMounted(() => {
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
    restoreDraftFromSession: () => restoreDraftFromSession(currentScope.value),
    currentScope,
    restoreSettled,
    restoreGeneration,
  };
}
