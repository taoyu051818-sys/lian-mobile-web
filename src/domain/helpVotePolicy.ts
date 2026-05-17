/**
 * Help vote action policy (PRD V0.1 §6.5 / §11.3).
 *
 * Pure function — given the help extension and viewer state, decide whether
 * the vote button should be enabled or disabled, and if disabled, why.
 *
 * Lives in `src/domain/` so it can be unit-tested without Vue refs and
 * reused by feed cards, detail panels, or any future surface that needs the
 * same gate. Mirrors `eventActionPolicy` so the two read-side flows share
 * shape.
 */

import type { HelpPostExtension } from "../types/post-extensions";

export type HelpVoteMode = "vote" | "unvote" | "disabled";

export interface HelpVotePlan {
  /** What the primary button should do. */
  mode: HelpVoteMode;
  /** True iff the button is clickable. */
  enabled: boolean;
  /** Disabled reason key. Empty string when enabled. */
  reasonKey: "" | "notSignedIn" | "alreadyResolved" | "alreadyClosed";
}

export interface HelpVoteInput {
  help: HelpPostExtension;
  /** True iff the viewer is logged in. */
  isAuthenticated: boolean;
  /** True iff the viewer has already voted on this help post. */
  hasVoted: boolean;
}

export function planHelpVote(input: HelpVoteInput): HelpVotePlan {
  const { help, isAuthenticated, hasVoted } = input;

  if (help.status === "resolved") {
    return { mode: "disabled", enabled: false, reasonKey: "alreadyResolved" };
  }
  if (help.status === "closed") {
    return { mode: "disabled", enabled: false, reasonKey: "alreadyClosed" };
  }
  if (!isAuthenticated) {
    return { mode: "disabled", enabled: false, reasonKey: "notSignedIn" };
  }
  if (hasVoted) {
    return { mode: "unvote", enabled: true, reasonKey: "" };
  }
  return { mode: "vote", enabled: true, reasonKey: "" };
}

/** Whether the post links to an event (UI uses this to render an entry). */
export function helpHasLinkedEvent(help: HelpPostExtension): boolean {
  return (
    help.status === "linked_event" &&
    typeof help.linkedEventTid === "number" &&
    help.linkedEventTid > 0
  );
}
