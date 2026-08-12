import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { effectScope, ref } from "vue";
import {
  PUBLISH_LLM_TICK_DEBOUNCE_MS,
  usePublishLlmTick,
} from "../../src/features/publish/usePublishLlmTick";
import type {
  PublishLlmTickFetcher,
  PublishLlmTickResponse,
} from "../../src/features/publish/usePublishLlmTick";
import type { InferredKind, SuggestedComponent } from "../../src/types/publishSuggestion";

/**
 * PRD V0.2 step E-pre — `usePublishLlmTick` plumbs the LLM preview tick into
 * the candidate state machines (steps B/D) and the new suggestedComponents
 * pipe. These tests drive the hook through an `effectScope` so we don't have
 * to mount a component just to exercise the watch + debounce logic.
 *
 * The fetcher is always injected — never let a stray `fetch` call sneak out
 * of the test runner.
 */

interface Harness {
  title: ReturnType<typeof ref<string>>;
  body: ReturnType<typeof ref<string>>;
  imageUrls: ReturnType<typeof ref<ReadonlyArray<string>>>;
  locationLabel: ReturnType<typeof ref<string>>;
  attemptGeneration: ReturnType<typeof ref<number>>;
  setTitleCandidate: ReturnType<typeof vi.fn>;
  setBodyCandidate: ReturnType<typeof vi.fn>;
  suggestedComponents: ReturnType<typeof ref<SuggestedComponent[]>>;
  llmInferredKind: ReturnType<typeof ref<InferredKind | null>>;
  fetcher: ReturnType<typeof vi.fn>;
  scope: ReturnType<typeof effectScope>;
  refresh: () => Promise<void>;
}

function emptyResponse(): PublishLlmTickResponse {
  return {
    title: null,
    bodyCandidate: null,
    suggestedComponents: [],
    inferredKind: null,
    modelLatencyMs: 0,
    modelName: "test",
  };
}

function fullResponse(over: Partial<PublishLlmTickResponse> = {}): PublishLlmTickResponse {
  return {
    title: "polished title",
    bodyCandidate: "polished body",
    suggestedComponents: [
      { kind: "location", payload: {}, label: "在哪儿？加个地点" },
      { kind: "event", payload: {}, label: "活动吗？加个时间" },
    ],
    inferredKind: "event",
    modelLatencyMs: 320,
    modelName: "test",
    ...over,
  };
}

function makeHarness(over: { fetchResponse?: PublishLlmTickResponse | Error } = {}): Harness {
  const title = ref("");
  const body = ref("");
  const imageUrls = ref<ReadonlyArray<string>>([]);
  const locationLabel = ref("");
  const attemptGeneration = ref(0);
  const setTitleCandidate = vi.fn<(value: string | null) => void>();
  const setBodyCandidate = vi.fn<(value: string | null) => void>();
  const suggestedComponents = ref<SuggestedComponent[]>([]);
  const llmInferredKind = ref<InferredKind | null>(null);
  const fetcher: ReturnType<typeof vi.fn> = vi.fn(() => {
    if (over.fetchResponse instanceof Error) return Promise.reject(over.fetchResponse);
    return Promise.resolve(over.fetchResponse ?? fullResponse());
  });
  const scope = effectScope();
  let refresh: () => Promise<void> = async () => {};
  scope.run(() => {
    const handle = usePublishLlmTick({
      title,
      body,
      imageUrls,
      locationLabel,
      attemptGeneration,
      setTitleCandidate,
      setBodyCandidate,
      suggestedComponents,
      llmInferredKind,
      fetcher: fetcher as unknown as PublishLlmTickFetcher,
    });
    refresh = handle.refresh;
  });
  return {
    title,
    body,
    imageUrls,
    locationLabel,
    attemptGeneration,
    setTitleCandidate,
    setBodyCandidate,
    suggestedComponents,
    llmInferredKind,
    fetcher,
    scope,
    refresh,
  };
}

