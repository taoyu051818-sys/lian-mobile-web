import { beforeEach, describe, expect, it, vi } from "vitest";

import { LianApiError } from "../../src/api/http";
import type { NotificationItem, NotificationResponse } from "../../src/types/messages";

vi.mock("../../src/api/notifications", () => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

const notificationsApi = await import("../../src/api/notifications");
const { useNotifications } = await import("../../src/features/messages/useNotifications.ts");

function item(id: string, read = false): NotificationItem {
  return {
    id,
    read,
    kind: "reply",
    title: `通知 ${id}`,
    target: { kind: "detail", tid: Number(id.replace(/\D/g, "")) || 1 },
  };
}

function response(
  items: NotificationItem[],
  hasMore = false,
  nextOffset = items.length,
): NotificationResponse {
  return { items, hasMore, nextOffset };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the first page and appends more notifications without duplicating overlap", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1"), item("n2")], true, 2))
      .mockResolvedValueOnce(response([item("n2"), item("n3")], false, 4));

    const notifications = useNotifications();

    await notifications.loadNotifications();
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    expect(notifications.notificationHasMore.value).toBe(true);

    await notifications.loadMoreNotifications();

    expect(notificationsApi.fetchNotifications).toHaveBeenNthCalledWith(1, 0, 30);
    expect(notificationsApi.fetchNotifications).toHaveBeenNthCalledWith(2, 2, 30);
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual([
      "n1",
      "n2",
      "n3",
    ]);
    expect(notifications.notificationHasMore.value).toBe(false);
  });

  it("preserves a local read mark when the opened notification appears again in a later page", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1", false)], true, 1))
      .mockResolvedValueOnce(response([item("n1", false), item("n2", false)], false, 3));
    vi.mocked(notificationsApi.markNotificationsRead).mockResolvedValue(undefined);

    const notifications = useNotifications();
    await notifications.loadNotifications();
    await notifications.openNotification(notifications.notificationItems.value[0]);

    await notifications.loadMoreNotifications();

    expect(notifications.notificationItems.value.map((entry) => [entry.id, entry.read])).toEqual([
      ["n1", true],
      ["n2", false],
    ]);
  });

  it("keeps separate notifications that do not have backend ids", async () => {
    const first = { ...item("n1"), id: undefined, tid: 42, title: "同一条帖子" };
    const second = { ...item("n2"), id: undefined, tid: 42, title: "同一条帖子" };
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([first], true, 1))
      .mockResolvedValueOnce(response([second], false, 2));

    const notifications = useNotifications();

    await notifications.loadNotifications();
    await notifications.loadMoreNotifications();

    expect(notifications.notificationItems.value).toHaveLength(2);
    expect(notifications.notificationItems.value).toEqual([first, second]);
  });

  it("does not accumulate an exact id-less NodeBB row repeated on every page", async () => {
    const repeated = {
      ...item("n1"),
      id: undefined,
      tid: 42,
      title: "重复的 NodeBB 通知",
      timestampISO: "2026-08-04T12:00:00Z",
    };
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([repeated], true, 1))
      .mockResolvedValueOnce(response([repeated], false, 2));

    const notifications = useNotifications();
    await notifications.loadNotifications();
    await notifications.loadMoreNotifications();

    expect(notifications.notificationItems.value).toEqual([repeated]);
  });

  it("falls back to the accumulated offset when a page omits nextOffset", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce({ items: [item("n1"), item("n2")], hasMore: true })
      .mockResolvedValueOnce({ items: [item("n2"), item("n3")], hasMore: true })
      .mockResolvedValueOnce({ items: [], hasMore: false });

    const notifications = useNotifications();

    await notifications.loadNotifications();
    await notifications.loadMoreNotifications();
    await notifications.loadMoreNotifications();

    expect(notificationsApi.fetchNotifications).toHaveBeenNthCalledWith(2, 2, 30);
    expect(notificationsApi.fetchNotifications).toHaveBeenNthCalledWith(3, 4, 30);
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual([
      "n1",
      "n2",
      "n3",
    ]);
  });

  it("does not post a read request for already-read notifications", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", true)]));

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.openNotification(notifications.notificationItems.value[0]);

    expect(notifications.notificationItems.value[0]?.read).toBe(true);
    expect(notificationsApi.markNotificationsRead).not.toHaveBeenCalled();
  });

  it("does not fetch more notifications when the current page is complete", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(
      response([item("n1")], false, 1),
    );

    const notifications = useNotifications();
    await notifications.loadNotifications();
    vi.mocked(notificationsApi.fetchNotifications).mockClear();

    await notifications.loadMoreNotifications();

    expect(notificationsApi.fetchNotifications).not.toHaveBeenCalled();
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1"]);
  });

  it("does not dispatch concurrent load-more requests while a page is already loading", async () => {
    let resolveSecondPage: ((value: NotificationResponse) => void) | undefined;
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1")], true, 1))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondPage = resolve;
        }),
      );

    const notifications = useNotifications();
    await notifications.loadNotifications();
    vi.mocked(notificationsApi.fetchNotifications).mockClear();

    const firstLoadMore = notifications.loadMoreNotifications();
    await notifications.loadMoreNotifications();
    resolveSecondPage?.(response([item("n2")], false, 2));
    await firstLoadMore;

    expect(notificationsApi.fetchNotifications).toHaveBeenCalledTimes(1);
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1", "n2"]);
  });

  it("keeps a successful read-on-open mark when a reset load resolves after the open", async () => {
    let resolveReset: ((value: NotificationResponse) => void) | undefined;
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1", false)], true, 1))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
      );
    vi.mocked(notificationsApi.markNotificationsRead).mockResolvedValue(undefined);

    const notifications = useNotifications();
    await notifications.loadNotifications();
    const staleItem = notifications.notificationItems.value[0];

    const resetLoad = notifications.loadNotifications();
    await notifications.openNotification(staleItem);
    resolveReset?.(response([item("n1", false)], false, 1));
    await resetLoad;

    expect(notifications.notificationItems.value.map((entry) => [entry.id, entry.read])).toEqual([
      ["n1", true],
    ]);
    expect(notifications.notificationFetchState.value).toBe("idle");
  });

  it("marks unread notifications read locally when opened and posts the read payload", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", false)]));
    vi.mocked(notificationsApi.markNotificationsRead).mockResolvedValue(undefined);

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.openNotification(notifications.notificationItems.value[0]);

    expect(notifications.notificationItems.value[0]?.read).toBe(true);
    expect(notificationsApi.markNotificationsRead).toHaveBeenCalledWith(["n1"]);
  });

  it("keeps opening immediate when the backend read request is still pending", async () => {
    let resolveRead: (() => void) | undefined;
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", false)]));
    vi.mocked(notificationsApi.markNotificationsRead).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRead = resolve;
      }),
    );

    const notifications = useNotifications();
    await notifications.loadNotifications();

    const openResult = notifications.openNotification(notifications.notificationItems.value[0]);

    expect(openResult).toBeUndefined();
    expect(notifications.notificationItems.value[0]?.read).toBe(true);
    expect(notificationsApi.markNotificationsRead).toHaveBeenCalledWith(["n1"]);

    resolveRead?.();
  });

  it("rolls back the local read mark when the backend read endpoint is unavailable", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", false)]));
    vi.mocked(notificationsApi.markNotificationsRead).mockRejectedValue(new Error("not found"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const notifications = useNotifications();
    await notifications.loadNotifications();

    expect(() =>
      notifications.openNotification(notifications.notificationItems.value[0]),
    ).not.toThrow();

    await new Promise((resolve) => queueMicrotask(resolve));

    expect(notifications.notificationItems.value[0]?.read).toBe(false);
    expect(notifications.notificationFetchState.value).toBe("idle");
    expect(consoleError).toHaveBeenCalledWith("notification mark-read failed", expect.any(Error));
    consoleError.mockRestore();
  });

  it("makes a network-failed read mutation retryable", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", false)]));
    vi.mocked(notificationsApi.markNotificationsRead).mockRejectedValue(
      new TypeError("NetworkError when fetching"),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const notifications = useNotifications();
    await notifications.loadNotifications();

    notifications.openNotification(notifications.notificationItems.value[0]);
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(notifications.notificationItems.value[0]?.read).toBe(false);
    expect(notifications.notificationFetchState.value).toBe("idle");

    vi.mocked(notificationsApi.markNotificationsRead).mockResolvedValueOnce(undefined);
    notifications.openNotification(notifications.notificationItems.value[0]);
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(notificationsApi.markNotificationsRead).toHaveBeenCalledTimes(2);
    expect(notifications.notificationItems.value[0]?.read).toBe(true);
    consoleError.mockRestore();
  });

  it("keeps read-on-open failures out of fetch state", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(response([item("n1", false)]));
    vi.mocked(notificationsApi.markNotificationsRead).mockRejectedValue(
      new LianApiError("expired", 401),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.openNotification(notifications.notificationItems.value[0]);

    expect(notifications.notificationItems.value[0]?.read).toBe(false);
    expect(notifications.notificationFetchState.value).toBe("idle");
    consoleError.mockRestore();
  });

  it("posts fallback notification ids when opening normalized items", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(
      response([{ ...item("n1", false), id: "同城招募" }]),
    );
    vi.mocked(notificationsApi.markNotificationsRead).mockResolvedValue(undefined);

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.openNotification(notifications.notificationItems.value[0]);

    expect(notifications.notificationItems.value[0]?.read).toBe(true);
    expect(notificationsApi.markNotificationsRead).toHaveBeenCalledWith(["同城招募"]);
  });

  it("preserves the current page and reports an error when load more fails", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1")], true, 1))
      .mockRejectedValueOnce(new Error("page failed"));

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.loadMoreNotifications();

    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1"]);
    expect(notifications.notificationHasMore.value).toBe(true);
    expect(notifications.notificationFetchState.value).toBe("error");
  });

  it("retries pagination after a load-more error while preserving accumulated items", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1")], true, 1))
      .mockRejectedValueOnce(new Error("page failed"))
      .mockResolvedValueOnce(response([item("n2")], false, 2));

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.loadMoreNotifications();
    await notifications.loadMoreNotifications();

    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    expect(notifications.notificationFetchState.value).toBe("idle");
    expect(notifications.notificationHasMore.value).toBe(false);
  });

  it("retries the failed pagination request without resetting accumulated items", async () => {
    vi.mocked(notificationsApi.fetchNotifications)
      .mockResolvedValueOnce(response([item("n1")], true, 1))
      .mockRejectedValueOnce(new Error("page failed"))
      .mockResolvedValueOnce(response([item("n2")], false, 2));

    const notifications = useNotifications();
    await notifications.loadNotifications();

    await notifications.loadMoreNotifications();
    await notifications.retryNotifications();

    expect(notificationsApi.fetchNotifications).toHaveBeenNthCalledWith(3, 1, 30);
    expect(notifications.notificationItems.value.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    expect(notifications.notificationFetchState.value).toBe("idle");
    expect(notifications.notificationHasMore.value).toBe(false);
  });

  it("keeps auth and generic fetch failures distinct from empty inbox", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockRejectedValueOnce(
      new LianApiError("login", 401),
    );

    const notifications = useNotifications();
    await notifications.loadNotifications();

    expect(notifications.notificationItems.value).toEqual([]);
    expect(notifications.notificationFetchState.value).toBe("auth-required");

    vi.mocked(notificationsApi.fetchNotifications).mockRejectedValueOnce(new Error("boom"));
    await notifications.loadNotifications();

    expect(notifications.notificationItems.value).toEqual([]);
    expect(notifications.notificationFetchState.value).toBe("error");
  });
});
