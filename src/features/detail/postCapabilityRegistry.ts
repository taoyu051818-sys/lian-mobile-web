/**
 * Post capability registry (issue #785).
 *
 * Single canonical lookup for which detail-block capabilities a post should
 * surface, and what fallback behavior applies when the capability extension is
 * absent or partially populated. Adapters in `src/api/posts.ts` keep ownership
 * of raw API normalization — the registry is a pure selection function over
 * the already-normalized `PostDetail` shape.
 *
 * The registry replaces the inline `v-if=…` ladder that previously lived in
 * `PostDetailContent.vue`. New capabilities should add a single entry here
 * instead of widening conditionals across the detail panel.
 *
 * Scope (per issue #785 / #794):
 *   - registry-backed typed capabilities currently shipped: help, event,
 *     merchant, trade
 *   - registry decides selection + fallback only; rendering still happens in
 *     the per-capability block components
 *   - structured place content still uses the separate `PostPlaceSheetBlock`
 *     path for now and is intentionally not exposed through this registry
 *   - errand orders, wallet ledgers, verification applications, audit records
 *     are explicitly NOT modeled as post capabilities
 */

import type { PostDetail, PostType } from "../../types/post";

/**
 * Capability identifiers known to the registry. These are *rendering*
 * capabilities, not post types.
 */
export type PostCapabilityId = "help" | "event" | "merchant" | "trade";

/**
 * Selection outcome for one capability against one post.
 *
 *   - `render`  — the extension is present and well-formed; render the block
 *   - `fallback`— the post type implies the capability but the payload is
 *     missing or partially populated; render the typed-fallback block instead
 *   - `skip`    — the capability does not apply to this post
 */
export type PostCapabilitySelection = "render" | "fallback" | "skip";

export interface PostCapabilityResolution {
  id: PostCapabilityId;
  selection: PostCapabilitySelection;
}

/**
 * Subset of `PostDetail` the registry actually reads. Defining it explicitly
 * makes the dependency surface obvious and lets tests construct minimal
 * fixtures without faking the full DTO.
 */
export type PostCapabilityInput = Pick<
  PostDetail,
  "type" | "event" | "help" | "merchant" | "trade"
>;

interface CapabilityDefinition {
  id: PostCapabilityId;
  /** True when the post payload contains a usable extension for this capability. */
  hasExtension: (post: PostCapabilityInput) => boolean;
  /**
   * Post types that *imply* the capability. When the type matches but
   * `hasExtension` is false, the registry returns `fallback`.
   */
  fallbackType: PostType | null;
}

const REGISTRY: readonly CapabilityDefinition[] = [
  {
    id: "event",
    hasExtension: (post) => isEventExtensionUsable(post.event),
    fallbackType: "event",
  },
  {
    id: "help",
    hasExtension: (post) => isHelpExtensionUsable(post.help),
    fallbackType: "help",
  },
  {
    id: "merchant",
    hasExtension: (post) => Boolean(post.merchant),
    fallbackType: "merchant",
  },
  {
    id: "trade",
    hasExtension: (post) => Boolean(post.trade),
    fallbackType: "trade",
  },
];

/**
 * Resolve one capability for one post. Returns `skip` when neither the
 * extension nor a typed fallback applies — callers can use the result without
 * further guards.
 */
export function selectPostCapability(
  id: PostCapabilityId,
  post: PostCapabilityInput,
): PostCapabilitySelection {
  const def = REGISTRY.find((entry) => entry.id === id);
  if (!def) return "skip";
  if (def.hasExtension(post)) return "render";
  if (def.fallbackType && post.type === def.fallbackType) return "fallback";
  return "skip";
}

/**
 * Resolve every capability the registry knows about. Iteration order is
 * stable and matches the order registry-backed blocks render in
 * `PostDetailContent.vue`.
 */
export function resolvePostCapabilities(
  post: PostCapabilityInput,
): readonly PostCapabilityResolution[] {
  return REGISTRY.map((def) => ({ id: def.id, selection: selectPostCapability(def.id, post) }));
}

/**
 * Convenience accessor for callers that only need to know whether to render
 * the actual block (not the fallback). Mirrors the previous `v-if="event"`
 * style truthy guard while routing through the canonical registry.
 */
export function shouldRenderCapability(id: PostCapabilityId, post: PostCapabilityInput): boolean {
  return selectPostCapability(id, post) === "render";
}

/**
 * True iff the registry would emit the typed-fallback block for this
 * capability + post pair.
 */
export function shouldRenderCapabilityFallback(
  id: PostCapabilityId,
  post: PostCapabilityInput,
): boolean {
  return selectPostCapability(id, post) === "fallback";
}

function isEventExtensionUsable(event: PostCapabilityInput["event"]): boolean {
  if (!event) return false;
  // The event block requires an `eventId` to wire actions; an extension that
  // lost the id during normalization is treated as partially-populated and
  // routed to the typed fallback instead of rendered.
  return typeof event.eventId === "string" && event.eventId.length > 0;
}

function isHelpExtensionUsable(help: PostCapabilityInput["help"]): boolean {
  if (!help) return false;
  // Same shape — the help block keys actions off `helpId`.
  return typeof help.helpId === "string" && help.helpId.length > 0;
}
