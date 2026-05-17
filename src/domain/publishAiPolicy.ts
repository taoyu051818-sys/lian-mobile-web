/**
 * Pure rules for applying AI publish suggestions to a draft (PRD V0.1 Phase 3).
 *
 * Lives in the domain layer because it encodes real product rules — what the
 * suggestion engine is *allowed* to change about a draft — that we want to
 * test without spinning up Vue refs or a publish view. This file MUST stay
 * free of `vue`, `api/*`, and feature imports (enforced by
 * scripts/validate-project-structure.js).
 *
 * Two rules:
 *
 *   1. Field suggestions (title/body/tag) only fill empty fields. We never
 *      clobber what the user has already typed.
 *   2. Audience suggestions only apply when the user has not narrowed
 *      visibility yet (still on the default "public") and the suggested
 *      target is allowed by the live audience contract. `linkOnly` is part
 *      of the audience model but is not a publish-visibility option, so we
 *      drop it.
 */

import type { Audience, AudienceVisibility } from "../types/audience";
import type { PublishVisibility } from "../types/publish";

/** Minimum shape of an AI suggestion bundle this policy needs. */
export interface AiSuggestionInput {
  title: string;
  body: string;
  tag: string;
  audience: Audience | null;
}

export interface PublishDraftFieldsView {
  title: string;
  body: string;
  tag: string;
  visibility: PublishVisibility;
}

export interface PublishDraftPatch {
  title?: string;
  body?: string;
  tag?: string;
  visibility?: PublishVisibility;
}

/**
 * Decide which parts of a draft should be patched given a fresh AI
 * suggestion bundle and the current audience contract.
 *
 * `isAllowed` is the same predicate used by the publish view to gate
 * visibility buttons — passing it here keeps a single source of truth.
 */
export function planAiSuggestionPatch(
  current: PublishDraftFieldsView,
  suggestion: AiSuggestionInput,
  isAllowed: (value: AudienceVisibility) => boolean,
): PublishDraftPatch {
  const patch: PublishDraftPatch = {};

  const trimmedTitle = suggestion.title.trim();
  const trimmedBody = suggestion.body.trim();
  const trimmedTag = suggestion.tag.trim();

  if (trimmedTitle && !current.title.trim()) patch.title = trimmedTitle;
  if (trimmedBody && !current.body.trim()) patch.body = trimmedBody;
  if (trimmedTag && !current.tag.trim()) patch.tag = trimmedTag;

  const audience = suggestion.audience;
  if (audience && current.visibility === "public") {
    const target = audience.visibility;
    if (target !== "linkOnly" && isAllowed(target)) {
      patch.visibility = target as PublishVisibility;
    }
  }

  return patch;
}
