import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { ProfileListResponse, ProfileUser } from "../../src/types/profile";

vi.mock("../../src/api/profile", () => ({
  fetchProfileTab: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  getRecentReadHistoryIds: vi.fn(() => []),
}));

import * as profileApi from "../../src/api/profile";
import { useProfileTabs } from "../../src/features/profile/useProfileTabs";

const fetchProfileTabMock = vi.mocked(profileApi.fetchProfileTab);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(tid: number, title: string): ProfileListResponse {
  return { items: [{ tid, title }] };
}

function makeHarness() {
  return useProfileTabs({
    user: ref<ProfileUser | null>({ id: "user-1" }),
    enterGuestState: vi.fn(),
    isMissingSessionError: () => false,
    refreshCurrentSession: vi.fn(async () => false),
  });
}

beforeEach(() => {
  fetchProfileTabMock.mockReset();
});

describe("useProfileTabs request generation", () => {
  it("keeps the newest tab loading when an older tab finishes first", async () => {
    const savedRequest = deferred<ProfileListResponse>();
    const likedRequest = deferred<ProfileListResponse>();
    fetchProfileTabMock
      .mockReturnValueOnce(savedRequest.promise)
      .mockReturnValueOnce(likedRequest.promise);
    const profile = makeHarness();

    const savedLoad = profile.loadProfileList("saved");
    const likedLoad = profile.loadProfileList("liked");

    expect(profile.activeTab.value).toBe("liked");
    expect(profile.listLoading.value).toBe(true);

    savedRequest.resolve(response(10, "旧的收藏"));
    await savedLoad;

    expect(profile.profileItems.value).toEqual([]);
    expect(profile.listLoading.value).toBe(true);

    likedRequest.resolve(response(11, "最新点赞"));
    await likedLoad;

    expect(profile.profileItems.value.map((item) => item.title)).toEqual(["最新点赞"]);
    expect(profile.listLoading.value).toBe(false);
  });

  it("ignores an all-posts response that arrives after the latest posts filter", async () => {
    const allPostsRequest = deferred<ProfileListResponse>();
    const merchantPostsRequest = deferred<ProfileListResponse>();
    fetchProfileTabMock
      .mockReturnValueOnce(allPostsRequest.promise)
      .mockReturnValueOnce(merchantPostsRequest.promise);
    const profile = makeHarness();

    const allPostsLoad = profile.loadProfileList("posts");
    const merchantPostsLoad = profile.selectPostsContentFilter("merchant");

    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(1, "posts", [], {
      contentFilter: "all",
    });
    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(2, "posts", [], {
      contentFilter: "merchant",
    });

    merchantPostsRequest.resolve(response(12, "当前商家内容"));
    await merchantPostsLoad;

    expect(profile.profileItems.value.map((item) => item.title)).toEqual(["当前商家内容"]);
    expect(profile.listLoading.value).toBe(false);

    allPostsRequest.resolve(response(13, "迟到的全部内容"));
    await allPostsLoad;

    expect(profile.activeTab.value).toBe("posts");
    expect(profile.postsContentFilter.value).toBe("merchant");
    expect(profile.profileItems.value.map((item) => item.title)).toEqual(["当前商家内容"]);
    expect(profile.listError.value).toBe("");
  });
});
