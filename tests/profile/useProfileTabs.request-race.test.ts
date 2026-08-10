import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { customRef, ref, watch, type Ref } from "vue";
import type { ProfileListResponse, ProfileUser } from "../../src/types/profile";

vi.mock("../../src/api/profile", () => ({
  fetchProfileTab: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  accountReadHistoryScope: vi.fn((userId: string) => {
    const normalized = typeof userId === "string" ? userId.trim() : "";
    return normalized ? { kind: "account", userId: normalized } : null;
  }),
  getRecentReadHistoryIds: vi.fn((scope: { kind: string; userId?: string }) => {
    if (scope?.userId === "user-a") return [101];
    if (scope?.userId === "user-b") return [202];
    if (scope?.userId === "user-1") return [11];
    return [];
  }),
}));

import * as profileApi from "../../src/api/profile";
import { useProfileTabs } from "../../src/features/profile/useProfileTabs";

const fetchProfileTabMock = vi.mocked(profileApi.fetchProfileTab);

beforeAll(() => {
  vi.stubGlobal("localStorage", {} as Storage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

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

const MISSING_SESSION = new Error("missing session");

function makeHarness(
  options: {
    initialUser?: ProfileUser | null;
    isMissingSessionError?: (error: unknown) => boolean;
    refreshCurrentSession?: (user: Ref<ProfileUser | null>) => Promise<ProfileUser | null>;
    resetAccountPresentation?: () => void;
  } = {},
) {
  const user = ref<ProfileUser | null>(options.initialUser ?? { id: "user-1" });
  const tabs = useProfileTabs({
    user,
    enterGuestState: vi.fn(),
    isMissingSessionError:
      options.isMissingSessionError ?? ((error: unknown) => error === MISSING_SESSION),
    refreshCurrentSession: vi.fn(async () =>
      options.refreshCurrentSession ? options.refreshCurrentSession(user) : null,
    ),
    resetAccountPresentation: options.resetAccountPresentation ?? vi.fn(),
  });
  return { ...tabs, user };
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

  it("keeps a reset A response from committing or clearing B's loading state", async () => {
    const accountARequest = deferred<ProfileListResponse>();
    const accountBRequest = deferred<ProfileListResponse>();
    fetchProfileTabMock
      .mockReturnValueOnce(accountARequest.promise)
      .mockReturnValueOnce(accountBRequest.promise);
    const profile = makeHarness({ initialUser: { id: "user-a" } });

    const accountALoad = profile.loadProfileList("history");
    profile.resetList();
    profile.user.value = { id: "user-b" };
    const accountBLoad = profile.loadProfileList("history");

    accountARequest.resolve(response(101, "account A history"));
    await accountALoad;

    expect(profile.profileItems.value).toEqual([]);
    expect(profile.listLoading.value).toBe(true);

    accountBRequest.resolve(response(202, "account B history"));
    await accountBLoad;

    expect(profile.profileItems.value).toEqual([{ tid: 202, title: "account B history" }]);
    expect(profile.listLoading.value).toBe(false);
  });
});

describe("useProfileTabs read-history ownership", () => {
  it("derives history ids from the current account for every new request", async () => {
    fetchProfileTabMock.mockResolvedValue({ items: [] });
    const profile = makeHarness({ initialUser: { id: "user-a" } });

    await profile.loadProfileList("history");
    profile.user.value = { id: "user-b" };
    await profile.loadProfileList("history");

    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(1, "history", [101], {
      contentFilter: "all",
    });
    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(2, "history", [202], {
      contentFilter: "all",
    });
  });

  it("supplies no local history for guest or authenticated users without an id", async () => {
    fetchProfileTabMock.mockResolvedValue({ items: [] });
    const profile = makeHarness({ initialUser: null });
    profile.user.value = null;

    await profile.loadProfileList("history");
    profile.user.value = { username: "missing-id" };
    await profile.loadProfileList("history");

    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(1, "history", [], {
      contentFilter: "all",
    });
    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(2, "history", [], {
      contentFilter: "all",
    });
  });

  it("rebuilds history ids for B when a 401 refresh changes A to B", async () => {
    fetchProfileTabMock
      .mockRejectedValueOnce(MISSING_SESSION)
      .mockResolvedValueOnce(response(202, "account B history"));
    const profile = makeHarness({
      initialUser: { id: "user-a" },
      refreshCurrentSession: async () => ({ id: "user-b" }),
    });

    await profile.loadProfileList("history");

    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(1, "history", [101], {
      contentFilter: "all",
    });
    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(2, "history", [202], {
      contentFilter: "all",
    });
    expect(profile.profileItems.value).toEqual([{ tid: 202, title: "account B history" }]);
  });

  it("keeps the same account's ids when a 401 refresh retains that account", async () => {
    fetchProfileTabMock
      .mockRejectedValueOnce(MISSING_SESSION)
      .mockResolvedValueOnce(response(101, "account A history"));
    const profile = makeHarness({
      initialUser: { id: "user-a" },
      refreshCurrentSession: async () => ({ id: "user-a", username: "refreshed A" }),
    });

    await profile.loadProfileList("history");

    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(1, "history", [101], {
      contentFilter: "all",
    });
    expect(fetchProfileTabMock).toHaveBeenNthCalledWith(2, "history", [101], {
      contentFilter: "all",
    });
    expect(profile.user.value).toEqual({ id: "user-a", username: "refreshed A" });
  });

  it("orders A-to-B list reset, external reset, identity commit, and B retry", async () => {
    const operations: string[] = [];
    let liveUser: ProfileUser | null = { id: "user-a", username: "A" };
    const user = customRef<ProfileUser | null>((track, trigger) => ({
      get() {
        track();
        return liveUser;
      },
      set(value) {
        liveUser = value;
        operations.push(`user:${value?.id ?? "guest"}`);
        trigger();
      },
    }));
    fetchProfileTabMock
      .mockRejectedValueOnce(MISSING_SESSION)
      .mockImplementationOnce(async (_tab, tids) => {
        operations.push(`retry:${tids.join(",")}`);
        return response(202, "account B history");
      });
    const profile = useProfileTabs({
      user,
      enterGuestState: vi.fn(),
      isMissingSessionError: (error) => error === MISSING_SESSION,
      refreshCurrentSession: vi.fn(async () => ({ id: "user-b", username: "B" })),
      resetAccountPresentation: () => operations.push("external-reset"),
    });
    profile.profileItems.value = [{ tid: 101, title: "account A history" }];
    watch(
      profile.profileItems,
      (items) => {
        if (items.length === 0) operations.push("list-reset");
      },
      { flush: "sync" },
    );

    await profile.loadProfileList("history");

    expect(operations).toEqual(["list-reset", "external-reset", "user:user-b", "retry:202"]);
    expect(profile.profileItems.value).toEqual([{ tid: 202, title: "account B history" }]);
  });

  it("does not reset a current collection when refresh retains account A", async () => {
    const resetAccountPresentation = vi.fn();
    const collectionSnapshots: number[] = [];
    fetchProfileTabMock
      .mockRejectedValueOnce(MISSING_SESSION)
      .mockResolvedValueOnce(response(101, "refreshed account A history"));
    const profile = makeHarness({
      initialUser: { id: "user-a", username: "old A" },
      refreshCurrentSession: async () => ({ id: "user-a", username: "new A" }),
      resetAccountPresentation,
    });
    profile.profileItems.value = [{ tid: 100, title: "current account A row" }];
    watch(profile.profileItems, (items) => collectionSnapshots.push(items.length), {
      flush: "sync",
    });

    await profile.loadProfileList("history");

    expect(resetAccountPresentation).not.toHaveBeenCalled();
    expect(collectionSnapshots).not.toContain(0);
    expect(profile.user.value).toEqual({ id: "user-a", username: "new A" });
    expect(profile.profileItems.value).toEqual([
      { tid: 101, title: "refreshed account A history" },
    ]);
  });

  it("drops a refresh candidate after the owning list generation is invalidated", async () => {
    const refreshCandidate = deferred<ProfileUser | null>();
    const refreshStarted = deferred<void>();
    const resetAccountPresentation = vi.fn();
    fetchProfileTabMock.mockRejectedValueOnce(MISSING_SESSION);
    const profile = makeHarness({
      initialUser: { id: "user-a", username: "A" },
      refreshCurrentSession: async () => {
        refreshStarted.resolve();
        return refreshCandidate.promise;
      },
      resetAccountPresentation,
    });

    const accountALoad = profile.loadProfileList("history");
    await refreshStarted.promise;
    profile.resetList();
    refreshCandidate.resolve({ id: "user-b", username: "B" });
    await accountALoad;

    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);
    expect(resetAccountPresentation).not.toHaveBeenCalled();
    expect(profile.user.value).toEqual({ id: "user-a", username: "A" });
    expect(profile.profileItems.value).toEqual([]);
    expect(profile.listLoading.value).toBe(false);
  });
});
