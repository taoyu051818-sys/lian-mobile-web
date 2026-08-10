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
import { createEvent, type CreateEventInput } from "../../api/events";
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

function cloneJsonValue<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function freezeJsonValue<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    freezeJsonValue(nested);
  }
  return Object.freeze(value);
}

function cloneAndFreezeJson<T>(value: T): T {
  return freezeJsonValue(cloneJsonValue(value));
}

interface CapturedPublishDraft {
  title: string;
  body: string;
  tagInput: string;
  identityTag: string;
  normalizedTag: string;
  normalizedIdentityTag: string;
  placeName: string;
  visibility: PublishVisibility;
  aliasId?: string;
  uploadedImageUrls: string[];
  uploading: boolean;
  selectedLocationDraft: PublishLocationDraft | null;
  locationPreviewLabel: string;
  postType: PublishPostType;
  eventStartAt: string;
  eventEndAt: string;
  eventCapacity: string;
  eventJoinPolicy: EventJoinPolicy;
  audienceVisibility: PublishVisibility;
  publishKind: PublishKind;
  llmInferredKind: InferredKind | null;
  titleCandidate: string | null;
  bodyCandidate: string | null;
  suggestedComponents: SuggestedComponent[];
  merchant?: { input: MerchantPublishInput; contentType: MerchantContentType };
  trade?: { input: TradePublishInput; contentType: TradeContentType };
  draftOwnership: unknown;
}

interface PostSubmitSnapshot {
  route: "post";
  fingerprint: string;
  request: PublishPayload;
  preview: PublishActionablePostPreview;
  locationFallback: string;
  draftOwnership: unknown;
}

interface EventSubmitSnapshot {
  route: "event";
  fingerprint: string;
  request: CreateEventInput;
  preview: PublishActionablePostPreview;
  locationFallback: string;
  draftOwnership: unknown;
}

type SubmitSnapshot = PostSubmitSnapshot | EventSubmitSnapshot;

