/**
 * Event / Help / Errand API client stubs (PRD V0.1 §11.2, §11.3, §11.4).
 *
 * Every function below is intentionally thin — it just shapes a request and
 * returns the parsed response. Business logic and authorization live in the
 * backend; the frontend stays a transport.
 *
 * Backends without these routes return 404. Surfaces that consume the events
 * API today are limited to the publish flow (audience options) and the
 * future event detail page; keep callers tolerant of 404s.
 */

import { apiGet, apiSend } from "./http";
import type {
  ErrandMode,
  ErrandOrder,
  ErrandRunnerLocation,
  EventJoinPolicy,
  EventPostExtension,
  EventReward,
  HelpPostExtension,
  HelpStatus,
} from "../types/post-extensions";
import type { Audience } from "../types/audience";
import type { PostLocation } from "../types/post";

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  body: string;
  participantScope: Audience;
  allowedOrganizations?: string[];
  reward?: EventReward;
  startAt?: string;
  endAt?: string;
  location?: PostLocation;
  capacity?: number;
  joinPolicy: EventJoinPolicy;
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
  return apiGet<EventPostExtension>(`/api/events/${encodeURIComponent(eventId)}`);
}

export async function joinEvent(eventId: string): Promise<EventPostExtension> {
  return apiSend<EventPostExtension>(`/api/events/${encodeURIComponent(eventId)}/join`, {
    method: "POST",
  });
}

export async function cancelJoinEvent(eventId: string): Promise<EventPostExtension> {
  return apiSend<EventPostExtension>(`/api/events/${encodeURIComponent(eventId)}/cancel-join`, {
    method: "POST",
  });
}

export async function completeEvent(eventId: string): Promise<EventPostExtension> {
  return apiSend<EventPostExtension>(`/api/events/${encodeURIComponent(eventId)}/complete`, {
    method: "POST",
  });
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
    body: JSON.stringify({ eventTid }),
  });
}

export async function unlinkHelpFromEvent(helpId: string): Promise<HelpPostExtension> {
  return apiSend<HelpPostExtension>(`/api/help/${encodeURIComponent(helpId)}/unlink-event`, {
    method: "POST",
  });
}

export async function resolveHelp(helpId: string, status: HelpStatus): Promise<HelpPostExtension> {
  return apiSend<HelpPostExtension>(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Errand (PRD V0.1 §6.4 — V0.1 ships only the contract)
// ---------------------------------------------------------------------------

export interface CreateErrandOrderInput {
  merchantPostId?: number;
  pickupLocation: PostLocation;
  dropoffLocation: PostLocation;
  mode: ErrandMode;
  feeAmount: number;
}

export async function createErrandOrder(input: CreateErrandOrderInput): Promise<ErrandOrder> {
  return apiSend<ErrandOrder>("/api/errands/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchErrandOrder(orderId: string): Promise<ErrandOrder> {
  return apiGet<ErrandOrder>(`/api/errands/orders/${encodeURIComponent(orderId)}`);
}

export async function reportRunnerLocation(location: ErrandRunnerLocation): Promise<{ ok: true }> {
  return apiSend<{ ok: true }>("/api/errands/runner/location", {
    method: "POST",
    body: JSON.stringify(location),
  });
}
