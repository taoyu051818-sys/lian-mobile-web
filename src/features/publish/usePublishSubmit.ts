import { computed, type Ref } from "vue";
import {
  PUBLISH_LOCATION_UNBOUND,
  PUBLISH_SUCCESS,
  PUBLISH_SUCCESS_BOUND,
  PUBLISH_EVENT_SUCCESS,
  PUBLISH_EVENT_UNAVAILABLE,
  PUBLISH_EVENT_INVALID_TIME,
  PUBLISH_EVENT_CAPACITY_NOT_INT,
  PUBLISH_EVENT_CAPACITY_NEGATIVE,
  PUBLISH_EVENT_JOIN_POLICY_UNKNOWN,
  PUBLISH_MERCHANT_GATE_BLOCK,
  PUBLISH_MERCHANT_NAME_REQUIRED,
  PUBLISH_TRADE_GATE_BLOCK,
  PUBLISH_TRADE_PRICE_REQUIRED,
} from "../../config/brand";
import {
  isWriteActionGenericFallback,
  resolveWriteActionErrorMessage,
} from "../../utils/writeActionErrors";
import { buildPublishPayload, publishPost } from "../../api/publish";
import { createEvent } from "../../api/events";
import { parseCapacityInput, validateEventPublishForm } from "../../domain/eventPublishPolicy";
import { normalizeAudience } from "../../types/audience";
import type { EventJoinPolicy } from "../../types/post-extensions";
import type {
  MerchantContentType,
  MerchantPublishInput,
  PublishLocationDraft,
  PublishVisibility,
  TradeContentType,
  TradePublishInput,
} from "../../types/publish";
import type { PublishPostType } from "../../composables/useEventPublishDraft";
import type { PublishKind } from "./usePublishDraft";
import { inferKind } from "./inferKind";

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
  postType?: Ref<PublishPostType>;
  eventStartAt?: Ref<string>;
  eventEndAt?: Ref<string>;
  eventCapacity?: Ref<string>;
  eventJoinPolicy?: Ref<EventJoinPolicy>;
  audienceVisibility?: Ref<PublishVisibility>;
  publishKind?: Ref<PublishKind>;
  merchantPayload?: () => { input: MerchantPublishInput; contentType: MerchantContentType };
  merchantVerified?: Ref<boolean>;
  tradePayload?: () => { input: TradePublishInput; contentType: TradeContentType };
  tradeVerified?: Ref<boolean>;
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

  function validateMerchantFields(): string {
    if (options.publishKind?.value !== "merchant") return "";
    if (!options.merchantVerified?.value) return PUBLISH_MERCHANT_GATE_BLOCK;
    if (!options.merchantPayload) return "";
    const { input } = options.merchantPayload();
    if (!input.name) return PUBLISH_MERCHANT_NAME_REQUIRED;
    return "";
  }

  function validateTradeFields(): string {
    if (options.publishKind?.value !== "trade") return "";
    if (!options.tradeVerified?.value) return PUBLISH_TRADE_GATE_BLOCK;
    if (!options.tradePayload) return "";
    const { input } = options.tradePayload();
    if (!input.price) return PUBLISH_TRADE_PRICE_REQUIRED;
    return "";
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
      const message = resolveWriteActionErrorMessage("publish", error);
      options.errorMessage.value = isWriteActionGenericFallback("publish", message)
        ? PUBLISH_EVENT_UNAVAILABLE
        : message;
    }
  }

  async function submitPublish() {
    const validation =
      options.validate() ||
      validateEventFields() ||
      validateMerchantFields() ||
      validateTradeFields();
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
      const merchant =
        options.publishKind?.value === "merchant" && options.merchantPayload
          ? options.merchantPayload()
          : undefined;
      const trade =
        options.publishKind?.value === "trade" && options.tradePayload
          ? options.tradePayload()
          : undefined;
      const publishedLocationLabel = options.locationPreviewLabel.value;
      // PRD V0.2 step F (§2.2) — derive the wire `kind` tag from the draft
      // snapshot. The 4-radio is gone, so this is the only path that picks
      // a kind for the post; backend still branches on the value rather
      // than re-inferring server-side.
      const kind = inferKind({
        publishKind: options.publishKind?.value ?? "regular",
        hasLocation: Boolean(
          options.selectedLocationDraft.value || options.placeName.value.trim().length > 0,
        ),
        hasImage: options.uploadedImageUrls.value.length > 0,
        hasBody: options.body.value.trim().length > 0,
        tag: options.normalizedTag.value,
      });
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
        kind,
        ...(merchant ? { merchant } : {}),
        ...(trade ? { trade } : {}),
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
      options.errorMessage.value = resolveWriteActionErrorMessage("publish", error);
    } finally {
      options.publishing.value = false;
    }
  }

  return { postDetailUrl, submitPublish };
}
