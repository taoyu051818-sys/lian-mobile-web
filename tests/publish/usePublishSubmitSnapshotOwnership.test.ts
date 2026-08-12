import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { createEvent } from "../../src/api/events";
import { createMapV2LocationDraft, publishPost } from "../../src/api/publish";
import { hapticError, hapticSuccess } from "../../src/composables/useHapticFeedback";
import type { PublishPostType } from "../../src/composables/useEventPublishDraft";
import { usePublishSubmit } from "../../src/features/publish/usePublishSubmit";
import type { PublishKind } from "../../src/features/publish/usePublishDraft";
import type { EventJoinPolicy } from "../../src/types/post-extensions";
import type {
  MerchantPublishInput,
  PublishActionablePostPreview,
  PublishLocationDraft,
  PublishVisibility,
  TradePublishInput,
} from "../../src/types/publish";
import type { InferredKind, SuggestedComponent } from "../../src/types/publishSuggestion";

vi.mock("../../src/api/publish", async () => {
  const actual =
    await vi.importActual<typeof import("../../src/api/publish")>("../../src/api/publish");
  return {
    ...actual,
    publishPost: vi.fn(),
  };
});

vi.mock("../../src/api/events", async () => {
  const actual =
    await vi.importActual<typeof import("../../src/api/events")>("../../src/api/events");
  return {
    ...actual,
    createEvent: vi.fn(),
  };
});

