/**
 * Event / Help API client stubs (PRD V0.1 §11.2, §11.3).
 *
 * Every function below is intentionally thin — it just shapes a request and
 * returns the parsed response. Business logic and authorization live in the
 * backend; the frontend stays a transport.
 *
 * Backends without these routes return 404. Surfaces that consume the events
 * API today are limited to the publish flow (audience options) and the
 * future event detail page; keep callers tolerant of 404s.
 */

import { apiGet, apiSend, LianApiError } from "./http";
import {
  normalizeEventCompleteResult,
  normalizeEventExtension,
  normalizeEventJoinResult,
} from "../platform/api-normalizers";
import type {
  EventJoinPolicy,
  EventJoinResult,
  EventPostExtension,
  HelpPostExtension,
} from "../types/post-extensions";
import type { Audience } from "../types/audience";
import type { PostLocation } from "../types/post";
import type { PublishPayload } from "../types/publish";

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  body: string;
  participantScope: Audience;
  allowedOrganizations?: string[];
  startsAt?: string;
  endsAt?: string;
  location?: PostLocation;
  capacity?: number;
  rewardSummary?: string;
  joinPolicy: EventJoinPolicy;
  draftContext?: PublishPayload;
}

export interface CreateEventResponse {
  eventId: string;
  tid: number;
}

export async function createEvent(input: CreateEventInput): Promise<CreateEventResponse> {
  return apiSend<CreateEventResponse>("/api/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchEvent(eventId: string): Promise<EventPostExtension> {
  const data = await apiGet<unknown>(`/api/events/${encodeURIComponent(eventId)}`);
  const event = normalizeEventExtension(data);
  if (!event) {
    throw new LianApiError("活动详情响应缺少有效 eventId", 200, "MALFORMED_RESPONSE");
  }
  return event;
}

export async function joinEvent(eventId: string): Promise<EventJoinResult> {
  const data = await apiSend<unknown>(`/api/events/${encodeURIComponent(eventId)}/join`, {
    method: "POST",
  });
  return normalizeEventJoinResult(data);
}

export async function cancelJoinEvent(eventId: string): Promise<EventJoinResult> {
  const data = await apiSend<unknown>(`/api/events/${encodeURIComponent(eventId)}/cancel-join`, {
    method: "POST",
  });
  return normalizeEventJoinResult(data);
}

export interface EventCompleteResult {
  eventId: string;
  status: "completed";
  joinedCount: number;
  completedAt: string;
}

/**
 * Issue #703 — `POST /api/events/:eventId/complete` (creator/admin action).
 *
 * Backend (`event-routes.js#handleEventComplete`) returns
 * `{ ok, eventId, status: "completed", joinedCount, completedAt }`.
 * Idempotent: a second call on an already-completed event returns 200 with
 * the original `completedAt`. Frontend treats every non-2xx as soft-fail.
 */
export async function completeEvent(eventId: string): Promise<EventCompleteResult> {
  const data = await apiSend<unknown>(`/api/events/${encodeURIComponent(eventId)}/complete`, {
    method: "POST",
  });
  return normalizeEventCompleteResult(data);
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

export async function linkHelpToEvent(
  helpId: string,
  eventTid: number,
): Promise<HelpPostExtension> {
  return apiSend<HelpPostExtension>(`/api/help/${encodeURIComponent(helpId)}/link-event`, {
    method: "POST",
    body: JSON.stringify({ eventId: String(eventTid) }),
  });
}

export async function unlinkHelpFromEvent(helpId: string): Promise<HelpPostExtension> {
  return apiSend<HelpPostExtension>(`/api/help/${encodeURIComponent(helpId)}/unlink-event`, {
    method: "POST",
  });
}

export async function resolveHelp(helpId: string): Promise<HelpPostExtension> {
  return apiSend<HelpPostExtension>(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
    method: "POST",
  });
}