/**
 * Drain pending microtasks. After a fetcher promise resolves we still need
 * to let the awaiting code in `fire()` proceed past the `await fetcher(...)`
 * line before assertions can see its side effects.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("usePublishLlmTick (PRD V0.2 step E-pre)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("debounces title changes and only fires after the user pauses", async () => {
    const h = makeHarness();
    h.title.value = "h";
    h.title.value = "he";
    h.title.value = "hel";

    // Mid-debounce — no fetch yet.
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS - 1);
    expect(h.fetcher).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    await flushMicrotasks();

    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls[0]?.[0]).toMatchObject({
      title: "hel",
      body: "",
    });
    h.scope.stop();
  });

  it("does not call the fetcher while the user is still typing within the debounce window", async () => {
    const h = makeHarness();

    h.title.value = "h";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS - 100);
    h.title.value = "he";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS - 100);
    h.title.value = "hel";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS - 100);

    expect(h.fetcher).not.toHaveBeenCalled();

    vi.advanceTimersByTime(101);
    await flushMicrotasks();
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    h.scope.stop();
  });

  it("body changes trigger the tick the same way as title (any-side ratchet)", async () => {
    const h = makeHarness();
    h.body.value = "wrote a body line";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls[0]?.[0]).toMatchObject({
      title: "",
      body: "wrote a body line",
    });
    h.scope.stop();
  });

  it("pipes title + body candidates and suggestedComponents into the sinks on success", async () => {
    const h = makeHarness();
    h.title.value = "draft";
    h.body.value = "body draft";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.setTitleCandidate).toHaveBeenCalledWith("polished title");
    expect(h.setBodyCandidate).toHaveBeenCalledWith("polished body");
    expect(h.suggestedComponents.value).toHaveLength(2);
    expect(h.suggestedComponents.value[0]).toMatchObject({ kind: "location" });
    expect(h.suggestedComponents.value[1]).toMatchObject({ kind: "event" });
    h.scope.stop();
  });

  it("silent-fails on rejected fetcher: no exception, no candidate writes, no suggestion churn", async () => {
    const h = makeHarness({ fetchResponse: new Error("LLM provider down") });
    h.suggestedComponents.value = [{ kind: "location", payload: {}, label: "stale" }];

    h.title.value = "h";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    // Pipe untouched — caller's existing list survives an LLM failure.
    expect(h.suggestedComponents.value).toEqual([
      { kind: "location", payload: {}, label: "stale" },
    ]);
    h.scope.stop();
  });

  it("drops a stale response when the user has changed the inputs since send", async () => {
    let resolve!: (value: PublishLlmTickResponse) => void;
    const h = makeHarness({
      fetchResponse: undefined,
    });
    h.fetcher.mockReset();
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolve = r;
        }),
    );

    h.title.value = "first";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks(); // start the fetch

    // User keeps typing while the fetch is in flight.
    h.title.value = "first plus more";

    // Server finally answers with the candidate it generated for "first".
    resolve(fullResponse({ title: "stale candidate" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    expect(h.suggestedComponents.value).toEqual([]);
    h.scope.stop();
  });

  it("drops a response from an older attempt even when the new draft has identical text", async () => {
    let resolve!: (value: PublishLlmTickResponse) => void;
    const h = makeHarness({ fetchResponse: undefined });
    h.fetcher.mockReset();
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolve = r;
        }),
    );

    h.title.value = "same title";
    h.body.value = "same body";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();
    h.attemptGeneration.value += 1;

    resolve(fullResponse({ title: "old attempt" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    expect(h.suggestedComponents.value).toEqual([]);
    expect(h.llmInferredKind.value).toBeNull();
    h.scope.stop();
  });

  it("drops an image-only response when only the image snapshot changed", async () => {
    let resolve!: (value: PublishLlmTickResponse) => void;
    const h = makeHarness({ fetchResponse: undefined });
    h.fetcher.mockReset();
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolve = r;
        }),
    );

    h.imageUrls.value = ["https://cdn.example/old.jpg"];
    void h.refresh();
    await flushMicrotasks();
    h.imageUrls.value = ["https://cdn.example/new.jpg"];

    resolve(fullResponse({ title: "old image" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    expect(h.suggestedComponents.value).toEqual([]);
    expect(h.llmInferredKind.value).toBeNull();
    h.scope.stop();
  });

  it("drops a response when only the location snapshot changed", async () => {
    let resolve!: (value: PublishLlmTickResponse) => void;
    const h = makeHarness({ fetchResponse: undefined });
    h.fetcher.mockReset();
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolve = r;
        }),
    );

    h.title.value = "unchanged title";
    h.locationLabel.value = "Library";
    void h.refresh();
    await flushMicrotasks();
    h.locationLabel.value = "Gym";

    resolve(fullResponse({ title: "old location" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    expect(h.suggestedComponents.value).toEqual([]);
    expect(h.llmInferredKind.value).toBeNull();
    h.scope.stop();
  });

  it("generation changes cancel pending debounce work without firing a request", async () => {
    const h = makeHarness();
    h.title.value = "abandoned";
    h.attemptGeneration.value += 1;

    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS * 2);
    await flushMicrotasks();

    expect(h.fetcher).not.toHaveBeenCalled();
    h.scope.stop();
  });

  it("does not make image or location changes automatic trigger sources", async () => {
    const h = makeHarness();
    h.imageUrls.value = ["https://cdn.example/image.jpg"];
    h.locationLabel.value = "Library";

    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS * 2);
    await flushMicrotasks();

    expect(h.fetcher).not.toHaveBeenCalled();
    h.scope.stop();
  });

  it("keeps only the most recent fire's response when two ticks race", async () => {
    const h = makeHarness({ fetchResponse: undefined });
    h.fetcher.mockReset();
    const resolvers: Array<(value: PublishLlmTickResponse) => void> = [];
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolvers.push(r);
        }),
    );

    // First tick — debounce-driven.
    h.title.value = "tick-one";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    // Second tick — refresh, but don't await it (it would block until the
    // fetcher resolves, which we want to do explicitly below).
    void h.refresh();
    await flushMicrotasks();

    expect(resolvers).toHaveLength(2);

    // Resolve in reverse order: second first, then the older first call.
    resolvers[1]!(fullResponse({ title: "second-wins" }));
    await flushMicrotasks();
    resolvers[0]!(fullResponse({ title: "stale-loses" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).toHaveBeenCalledTimes(1);
    expect(h.setTitleCandidate).toHaveBeenCalledWith("second-wins");
    h.scope.stop();
  });

  it("does not fire when title, body, and image list are all empty (no grounding)", async () => {
    const h = makeHarness();

    // Trigger the watch by writing then erasing — final value is empty.
    h.title.value = "x";
    h.title.value = "";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.fetcher).not.toHaveBeenCalled();
    h.scope.stop();
  });

  it("fires when only image URLs are present (image-only flow per PRD §4.1)", async () => {
    const h = makeHarness();

    h.imageUrls.value = ["https://cdn.example/upload-1.jpg"];
    // imageUrls isn't watched, so we still need a typing event to run a
    // fire(). PRD §4.1 names image upload as its own trigger; this hook
    // exposes `refresh()` so the composer can wire the upload edge later.
    await h.refresh();

    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls[0]?.[0]).toMatchObject({
      title: "",
      body: "",
      imageUrls: ["https://cdn.example/upload-1.jpg"],
    });
    h.scope.stop();
  });

  it("only writes title candidate when the model returned one (null candidates leave sinks alone)", async () => {
    const h = makeHarness({
      fetchResponse: {
        ...emptyResponse(),
        title: null,
        bodyCandidate: "only-body",
        suggestedComponents: [{ kind: "trade", payload: {}, label: "加个价格" }],
      },
    });

    h.body.value = "x";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).toHaveBeenCalledWith("only-body");
    expect(h.suggestedComponents.value).toEqual([
      { kind: "trade", payload: {}, label: "加个价格" },
    ]);
    h.scope.stop();
  });

  it("clears suggestedComponents when the latest response is empty", async () => {
    const h = makeHarness({ fetchResponse: emptyResponse() });
    h.suggestedComponents.value = [{ kind: "location", payload: {}, label: "stale" }];

    h.title.value = "x";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();

    expect(h.suggestedComponents.value).toEqual([]);
    h.scope.stop();
  });

  it("disposing the scope cancels the pending debounce timer", async () => {
    const h = makeHarness();

    h.title.value = "typing";
    h.scope.stop();

    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS * 2);
    await flushMicrotasks();
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it("disposing the scope invalidates an in-flight response", async () => {
    let resolve!: (value: PublishLlmTickResponse) => void;
    const h = makeHarness({ fetchResponse: undefined });
    h.fetcher.mockReset();
    h.fetcher.mockImplementation(
      () =>
        new Promise<PublishLlmTickResponse>((r) => {
          resolve = r;
        }),
    );

    h.title.value = "in flight";
    vi.advanceTimersByTime(PUBLISH_LLM_TICK_DEBOUNCE_MS);
    await flushMicrotasks();
    h.scope.stop();
    resolve(fullResponse({ title: "after dispose" }));
    await flushMicrotasks();

    expect(h.setTitleCandidate).not.toHaveBeenCalled();
    expect(h.setBodyCandidate).not.toHaveBeenCalled();
    expect(h.suggestedComponents.value).toEqual([]);
    expect(h.llmInferredKind.value).toBeNull();
  });
});
