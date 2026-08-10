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
import type { PublishActionablePostPreview, PublishVisibility } from "../../src/types/publish";

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
  const uploadedImageUrls = ref<string[]>([]);
  const selectedFileCount = ref(0);
  const localPreviewUrls = ref<string[]>([]);
  const uploading = ref(false);
  const publishing = ref(false);
  const actionablePreview = ref<PublishActionablePostPreview | null>(null);
  const validate = vi.fn(() => "");
  const submit = usePublishSubmit({
    title,
    body,
    tagInput: ref("campus"),
    identityTag: ref(""),
    placeName: ref(""),
    visibility,
    aliasId: ref(undefined),
    uploadedImageUrls,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    actionablePreview,
    lastTid,
    normalizedTag: ref("#campus"),
    normalizedIdentityTag: ref(""),
    selectedLocationDraft: ref(null),
    locationPreviewLabel: ref("未绑定地点"),
    validate,
    resetForm,
    createIdempotencyKey,
    draftOwnership: () => ({
      title: title.value,
      body: body.value,
      visibility: visibility.value,
      selectedFileCount: selectedFileCount.value,
      localPreviewUrls: localPreviewUrls.value,
      uploadedImageUrls: uploadedImageUrls.value,
      uploading: uploading.value,
    }),
  });

  return {
    ...submit,
    actionablePreview,
    body,
    createIdempotencyKey,
    errorMessage,
    lastTid,
    publishing,
    resetForm,
    successMessage,
    title,
    validate,
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

  it("treats a duplicate submit while publishing as a true no-op", async () => {
    const harness = createHarness();
    const existingPreview: PublishActionablePostPreview = {
      kind: "text",
      action: "existing action",
      structure: ["existing structure"],
      components: [],
    };
    harness.publishing.value = true;
    harness.errorMessage.value = "existing error";
    harness.successMessage.value = "existing success";
    harness.lastTid.value = 700;
    harness.actionablePreview.value = existingPreview;
    harness.validate.mockReturnValue("new validation must not run");

    await harness.submitPublish();

    expect(harness.validate).not.toHaveBeenCalled();
    expect(harness.errorMessage.value).toBe("existing error");
    expect(harness.successMessage.value).toBe("existing success");
    expect(harness.lastTid.value).toBe(700);
    expect(harness.actionablePreview.value).toStrictEqual(existingPreview);
    expect(harness.createIdempotencyKey).not.toHaveBeenCalled();
    expect(publishPost).not.toHaveBeenCalled();
    expect(hapticSuccess).not.toHaveBeenCalled();
    expect(hapticError).not.toHaveBeenCalled();
    expect(harness.publishing.value).toBe(true);
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

  it("keeps changed-payload B busy and ignores a duplicate while B is deferred", async () => {
    const responseB = deferred<Awaited<ReturnType<typeof publishPost>>>();
    vi.mocked(publishPost)
      .mockResolvedValueOnce({
        ok: true,
        status: "published_metadata_pending",
        tid: 207,
        partial: true,
        recoverable: true,
      })
      .mockImplementationOnce(() => responseB.promise);
    const harness = createHarness();

    await harness.submitPublish();
    harness.body.value = "B body";
    const runB = harness.submitPublish();
    await flushAsync();

    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
    expect(harness.publishing.value).toBe(true);
    expect(harness.lastTid.value).toBeNull();
    expect(harness.successMessage.value).toBe("");

    harness.validate.mockClear();
    await harness.submitPublish();
    expect(harness.validate).not.toHaveBeenCalled();
    expect(publishPost).toHaveBeenCalledTimes(2);
    expect(sentKeys()).toEqual(["publish-key-1", "publish-key-2"]);
    expect(harness.publishing.value).toBe(true);
    expect(hapticSuccess).toHaveBeenCalledTimes(1);

    responseB.resolve({ ok: true, status: "published", tid: 208 });
    await runB;
    await flushAsync();

    expect(harness.lastTid.value).toBe(208);
    expect(harness.resetForm).toHaveBeenCalledTimes(1);
    expect(harness.publishing.value).toBe(false);
  });
});
