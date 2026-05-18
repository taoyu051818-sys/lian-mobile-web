import { computed, onBeforeUnmount, ref } from "vue";
import {
  ERROR_PUBLISH_IMAGE,
  PUBLISH_IMAGE_MAX,
  PUBLISH_IMAGE_UPLOADING,
  PUBLISH_IMAGE_READY,
  PUBLISH_IMAGE_COUNT_SUFFIX,
  PUBLISH_VIS_PUBLIC,
  PUBLISH_VIS_CAMPUS,
  PUBLISH_VIS_SCHOOL,
  PUBLISH_VIS_PRIVATE,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  MAX_PUBLISH_IMAGE_COUNT,
  normalizePublishTag,
  uploadPublishImage,
  validatePublishImageSelection,
} from "../../api/publish";
import { validatePublishForm } from "../../domain/validation/forms";
import type { PublishVisibility } from "../../types/publish";
import type { AudienceVisibility } from "../../types/audience";
import { useAudienceOptions } from "../../composables/useAudienceOptions";
import { usePublishIdentity } from "./usePublishIdentity";
import { usePublishAi } from "./usePublishAi";
import { useMerchantPublishDraft } from "./useMerchantPublishDraft";
import { useTradePublishDraft } from "./useTradePublishDraft";

export type PublishKind = "regular" | "merchant" | "trade";

/**
 * Composes the three slices of publish-form state — form fields & uploads
 * (this file), identity (`usePublishIdentity`), and AI suggestions
 * (`usePublishAi`) — into the single object PublishView consumes. Splitting
 * out identity/AI is a deliberate carve-out: this file used to mix all three
 * concerns into one 314-line composable that returned 27 fields.
 *
 * Public surface kept stable so PublishView, usePublishSubmit, and
 * usePublishDraftSession don't need to change shape.
 */
export function usePublishDraft() {
  const title = ref("");
  const body = ref("");
  const tagInput = ref("");
  const placeName = ref("");
  const visibility = ref<PublishVisibility>("public");
  const selectedFiles = ref<File[]>([]);
  const localPreviewUrls = ref<string[]>([]);
  const uploadedImageUrls = ref<string[]>([]);
  const uploading = ref(false);
  const publishing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const lastTid = ref<string | number | null>(null);

  const normalizedTag = computed(() => normalizePublishTag(tagInput.value));

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

  const identity = usePublishIdentity();

  const merchant = useMerchantPublishDraft();
  const trade = useTradePublishDraft();
  const publishKind = ref<PublishKind>("regular");

  // AI draft (PRD V0.1 Phase 3). Suggestions only fill empty fields, and AI
  // failures stay silent — manual entry always works. Decision lives in
  // domain/publishAiPolicy; this composable just owns the wiring.
  const ai = usePublishAi({
    uploadedImageUrls,
    title,
    body,
    tagInput,
    placeName,
    visibility,
    isAllowed: (value) => audience.isAllowed(value),
  });

  const visibilityLabel = computed(
    () =>
      visibilityOptions.find((item) => item.value === visibility.value)?.label ||
      PUBLISH_VIS_PUBLIC,
  );

  const canSubmit = computed(() => {
    if (title.value.trim().length === 0) return false;
    if (body.value.trim().length === 0) return false;
    if (uploading.value || publishing.value) return false;
    if (publishKind.value === "merchant") return merchant.canSubmit.value;
    if (publishKind.value === "trade") return trade.canSubmit();
    return true;
  });
  const titleCount = computed(() => title.value.length);
  const bodyCount = computed(() => body.value.length);
  const imageStatus = computed(() => {
    if (!selectedFiles.value.length)
      return PUBLISH_IMAGE_MAX.replace("{n}", String(MAX_PUBLISH_IMAGE_COUNT));
    if (uploading.value)
      return `${PUBLISH_IMAGE_UPLOADING} ${uploadedImageUrls.value.length}/${selectedFiles.value.length}`;
    return `${PUBLISH_IMAGE_READY} ${uploadedImageUrls.value.length}/${selectedFiles.value.length} ${PUBLISH_IMAGE_COUNT_SUFFIX}`;
  });

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
    identity.identityTag.value = "";
    placeName.value = "";
    visibility.value = "public";
    selectedFiles.value = [];
    uploadedImageUrls.value = [];
    tagPanelOpen.value = false;
    visibilityPanelOpen.value = false;
    publishKind.value = "regular";
    merchant.reset();
    trade.reset();
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
    identityTag: identity.identityTag,
    identityTagOptions: identity.identityTagOptions,
    placeName,
    visibility,
    selectedFiles,
    localPreviewUrls,
    uploadedImageUrls,
    aliasId: identity.aliasId,
    identityName: identity.identityName,
    identityMeta: identity.identityMeta,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    lastTid,
    tagPanelOpen,
    visibilityPanelOpen,
    normalizedTag,
    normalizedIdentityTag: identity.normalizedIdentityTag,
    avatarText: identity.avatarText,
    canSubmit,
    titleCount,
    bodyCount,
    imageStatus,
    visibilityLabel,
    visibilityOptions,
    pageChrome: identity.pageChrome,
    handleFiles,
    removeImage,
    validate,
    loadIdentity: identity.loadIdentity,
    resetForm,
    toggleTagPanel,
    toggleVisibilityPanel,
    audience,
    isVisibilityAllowed,
    visibilityDisabledReason,
    aiLoading: ai.aiLoading,
    aiError: ai.aiError,
    aiRiskFlags: ai.aiRiskFlags,
    aiRefresh: ai.aiRefresh,
    notifyFirstUploadComplete,
    publishKind,
    merchant,
    trade,
  };
}
