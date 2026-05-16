import { computed, type Ref } from "vue";
import {
  ERROR_PUBLISH_GENERIC,
  PUBLISH_LOCATION_UNBOUND,
  PUBLISH_SUCCESS,
  PUBLISH_SUCCESS_BOUND,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { buildPublishPayload, publishPost } from "../../api/publish";
import type { PublishLocationDraft, PublishVisibility } from "../../types/publish";

export function usePublishSubmit(options: {
  title: Ref<string>;
  body: Ref<string>;
  tagInput: Ref<string>;
  identityTag: Ref<string>;
  placeName: Ref<string>;
  visibility: Ref<PublishVisibility>;
  aliasId: Ref<string | undefined>;
  uploadedImageUrls: Ref<string[]>;
  uploading: Ref<boolean>;
  publishing: Ref<boolean>;
  errorMessage: Ref<string>;
  successMessage: Ref<string>;
  lastTid: Ref<string | number | null>;
  normalizedTag: Ref<string>;
  normalizedIdentityTag: Ref<string>;
  selectedLocationDraft: Ref<PublishLocationDraft | null>;
  locationPreviewLabel: Ref<string>;
  validate: () => string;
  resetForm: () => void;
}) {
  const postDetailUrl = computed(() => {
    const tid = options.lastTid.value;
    if (!tid) return "";
    return `#/post/${tid}`;
  });

  function placeNameFromResponse(response: { place?: { name?: string } | null }): string {
    return response.place?.name || "";
  }

  async function submitPublish() {
    const validation = options.validate();
    options.errorMessage.value = validation;
    options.successMessage.value = "";
    options.lastTid.value = null;
    if (validation || options.publishing.value) return;

    options.publishing.value = true;
    try {
      const publishedLocationLabel = options.locationPreviewLabel.value;
      const payload = buildPublishPayload({
        imageUrls: options.uploadedImageUrls.value,
        title: options.title.value,
        body: options.body.value,
        tag: options.normalizedTag.value,
        identityTag: options.normalizedIdentityTag.value,
        placeName: options.placeName.value,
        visibility: options.visibility.value,
        aliasId: options.aliasId.value,
        locationDraft: options.selectedLocationDraft.value,
      });
      const response = await publishPost(payload);
      options.lastTid.value = response.tid || null;
      const boundPlaceName = placeNameFromResponse(response) || publishedLocationLabel;
      options.successMessage.value =
        boundPlaceName && boundPlaceName !== PUBLISH_LOCATION_UNBOUND
          ? PUBLISH_SUCCESS_BOUND.replace("{n}", boundPlaceName)
          : PUBLISH_SUCCESS;
      options.resetForm();
    } catch (error) {
      options.errorMessage.value = extractErrorMessage(error, ERROR_PUBLISH_GENERIC);
    } finally {
      options.publishing.value = false;
    }
  }

  return { postDetailUrl, submitPublish };
}
