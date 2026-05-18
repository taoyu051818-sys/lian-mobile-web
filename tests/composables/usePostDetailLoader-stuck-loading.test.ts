import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/posts", () => ({
  fetchPostDetail: vi.fn(),
}));

import { usePostDetailLoader } from "../../src/features/feed/usePostDetailLoader";
import { fetchPostDetail } from "../../src/api/posts";

const mockFetchPostDetail = vi.mocked(fetchPostDetail);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("usePostDetailLoader — stuck-loading regression (PR #601 follow-up)", () => {
  beforeEach(() => {
    mockFetchPostDetail.mockReset();
  });

  // The original guard compared `selectedPostId.value` after the await against
  // the id captured at call time. If anything mutated selectedPostId during
  // the fetch, the finally block would skip `detailLoading.value = false` and
  // the panel would stay stuck on "正在加载详情…". The token-based guard is
  // immune to external state mutation.
  it("settles detailLoading even if selectedPostId is overwritten during fetch", async () => {
    const d = deferred<{ tid: number; title: string }>();
    mockFetchPostDetail.mockReturnValueOnce(d.promise as never);

    const loader = usePostDetailLoader();
    loader.selectedPostId.value = 113;
    const fetchTask = loader.loadDetail(113);

    expect(loader.detailLoading.value).toBe(true);

    // Simulate a sibling watcher (e.g. detailTid watch in FeedView) flipping
    // selectedPostId mid-flight — the kind of race that produced the stuck-
    // loading panel after PR #601 landed.
    loader.selectedPostId.value = 999;

    d.resolve({ tid: 113, title: "ok" } as never);
    await fetchTask;

    expect(loader.detailLoading.value).toBe(false);
    expect(loader.selectedPost.value).toEqual({ tid: 113, title: "ok" });
    expect(loader.detailError.value).toBe("");
  });

  it("settles detailLoading on rejection even if selectedPostId is overwritten during fetch", async () => {
    const d = deferred<unknown>();
    mockFetchPostDetail.mockReturnValueOnce(d.promise as never);

    const loader = usePostDetailLoader();
    loader.selectedPostId.value = 42;
    const fetchTask = loader.loadDetail(42);

    loader.selectedPostId.value = null;
    d.reject(new Error("boom"));
    await fetchTask;

    expect(loader.detailLoading.value).toBe(false);
    expect(loader.detailError.value).toBe("boom");
  });

  // Multiple concurrent loads must let only the most recent one land.
  it("a later loadDetail call supersedes an earlier in-flight one", async () => {
    const first = deferred<{ tid: number; title: string }>();
    const second = deferred<{ tid: number; title: string }>();
    mockFetchPostDetail
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);

    const loader = usePostDetailLoader();
    loader.selectedPostId.value = 1;
    const firstTask = loader.loadDetail(1);

    loader.selectedPostId.value = 2;
    const secondTask = loader.loadDetail(2);

    // First fetch resolves to a stale post — must NOT land.
    first.resolve({ tid: 1, title: "stale" } as never);
    await firstTask;
    expect(loader.selectedPost.value).toBeNull();
    expect(loader.detailLoading.value).toBe(true);

    second.resolve({ tid: 2, title: "fresh" } as never);
    await secondTask;
    expect(loader.selectedPost.value).toEqual({ tid: 2, title: "fresh" });
    expect(loader.detailLoading.value).toBe(false);
  });

  it("resetLoaderState invalidates an in-flight fetch so it does not write back", async () => {
    const d = deferred<{ tid: number; title: string }>();
    mockFetchPostDetail.mockReturnValueOnce(d.promise as never);

    const loader = usePostDetailLoader();
    loader.selectedPostId.value = 7;
    const fetchTask = loader.loadDetail(7);

    loader.resetLoaderState();
    expect(loader.detailLoading.value).toBe(false);
    expect(loader.selectedPostId.value).toBeNull();

    d.resolve({ tid: 7, title: "should not land" } as never);
    await fetchTask;

    expect(loader.selectedPost.value).toBeNull();
    expect(loader.detailLoading.value).toBe(false);
    expect(loader.detailError.value).toBe("");
  });
});
