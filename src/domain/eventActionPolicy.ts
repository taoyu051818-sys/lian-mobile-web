/**
 * Event action policy (PRD V0.1 §6.3 / §11.2).
 *
 * Pure function — given the event extension, the viewer's audience eligibility,
 * and whether the viewer has already joined, decide whether the join button
 * should be enabled, and if not, why.
 *
 * Stays in `src/domain/` so it can be unit-tested without Vue refs and reused
 * by feed cards, detail panels, or any future surface that needs the same gate.
 */

import type { Audience } from "../types/audience";
import type { EventPostExtension, EventStatus } from "../types/post-extensions";

export type EventActionMode = "join" | "cancel" | "disabled";

export interface EventActionPlan {
  /** What the primary button should do. */
  mode: EventActionMode;
  /** True iff the action button is clickable. */
  enabled: boolean;
  /** Disabled reason key. Empty string when enabled. */
  reasonKey:
    | ""
    | "notOpen"
    | "full"
    | "outOfScope"
    | "alreadyJoined"
    | "notSignedIn"
    | "alreadyEnded";
}

export interface EventActionInput {
  event: EventPostExtension;
  /** True iff the viewer is logged in. */
  isAuthenticated: boolean;
  /** True iff the viewer has already joined this event. */
  hasJoined: boolean;
  /**
   * Audience gate — receives the event's participantScope and returns true iff
   * the viewer is eligible. Decoupling this lets feature code wire in whatever
   * audience-resolution it has (`useAudienceOptions`, a profile claim, etc.)
   * without dragging Vue state into this module.
   */
  isEligibleForScope: (scope: Audience) => boolean;
}

const TERMINAL_STATUSES: ReadonlySet<EventStatus> = new Set(["completed", "cancelled", "closed"]);

export function planEventAction(input: EventActionInput): EventActionPlan {
  const { event, isAuthenticated, hasJoined, isEligibleForScope } = input;

  if (TERMINAL_STATUSES.has(event.eventStatus)) {
    if (hasJoined) {
      return { mode: "disabled", enabled: false, reasonKey: "alreadyEnded" };
    }
    return { mode: "disabled", enabled: false, reasonKey: "alreadyEnded" };
  }

  if (hasJoined) {
    return { mode: "cancel", enabled: true, reasonKey: "" };
  }

  if (!isAuthenticated) {
    return { mode: "disabled", enabled: false, reasonKey: "notSignedIn" };
  }

  if (event.eventStatus !== "open") {
    return { mode: "disabled", enabled: false, reasonKey: "notOpen" };
  }

  if (
    typeof event.capacity === "number" &&
    event.capacity > 0 &&
    event.participantCount >= event.capacity
  ) {
    return { mode: "disabled", enabled: false, reasonKey: "full" };
  }

  if (!isEligibleForScope(event.participantScope)) {
    return { mode: "disabled", enabled: false, reasonKey: "outOfScope" };
  }

  return { mode: "join", enabled: true, reasonKey: "" };
}