interface ActiveSubmitRequest {
  generation: number;
  ticket: number;
  snapshot: SubmitSnapshot;
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
  /** Exact JSON-safe projection of the raw form state cleared by resetForm. */
  draftOwnership?: () => unknown;
}) {
  let activeAiPublishIdempotencyKey = "";
  let activeAiPublishPayloadSnapshot: PublishPayload | null = null;
  let activeAiPublishHasPartialResult = false;
  let responseGeneration = 0;
  let nextSubmitTicket = 0;
  let activeSubmitRequest: ActiveSubmitRequest | null = null;
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

  function clearLogicalPublishAttempt() {
    activeAiPublishIdempotencyKey = "";
    activeAiPublishPayloadSnapshot = null;
    activeAiPublishHasPartialResult = false;
  }

  function resetPublishAttempt() {
    clearLogicalPublishAttempt();
    responseGeneration += 1;
    activeSubmitRequest = null;
    options.publishing.value = false;
  }

  function beginSubmitRequest(snapshot: SubmitSnapshot): ActiveSubmitRequest {
    const request: ActiveSubmitRequest = {
      generation: responseGeneration,
      ticket: (nextSubmitTicket += 1),
      snapshot,
    };
    activeSubmitRequest = request;
    options.publishing.value = true;
    return request;
  }

  function ownsSubmitRequest(request: ActiveSubmitRequest): boolean {
    return activeSubmitRequest === request && request.generation === responseGeneration;
  }

  function finishSubmitRequest(request: ActiveSubmitRequest) {
    if (!ownsSubmitRequest(request)) return;
    activeSubmitRequest = null;
    options.publishing.value = false;
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

  function captureDraft(): CapturedPublishDraft {
    const publishKind = options.publishKind?.value ?? "regular";
    const uploadedImageUrls = cloneJsonValue(options.uploadedImageUrls.value);
    const selectedLocationDraft = cloneJsonValue(options.selectedLocationDraft.value);
    const suggestedComponents = cloneJsonValue(options.suggestedComponents?.value ?? []);
    const merchant =
      publishKind === "merchant" && options.merchantPayload
        ? cloneJsonValue(options.merchantPayload())
        : undefined;
    const trade =
      publishKind === "trade" && options.tradePayload
        ? cloneJsonValue(options.tradePayload())
        : undefined;
    const fallbackOwnership = {
      title: options.title.value,
      body: options.body.value,
      tagInput: options.tagInput.value,
      identityTag: options.identityTag.value,
      placeName: options.placeName.value,
      visibility: options.visibility.value,
      aliasId: options.aliasId.value,
      uploadedImageUrls,
      uploading: options.uploading.value,
      selectedLocationDraft,
      locationPreviewLabel: options.locationPreviewLabel.value,
      postType: options.postType?.value ?? "post",
      eventStartAt: options.eventStartAt?.value ?? "",
      eventEndAt: options.eventEndAt?.value ?? "",
      eventCapacity: options.eventCapacity?.value ?? "",
      eventJoinPolicy: options.eventJoinPolicy?.value ?? "open",
      audienceVisibility: options.audienceVisibility?.value ?? options.visibility.value,
      publishKind,
      llmInferredKind: options.llmInferredKind?.value ?? null,
      titleCandidate: options.titleCandidate?.value ?? null,
      bodyCandidate: options.bodyCandidate?.value ?? null,
      suggestedComponents,
      merchant,
      trade,
    };

    return cloneAndFreezeJson({
      title: options.title.value,
      body: options.body.value,
      tagInput: options.tagInput.value,
      identityTag: options.identityTag.value,
      normalizedTag: options.normalizedTag.value,
      normalizedIdentityTag: options.normalizedIdentityTag.value,
      placeName: options.placeName.value,
      visibility: options.visibility.value,
      aliasId: options.aliasId.value,
      uploadedImageUrls,
      uploading: options.uploading.value,
      selectedLocationDraft,
      locationPreviewLabel: options.locationPreviewLabel.value,
      postType: options.postType?.value ?? "post",
      eventStartAt: options.eventStartAt?.value ?? "",
      eventEndAt: options.eventEndAt?.value ?? "",
      eventCapacity: options.eventCapacity?.value ?? "",
      eventJoinPolicy: options.eventJoinPolicy?.value ?? "open",
      audienceVisibility: options.audienceVisibility?.value ?? options.visibility.value,
      publishKind,
      llmInferredKind: options.llmInferredKind?.value ?? null,
      titleCandidate: options.titleCandidate?.value ?? null,
      bodyCandidate: options.bodyCandidate?.value ?? null,
      suggestedComponents,
      merchant,
      trade,
      draftOwnership: options.draftOwnership?.() ?? fallbackOwnership,
    });
  }

  function fingerprintFor(input: {
    route: "post" | "event";
    request: PublishPayload | CreateEventInput;
    locationFallback: string;
    draftOwnership: unknown;
  }): string {
    return JSON.stringify({
      route: input.route,
      request: input.request,
      locationFallback: input.locationFallback,
      draftOwnership: input.draftOwnership,
    });
  }

  function capturePostSnapshotBase(draft = captureDraft()): PostSubmitSnapshot {
    const kind = inferKind({
      publishKind: draft.publishKind,
      hasLocation: Boolean(draft.selectedLocationDraft || draft.placeName.trim().length > 0),
      hasImage: draft.uploadedImageUrls.length > 0,
      hasBody: draft.body.trim().length > 0,
      tag: draft.normalizedTag,
      llmInferredKind: draft.llmInferredKind,
    });
    const request = cloneAndFreezeJson(
      buildPublishPayload({
        imageUrls: draft.uploadedImageUrls,
        title: draft.title,
        body: draft.body,
        tag: draft.normalizedTag,
        identityTag: draft.normalizedIdentityTag,
        placeName: draft.placeName,
        visibility: draft.visibility,
        aliasId: draft.aliasId,
        locationDraft: draft.selectedLocationDraft,
        kind,
        candidates: {
          title: draft.titleCandidate,
          bodyCandidate: draft.bodyCandidate,
          inferredKind: draft.llmInferredKind,
          suggestedComponents: draft.suggestedComponents,
        },
        ...(draft.merchant ? { merchant: draft.merchant } : {}),
        ...(draft.trade ? { trade: draft.trade } : {}),
      }),
    );
    const preview = cloneAndFreezeJson(
      createPublishActionablePostPreview({
        kind,
        title: draft.title,
        body: draft.body,
        tag: request.tag,
        identityTag: request.identityTag,
        imageUrls: request.imageUrls,
        locationArea: request.metadata.locationArea || "",
        components: draft.suggestedComponents,
        ...(draft.merchant ? { merchant: draft.merchant } : {}),
        ...(draft.trade ? { trade: draft.trade } : {}),
      }),
    );
    const locationFallback = draft.locationPreviewLabel;
    return {
      route: "post",
      fingerprint: fingerprintFor({
        route: "post",
        request,
        locationFallback,
        draftOwnership: draft.draftOwnership,
      }),
      request,
      preview,
      locationFallback,
      draftOwnership: draft.draftOwnership,
    };
  }

  function captureEventSnapshot(draft = captureDraft()): EventSubmitSnapshot {
    const cap = parseCapacityInput(draft.eventCapacity);
    const capacity = cap.ok ? cap.capacity : undefined;
    const startsAt = draft.eventStartAt.trim();
    const endsAt = draft.eventEndAt.trim();
    const audience = normalizeAudience({
      visibility: draft.audienceVisibility,
    });
    const eventDraftContext = buildPublishPayload({
      imageUrls: draft.uploadedImageUrls,
      title: draft.title,
      body: draft.body,
      tag: draft.normalizedTag,
      identityTag: draft.normalizedIdentityTag,
      placeName: draft.placeName,
      visibility: draft.visibility,
      aliasId: draft.aliasId,
      locationDraft: draft.selectedLocationDraft,
      audience,
      event: {
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
        joinPolicy: draft.eventJoinPolicy,
        participantScope: audience,
      },
      candidates: {
        title: draft.titleCandidate,
        bodyCandidate: draft.bodyCandidate,
        inferredKind: draft.llmInferredKind,
        suggestedComponents: draft.suggestedComponents,
      },
      kind: inferKind({
        publishKind: draft.publishKind,
        hasLocation: Boolean(draft.selectedLocationDraft || draft.placeName.trim().length > 0),
        hasImage: draft.uploadedImageUrls.length > 0,
        hasBody: draft.body.trim().length > 0,
        tag: draft.normalizedTag,
        llmInferredKind: draft.llmInferredKind,
      }),
    });
    const request = cloneAndFreezeJson<CreateEventInput>({
      title: draft.title,
      body: draft.body,
      participantScope: audience,
      joinPolicy: draft.eventJoinPolicy,
      draftContext: eventDraftContext,
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt ? { endsAt } : {}),
      ...(capacity !== undefined ? { capacity } : {}),
    });
    const submittedActionablePreview = cloneAndFreezeJson(
      createPublishActionablePostPreview({
        kind: "event",
        title: draft.title,
        body: draft.body,
        tag: draft.normalizedTag,
        identityTag: draft.normalizedIdentityTag,
        imageUrls: draft.uploadedImageUrls,
        locationArea: draft.locationPreviewLabel,
        components: draft.suggestedComponents,
        event: { startsAt, joinPolicy: draft.eventJoinPolicy },
      }),
    );
    const locationFallback = draft.locationPreviewLabel;
    return {
      route: "event",
      fingerprint: fingerprintFor({
        route: "event",
        request,
        locationFallback,
        draftOwnership: draft.draftOwnership,
      }),
      request,
      preview: submittedActionablePreview,
      locationFallback,
      draftOwnership: draft.draftOwnership,
    };
  }

  function captureCurrentFingerprint(): string {
    const draft = captureDraft();
    return draft.postType === "event"
      ? captureEventSnapshot(draft).fingerprint
      : capturePostSnapshotBase(draft).fingerprint;
  }

  function currentDraftMatches(request: ActiveSubmitRequest): boolean {
    try {
      return captureCurrentFingerprint() === request.snapshot.fingerprint;
    } catch {
      return false;
    }
  }

  function idempotencyKeyForPayload(payload: PublishPayload): {
    idempotencyKey: string;
    startedNewAttempt: boolean;
  } {
    const startedNewAttempt =
      activeAiPublishPayloadSnapshot !== null && !publishPayloadMatchesActiveAttempt(payload);
    if (startedNewAttempt) {
      clearLogicalPublishAttempt();
    }
    if (!activeAiPublishIdempotencyKey) {
      activeAiPublishIdempotencyKey = (
        options.createIdempotencyKey || createPublishIdempotencyKey
      )();
      activeAiPublishPayloadSnapshot = cloneAndFreezeJson(payload);
    }
    return { idempotencyKey: activeAiPublishIdempotencyKey, startedNewAttempt };
  }

  async function submitEvent() {
    const snapshot = captureEventSnapshot();
    const submittedActionablePreview = snapshot.preview;
    const request = beginSubmitRequest(snapshot);
    try {
      const response = await createEvent(snapshot.request);
      if (!ownsSubmitRequest(request)) return;
      const unchanged = currentDraftMatches(request);
      options.lastTid.value = response.tid || null;
      options.successMessage.value = PUBLISH_EVENT_SUCCESS;
      hapticSuccess();
      if (unchanged) options.resetForm();
      if (options.actionablePreview) {
        options.actionablePreview.value = submittedActionablePreview;
      }
    } catch (error) {
      if (!ownsSubmitRequest(request)) return;
      const message = resolveWriteActionErrorMessage("publish", error);
      options.errorMessage.value = isWriteActionGenericFallback("publish", message)
        ? PUBLISH_EVENT_UNAVAILABLE
        : message;
      hapticError();
    } finally {
      finishSubmitRequest(request);
    }
  }

  async function submitPublish() {
    if (options.publishing.value || activeSubmitRequest) return;
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

    if (options.postType?.value === "event") {
      if (activeAiPublishHasPartialResult) clearPublishResult();
      clearLogicalPublishAttempt();
      await submitEvent();
      return;
    }

    const baseSnapshot = capturePostSnapshotBase();
    const { idempotencyKey, startedNewAttempt } = idempotencyKeyForPayload(baseSnapshot.request);
    if (startedNewAttempt) clearPublishResult();
    const snapshot: PostSubmitSnapshot = {
      ...baseSnapshot,
      request: cloneAndFreezeJson({ ...baseSnapshot.request, idempotencyKey }),
    };
    const submittedActionablePreview = snapshot.preview;
    const request = beginSubmitRequest(snapshot);
    try {
      const response = await publishPost(snapshot.request);
      if (!ownsSubmitRequest(request)) return;
      const unchanged = currentDraftMatches(request);
      options.lastTid.value = response.tid || null;
      const boundPlaceName = placeNameFromResponse(response) || snapshot.locationFallback;
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
        clearLogicalPublishAttempt();
        if (unchanged) options.resetForm();
      }
      if (options.actionablePreview) {
        options.actionablePreview.value = submittedActionablePreview;
      }
    } catch (error) {
      if (!ownsSubmitRequest(request)) return;
      options.errorMessage.value = resolveWriteActionErrorMessage("publish", error);
      hapticError();
    } finally {
      finishSubmitRequest(request);
    }
  }

  return { postDetailUrl, resetPublishAttempt, submitPublish };
}
