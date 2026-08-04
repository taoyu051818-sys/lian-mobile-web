import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelResponse } from "../../src/types/messages";

vi.mock("vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue")>();
  return {
    ...actual,
    onBeforeUnmount: vi.fn(),
    onMounted: vi.fn(),
  };
});

vi.mock("../../src/api/channel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/channel")>();
  return {
    ...actual,
    fetchChannelMessages: vi.fn(),
    markChannelMessagesRead: vi.fn().mockResolvedValue(undefined),
  };
});

const channelApi = await import("../../src/api/channel");
const { useChannelMessages } = await import("../../src/features/messages/useChannelMessages");

function response(
  id: string,
  { hasMore = false, nextOffset = 0 }: { hasMore?: boolean; nextOffset?: number } = {},
): ChannelResponse {
  return {
    items: [{ id, content: id, timestampISO: "2026-01-01T00:00:00.000Z" }],
    hasMore,
    nextOffset,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("useChannelMessages visibility filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(channelApi.markChannelMessagesRead).mockResolvedValue(undefined);
    vi.stubGlobal("document", { documentElement: { scrollHeight: 1000 } });
    vi.stubGlobal("window", {
      innerHeight: 800,
      scrollTo: vi.fn(),
      scrollY: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps pagination on the active filter and resets it when the filter changes", async () => {
    vi.mocked(channelApi.fetchChannelMessages)
      .mockResolvedValueOnce(response("public-1", { hasMore: true, nextOffset: 30 }))
      .mockResolvedValueOnce(response("public-older", { nextOffset: 60 }))
      .mockResolvedValueOnce(response("campus-1", { nextOffset: 30 }));

    const channel = useChannelMessages();

    await channel.loadChannel(true);
    await channel.loadChannel(false);
    await channel.setChannelVisibilityFilter("campus");

    expect(channelApi.fetchChannelMessages).toHaveBeenNthCalledWith(1, 0, 30, undefined);
    expect(channelApi.fetchChannelMessages).toHaveBeenNthCalledWith(2, 30, 30, undefined);
    expect(channelApi.fetchChannelMessages).toHaveBeenNthCalledWith(3, 0, 30, "campus");
    expect(channel.channelVisibilityFilter.value).toBe("campus");
    expect(channel.channelItems.value.map((item) => item.id)).toEqual(["campus-1"]);
    expect(channel.channelHasMore.value).toBe(false);
  });

  it("ignores an older response after a new visibility filter starts loading", async () => {
    const unfiltered = deferred<ChannelResponse>();
    const campus = deferred<ChannelResponse>();
    vi.mocked(channelApi.fetchChannelMessages)
      .mockReturnValueOnce(unfiltered.promise)
      .mockReturnValueOnce(campus.promise);

    const channel = useChannelMessages();
    const unfilteredLoad = channel.loadChannel(true);
    const campusLoad = channel.setChannelVisibilityFilter("campus");

    unfiltered.resolve(response("stale-public", { hasMore: true, nextOffset: 30 }));
    await unfilteredLoad;

    expect(channel.channelItems.value).toEqual([]);
    expect(channel.channelLoading.value).toBe(true);

    campus.resolve(response("current-campus", { nextOffset: 30 }));
    await campusLoad;

    expect(channel.channelItems.value.map((item) => item.id)).toEqual(["current-campus"]);
    expect(channel.channelVisibilityFilter.value).toBe("campus");
    expect(channel.channelLoading.value).toBe(false);
    expect(channel.channelError.value).toBe("");
  });

  it("does not merge an old pagination page after a filter reset", async () => {
    const oldPage = deferred<ChannelResponse>();
    vi.mocked(channelApi.fetchChannelMessages)
      .mockResolvedValueOnce(response("public-1", { hasMore: true, nextOffset: 30 }))
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce(response("school-1", { nextOffset: 30 }));

    const channel = useChannelMessages();
    await channel.loadChannel(true);

    const oldPageLoad = channel.loadChannel(false);
    await channel.setChannelVisibilityFilter("school");

    oldPage.resolve(response("stale-public-page", { nextOffset: 60 }));
    await oldPageLoad;

    expect(channelApi.fetchChannelMessages).toHaveBeenNthCalledWith(2, 30, 30, undefined);
    expect(channelApi.fetchChannelMessages).toHaveBeenNthCalledWith(3, 0, 30, "school");
    expect(channel.channelItems.value.map((item) => item.id)).toEqual(["school-1"]);
    expect(channel.channelVisibilityFilter.value).toBe("school");
    expect(channel.channelLoading.value).toBe(false);
  });
});
