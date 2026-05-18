import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/posts", () => ({
  fetchPostDetail: vi.fn(),
}));

import { usePostDetail } from "../../src/features/detail/usePostDetail";
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

describe("usePostDetail state machine", () => {
  beforeEach(() => {
    mockFetchPostDetail.mockReset();
  });

  it("starts with no selection", () => {
    const d = usePostDetail();
    expect(d.selectedPostId.value).toBeNull();
    expect(d.selectedPost.value).toBeNull();
    expect(d.detailLoading.value).toBe(false);
    expect(d.detailError.value).toBe("");
    expect(d.detailOpen.value).toBe(false);
  });

  it("openDetail sets loading and fetches post", async () => {
    const mockPost = { tid: 42, title: "测试帖子" };
    mockFetchPostDetail.mockResolvedValue(mockPost as any);

    const d = usePostDetail();
    const promise = d.openDetail(42);

    expect(d.selectedPostId.value).toBe(42);
    expect(d.detailLoading.value).toBe(true);
    expect(d.detailOpen.value).toBe(true);
    expect(d.selectedPost.value).toBeNull();

    await promise;

    expect(d.detailLoading.value).toBe(false);
    expect(d.selectedPost.value).toEqual(mockPost);
    expect(d.detailError.value).toBe("");
  });

  it("openDetail sets error on fetch failure", async () => {
    mockFetchPostDetail.mockRejectedValue(new Error("网络错误"));

    const d = usePostDetail();
    await d.openDetail(99);

    expect(d.detailLoading.value).toBe(false);
    expect(d.detailError.value).toBe("网络错误");
    expect(d.selectedPost.value).toBeNull();
    expect(d.selectedPostId.value).toBe(99);
    expect(d.detailOpen.value).toBe(true);
  });

  it("openDetail uses fallback error for non-Error throws", async () => {
    mockFetchPostDetail.mockRejectedValue("unknown");

    const d = usePostDetail();
    await d.openDetail(1);

    expect(d.detailError.value).toBe("详情暂时没加载出来，可以稍后再试。");
  });

  it("closeDetail resets all state", () => {
    const d = usePostDetail();
    d.selectedPostId.value = 42;
    d.selectedPost.value = { tid: 42 } as any;
    d.detailLoading.value = true;
    d.detailError.value = "err";

    d.closeDetail();

    expect(d.selectedPostId.value).toBeNull();
    expect(d.selectedPost.value).toBeNull();
    expect(d.detailLoading.value).toBe(false);
    expect(d.detailError.value).toBe("");
    expect(d.detailOpen.value).toBe(false);
  });

  it("retryDetail re-fetches when post is selected", async () => {
    mockFetchPostDetail.mockResolvedValue({ tid: 5 } as any);

    const d = usePostDetail();
    d.selectedPostId.value = 5;

    await d.retryDetail();

    expect(mockFetchPostDetail).toHaveBeenCalledWith(5);
  });

  it("retryDetail does nothing when no post is selected", () => {
    const d = usePostDetail();
    d.retryDetail();
    expect(mockFetchPostDetail).not.toHaveBeenCalled();
  });

  it("closeDetail invalidates an in-flight fetch so it cannot write back", async () => {
    const pending = deferred<{ tid: number; title: string }>();
    mockFetchPostDetail.mockReturnValueOnce(pending.promise as never);

    const d = usePostDetail();
    const task = d.openDetail(12);

    expect(d.detailLoading.value).toBe(true);

    d.closeDetail();
    pending.resolve({ tid: 12, title: "stale detail" });
    await task;

    expect(d.selectedPostId.value).toBeNull();
    expect(d.selectedPost.value).toBeNull();
    expect(d.detailLoading.value).toBe(false);
    expect(d.detailError.value).toBe("");
  });

  it("keeps the latest openDetail request authoritative", async () => {
    const first = deferred<{ tid: number; title: string }>();
    const second = deferred<{ tid: number; title: string }>();
    mockFetchPostDetail
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);

    const d = usePostDetail();
    const firstTask = d.openDetail(1);
    const secondTask = d.openDetail(2);

    first.resolve({ tid: 1, title: "old detail" });
    await firstTask;

    expect(d.selectedPost.value).toBeNull();
    expect(d.detailLoading.value).toBe(true);

    second.resolve({ tid: 2, title: "new detail" });
    await secondTask;

    expect(d.selectedPostId.value).toBe(2);
    expect(d.selectedPost.value).toEqual({ tid: 2, title: "new detail" });
    expect(d.detailLoading.value).toBe(false);
  });
});
