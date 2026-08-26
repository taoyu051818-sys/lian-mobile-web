import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api/http", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

const http = await import("../../src/api/http");
const notificationsApi = await import("../../src/api/notifications.ts");

describe("notification API pagination and read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches notifications with offset and limit query params", async () => {
    vi.mocked(http.apiGet).mockResolvedValue({ items: [], hasMore: true, nextOffset: 15 });

    const result = await notificationsApi.fetchNotifications(5, 10);

    expect(http.apiGet).toHaveBeenCalledWith("/api/messages?limit=10&offset=5");
    expect(result).toEqual({ items: [], hasMore: true, nextOffset: 15 });
  });

  it("normalizes pagination defaults without dropping nextOffset zero", () => {
    expect(
      notificationsApi.normalizeNotificationResponse({ items: [], nextOffset: 0 }, 30).nextOffset,
    ).toBe(0);
    expect(
      notificationsApi.normalizeNotificationResponse({ items: [{ id: "n1" }] }, 10).nextOffset,
    ).toBe(11);
  });

  it("normalizes backend read indicators without forcing missing values unread", () => {
    expect(
      notificationsApi.normalizeNotificationResponse({ items: [{ id: "n1", read: true }] })
        .items?.[0]?.read,
    ).toBe(true);
    expect(
      notificationsApi.normalizeNotificationResponse({ items: [{ id: "n2" }] }).items?.[0]?.read,
    ).toBe(true);
  });

  it("preserves the backend provider source needed for a scoped read mutation", () => {
    const result = notificationsApi.normalizeNotificationResponse({
      items: [
        { id: "local", source: "lian" },
        { id: "reply", source: "nodebb" },
      ],
    });

    expect(result.items?.map((entry) => entry.source)).toEqual(["lian", "nodebb"]);
  });

  it("preserves a positive reply pid without replacing the tid detail target", () => {
    const result = notificationsApi.normalizeNotificationResponse({
      items: [{ id: "reply", source: "nodebb", tid: 77, pid: 901, type: "new-reply" }],
    });

    expect(result.items?.[0]).toMatchObject({
      id: "reply",
      source: "nodebb",
      tid: 77,
      pid: 901,
      target: { kind: "detail", tid: 77 },
    });
    expect(
      notificationsApi.normalizeNotificationResponse({
        items: [{ id: "invalid-pid", tid: 77, pid: 0 }],
      }).items?.[0]?.pid,
    ).toBeUndefined();
  });

  it("normalizes notification-array responses for pagination", () => {
    const result = notificationsApi.normalizeNotificationResponse(
      { notifications: [{ id: "n1", title: "通知" }], hasMore: true },
      20,
    );

    expect(result.items?.map((entry) => entry.id)).toEqual(["n1"]);
    expect(result.items?.[0]?.read).toBe(true);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(21);
  });

  it("flattens the backend LIAN pagination envelope without counting repeated NodeBB items", () => {
    const result = notificationsApi.normalizeNotificationResponse(
      {
        items: [
          { id: "lian-11", title: "LIAN page row" },
          { id: "nodebb-repeat", title: "NodeBB row repeated on every page" },
        ],
        pagination: {
          limit: 10,
          offset: 10,
          lianCount: 1,
          lianHasMore: true,
        },
      },
      10,
    );

    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(11);
  });

  it("keeps the LIAN offset stable when a page only contains repeated NodeBB rows", () => {
    const result = notificationsApi.normalizeNotificationResponse(
      {
        items: [{ id: "nodebb-repeat" }],
        pagination: {
          limit: 30,
          offset: 60,
          lianCount: 0,
          lianHasMore: false,
        },
      },
      60,
    );

    expect(result.hasMore).toBe(false);
    expect(result.nextOffset).toBe(60);
  });

  it("clamps negative offsets before requesting and normalizing pagination", async () => {
    vi.mocked(http.apiGet).mockResolvedValue({ items: [{ id: "n1" }], hasMore: false });

    const result = await notificationsApi.fetchNotifications(-5, 10);

    expect(http.apiGet).toHaveBeenCalledWith("/api/messages?limit=10&offset=0");
    expect(result.nextOffset).toBe(1);
  });

  it("narrows read mutation to one notification identity per call", async () => {
    await notificationsApi.markNotificationRead("n1");

    expect(http.apiSend).toHaveBeenCalledWith("/api/notifications/n1/read", {
      method: "POST",
    });
    expect(http.apiSend).toHaveBeenCalledTimes(1);
  });

  it("echoes the item source when posting a provider-scoped read", async () => {
    await notificationsApi.markNotificationRead("reply-1", "nodebb");

    expect(http.apiSend).toHaveBeenCalledWith("/api/notifications/reply-1/read?source=nodebb", {
      method: "POST",
    });
  });

  it("rejects ids outside the backend route contract before sending", async () => {
    await expect(notificationsApi.markNotificationRead("没有后端通知 ID")).rejects.toThrow(
      "通知缺少可用于更新已读状态的 ID",
    );
    expect(http.apiSend).not.toHaveBeenCalled();
  });
});
