import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/posts", () => ({
  fetchPostDetail: vi.fn(),
}));

import { usePostDetail } from "../../src/composables/usePostDetail";
import { fetchPostDetail } from "../../src/api/posts";

const mockFetchPostDetail = vi.mocked(fetchPostDetail);

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
});
