/**
 * Wire-`kind` inference for publish submit (PRD V0.2 step F, §2.2).
 *
 * After step F there is no user-picked "publish kind" radio. The post still
 * leaves the client carrying an explicit `kind` field on the wire so the
 * backend's existing `kind`-driven branches (event vs merchant vs trade vs
 * generic post) keep firing without re-inferring server-side. The mapping
 * is mechanical — it reads:
 *
 *   1. `publishKind` panel — when the user (or `accept(suggestedComponent)`)
 *      has explicitly entered the event / merchant / trade flow, that beats
 *      every content-derived signal. The panel routing in PublishView and
 *      the create-event branch in usePublishSubmit already gate on this.
 *   2. The `求助` tag — PRD reserves `help` for "this is a help-wanted
 *      post". Surfaced in V0.1 as a tag, set by `accept(help_tag)` in step
 *      E-main when the tag is blank.
 *   3. Location-only — a card with a place but no body / image is a
 *      `place` post (campus map pin), per PRD §2.2.
 *   4. Image / text — content-only fallback. The PRD's tie-breaker is
 *      "有图 → image, 否则 text", so when both image and body exist we
 *      still call it `image` (image is the dominant card surface).
 *
 * Pure factory — no Vue, no refs. The submit caller is responsible for
 * snapshotting refs into the input shape. Keeps the function unit-testable
 * without mounting.
 */

import type { InferredKind } from "../../types/publishSuggestion";
import type { PublishKind } from "./usePublishDraft";

export interface InferKindInput {
  /** The active publish-panel selector (event / merchant / trade flow). */
  publishKind: PublishKind;
  /**
   * True when the draft is bound to a known place (map_v2 pick or non-empty
   * manual `placeName`). The "place" kind is reserved for location-only
   * cards, so the inference also peeks at body/image to keep `place` from
   * eating image- or text-driven posts that happen to carry a location.
   */
  hasLocation: boolean;
  /** True when at least one image has been uploaded. */
  hasImage: boolean;
  /** True when the trimmed body is non-empty. */
  hasBody: boolean;
  /**
   * The user's tag at submit time. Either the raw input or its normalized
   * form (e.g. `"#求助"` or just `"求助"`). The function strips the leading
   * `#` and whitespace before checking — a defensive no-op when the caller
   * already passed the normalized value.
   */
  tag: string;
}

/** Tags that flip kind to `help`. Single-element today; kept as a set so a
 * future i18n / synonym extension is a one-line edit. */
const HELP_TAG_TOKENS: ReadonlySet<string> = new Set(["求助"]);

function isHelpTag(tag: string): boolean {
  const trimmed = tag.trim().replace(/^#+/, "");
  if (!trimmed) return false;
  return HELP_TAG_TOKENS.has(trimmed);
}

export function inferKind(input: InferKindInput): InferredKind {
  // Panel-driven kinds win. The user (directly or via ghost-component
  // accept) opted into a specific flow; the matching sub-draft is open and
  // its required fields are validated separately. Honor that decision.
  if (input.publishKind === "event") return "event";
  if (input.publishKind === "merchant") return "merchant";
  if (input.publishKind === "trade") return "trade";

  // Help tag — once the user opts into "求助" the post is a help-wanted
  // card regardless of whether they also attached an image or pinned a
  // location. Mirrors PRD §2.2 "启用了求助标签 → help".
  if (isHelpTag(input.tag)) return "help";

  // Location-only cards — PRD §2.2 "仅地点 → place". A card with body or
  // image is a content card with a place attached, not a place card.
  if (input.hasLocation && !input.hasBody && !input.hasImage) return "place";

  // Content-only fallback. PRD tie-breaker: 有图 优先 → image, otherwise
  // text. Keeps the rule explicit so future card templates that key on
  // kind=image (cover crop, list density) stay stable.
  if (input.hasImage) return "image";
  return "text";
}
