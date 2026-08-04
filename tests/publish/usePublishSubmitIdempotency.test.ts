import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { publishPost } from "../../src/api/publish";
import {
  PUBLISH_SUCCESS_METADATA_PENDING,
  PUBLISH_SUCCESS_METADATA_RETRY,
} from "../../src/config/brand";
import { hapticError, hapticSuccess } from "../../src/composables/useHapticFeedback";
import {
  createPublishIdempotencyKey,
  usePublishSubmit,
} from "../../src/features/publish/usePublishSubmit";
import type { PublishVisibility } from "../../src/types/publish";

vi.mock("../../src/api/publish", async () => {
  const actual =
    await vi.importActual<typeof import("../../src/api/publish")>("../../src/api/publish");
  return {
    ...actual,
    publishPost: vi.fn(),
  };
});

vi.mock("../../src/composables/useHapticFeedback", () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

function createHarness(keys = ["publish-key-1", "publish-key-2"]) {
  let nextKey = 0;
  const createIdempotencyKey = vi.fn(() => keys[nextKey++] ?? `publish-key-${nextKey}`);
  const resetForm = vi.fn();
  const body = ref("A body");
  const errorMessage = ref("");
  const successMessage = ref("");
  const lastTid = ref<string | number | null>(null);
  const title = ref("A title");
  const visibility = ref<PublishVisibility>("public");
  const submit = usePublishSubmit({
    title,
    body,
    tagInput: ref("campus"),
    identityTag: ref(""),
    placeName: ref(""),
    visibility,
    aliasId: ref(undefined),
    uploadedImageUrls: ref([]),
    uploading: ref(false),
    publishing: ref(false),
    errorMessage,
    successMessage,
    lastTid,
    normalizedTag: ref("#campus"),
    normalizedIdentityTag: ref(""),
    selectedLocationDraft: ref(null),
    locationPreviewLabel: ref("未绑定地点"),
    validate: () => "",
    resetForm,
    createIdempotencyKey,
  });

  return {
    ...submit,
    body,
    createIdempotencyKey,
    errorMessage,
    lastTid,
    resetForm,
    successMessage,
    title,
    visibility,
  };
}

function sentKeys() {
  return vi.mocked(publishPost).mock.calls.map(([payload]) => payload.idempotencyKey);
}

describe("AI publish idempotency lifecycle", () => {
  beforeEach(() => {
    vi.mocked(publishPost).mockReset();
    vi.mocked(hapticSuccess).mockReset();
    vi.mocked(hapticError).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates an opaque random key without deriving it from publish content", () => {
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createPublishIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000001");
    expect(createPublishIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000002");
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });

  it("keeps generating an ephemeral key when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    vi.spyOn(Date, "now").mockReturnValue(123_456_789);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createPublishIdempotencyKey()).toBe(
      `publish-${(123_456_789).toString(36)}-${(0.5).toString(36).slice(2)}`,
    );
  });

  it("reuses one random key when the user retries after an ambiguous network failure", async () => {
    vi.mocked(publishPost)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 41 });
    const harness = createHarness();

    await harness.submitPublish();
    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-1"]);
    expect(harness.createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it("starts a new attempt when the payload changes after a network failure", async () => {
    vi.mocked(publishPost)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 42 });
    const harness = createHarness();

    await harness.submitPublish();
    harness.body.value = "A revised body";
    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
    expect(vi.mocked(publishPost).mock.calls[1]?.[0].body).toBe("A revised body");
    expect(harness.createIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it("generates a new key after a confirmed publish result", async () => {
    vi.mocked(publishPost)
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 51 })
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 52 });
    const harness = createHarness();

    await harness.submitPublish();
    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
    expect(harness.createIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it("generates a new key when the user explicitly starts a fresh submission", async () => {
    vi.mocked(publishPost)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 61 });
    const harness = createHarness();

    await harness.submitPublish();
    harness.resetPublishAttempt();
    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
  });

  it("shows a 202 topic result without blind retry and reuses its key for a manual retry", async () => {
    vi.mocked(publishPost)
      .mockResolvedValueOnce({
        ok: true,
        status: "published_metadata_pending",
        tid: 202,
        url: "/post/202",
        partial: true,
        recoverable: true,
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 202 });
    const harness = createHarness();

    await harness.submitPublish();

    expect(publishPost).toHaveBeenCalledTimes(1);
    expect(sentKeys()).toEqual(["publish-key-1"]);
    expect(harness.lastTid.value).toBe(202);
    expect(harness.postDetailUrl.value).toBe("#/post/202");
    expect(harness.errorMessage.value).toBe("");
    expect(harness.successMessage.value).toBe(PUBLISH_SUCCESS_METADATA_RETRY);
    expect(harness.resetForm).not.toHaveBeenCalled();
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
    expect(hapticError).not.toHaveBeenCalled();

    await harness.submitPublish();

    expect(publishPost).toHaveBeenCalledTimes(2);
    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-1"]);
    expect(harness.lastTid.value).toBe(202);
    expect(harness.postDetailUrl.value).toBe("#/post/202");
    expect(harness.successMessage.value).toBe(PUBLISH_SUCCESS_METADATA_RETRY);
    expect(harness.errorMessage.value).not.toBe("");
    expect(harness.resetForm).not.toHaveBeenCalled();

    await harness.submitPublish();

    expect(publishPost).toHaveBeenCalledTimes(3);
    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-1", "publish-key-1"]);
    expect(harness.resetForm).toHaveBeenCalledTimes(1);
  });

  it("finishes a non-recoverable 202 lifecycle without offering a futile replay", async () => {
    vi.mocked(publishPost)
      .mockResolvedValueOnce({
        ok: true,
        status: "published_metadata_pending",
        tid: 203,
        url: "/post/203",
        partial: true,
        recoverable: false,
      })
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 204 });
    const harness = createHarness();

    await harness.submitPublish();

    expect(publishPost).toHaveBeenCalledTimes(1);
    expect(harness.lastTid.value).toBe(203);
    expect(harness.successMessage.value).toBe(PUBLISH_SUCCESS_METADATA_PENDING);
    expect(harness.resetForm).toHaveBeenCalledTimes(1);

    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
  });

  it("starts a new attempt when the user edits a recoverable partial publish", async () => {
    vi.mocked(publishPost)
      .mockResolvedValueOnce({
        ok: true,
        status: "published_metadata_pending",
        tid: 205,
        url: "/post/205",
        partial: true,
        recoverable: true,
      })
      .mockResolvedValueOnce({ ok: true, status: "published", tid: 206 });
    const harness = createHarness();

    await harness.submitPublish();
    expect(harness.postDetailUrl.value).toBe("#/post/205");

    harness.title.value = "A new title";
    harness.visibility.value = "campus";
    await harness.submitPublish();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
    expect(vi.mocked(publishPost).mock.calls[1]?.[0]).toMatchObject({
      title: "A new title",
      metadata: { visibility: "campus" },
    });
    expect(harness.lastTid.value).toBe(206);
    expect(harness.resetForm).toHaveBeenCalledTimes(1);
  });
});
