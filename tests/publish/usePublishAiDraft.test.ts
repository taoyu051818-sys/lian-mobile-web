import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  usePublishAiDraft,
  type PublishAiDraftFetcher,
  type UsePublishAiDraftResult,
} from "../../src/composables/usePublishAiDraft";
import type { AiPreviewSuggestions } from "../../src/api/aiPublish";

function fullSuggestion(over: Partial<AiPreviewSuggestions> = {}): AiPreviewSuggestions {
  return {
    title: "AI title",
    body: "AI body",
    tag: "#campus",
    audience: null,
    riskFlags: ["review"],
    confidence: 0.8,
    needsHumanReview: true,
    candidates: {
      title: "AI title",
      bodyCandidate: "AI body",
      suggestedComponents: [],
      inferredKind: "text",
      modelLatencyMs: 10,
      modelName: "test",
    },
    suggestedComponents: [],
    inferredKind: "text",
    ...over,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await nextTick();
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

interface Harness {
  uploadedImageUrls: ReturnType<typeof ref<string[]>>;
  title: ReturnType<typeof ref<string>>;
  body: ReturnType<typeof ref<string>>;
  locationLabel: ReturnType<typeof ref<string>>;
  attemptGeneration: ReturnType<typeof ref<number>>;
  onSuggestion: ReturnType<typeof vi.fn>;
  fetcher: ReturnType<typeof vi.fn>;
  handle: UsePublishAiDraftResult;
  scope: ReturnType<typeof effectScope>;
}

function makeHarness(fetcherImpl?: PublishAiDraftFetcher): Harness {
  const uploadedImageUrls = ref<string[]>([]);
  const title = ref("");
  const body = ref("");
  const locationLabel = ref("");
  const attemptGeneration = ref(0);
  const onSuggestion = vi.fn<(suggestion: AiPreviewSuggestions) => void>();
  const fetcher = vi.fn(fetcherImpl ?? (() => Promise.resolve(fullSuggestion()))) as ReturnType<
    typeof vi.fn
  >;
  const scope = effectScope();
  let handle!: UsePublishAiDraftResult;

  scope.run(() => {
    handle = usePublishAiDraft({
      uploadedImageUrls,
      title,
      body,
      locationLabel,
      attemptGeneration,
      onSuggestion,
      fetcher: fetcher as unknown as PublishAiDraftFetcher,
    });
  });

  return {
    uploadedImageUrls,
    title,
    body,
    locationLabel,
    attemptGeneration,
    onSuggestion,
    fetcher,
    handle,
    scope,
  };
}

describe("usePublishAiDraft attempt boundary", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("injected preview fetcher was bypassed"))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the first-image and explicit-refresh trigger contract", async () => {
    const h = makeHarness();

    h.uploadedImageUrls.value = ["https://cdn.test/one.jpg"];
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.onSuggestion).toHaveBeenCalledTimes(1);

    h.uploadedImageUrls.value.push("https://cdn.test/two.jpg");
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);

    await h.handle.refresh();
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    h.scope.stop();
  });

  it.each([
    ["title", (h: Harness) => (h.title.value = "changed title")],
    ["body", (h: Harness) => (h.body.value = "changed body")],
    ["image list", (h: Harness) => (h.uploadedImageUrls.value = ["https://cdn.test/new.jpg"])],
    ["location", (h: Harness) => (h.locationLabel.value = "Gym")],
  ])("drops an old success when only the %s snapshot changes", async (_label, mutate) => {
    const oldRequest = deferred<AiPreviewSuggestions>();
    const h = makeHarness(() => oldRequest.promise);
    h.title.value = "original title";
    h.body.value = "original body";
    h.locationLabel.value = "Library";
    h.uploadedImageUrls.value = ["https://cdn.test/old.jpg"];
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);

    mutate(h);
    oldRequest.resolve(fullSuggestion({ title: "stale response" }));
    await flushMicrotasks();

    expect(h.onSuggestion).not.toHaveBeenCalled();
    expect(h.handle.suggestions.value).toBeNull();
    expect(h.handle.riskFlags.value).toEqual([]);
    expect(h.handle.loading.value).toBe(false);
    h.scope.stop();
  });

  it("clears transient state, drops an old success, and rearms the next attempt", async () => {
    const first = deferred<AiPreviewSuggestions>();
    let requestCount = 0;
    const h = makeHarness(() => {
      requestCount += 1;
      return requestCount === 1
        ? first.promise
        : Promise.resolve(fullSuggestion({ title: "new attempt" }));
    });

    h.uploadedImageUrls.value = ["https://cdn.test/old.jpg"];
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.handle.loading.value).toBe(true);

    h.handle.error.value = "old error";
    h.handle.suggestions.value = fullSuggestion({ title: "old cached" });
    h.handle.riskFlags.value = ["old risk"];
    h.uploadedImageUrls.value = [];
    h.attemptGeneration.value += 1;

    expect(h.handle.loading.value).toBe(false);
    expect(h.handle.error.value).toBe("");
    expect(h.handle.suggestions.value).toBeNull();
    expect(h.handle.riskFlags.value).toEqual([]);

    first.resolve(fullSuggestion({ title: "stale response" }));
    await flushMicrotasks();
    expect(h.onSuggestion).not.toHaveBeenCalled();
    expect(h.handle.suggestions.value).toBeNull();

    h.uploadedImageUrls.value = ["https://cdn.test/new.jpg"];
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(h.onSuggestion).toHaveBeenCalledTimes(1);
    expect(h.handle.suggestions.value?.title).toBe("new attempt");
    h.scope.stop();
  });

  it("ignores a rejected request from an abandoned attempt", async () => {
    const oldRequest = deferred<AiPreviewSuggestions>();
    const h = makeHarness(() => oldRequest.promise);

    h.uploadedImageUrls.value = ["https://cdn.test/old.jpg"];
    await flushMicrotasks();
    h.attemptGeneration.value += 1;
    if (h.fetcher.mock.calls.length > 0) {
      oldRequest.reject(new Error("old request failed"));
    }
    await flushMicrotasks();

    expect(h.handle.error.value).toBe("");
    expect(h.handle.loading.value).toBe(false);
    h.scope.stop();
  });

  it("invalidates an in-flight response when its scope is disposed", async () => {
    const oldRequest = deferred<AiPreviewSuggestions>();
    const h = makeHarness(() => oldRequest.promise);

    h.uploadedImageUrls.value = ["https://cdn.test/old.jpg"];
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);

    h.scope.stop();
    oldRequest.resolve(fullSuggestion({ title: "after dispose" }));
    await flushMicrotasks();

    expect(h.onSuggestion).not.toHaveBeenCalled();
    expect(h.handle.suggestions.value).toBeNull();
  });
});
