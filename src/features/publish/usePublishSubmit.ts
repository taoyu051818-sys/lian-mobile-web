import { computed, type Ref } from "vue";
import {
  PUBLISH_LOCATION_UNBOUND,
  PUBLISH_SUCCESS,
  PUBLISH_SUCCESS_BOUND,
  PUBLISH_SUCCESS_METADATA_PENDING,
  PUBLISH_SUCCESS_METADATA_RETRY,
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
import { hapticSuccess, hapticError } from "../../composables/useHapticFeedback";
import type { EventJoinPolicy } from "../../types/post-extensions";
import type {
  MerchantContentType,
  MerchantPublishInput,
  PublishActionablePostPreview,
  PublishLocationDraft,
  PublishPayload,
  PublishVisibility,
  TradeContentType,
  TradePublishInput,
} from "../../types/publish";
import type { PublishPostType } from "../../composables/useEventPublishDraft";
import type { PublishKind } from "./usePublishDraft";
import type { InferredKind, SuggestedComponent } from "../../types/publishSuggestion";
import { inferKind } from "./inferKind";

export function createPublishIdempotencyKey(): string {
  try {
    const key = globalThis.crypto?.randomUUID?.();
    if (key) return key;
  } catch {
    // Some embedded browsers expose crypto but reject access to randomUUID.
  }
  return `publish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createPublishActionablePostPreview(input: {
  kind?: InferredKind;
  title: string;
  body: string;
  tag: string;
  identityTag: string;
  imageUrls: string[];
  locationArea: string;
  components: SuggestedComponent[];
  event?: { startsAt?: string; joinPolicy?: EventJoinPolicy };
  merchant?: { input: MerchantPublishInput; contentType: MerchantContentType };
  trade?: { input: TradePublishInput; contentType: TradeContentType };
}): PublishActionablePostPreview {
  const kind = input.kind || "text";
  const structure = [
    input.title.trim() ? "标题" : "",
    input.body.trim() ? "正文" : "",
    input.imageUrls.length ? `图片 x${input.imageUrls.length}` : "",
    input.locationArea ? `地点：${input.locationArea}` : "",
    input.tag ? `标签：${input.tag}` : "",
    input.identityTag ? `身份：${input.identityTag}` : "",
    input.event?.startsAt || input.event?.joinPolicy
      ? `活动：${[input.event.startsAt, input.event.joinPolicy].filter(Boolean).join(" · ")}`
      : "",
    input.merchant?.input.name ? `商家：${input.merchant.input.name}` : "",
    input.trade?.input.price || input.trade?.input.category
      ? `交易：${input.trade.input.price || input.trade.input.category}`
      : "",
  ].filter(Boolean);
  const action =
    kind === "event"
      ? "报名"
      : kind === "merchant"
        ? "联系商家"
        : kind === "trade"
          ? "发起交易"
          : kind === "help"
            ? "提供帮助"
            : kind === "place"
              ? "查看地点"
              : "查看详情";
  return {
    kind,
    action,
    structure,
    components: input.components.map((component) => ({
      kind: component.kind,
      label: component.label,
    })),
  };
}

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
  actionablePreview?: Ref<PublishActionablePostPreview | null>;
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
  /**
   * PRD V0.2 §4.3 — the LLM `inferredKind` hint sink. Optional so existing
   * call sites that don't wire the hint don't error; when omitted the
   * inference falls back to the deterministic chain in `inferKind.ts`.
   * Wired by `PublishView` from `usePublishDraft.llmInferredKind`.
   */
  llmInferredKind?: Ref<InferredKind | null>;
  titleCandidate?: Ref<string | null>;
  bodyCandidate?: Ref<string | null>;
  suggestedComponents?: Ref<SuggestedComponent[]>;
  merchantPayload?: () => { input: MerchantPublishInput; contentType: MerchantContentType };
  merchantVerified?: Ref<boolean>;
  tradePayload?: () => { input: TradePublishInput; contentType: TradeContentType };
  tradeVerified?: Ref<boolean>;
  /** Deterministic override for behavior tests; production uses a random UUID. */
  createIdempotencyKey?: () => string;
}) {
  let activeAiPublishIdempotencyKey = "";
  let activeAiPublishPayloadSnapshot: PublishPayload | null = null;
  let activeAiPublishHasPartialResult = false;
  const postDetailUrl = computed(() => {
    const tid = options.lastTid.value;
    if (!tid) return "";
    return `#/post/${tid}`;
  });

  function placeNameFromResponse(response: { place?: { name?: string } | null }): string {
    return response.place?.name || "";
  }

  function publishPayloadMatchesActiveAttempt(payload: PublishPayload): boolean {
    return (
      activeAiPublishPayloadSnapshot !== null &&
      JSON.stringify(activeAiPublishPayloadSnapshot) === JSON.stringify(payload)
    );
  }

  function snapshotPublishPayload(payload: PublishPayload): PublishPayload {
    return JSON.parse(JSON.stringify(payload)) as PublishPayload;
  }

  function idempotencyKeyForPayload(payload: PublishPayload): {
    idempotencyKey: string;
    startedNewAttempt: boolean;
  } {
    const startedNewAttempt =
      activeAiPublishPayloadSnapshot !== null && !publishPayloadMatchesActiveAttempt(payload);
    if (startedNewAttempt) {
      resetPublishAttempt();
    }
    if (!activeAiPublishIdempotencyKey) {
      activeAiPublishIdempotencyKey = (
        options.createIdempotencyKey || createPublishIdempotencyKey
      )();
      activeAiPublishPayloadSnapshot = snapshotPublishPayload(payload);
    }
    return { idempotencyKey: activeAiPublishIdempotencyKey, startedNewAttempt };
  }

  function resetPublishAttempt() {
    activeAiPublishIdempotencyKey = "";
    activeAiPublishPayloadSnapshot = null;
    activeAiPublishHasPartialResult = false;
  }

  function clearPublishResult() {
    options.successMessage.value = "";
    if (options.actionablePreview) {
      options.actionablePreview.value = null;
    }
    options.lastTid.value = null;
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
    const eventDraftContext = buildPublishPayload({
      imageUrls: options.uploadedImageUrls.value,
      title: options.title.value,
      body: options.body.value,
      tag: options.normalizedTag.value,
      identityTag: options.normalizedIdentityTag.value,
      placeName: options.placeName.value,
      visibility: options.visibility.value,
      aliasId: options.aliasId.value,
      locationDraft: options.selectedLocationDraft.value,
      audience,
      event: {
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
        joinPolicy: options.eventJoinPolicy?.value || "open",
        participantScope: audience,
      },
      candidates: {
        title: options.titleCandidate?.value ?? null,
        bodyCandidate: options.bodyCandidate?.value ?? null,
        inferredKind: options.llmInferredKind?.value ?? null,
        suggestedComponents: options.suggestedComponents?.value ?? [],
      },
      kind: inferKind({
        publishKind: options.publishKind?.value ?? "regular",
        hasLocation: Boolean(
          options.selectedLocationDraft.value || options.placeName.value.trim().length > 0,
        ),
        hasImage: options.uploadedImageUrls.value.length > 0,
        hasBody: options.body.value.trim().length > 0,
        tag: options.normalizedTag.value,
        llmInferredKind: options.llmInferredKind?.value ?? null,
      }),
    });
    try {
      const response = await createEvent({
        title: options.title.value,
        body: options.body.value,
        participantScope: audience,
        joinPolicy: options.eventJoinPolicy?.value || "open",
        draftContext: eventDraftContext,
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
      });
      const submittedActionablePreview = createPublishActionablePostPreview({
        kind: "event",
        title: options.title.value,
        body: options.body.value,
        tag: options.normalizedTag.value,
        identityTag: options.normalizedIdentityTag.value,
        imageUrls: options.uploadedImageUrls.value,
        locationArea: options.locationPreviewLabel.value,
        components: options.suggestedComponents?.value ?? [],
        event: { startsAt, joinPolicy: options.eventJoinPolicy?.value || "open" },
      });
      options.lastTid.value = response.tid || null;
      options.successMessage.value = PUBLISH_EVENT_SUCCESS;
      hapticSuccess();
      options.resetForm();
      if (options.actionablePreview) {
        options.actionablePreview.value = submittedActionablePreview;
      }
    } catch (error) {
      const message = resolveWriteActionErrorMessage("publish", error);
      options.errorMessage.value = isWriteActionGenericFallback("publish", message)
        ? PUBLISH_EVENT_UNAVAILABLE
        : message;
      hapticError();
    }
  }

  async function submitPublish() {
    const validation =
      options.validate() ||
      validateEventFields() ||
      validateMerchantFields() ||
      validateTradeFields();
    options.errorMessage.value = validation;
    if (!activeAiPublishHasPartialResult) {
      clearPublishResult();
    }
    if (validation || options.publishing.value) return;

    options.publishing.value = true;
    try {
      if (options.postType?.value === "event") {
        if (activeAiPublishHasPartialResult) {
          resetPublishAttempt();
          clearPublishResult();
        }
        await submitEvent();
        return;
      }
      const submittedPublishKind = options.publishKind?.value ?? "regular";
      const merchant =
        submittedPublishKind === "merchant" && options.merchantPayload
          ? options.merchantPayload()
          : undefined;
      const trade =
        submittedPublishKind === "trade" && options.tradePayload
          ? options.tradePayload()
          : undefined;
      const publishedLocationLabel = options.locationPreviewLabel.value;
      // PRD V0.2 step F (§2.2) — derive the wire `kind` tag from the draft
      // snapshot. The 4-radio is gone, so this is the only path that picks
      // a kind for the post; backend still branches on the value rather
      // than re-inferring server-side.
      const kind = inferKind({
        publishKind: submittedPublishKind,
        hasLocation: Boolean(
          options.selectedLocationDraft.value || options.placeName.value.trim().length > 0,
        ),
        hasImage: options.uploadedImageUrls.value.length > 0,
        hasBody: options.body.value.trim().length > 0,
        tag: options.normalizedTag.value,
        // PRD §4.3 — feed the LLM `inferredKind` hint into the chain.
        // Optional ref; when unwired or null the deterministic chain
        // remains unchanged.
        llmInferredKind: options.llmInferredKind?.value ?? null,
      });
      const publishPayload = buildPublishPayload({
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
        candidates: {
          title: options.titleCandidate?.value ?? null,
          bodyCandidate: options.bodyCandidate?.value ?? null,
          inferredKind: options.llmInferredKind?.value ?? null,
          suggestedComponents: options.suggestedComponents?.value ?? [],
        },
        ...(merchant ? { merchant } : {}),
        ...(trade ? { trade } : {}),
      });
      const { idempotencyKey, startedNewAttempt } = idempotencyKeyForPayload(publishPayload);
      if (startedNewAttempt) {
        clearPublishResult();
      }
      const payload = {
        ...publishPayload,
        idempotencyKey,
      };
      const response = await publishPost(payload);
      const submittedActionablePreview = createPublishActionablePostPreview({
        kind,
        title: options.title.value,
        body: options.body.value,
        tag: payload.tag,
        identityTag: payload.identityTag,
        imageUrls: payload.imageUrls,
        locationArea: payload.metadata.locationArea || "",
        components: options.suggestedComponents?.value ?? [],
        ...(merchant ? { merchant } : {}),
        ...(trade ? { trade } : {}),
      });
      options.lastTid.value = response.tid || null;
      const boundPlaceName = placeNameFromResponse(response) || publishedLocationLabel;
      const metadataPending =
        response.partial === true || response.status === "published_metadata_pending";
      const metadataRetryAvailable = metadataPending && response.recoverable === true;
      options.successMessage.value = metadataPending
        ? metadataRetryAvailable
          ? PUBLISH_SUCCESS_METADATA_RETRY
          : PUBLISH_SUCCESS_METADATA_PENDING
        : boundPlaceName && boundPlaceName !== PUBLISH_LOCATION_UNBOUND
          ? PUBLISH_SUCCESS_BOUND.replace("{n}", boundPlaceName)
          : PUBLISH_SUCCESS;
      hapticSuccess();
      if (metadataRetryAvailable) {
        activeAiPublishHasPartialResult = true;
      } else {
        resetPublishAttempt();
        options.resetForm();
      }
      if (options.actionablePreview) {
        options.actionablePreview.value = submittedActionablePreview;
      }
    } catch (error) {
      options.errorMessage.value = resolveWriteActionErrorMessage("publish", error);
      hapticError();
    } finally {
      options.publishing.value = false;
    }
  }

  return { postDetailUrl, resetPublishAttempt, submitPublish };
}
