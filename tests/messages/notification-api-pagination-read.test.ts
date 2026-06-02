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
    expect(notificationsApi.normalizeNotificationResponse({ items: [{ id: "n1" }] }, 10).nextOffset).toBe(
      11,
    );
  });

  it("normalizes backend read indicators without forcing missing values unread", () => {
    expect(
      notificationsApi.normalizeNotificationResponse({ items: [{ id: "n1", read: true }] }).items?.[0]
        ?.read,
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
  it("clamps negative offsets before requesting and normalizing pagination", async () => {
    vi.mocked(http.apiGet).mockResolvedValue({ items: [{ id: "n1" }], hasMore: false });

    const result = await notificationsApi.fetchNotifications(-5, 10);

    expect(http.apiGet).toHaveBeenCalledWith("/api/messages?limit=10&offset=0");
    expect(result.nextOffset).toBe(1);
  });

  it("posts the expected read payload and skips empty read batches", async () => {
    await notificationsApi.markNotificationsRead([]);
    expect(http.apiSend).not.toHaveBeenCalled();

    await notificationsApi.markNotificationsRead(["n1"]);

    expect(http.apiSend).toHaveBeenCalledWith("/api/messages/read", {
      method: "POST",
      body: JSON.stringify({ eventIds: ["n1"] }),
    });
  });
});
