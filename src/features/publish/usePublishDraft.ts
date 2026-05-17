import { computed, onBeforeUnmount, ref } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  DEFAULT_USER_LABEL,
  ERROR_PUBLISH_IMAGE,
  PUBLISH_IDENTITY_META,
  PUBLISH_IDENTITY_UNCONFIRMED,
  PUBLISH_IMAGE_MAX,
  PUBLISH_IMAGE_UPLOADING,
  PUBLISH_IMAGE_READY,
  PUBLISH_IMAGE_COUNT_SUFFIX,
  PUBLISH_VIS_PUBLIC,
  PUBLISH_VIS_CAMPUS,
  PUBLISH_VIS_SCHOOL,
  PUBLISH_VIS_PRIVATE,
  USER_AVATAR_FALLBACK,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  MAX_PUBLISH_IMAGE_COUNT,
  normalizeIdentityTag,
  normalizePublishTag,
  uploadPublishImage,
  validatePublishImageSelection,
} from "../../api/publish";
import { validatePublishForm } from "../../domain/validation/forms";
import { fetchAuthMe } from "../../api/profile";
import type { PublishVisibility } from "../../types/publish";
import { useAudienceOptions } from "../../composables/useAudienceOptions";
import { usePublishAiDraft } from "../../composables/usePublishAiDraft";
import { planAiSuggestionPatch } from "../../domain/publishAiPolicy";
import type { AudienceVisibility } from "../../types/audience";

