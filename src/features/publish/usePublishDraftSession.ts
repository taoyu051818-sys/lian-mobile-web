import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { PUBLISH_DRAFT_RECOVERED } from "../../config/brand";
import type { MapLocation } from "../../types/map";
import type { PublishVisibility } from "../../types/publish";
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
  locationSearch: Ref<string>;
  locationPanelOpen: Ref<boolean>;
  publishing: Ref<boolean>;
  loadIdentity: () => void | Promise<void>;
  loadMapLocations: () => void;
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
    locationSearch,
    locationPanelOpen,
    publishing,
    loadIdentity,
    loadMapLocations,
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
  const restoredScopes = ref<Set<string>>(new Set());

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
    if (persistedScope.value === null) return;
    savePublishDraft(
      {
        title: title.value,
        body: body.value,
        tagInput: tagInput.value,
        placeName: placeName.value,
        visibility: visibility.value,
        selectedMapLocation: selectedMapLocation.value,
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
    locationSearch.value = "";
    locationPanelOpen.value = false;
  }

  function restoreDraftFromSession(scope: string) {
    const snapshot = readPublishDraft(scope);
    if (!snapshot) {
      // No draft for this scope — make sure we don't leave another account's
      // typed-but-unpersisted state in the form when the user just switched.
      if (hasUnsavedDraft.value && persistedScope.value !== scope) {
        clearFormFields();
      }
      draftNotice.value = "";
      return;
    }

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

  function adoptScope(scope: string) {
    if (persistedScope.value === scope) return;
    if (!restoredScopes.value.has(scope)) {
      restoreDraftFromSession(scope);
      restoredScopes.value.add(scope);
    }
    persistedScope.value = scope;
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
      { immediate: true },
    );
  } else {
    watch(currentScope, (scope) => adoptScope(scope), { immediate: true });
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
  };
}