vi.mock("../../src/composables/useHapticFeedback", () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

const published = (tid: number) => ({ ok: true, status: "published" as const, tid });

function createRegularHarness(kind: PublishKind = "merchant") {
  let nextKey = 0;
  const title = ref("A title");
  const body = ref("A body");
  const tagInput = ref("campus-a");
  const identityTag = ref("identity-a");
  const placeName = ref("A Library");
  const visibility = ref<PublishVisibility>("campus");
  const aliasId = ref<string | undefined>("alias-a");
  const uploadedImageUrls = ref(["https://cdn.test/a.png"]);
  const selectedFileCount = ref(1);
  const localPreviewUrls = ref(["blob:preview-a"]);
  const uploading = ref(false);
  const publishing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const actionablePreview = ref<PublishActionablePostPreview | null>(null);
  const lastTid = ref<string | number | null>(null);
  const normalizedTag = ref("#campus-a");
  const normalizedIdentityTag = ref("identity-a");
  const selectedLocationDraft = ref<PublishLocationDraft | null>(
    createMapV2LocationDraft({
      locationId: "location-a",
      name: "A Library",
      lat: 31.2304,
      lng: 121.4737,
    }),
  );
  const locationPreviewLabel = ref("A Library");
  const publishKind = ref<PublishKind>(kind);
  const postType = ref<PublishPostType>("post");
  const eventStartAt = ref("2026-08-20T09:00");
  const eventEndAt = ref("2026-08-20T10:00");
  const eventCapacity = ref("24");
  const eventJoinPolicy = ref<EventJoinPolicy>("approval_required");
  const llmInferredKind = ref<InferredKind | null>(kind === "trade" ? "trade" : "merchant");
  const titleCandidate = ref<string | null>("A candidate title");
  const bodyCandidate = ref<string | null>("A candidate body");
  const suggestedComponents = ref<SuggestedComponent[]>([
    {
      kind: kind === "trade" ? "trade" : "merchant",
      payload: { owner: "A" },
      label: "A component",
    },
  ]);
  const merchantSource: { input: MerchantPublishInput; contentType: "merchant_food" } = {
    input: {
      name: "A Merchant",
      category: "food",
      hours: "09:00-18:00",
      contact: "merchant-a",
      errandSupported: true,
    },
    contentType: "merchant_food",
  };
  const tradeSource: { input: TradePublishInput; contentType: "trade" } = {
    input: {
      price: "88",
      state: "available",
      category: "A category",
    },
    contentType: "trade",
  };
  const validate = vi.fn(() => "");
  const resetForm = vi.fn();
  const createIdempotencyKey = vi.fn(
    () => ["publish-key-a", "publish-key-b", "publish-key-c"][nextKey++] || `key-${nextKey}`,
  );
  const draftOwnership = () => ({
    title: title.value,
    body: body.value,
    tagInput: tagInput.value,
    identityTag: identityTag.value,
    placeName: placeName.value,
    visibility: visibility.value,
    aliasId: aliasId.value,
    publishKind: publishKind.value,
    llmInferredKind: llmInferredKind.value,
    titleCandidate: titleCandidate.value,
    bodyCandidate: bodyCandidate.value,
    suggestedComponents: suggestedComponents.value,
    selectedLocationDraft: selectedLocationDraft.value,
    locationPreviewLabel: locationPreviewLabel.value,
    postType: postType.value,
    eventStartAt: eventStartAt.value,
    eventEndAt: eventEndAt.value,
    eventCapacity: eventCapacity.value,
    eventJoinPolicy: eventJoinPolicy.value,
    merchant: merchantSource.input,
    trade: tradeSource.input,
    selectedFileCount: selectedFileCount.value,
    localPreviewUrls: localPreviewUrls.value,
    uploadedImageUrls: uploadedImageUrls.value,
    uploading: uploading.value,
  });

  const submit = usePublishSubmit({
    title,
    body,
    tagInput,
    identityTag,
    placeName,
    visibility,
    aliasId,
    uploadedImageUrls,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    actionablePreview,
    lastTid,
    normalizedTag,
    normalizedIdentityTag,
    selectedLocationDraft,
    locationPreviewLabel,
    validate,
    resetForm,
    postType,
    eventStartAt,
    eventEndAt,
    eventCapacity,
    eventJoinPolicy,
    audienceVisibility: visibility,
    publishKind,
    llmInferredKind,
    titleCandidate,
    bodyCandidate,
    suggestedComponents,
    merchantPayload: () => merchantSource,
    merchantVerified: ref(true),
    tradePayload: () => tradeSource,
    tradeVerified: ref(true),
    createIdempotencyKey,
    draftOwnership,
  });

  return {
    ...submit,
    title,
    body,
    tagInput,
    identityTag,
    placeName,
    visibility,
    aliasId,
    uploadedImageUrls,
    selectedFileCount,
    localPreviewUrls,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    actionablePreview,
    lastTid,
    normalizedTag,
    normalizedIdentityTag,
    selectedLocationDraft,
    locationPreviewLabel,
    publishKind,
    postType,
    eventStartAt,
    eventEndAt,
    eventCapacity,
    eventJoinPolicy,
    llmInferredKind,
    titleCandidate,
    bodyCandidate,
    suggestedComponents,
    merchantSource,
    tradeSource,
    validate,
    resetForm,
    createIdempotencyKey,
    draftOwnership,
  };
}

type RegularHarness = ReturnType<typeof createRegularHarness>;

function mutateToB(harness: RegularHarness, options: { emptyText?: boolean } = {}) {
  harness.title.value = options.emptyText ? "" : "B title";
  harness.body.value = options.emptyText ? "" : "B body";
  harness.tagInput.value = "campus-b";
  harness.identityTag.value = "identity-b";
  harness.placeName.value = "B Harbor";
  harness.visibility.value = "private";
  harness.aliasId.value = "alias-b";
  harness.uploadedImageUrls.value.splice(
    0,
    harness.uploadedImageUrls.value.length,
    "https://cdn.test/b.png",
  );
  harness.localPreviewUrls.value.splice(0, harness.localPreviewUrls.value.length, "blob:preview-b");
  harness.normalizedTag.value = "#campus-b";
  harness.normalizedIdentityTag.value = "identity-b";
  if (harness.selectedLocationDraft.value) {
    harness.selectedLocationDraft.value.locationId = "location-b";
    harness.selectedLocationDraft.value.locationArea = "B Harbor";
    harness.selectedLocationDraft.value.displayName = "B Harbor";
    harness.selectedLocationDraft.value.lat = 22.5431;
    harness.selectedLocationDraft.value.lng = 114.0579;
  }
  harness.locationPreviewLabel.value = "B Harbor";
  harness.llmInferredKind.value = harness.publishKind.value === "trade" ? "trade" : "merchant";
  harness.titleCandidate.value = "B candidate title";
  harness.bodyCandidate.value = "B candidate body";
  const component = harness.suggestedComponents.value[0];
  if (component) {
    component.label = "B component";
    component.payload.owner = "B";
  }
  harness.merchantSource.input.name = "B Merchant";
  harness.merchantSource.input.contact = "merchant-b";
  harness.tradeSource.input.price = "188";
  harness.tradeSource.input.category = "B category";
}

beforeEach(() => {
  vi.mocked(publishPost).mockReset();
  vi.mocked(createEvent).mockReset();
  vi.mocked(hapticSuccess).mockReset();
  vi.mocked(hapticError).mockReset();
});

describe("usePublishSubmit immutable regular snapshots", () => {
  it.each(["merchant", "trade"] as const)(
    "keeps a deeply owned %s request and A preview while the editable draft becomes B",
    async (kind) => {
      const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
      vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
      const harness = createRegularHarness(kind);
      const sourceImages = harness.uploadedImageUrls.value;
      const sourceLocation = harness.selectedLocationDraft.value;
      const sourceComponents = harness.suggestedComponents.value;

      const run = harness.submitPublish();
      await flushAsync();
      const request = vi.mocked(publishPost).mock.calls[0]?.[0];
      expect(request).toBeDefined();

      mutateToB(harness, { emptyText: true });
      response.resolve(published(kind === "merchant" ? 301 : 302));
      await run;
      await flushAsync();

      expect(request).toMatchObject({
        title: "A title",
        body: "A body",
        imageUrls: ["https://cdn.test/a.png"],
        tag: "#campus-a",
        identityTag: "identity-a",
        metadata: { locationArea: "A Library", visibility: "campus" },
        candidates: {
          title: "A candidate title",
          bodyCandidate: "A candidate body",
          suggestedComponents: [{ label: "A component", payload: { owner: "A" } }],
        },
      });
      if (kind === "merchant") {
        expect(request?.merchant).toMatchObject({ name: "A Merchant", contact: "merchant-a" });
        expect(request?.merchant).not.toBe(harness.merchantSource.input);
      } else {
        expect(request?.trade).toMatchObject({ price: "88", category: "A category" });
        expect(request?.trade).not.toBe(harness.tradeSource.input);
      }
      expect(request?.imageUrls).not.toBe(sourceImages);
      expect(request?.locationDraft).not.toBe(sourceLocation);
      expect(request?.candidates?.suggestedComponents).not.toBe(sourceComponents);
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request?.imageUrls)).toBe(true);
      expect(Object.isFrozen(request?.metadata)).toBe(true);
      expect(Object.isFrozen(request?.locationDraft)).toBe(true);
      expect(Object.isFrozen(request?.candidates)).toBe(true);
      expect(Object.isFrozen(request?.candidates?.suggestedComponents)).toBe(true);

      expect(harness.lastTid.value).toBe(kind === "merchant" ? 301 : 302);
      expect(harness.successMessage.value).not.toBe("");
      expect(harness.actionablePreview.value?.components).toEqual([{ kind, label: "A component" }]);
      expect(harness.actionablePreview.value?.structure).toHaveLength(7);
      expect(harness.resetForm).not.toHaveBeenCalled();
      expect(harness.title.value).toBe("");
      expect(harness.body.value).toBe("");
      expect(hapticSuccess).toHaveBeenCalledTimes(1);
      expect(hapticError).not.toHaveBeenCalled();
      expect(harness.publishing.value).toBe(false);
    },
  );

  it("commits and resets one unchanged owned success", async () => {
    const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
    const harness = createRegularHarness("merchant");

    const run = harness.submitPublish();
    await flushAsync();
    expect(harness.publishing.value).toBe(true);

    response.resolve(published(311));
    await run;
    await flushAsync();

    expect(harness.lastTid.value).toBe(311);
    expect(harness.successMessage.value).not.toBe("");
    expect(harness.actionablePreview.value?.components).toEqual([
      { kind: "merchant", label: "A component" },
    ]);
    expect(harness.resetForm).toHaveBeenCalledTimes(1);
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
    expect(hapticError).not.toHaveBeenCalled();
    expect(harness.publishing.value).toBe(false);
  });

  it("restores the frozen A preview after production-style reset re-entry abandons its owner", async () => {
    const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
    const harness = createRegularHarness("merchant");
    harness.resetForm.mockImplementation(() => {
      harness.resetPublishAttempt();
      harness.title.value = "";
      harness.body.value = "";
      harness.suggestedComponents.value = [];
      harness.actionablePreview.value = null;
    });

    const run = harness.submitPublish();
    await flushAsync();
    response.resolve(published(313));
    await run;
    await flushAsync();

    expect(harness.resetForm).toHaveBeenCalledTimes(1);
    expect(harness.publishing.value).toBe(false);
    expect(harness.lastTid.value).toBe(313);
    expect(harness.title.value).toBe("");
    expect(harness.body.value).toBe("");
    expect(harness.actionablePreview.value?.components).toEqual([
      { kind: "merchant", label: "A component" },
    ]);
    expect(harness.actionablePreview.value?.structure).toContain("商家：A Merchant");
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
    expect(hapticError).not.toHaveBeenCalled();
  });

  it.each([
    { arm: "pending", uploading: true, uploadedUrls: [] as string[] },
    { arm: "success", uploading: false, uploadedUrls: ["https://cdn.test/b.png"] },
    { arm: "failure", uploading: false, uploadedUrls: [] as string[] },
  ])("preserves a B image in the $arm arm instead of letting A reset it", async (state) => {
    const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
    const harness = createRegularHarness("regular");
    harness.uploadedImageUrls.value = [];
    harness.selectedFileCount.value = 0;
    harness.localPreviewUrls.value = [];

    const run = harness.submitPublish();
    await flushAsync();
    harness.selectedFileCount.value = 1;
    harness.localPreviewUrls.value = [`blob:preview-b-${state.arm}`];
    harness.uploading.value = state.uploading;
    harness.uploadedImageUrls.value = [...state.uploadedUrls];

    response.resolve(published(312));
    await run;
    await flushAsync();

    expect(harness.lastTid.value).toBe(312);
    expect(harness.successMessage.value).not.toBe("");
    expect(harness.resetForm).not.toHaveBeenCalled();
    expect(harness.selectedFileCount.value).toBe(1);
    expect(harness.localPreviewUrls.value).toEqual([`blob:preview-b-${state.arm}`]);
    expect(harness.uploadedImageUrls.value).toEqual(state.uploadedUrls);
    expect(harness.uploading.value).toBe(state.uploading);
    expect(harness.publishing.value).toBe(false);
  });
});

