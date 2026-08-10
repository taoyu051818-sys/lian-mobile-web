import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, type Ref } from "vue";
import { createEvent } from "../../src/api/events";
import { createMapV2LocationDraft } from "../../src/api/publish";
import { usePublishSubmit } from "../../src/features/publish/usePublishSubmit";
import type {
  PublishActionablePostPreview,
  PublishLocationDraft,
  PublishVisibility,
} from "../../src/types/publish";
import type { EventJoinPolicy } from "../../src/types/post-extensions";
import type { PublishKind } from "../../src/features/publish/usePublishDraft";
import type { PublishPostType } from "../../src/composables/useEventPublishDraft";

vi.mock("../../src/api/events", () => ({
  createEvent: vi.fn(),
}));

vi.mock("../../src/composables/useHapticFeedback", () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

function deferred<T>() {
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

describe("usePublishSubmit event draft context", () => {
  beforeEach(() => {
    vi.mocked(createEvent).mockReset();
    vi.mocked(createEvent).mockResolvedValue({ eventId: "event-1", tid: 971 });
  });

  function submitHarness(
    overrides: Partial<Parameters<typeof usePublishSubmit>[0]> = {},
    ownership: {
      selectedFileCount?: Ref<number>;
      localPreviewUrls?: Ref<string[]>;
    } = {},
  ) {
    const options: Parameters<typeof usePublishSubmit>[0] = {
      title: ref("Coffee meetup"),
      body: ref("Discuss launch notes"),
      tagInput: ref("coffee"),
      identityTag: ref(""),
      placeName: ref("Library"),
      visibility: ref<PublishVisibility>("campus"),
      aliasId: ref("alias-1"),
      uploadedImageUrls: ref(["https://example.test/image.jpg"]),
      uploading: ref(false),
      publishing: ref(false),
      errorMessage: ref(""),
      successMessage: ref(""),
      actionablePreview: ref(null),
      lastTid: ref(null),
      normalizedTag: ref("#coffee"),
      normalizedIdentityTag: ref("organizer"),
      selectedLocationDraft: ref(
        createMapV2LocationDraft({
          locationId: "loc-1",
          name: "Library",
          lat: 31.2304,
          lng: 121.4737,
        }),
      ),
      locationPreviewLabel: ref("Library"),
      validate: () => "",
      resetForm: vi.fn(),
      postType: ref<PublishPostType>("event"),
      eventStartAt: ref("2026-06-12T09:00"),
      eventEndAt: ref("2026-06-12T10:00"),
      eventCapacity: ref("24"),
      eventJoinPolicy: ref<EventJoinPolicy>("approval_required"),
      audienceVisibility: ref<PublishVisibility>("campus"),
      publishKind: ref<PublishKind>("event"),
      llmInferredKind: ref("event"),
      titleCandidate: ref("AI coffee meetup"),
      bodyCandidate: ref("AI-polished launch notes"),
      suggestedComponents: ref([
        {
          kind: "event",
          payload: { startsAt: "2026-06-12T09:00", participantScope: { visibility: "campus" } },
          label: "补充活动结构",
        },
        {
          kind: "time",
          payload: { startsAt: "2026-06-12T09:00", endsAt: "2026-06-12T10:00" },
          label: "加活动时间",
        },
      ]),
      ...overrides,
    };
    const selectedFileCount =
      ownership.selectedFileCount ?? ref(options.uploadedImageUrls.value.length);
    const localPreviewUrls =
      ownership.localPreviewUrls ??
      ref(options.uploadedImageUrls.value.map((_, index) => `blob:${index}`));
    return usePublishSubmit({
      ...options,
      draftOwnership: () => ({
        title: options.title.value,
        body: options.body.value,
        tagInput: options.tagInput.value,
        identityTag: options.identityTag.value,
        placeName: options.placeName.value,
        visibility: options.visibility.value,
        aliasId: options.aliasId.value,
        selectedFileCount: selectedFileCount.value,
        localPreviewUrls: localPreviewUrls.value,
        uploadedImageUrls: options.uploadedImageUrls.value,
        uploading: options.uploading.value,
        selectedLocationDraft: options.selectedLocationDraft.value,
        locationPreviewLabel: options.locationPreviewLabel.value,
        postType: options.postType?.value,
        eventStartAt: options.eventStartAt?.value,
        eventEndAt: options.eventEndAt?.value,
        eventCapacity: options.eventCapacity?.value,
        eventJoinPolicy: options.eventJoinPolicy?.value,
        audienceVisibility: options.audienceVisibility?.value,
        publishKind: options.publishKind?.value,
        llmInferredKind: options.llmInferredKind?.value,
        titleCandidate: options.titleCandidate?.value,
        bodyCandidate: options.bodyCandidate?.value,
        suggestedComponents: options.suggestedComponents?.value,
      }),
    }).submitPublish;
  }

  it("sends the reviewed AI draft context to createEvent", async () => {
    await submitHarness()();

    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createEvent).mock.calls[0]?.[0]).toMatchObject({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      participantScope: { visibility: "campus" },
      joinPolicy: "approval_required",
      startsAt: "2026-06-12T09:00",
      endsAt: "2026-06-12T10:00",
      capacity: 24,
      draftContext: {
        imageUrl: "https://example.test/image.jpg",
        imageUrls: ["https://example.test/image.jpg"],
        title: "Coffee meetup",
        body: "Discuss launch notes",
        tag: "#coffee",
        identityTag: "organizer",
        kind: "image",
        event: {
          startsAt: "2026-06-12T09:00",
          endsAt: "2026-06-12T10:00",
          capacity: 24,
          joinPolicy: "approval_required",
          participantScope: { visibility: "campus" },
        },
        metadata: {
          locationArea: "Library",
          visibility: "campus",
          audience: { visibility: "campus" },
        },
        locationDraft: {
          source: "map_v2",
          locationId: "loc-1",
          displayName: "Library",
          confidence: 0.86,
        },
        riskFlags: [],
        confidence: 0.86,
        needsHumanReview: false,
        aiMode: "manual-vue-map-v2",
        aliasId: "alias-1",
        candidates: {
          title: "AI coffee meetup",
          bodyCandidate: "AI-polished launch notes",
          inferredKind: "event",
          suggestedComponents: [
            {
              kind: "event",
              payload: {
                startsAt: "2026-06-12T09:00",
                participantScope: { visibility: "campus" },
              },
              label: "补充活动结构",
            },
            {
              kind: "time",
              payload: { startsAt: "2026-06-12T09:00", endsAt: "2026-06-12T10:00" },
              label: "加活动时间",
            },
          ],
        },
      },
    });
  });

  it("surfaces event fields in the actionable preview after publish", async () => {
    const actionablePreview = ref(null);

    await submitHarness({ actionablePreview })();

    expect(actionablePreview.value).toEqual({
      kind: "event",
      action: "报名",
      components: [
        {
          kind: "event",
          label: "补充活动结构",
        },
        {
          kind: "time",
          label: "加活动时间",
        },
      ],
      structure: [
        "标题",
        "正文",
        "图片 x1",
        "地点：Library",
        "标签：#coffee",
        "身份：organizer",
        "活动：2026-06-12T09:00 · approval_required",
      ],
    });
  });

  it("sends a safe no-context fallback when no AI tick has landed", async () => {
    await submitHarness({
      llmInferredKind: ref(null),
      titleCandidate: ref(null),
      bodyCandidate: ref(null),
      suggestedComponents: ref([]),
    })();

    expect(vi.mocked(createEvent).mock.calls[0]?.[0].draftContext).toMatchObject({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      kind: "image",
      candidates: {
        title: null,
        bodyCandidate: null,
        inferredKind: null,
        suggestedComponents: [],
      },
    });
  });

  it("supports legacy event callers without candidate refs", async () => {
    await submitHarness({
      uploadedImageUrls: ref([]),
      selectedLocationDraft: ref(null),
      eventStartAt: ref(""),
      eventEndAt: ref(""),
      eventCapacity: ref(""),
      publishKind: undefined,
      llmInferredKind: undefined,
      titleCandidate: undefined,
      bodyCandidate: undefined,
      suggestedComponents: undefined,
    })();

    const input = vi.mocked(createEvent).mock.calls[0]?.[0];
    expect(input).toMatchObject({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      participantScope: { visibility: "campus" },
      joinPolicy: "approval_required",
      draftContext: {
        imageUrl: "",
        imageUrls: [],
        title: "Coffee meetup",
        body: "Discuss launch notes",
        kind: "text",
        event: {
          joinPolicy: "approval_required",
          participantScope: { visibility: "campus" },
        },
        candidates: {
          title: null,
          bodyCandidate: null,
          inferredKind: null,
          suggestedComponents: [],
        },
        locationDraft: {
          source: "manual",
          displayName: "Library",
          confidence: 0.65,
        },
      },
    });
    expect(input).not.toHaveProperty("startsAt");
    expect(input).not.toHaveProperty("endsAt");
    expect(input).not.toHaveProperty("capacity");
  });

  it("keeps one deeply frozen Event A request and preview while every live source becomes B", async () => {
    const response = deferred<Awaited<ReturnType<typeof createEvent>>>();
    vi.mocked(createEvent).mockImplementationOnce(() => response.promise);
    const title = ref("A event title");
    const body = ref("A event body");
    const uploadedImageUrls = ref(["https://cdn.test/event-a.png"]);
    const selectedFileCount = ref(1);
    const localPreviewUrls = ref(["blob:event-a"]);
    const selectedLocationDraft = ref<PublishLocationDraft | null>(
      createMapV2LocationDraft({
        locationId: "event-location-a",
        name: "A Event Hall",
        lat: 31.2304,
        lng: 121.4737,
      }),
    );
    const locationPreviewLabel = ref("A Event Hall");
    const eventStartAt = ref("2026-09-01T09:00");
    const eventEndAt = ref("2026-09-01T10:00");
    const eventCapacity = ref("24");
    const eventJoinPolicy = ref<EventJoinPolicy>("approval_required");
    const suggestedComponents = ref([
      {
        kind: "event" as const,
        payload: { startsAt: "2026-09-01T09:00", owner: "A" },
        label: "A event component",
      },
    ]);
    const actionablePreview = ref<PublishActionablePostPreview | null>(null);
    const resetForm = vi.fn();
    const publishing = ref(false);
    const lastTid = ref<string | number | null>(null);
    const successMessage = ref("");
    const sourceImages = uploadedImageUrls.value;
    const sourceLocation = selectedLocationDraft.value;
    const sourceComponents = suggestedComponents.value;

    const run = submitHarness(
      {
        title,
        body,
        uploadedImageUrls,
        selectedLocationDraft,
        locationPreviewLabel,
        eventStartAt,
        eventEndAt,
        eventCapacity,
        eventJoinPolicy,
        suggestedComponents,
        actionablePreview,
        resetForm,
        publishing,
        lastTid,
        successMessage,
      },
      { selectedFileCount, localPreviewUrls },
    )();
    await flushAsync();
    const request = vi.mocked(createEvent).mock.calls[0]?.[0];
    expect(request).toBeDefined();

    title.value = "";
    body.value = "";
    uploadedImageUrls.value.splice(0, 1, "https://cdn.test/event-b.png");
    selectedFileCount.value = 2;
    localPreviewUrls.value.splice(0, 1, "blob:event-b");
    if (selectedLocationDraft.value) {
      selectedLocationDraft.value.locationId = "event-location-b";
      selectedLocationDraft.value.locationArea = "B Event Hall";
      selectedLocationDraft.value.displayName = "B Event Hall";
    }
    locationPreviewLabel.value = "B Event Hall";
    eventStartAt.value = "2026-10-02T11:00";
    eventEndAt.value = "2026-10-02T12:00";
    eventCapacity.value = "48";
    eventJoinPolicy.value = "open";
    suggestedComponents.value[0]!.label = "B event component";
    suggestedComponents.value[0]!.payload.owner = "B";

    response.resolve({ eventId: "event-a", tid: 981 });
    await run;
    await flushAsync();

    expect(request).toMatchObject({
      title: "A event title",
      body: "A event body",
      startsAt: "2026-09-01T09:00",
      endsAt: "2026-09-01T10:00",
      capacity: 24,
      joinPolicy: "approval_required",
      draftContext: {
        imageUrls: ["https://cdn.test/event-a.png"],
        metadata: { locationArea: "A Event Hall" },
        candidates: {
          suggestedComponents: [
            {
              label: "A event component",
              payload: { startsAt: "2026-09-01T09:00", owner: "A" },
            },
          ],
        },
      },
    });
    expect(request?.draftContext?.imageUrls).not.toBe(sourceImages);
    expect(request?.draftContext?.locationDraft).not.toBe(sourceLocation);
    expect(request?.draftContext?.candidates?.suggestedComponents).not.toBe(sourceComponents);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request?.participantScope)).toBe(true);
    expect(Object.isFrozen(request?.draftContext)).toBe(true);
    expect(Object.isFrozen(request?.draftContext?.imageUrls)).toBe(true);
    expect(Object.isFrozen(request?.draftContext?.locationDraft)).toBe(true);
    expect(Object.isFrozen(request?.draftContext?.candidates?.suggestedComponents)).toBe(true);

    expect(lastTid.value).toBe(981);
    expect(successMessage.value).not.toBe("");
    expect(actionablePreview.value?.components).toEqual([
      { kind: "event", label: "A event component" },
    ]);
    const structure = actionablePreview.value?.structure.join(" | ") || "";
    expect(structure).toContain("A Event Hall");
    expect(structure).toContain("2026-09-01T09:00");
    expect(structure).toContain("approval_required");
    expect(structure).not.toContain("B Event Hall");
    expect(structure).not.toContain("2026-10-02T11:00");
    expect(resetForm).not.toHaveBeenCalled();
    expect(title.value).toBe("");
    expect(body.value).toBe("");
    expect(publishing.value).toBe(false);
  });
});
