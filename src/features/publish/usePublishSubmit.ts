import { computed, type Ref } from "vue";
import {
  ERROR_PUBLISH_GENERIC,
  PUBLISH_LOCATION_UNBOUND,
  PUBLISH_SUCCESS,
  PUBLISH_SUCCESS_BOUND,
  PUBLISH_EVENT_SUCCESS,
  PUBLISH_EVENT_UNAVAILABLE,
  PUBLISH_EVENT_INVALID_TIME,
  PUBLISH_EVENT_CAPACITY_NOT_INT,
  PUBLISH_EVENT_CAPACITY_NEGATIVE,
  PUBLISH_EVENT_JOIN_POLICY_UNKNOWN,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { buildPublishPayload, publishPost } from "../../api/publish";
import { createEvent } from "../../api/events";
import { parseCapacityInput, validateEventPublishForm } from "../../domain/eventPublishPolicy";
import { normalizeAudience } from "../../types/audience";
import type { EventJoinPolicy } from "../../types/post-extensions";
import type { PublishLocationDraft, PublishVisibility } from "../../types/publish";
import type { PublishPostType } from "../../composables/useEventPublishDraft";

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
  // Event-publish extras (PRD V0.1 §6.3 / §11.2). Optional so callers that
  // never publish events stay backwards-compatible.
  postType?: Ref<PublishPostType>;
  eventStartAt?: Ref<string>;
  eventEndAt?: Ref<string>;
  eventCapacity?: Ref<string>;
  eventJoinPolicy?: Ref<EventJoinPolicy>;
  audienceVisibility?: Ref<PublishVisibility>;
}) {
  const postDetailUrl = computed(() => {
    const tid = options.lastTid.value;
    if (!tid) return "";
    return `#/post/${tid}`;
  });

  function placeNameFromResponse(response: { place?: { name?: string } | null }): string {
    return response.place?.name || "";
  }

  function validateEventFields(): string {
    if (!options.postType || options.postType.value !== "event") return "";
    return validateEventPublishForm(
      {
        startsAt: options.eventStartAt?.value || "",
        endsAt: options.eventEndAt?.value || "",
        capacity: options.eventCapacity?.value || "",
        joinPolicy: options.eventJoinPolicy?.value || "open",
      },
      {
        startAfterEnd: PUBLISH_EVENT_INVALID_TIME,
        capacityNotInt: PUBLISH_EVENT_CAPACITY_NOT_INT,
        capacityNegative: PUBLISH_EVENT_CAPACITY_NEGATIVE,
        joinPolicyUnknown: PUBLISH_EVENT_JOIN_POLICY_UNKNOWN,
      },
    );
  }

  async function submitEvent() {
    const cap = parseCapacityInput(options.eventCapacity?.value || "");
    const capacity = cap.ok ? cap.capacity : undefined;
    const startsAt = (options.eventStartAt?.value || "").trim();
    const endsAt = (options.eventEndAt?.value || "").trim();
    const audience = normalizeAudience({
      visibility: options.audienceVisibility?.value || options.visibility.value,
    });
    try {
      const response = await createEvent({
        title: options.title.value,
        body: options.body.value,
        participantScope: audience,
        joinPolicy: options.eventJoinPolicy?.value || "open",
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
      });
      options.lastTid.value = response.tid || null;
      options.successMessage.value = PUBLISH_EVENT_SUCCESS;
      options.resetForm();
    } catch (error) {
      options.errorMessage.value = extractErrorMessage(error, PUBLISH_EVENT_UNAVAILABLE);
    }
  }

  async function submitPublish() {
    const validation = options.validate() || validateEventFields();
    options.errorMessage.value = validation;
    options.successMessage.value = "";
    options.lastTid.value = null;
    if (validation || options.publishing.value) return;

    options.publishing.value = true;
    try {
      if (options.postType?.value === "event") {
        await submitEvent();
        return;
      }
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
