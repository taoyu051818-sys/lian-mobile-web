/**
 * Help manage action policy (PRD V0.1 §6.5 / §11.3).
 *
 * Pure function — given the help extension, decide which manage actions are
 * available. The viewer's right to manage is backend-driven (PostDetail
 * carries a `helpManageable` flag); this policy only encodes the per-status
 * transitions allowed once the viewer is a manager.
 *
 * Mirrors `eventActionPolicy` / `helpVotePolicy` in shape so the three
 * pure-function gates stay easy to read together.
 */

import type { HelpPostExtension } from "../types/post-extensions";

export type HelpManageAction = "linkEvent" | "unlinkEvent" | "resolve" | "close";

export interface HelpManagePlan {
  /** True iff a `helpManageable` viewer can take any action right now. */
  canManage: boolean;
  /** Subset of actions enabled for the current status. */
  allowed: ReadonlySet<HelpManageAction>;
}

const DISABLED: HelpManagePlan = { canManage: false, allowed: new Set() };

export interface HelpManageInput {
  help: HelpPostExtension | undefined;
  /** Backend-driven gate. Defaults to false on the read side. */
  isManageable: boolean;
}

export function planHelpManage(input: HelpManageInput): HelpManagePlan {
  const { help, isManageable } = input;
  if (!help || !isManageable) return DISABLED;

  // Terminal states cannot transition.
  if (help.status === "resolved" || help.status === "closed") return DISABLED;

  const allowed = new Set<HelpManageAction>();
  if (help.status === "open") {
    allowed.add("linkEvent");
    allowed.add("resolve");
    allowed.add("close");
  } else if (help.status === "linked_event") {
    allowed.add("unlinkEvent");
    allowed.add("resolve");
    allowed.add("close");
  }
  return { canManage: true, allowed };
}

/**
 * Parse a free-text event tid into a positive integer, or null when the input
 * is empty / non-numeric / non-positive. Used by the link-event input.
 */
export function parseEventTidInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}