describe("usePublishSubmit physical request ownership", () => {
  it.each(["a-first", "b-first"] as const)(
    "keeps B authoritative when reset starts B and responses settle %s",
    async (settleOrder) => {
      const responseA = deferred<Awaited<ReturnType<typeof publishPost>>>();
      const responseB = deferred<Awaited<ReturnType<typeof publishPost>>>();
      vi.mocked(publishPost)
        .mockImplementationOnce(() => responseA.promise)
        .mockImplementationOnce(() => responseB.promise);
      const harness = createRegularHarness("merchant");

      const runA = harness.submitPublish();
      await flushAsync();
      harness.resetPublishAttempt();
      mutateToB(harness);
      const runB = harness.submitPublish();
      await flushAsync();

      const bStarted = vi.mocked(publishPost).mock.calls.length === 2;
      if (!bStarted) {
        responseA.resolve(published(401));
        await Promise.all([runA, runB]);
        expect(vi.mocked(publishPost)).toHaveBeenCalledTimes(2);
        return;
      }

      expect(harness.publishing.value).toBe(true);
      expect(vi.mocked(publishPost).mock.calls.map(([payload]) => payload.idempotencyKey)).toEqual([
        "publish-key-a",
        "publish-key-b",
      ]);

      if (settleOrder === "a-first") {
        responseA.resolve(published(401));
        await runA;
        await flushAsync();
        expect(harness.lastTid.value).toBeNull();
        expect(harness.successMessage.value).toBe("");
        expect(harness.actionablePreview.value).toBeNull();
        expect(harness.resetForm).not.toHaveBeenCalled();
        expect(hapticSuccess).not.toHaveBeenCalled();
        expect(harness.publishing.value).toBe(true);

        responseB.resolve(published(402));
        await runB;
      } else {
        responseB.resolve(published(402));
        await runB;
        expect(harness.lastTid.value).toBe(402);
        expect(harness.publishing.value).toBe(false);

        responseA.resolve(published(401));
        await runA;
      }
      await flushAsync();

      expect(harness.lastTid.value).toBe(402);
      expect(harness.actionablePreview.value?.components).toEqual([
        { kind: "merchant", label: "B component" },
      ]);
      expect(harness.resetForm).toHaveBeenCalledTimes(1);
      expect(hapticSuccess).toHaveBeenCalledTimes(1);
      expect(hapticError).not.toHaveBeenCalled();
      expect(harness.publishing.value).toBe(false);
    },
  );

  it("drops an abandoned failure without error, haptic, reset, or result state", async () => {
    const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
    const harness = createRegularHarness("merchant");

    const run = harness.submitPublish();
    await flushAsync();
    harness.resetPublishAttempt();
    expect(harness.publishing.value).toBe(false);

    response.reject(new TypeError("stale A failed"));
    await run;
    await flushAsync();

    expect(harness.errorMessage.value).toBe("");
    expect(harness.successMessage.value).toBe("");
    expect(harness.lastTid.value).toBeNull();
    expect(harness.actionablePreview.value).toBeNull();
    expect(harness.resetForm).not.toHaveBeenCalled();
    expect(hapticError).not.toHaveBeenCalled();
    expect(hapticSuccess).not.toHaveBeenCalled();
    expect(harness.publishing.value).toBe(false);
  });

  it("drops an abandoned recoverable partial response without resurrecting retry UI", async () => {
    const response = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost).mockImplementationOnce(() => response.promise);
    const harness = createRegularHarness("merchant");

    const run = harness.submitPublish();
    await flushAsync();
    harness.resetPublishAttempt();
    expect(harness.publishing.value).toBe(false);

    response.resolve({
      ok: true,
      status: "published_metadata_pending",
      tid: 421,
      partial: true,
      recoverable: true,
    });
    await run;
    await flushAsync();

    expect(harness.errorMessage.value).toBe("");
    expect(harness.successMessage.value).toBe("");
    expect(harness.lastTid.value).toBeNull();
    expect(harness.actionablePreview.value).toBeNull();
    expect(harness.resetForm).not.toHaveBeenCalled();
    expect(hapticSuccess).not.toHaveBeenCalled();
    expect(hapticError).not.toHaveBeenCalled();
    expect(harness.publishing.value).toBe(false);
  });

  it("converts a recoverable regular attempt into an owned Event request without self-invalidating", async () => {
    const eventResponse = deferred<Awaited<ReturnType<typeof createEvent>>>();
    vi.mocked(publishPost).mockResolvedValueOnce({
      ok: true,
      status: "published_metadata_pending",
      tid: 431,
      partial: true,
      recoverable: true,
    });
    vi.mocked(createEvent).mockImplementationOnce(() => eventResponse.promise);
    const harness = createRegularHarness("regular");

    await harness.submitPublish();
    expect(harness.lastTid.value).toBe(431);
    expect(harness.resetForm).not.toHaveBeenCalled();

    harness.title.value = "B event";
    harness.body.value = "B event body";
    harness.publishKind.value = "event";
    harness.postType.value = "event";
    harness.llmInferredKind.value = "event";
    harness.suggestedComponents.value = [
      { kind: "event", payload: { startsAt: "2026-08-20T09:00" }, label: "B event" },
    ];
    const eventRun = harness.submitPublish();
    await flushAsync();

    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(harness.publishing.value).toBe(true);
    expect(harness.lastTid.value).toBeNull();

    eventResponse.resolve({ eventId: "event-b", tid: 432 });
    await eventRun;
    await flushAsync();

    expect(harness.lastTid.value).toBe(432);
    expect(harness.actionablePreview.value?.kind).toBe("event");
    expect(harness.resetForm).toHaveBeenCalledTimes(1);
    expect(hapticSuccess).toHaveBeenCalledTimes(2);
    expect(hapticError).not.toHaveBeenCalled();
    expect(harness.publishing.value).toBe(false);
  });
});
