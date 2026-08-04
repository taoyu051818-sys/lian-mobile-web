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

  it("posts each unique notification to the existing per-id read endpoint", async () => {
    await notificationsApi.markNotificationsRead([]);
    expect(http.apiSend).not.toHaveBeenCalled();

    await notificationsApi.markNotificationsRead(["n1", "n2", "n1"]);

    expect(http.apiSend).toHaveBeenNthCalledWith(1, "/api/notifications/n1/read", {
      method: "POST",
    });
    expect(http.apiSend).toHaveBeenNthCalledWith(2, "/api/notifications/n2/read", {
      method: "POST",
    });
    expect(http.apiSend).toHaveBeenCalledTimes(2);
  });

  it("rejects ids outside the backend route contract before sending", async () => {
    await expect(notificationsApi.markNotificationsRead(["没有后端通知 ID"])).rejects.toThrow(
      "通知缺少可用于更新已读状态的 ID",
    );
    expect(http.apiSend).not.toHaveBeenCalled();
  });
});
