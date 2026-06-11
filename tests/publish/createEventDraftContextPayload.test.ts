import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "../../src/api/events";
import { buildPublishPayload } from "../../src/api/publish";

const apiSendMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/api/http", () => ({
  apiGet: vi.fn(),
  apiSend: apiSendMock,
}));

describe("createEvent draft context payload", () => {
  beforeEach(() => {
    apiSendMock.mockReset();
    apiSendMock.mockResolvedValue({ eventId: "event-1", tid: 971 });
  });

  it("omits draftContext when caller has no reviewed draft context", async () => {
    await createEvent({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      participantScope: { visibility: "campus" },
      joinPolicy: "open",
    });

    expect(apiSendMock).toHaveBeenCalledTimes(1);
    const [, options] = apiSendMock.mock.calls[0] as [string, { method?: string; body?: string }];
    const body = JSON.parse(options.body || "{}");

    expect(body).toEqual({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      participantScope: { visibility: "campus" },
      joinPolicy: "open",
    });
    expect(body).not.toHaveProperty("draftContext");
  });

  it("serializes full draftContext in the event publish request body", async () => {
    const draftContext = buildPublishPayload({
      imageUrls: ["https://example.test/event.jpg"],
      title: "Coffee meetup",
      body: "Discuss launch notes",
      tag: "#coffee",
      identityTag: "organizer",
      placeName: "Library",
      visibility: "campus",
      kind: "event",
      event: {
        startsAt: "2026-06-12T09:00",
        endsAt: "2026-06-12T10:00",
        capacity: 24,
        joinPolicy: "approval_required",
        participantScope: { visibility: "campus" },
      },
      candidates: {
        title: "AI coffee meetup",
        bodyCandidate: "AI-polished launch notes",
        inferredKind: "event",
        suggestedComponents: [
          {
            kind: "event",
            payload: {
              startsAt: "2026-06-12T09:00",
              participantScope: { visibility: "campus" },
            },
            label: "补充活动结构",
          },
          {
            kind: "time",
            payload: { startsAt: "2026-06-12T09:00", endsAt: "2026-06-12T10:00" },
            label: "加活动时间",
          },
        ],
      },
    });

    await createEvent({
      title: "Coffee meetup",
      body: "Discuss launch notes",
      participantScope: { visibility: "campus" },
      joinPolicy: "approval_required",
      draftContext,
    });

    expect(apiSendMock).toHaveBeenCalledTimes(1);
    const [path, options] = apiSendMock.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ];
    const body = JSON.parse(options.body || "{}");

    expect(path).toBe("/api/events");
    expect(options.method).toBe("POST");
    expect(body.draftContext).toEqual(draftContext);
    expect(body.draftContext.event).toEqual({
      startsAt: "2026-06-12T09:00",
      endsAt: "2026-06-12T10:00",
      capacity: 24,
      joinPolicy: "approval_required",
      participantScope: { visibility: "campus" },
    });
    expect(body.draftContext.candidates).toEqual({
      title: "AI coffee meetup",
      bodyCandidate: "AI-polished launch notes",
      inferredKind: "event",
      suggestedComponents: [
        {
          kind: "event",
          payload: {
            startsAt: "2026-06-12T09:00",
            participantScope: { visibility: "campus" },
          },
          label: "补充活动结构",
        },
        {
          kind: "time",
          payload: { startsAt: "2026-06-12T09:00", endsAt: "2026-06-12T10:00" },
          label: "加活动时间",
        },
      ],
    });
  });
});
