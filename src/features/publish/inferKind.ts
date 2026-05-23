/**
 * Wire-`kind` inference for publish submit (PRD V0.2 step F, §2.2).
 *
 * After step F there is no user-picked "publish kind" radio. The post still
 * leaves the client carrying an explicit `kind` field on the wire so the
 * backend's existing `kind`-driven branches (event vs merchant vs trade vs
 * generic post) keep firing without re-inferring server-side. The mapping
 * is mechanical — it reads, in priority order:
 *
 *   1. The `求助` tag — PRD reserves `help` for "this is a help-wanted
 *      post". The tag is an explicit user-typed semantic gesture, not a
 *      ghost-component fill, so per PRD §2.2 it sits at the top of the
 *      chain (the §2.2 媒体优先 rule is "图 vs ghost", not "图 vs tag").
 *      Surfaced in V0.1 as a tag, set by `accept(help_tag)` in step E-main
 *      when the tag is blank.
 *   2. Image — PRD §2.2 拍板：「有图就一定是 kind=image。媒体优先级最高，
 *      即便用户化实了 ghost component（地点/时间/价格），有图都覆盖。」
 *      So image beats publishKind even though publishKind may have been
 *      flipped by `accept('event_time'|'merchant_info'|'trade_condition'|
 *      'price')`. The matching sub-draft (event panel, trade panel) is
 *      still validated separately at submit; only the wire `kind` flips.
 *   3. `publishKind` panel — when the user (or `accept(suggestedComponent)`)
 *      has entered the event / merchant / trade flow without an attached
 *      image, that beats place / text. The panel routing in PublishView and
 *      the create-event branch in usePublishSubmit already gate on this.
 *   4. Location-only — a card with a place but no body / image is a
 *      `place` post (campus map pin), per PRD §2.2. Image is already
 *      handled by rule #2 so the no-image guard collapses to
 *      `hasLocation && !hasBody`.
 *   5. Body / text — content-only fallback.
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
  // Help tag — explicit user-typed semantic gesture (or accept(help_tag)
  // when the tag was blank). Sits at the top: PRD §2.2 媒体优先 is "图 vs
  // ghost component", and the 求助 tag is neither. Once the user opts into
  // "求助" the post is a help-wanted card regardless of whether they also
  // attached an image or pinned a location.
  if (isHelpTag(input.tag)) return "help";

  // Image — PRD §2.2 拍板：「有图就一定是 kind=image。媒体优先级最高，
  // 即便用户化实了 ghost component（地点/时间/价格），有图都覆盖。」
  // So image beats publishKind even when it was flipped by accept(price |
  // event_time | merchant_info | trade_condition). Sub-draft validation
  // (event panel, trade panel) still runs at submit; only the wire `kind`
  // collapses to "image" because that's the dominant card surface.
  if (input.hasImage) return "image";

  // Panel-driven kinds — the user (directly or via ghost-component accept)
  // opted into a specific flow without an attached image. The matching
  // sub-draft is open and its required fields are validated separately.
  if (input.publishKind === "event") return "event";
  if (input.publishKind === "merchant") return "merchant";
  if (input.publishKind === "trade") return "trade";

  // Location-only cards — PRD §2.2 "仅地点 → place". `hasImage` is already
  // handled above, so the no-image guard collapses to `!hasBody`. A card
  // with body is a content card with a place attached, not a place card.
  if (input.hasLocation && !input.hasBody) return "place";

  // Body / text fallback. Submit-side validation blocks an entirely empty
  // draft elsewhere; this still has to return a valid enum value.
  return "text";
}
