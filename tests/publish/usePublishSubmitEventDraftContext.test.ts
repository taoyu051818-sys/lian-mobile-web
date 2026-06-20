import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { createEvent } from "../../src/api/events";
import { createMapV2LocationDraft } from "../../src/api/publish";
import { usePublishSubmit } from "../../src/features/publish/usePublishSubmit";
import type { PublishVisibility } from "../../src/types/publish";
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

describe("usePublishSubmit event draft context", () => {
  beforeEach(() => {
    vi.mocked(createEvent).mockReset();
    vi.mocked(createEvent).mockResolvedValue({ eventId: "event-1", tid: 971 });
  });

  function submitHarness(overrides: Partial<Parameters<typeof usePublishSubmit>[0]> = {}) {
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
    return usePublishSubmit(options).submitPublish;
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
});