export function usePublishDraft() {
  const title = ref("");
  const body = ref("");
  const tagInput = ref("");
  const identityTag = ref("");
  const identityTagOptions = ref<string[]>([]);
  const placeName = ref("");
  const visibility = ref<PublishVisibility>("public");
  const selectedFiles = ref<File[]>([]);
  const localPreviewUrls = ref<string[]>([]);
  const uploadedImageUrls = ref<string[]>([]);
  const aliasId = ref<string | undefined>(undefined);
  const identityName = ref(DEFAULT_USER_LABEL);
  const identityMeta = ref(PUBLISH_IDENTITY_META);
  const uploading = ref(false);
  const publishing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const lastTid = ref<string | number | null>(null);

  const normalizedTag = computed(() => normalizePublishTag(tagInput.value));
  const normalizedIdentityTag = computed(() => normalizeIdentityTag(identityTag.value));
  const avatarText = computed(() => identityName.value.slice(0, 2) || USER_AVATAR_FALLBACK);

  const tagPanelOpen = ref(false);
  const visibilityPanelOpen = ref(false);

  const visibilityOptions: Array<{ value: PublishVisibility; label: string }> = [
    { value: "public", label: PUBLISH_VIS_PUBLIC },
    { value: "campus", label: PUBLISH_VIS_CAMPUS },
    { value: "school", label: PUBLISH_VIS_SCHOOL },
    { value: "private", label: PUBLISH_VIS_PRIVATE },
  ];

  // Backend-driven audience options (PRD V0.1 §7.4.3). Falls back to public-only
  // when the backend route is missing, so the publish UI degrades gracefully.
  const audience = useAudienceOptions();
  function isVisibilityAllowed(value: PublishVisibility): boolean {
    return audience.isAllowed(value as AudienceVisibility);
  }
  function visibilityDisabledReason(value: PublishVisibility): string {
    return audience.disabledReason(value as AudienceVisibility);
  }

  // AI draft (PRD V0.1 Phase 3 / §7.4.2). Suggestions only fill empty fields,
  // and AI failures are silent — manual entry always works. The decision of
  // *what* to apply lives in domain/publishAiPolicy so it can be unit-tested
  // without Vue refs; this composable just wires the policy to live state.
  const aiInternal = usePublishAiDraft({
    uploadedImageUrls,
    title,
    body,
    locationLabel: placeName,
    onSuggestion: (suggestion) => {
      const patch = planAiSuggestionPatch(
        {
          title: title.value,
          body: body.value,
          tag: tagInput.value,
          visibility: visibility.value,
        },
        suggestion,
        (value) => audience.isAllowed(value as AudienceVisibility),
      );
      if (patch.title !== undefined) title.value = patch.title;
      if (patch.body !== undefined) body.value = patch.body;
      if (patch.tag !== undefined) tagInput.value = patch.tag;
      if (patch.visibility !== undefined) visibility.value = patch.visibility;
    },
  });

  // Flat re-exports so the view never reaches into nested `ai.*.value`.
  const aiLoading = aiInternal.loading;
  const aiError = aiInternal.error;
  const aiRiskFlags = aiInternal.riskFlags;
  const aiRefresh = aiInternal.refresh;

  const visibilityLabel = computed(
    () =>
      visibilityOptions.find((item) => item.value === visibility.value)?.label ||
      PUBLISH_VIS_PUBLIC,
  );

  const canSubmit = computed(
    () =>
      title.value.trim().length > 0 &&
      body.value.trim().length > 0 &&
      !uploading.value &&
      !publishing.value,
  );
  const titleCount = computed(() => title.value.length);
  const bodyCount = computed(() => body.value.length);
  const imageStatus = computed(() => {
    if (!selectedFiles.value.length)
      return PUBLISH_IMAGE_MAX.replace("{n}", String(MAX_PUBLISH_IMAGE_COUNT));
    if (uploading.value)
      return `${PUBLISH_IMAGE_UPLOADING} ${uploadedImageUrls.value.length}/${selectedFiles.value.length}`;
    return `${PUBLISH_IMAGE_READY} ${uploadedImageUrls.value.length}/${selectedFiles.value.length} ${PUBLISH_IMAGE_COUNT_SUFFIX}`;
  });

  const pageChrome = computed<PageChromeSpec>(() => ({
    top: {
      identity: {
        avatarText: avatarText.value,
        name: identityName.value,
        meta: identityMeta.value,
      },
    },
  }));

  function revokePreviewUrls() {
    localPreviewUrls.value.forEach((url) => URL.revokeObjectURL(url));
    localPreviewUrls.value = [];
  }

  async function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const selection = validatePublishImageSelection(
      Array.from(input.files || []),
      selectedFiles.value.length,
    );
    input.value = "";

    if (!selection.acceptedFiles.length) {
      if (selection.message) errorMessage.value = selection.message;
      return;
    }

    errorMessage.value = selection.message;
    successMessage.value = "";
    selectedFiles.value = [...selectedFiles.value, ...selection.acceptedFiles];
    localPreviewUrls.value = [
      ...localPreviewUrls.value,
      ...selection.acceptedFiles.map((file) => URL.createObjectURL(file)),
    ];
    await uploadPendingImages();
  }

  async function uploadPendingImages() {
    if (uploading.value) return;
    uploading.value = true;
    try {
      for (
        let index = uploadedImageUrls.value.length;
        index < selectedFiles.value.length;
        index += 1
      ) {
        const url = await uploadPublishImage(selectedFiles.value[index]);
        uploadedImageUrls.value[index] = url;
      }
      uploadedImageUrls.value = uploadedImageUrls.value.filter(Boolean);
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, ERROR_PUBLISH_IMAGE);
    } finally {
      uploading.value = false;
    }
  }

  /**
   * After the first successful upload, surface the location step (PRD §7.4.2).
   * The caller passes a callback rather than coupling this composable to the
   * location-options composable, so this stays publishable in isolation.
   */
  function notifyFirstUploadComplete(openLocation: () => void) {
    if (uploadedImageUrls.value.length === 1 && !uploading.value) {
      openLocation();
    }
  }

  function removeImage(index: number) {
    if (localPreviewUrls.value[index]) URL.revokeObjectURL(localPreviewUrls.value[index]);
    selectedFiles.value.splice(index, 1);
    localPreviewUrls.value.splice(index, 1);
    uploadedImageUrls.value.splice(index, 1);
  }

  function validate() {
    return validatePublishForm({
      title: title.value,
      body: body.value,
      uploading: uploading.value,
      selectedFileCount: selectedFiles.value.length,
      uploadedImageCount: uploadedImageUrls.value.length,
    });
  }

  async function loadIdentity() {
    try {
      const user = await fetchAuthMe();
      identityName.value = user?.username || DEFAULT_USER_LABEL;
      aliasId.value = user?.activeAliasId || undefined;
      identityTagOptions.value = user?.identityTags || [];
      identityTag.value = "";
      const activeAlias = aliasId.value
        ? user?.aliases?.find((alias) => alias.id === aliasId.value)
        : null;
      identityMeta.value = activeAlias?.name || user?.institution || PUBLISH_IDENTITY_META;
    } catch {
      identityName.value = DEFAULT_USER_LABEL;
      identityMeta.value = PUBLISH_IDENTITY_UNCONFIRMED;
      identityTagOptions.value = [];
      identityTag.value = "";
    }
  }

  function toggleTagPanel() {
    tagPanelOpen.value = !tagPanelOpen.value;
  }

  function toggleVisibilityPanel() {
    visibilityPanelOpen.value = !visibilityPanelOpen.value;
  }

  function resetForm(clearLocation: () => void) {
    title.value = "";
    body.value = "";
    tagInput.value = "";
    identityTag.value = "";
    placeName.value = "";
    visibility.value = "public";
    selectedFiles.value = [];
    uploadedImageUrls.value = [];
    tagPanelOpen.value = false;
    visibilityPanelOpen.value = false;
    clearLocation();
    revokePreviewUrls();
  }

  onBeforeUnmount(() => {
    revokePreviewUrls();
  });

  return {
    title,
    body,
    tagInput,
    identityTag,
    identityTagOptions,
    placeName,
    visibility,
    selectedFiles,
    localPreviewUrls,
    uploadedImageUrls,
    aliasId,
    identityName,
    identityMeta,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    lastTid,
    tagPanelOpen,
    visibilityPanelOpen,
    normalizedTag,
    normalizedIdentityTag,
    avatarText,
    canSubmit,
    titleCount,
    bodyCount,
    imageStatus,
    visibilityLabel,
    visibilityOptions,
    pageChrome,
    handleFiles,
    removeImage,
    validate,
    loadIdentity,
    resetForm,
    toggleTagPanel,
    toggleVisibilityPanel,
    audience,
    isVisibilityAllowed,
    visibilityDisabledReason,
    aiLoading,
    aiError,
    aiRiskFlags,
    aiRefresh,
    notifyFirstUploadComplete,
  };
}
