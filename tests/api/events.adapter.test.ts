import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchEvent } from "../../src/api/events";
import { LianApiError } from "../../src/api/http";

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/http")>();
  return {
    ...actual,
    apiGet: apiGetMock,
  };
});

describe("event detail API adapter", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("requests the encoded event detail path", async () => {
    apiGetMock.mockResolvedValue({ eventId: "evt/path", joinedCount: 0 });

    await fetchEvent("evt/path with space");

    expect(apiGetMock).toHaveBeenCalledOnce();
    expect(apiGetMock).toHaveBeenCalledWith("/api/events/evt%2Fpath%20with%20space");
  });

  it("normalizes the direct event detail DTO", async () => {
    apiGetMock.mockResolvedValue({
      eventId: "evt-42",
      startsAt: "2026-08-10T09:00:00.000Z",
      endsAt: "2026-08-10T11:00:00.000Z",
      location: "Library lawn",
      capacity: 30,
      rewardSummary: "10 points after completion",
      joinedCount: 2,
      status: "completed",
      completedAt: "2026-08-10T11:05:00.000Z",
      rewardSettlement: null,
    });

    await expect(fetchEvent("evt-42")).resolves.toEqual({
      eventId: "evt-42",
      startsAt: "2026-08-10T09:00:00.000Z",
      endsAt: "2026-08-10T11:00:00.000Z",
      location: "Library lawn",
      capacity: 30,
      rewardSummary: "10 points after completion",
      joinedCount: 2,
      status: "completed",
      completedAt: "2026-08-10T11:05:00.000Z",
    });
  });

  it("reuses event aliases, count coercion, and settlement normalization", async () => {
    apiGetMock.mockResolvedValue({
      eventId: "  evt-alias  ",
      startAt: "2026-08-11T09:00:00.000Z",
      endAt: "2026-08-11T10:00:00.000Z",
      capacity: "12",
      participantCount: "7.9",
      rewardSettlement: {
        settlementId: "  stl-7  ",
        settledAt: "2026-08-11T10:05:00.000Z",
        settledBy: "  u-host  ",
        perJoiner: "5",
        joinerCount: "3",
        totalPaid: "15",
        remainder: "2",
        joinerIds: [" u-1 ", 2, ""],
        honorAwarded: { "u-1": "3", "u-2": -1 },
      },
    });

    await expect(fetchEvent("evt-alias")).resolves.toEqual({
      eventId: "evt-alias",
      startsAt: "2026-08-11T09:00:00.000Z",
      endsAt: "2026-08-11T10:00:00.000Z",
      capacity: 12,
      joinedCount: 7,
      rewardSettlement: {
        settlementId: "stl-7",
        settledAt: "2026-08-11T10:05:00.000Z",
        settledBy: "u-host",
        perJoiner: 5,
        joinerCount: 3,
        totalPaid: 15,
        remainder: 2,
        joinerIds: ["u-1", "2"],
        honorAwarded: { "u-1": 3, "u-2": 0 },
      },
    });
  });

  it.each([{}, { eventId: "   ", joinedCount: 1 }, null])(
    "rejects a successful response without a valid eventId: %j",
    async (payload) => {
      apiGetMock.mockResolvedValue(payload);

      const request = fetchEvent("evt-missing");
      const error = await request.then(
        () => null,
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(LianApiError);
      expect(error).toMatchObject({
        name: "LianApiError",
        status: 200,
        code: "MALFORMED_RESPONSE",
        message: "活动详情响应缺少有效 eventId",
      });
    },
  );
});
