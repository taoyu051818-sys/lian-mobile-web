import type { Component } from "vue";
import type { MetadataComponentType, MetadataComponentV2 } from "../../types/post-extensions";
import PostDetailGroupbuyBlock from "./PostDetailGroupbuyBlock.vue";

/**
 * PRD V0.3 §2.1.3 — V2 component renderer registry.
 *
 * The detail page used to fan out one prop+block per extension (event, help,
 * merchant, trade) on PostDetailContent. Each new component type the PRD adds
 * (delivery, groupbuy, channel, ledger, …) would otherwise widen that fan-out.
 * The registry collapses the fan-out: feature owners register a renderer for
 * the component type they own, and `<PostComponentsSlot>` dispatches to it.
 *
 * Read path (this seam): the slot iterates `metadata.components` (PRD V0.3 §2.1
 * V2 array shape) and looks up a renderer per `type`. Unknown / unregistered
 * types are silently skipped — adding a new component type must not require a
 * frontend release on the rendering side.
 *
 * Existing event/help/merchant/trade blocks deliberately stay on the
 * postCapabilityRegistry path (they consume already-flattened V1 fields). The
 * slot is purely additive — it does not double-render those blocks.
 */

/**
 * Renderer contract: a Vue component that accepts a single `component` prop
 * carrying the typed V2 component shape. Renderers are responsible for their
 * own empty / loading / error states. Returning nothing is fine — the slot
 * tolerates renderers that conditionally render nothing.
 */
export interface PostComponentRenderEntry<T extends MetadataComponentV2 = MetadataComponentV2> {
  component: Component;
  /**
   * Optional gate: when present, the slot calls this with the raw component
   * before rendering and skips when it returns false. Use this for renderers
   * that only want to render under certain shapes (e.g. a quality renderer
   * that needs `qualityScore` to be populated). Falsy / missing = always render
   * when the type matches.
   */
  shouldRender?: (component: T) => boolean;
}

const registry = new Map<MetadataComponentType, PostComponentRenderEntry>();
registry.set("groupbuy", { component: PostDetailGroupbuyBlock });

/**
 * Register a renderer for a V2 component type. Last-write-wins so feature
 * owners can override a default renderer in tests or in feature-flagged paths.
 * Calling `registerPostComponentRenderer("event", { component: X })` does NOT
 * disable the existing PostDetailEventBlock — that block lives on the
 * capability registry path. The two paths coexist.
 */
export function registerPostComponentRenderer<T extends MetadataComponentV2>(
  type: T["type"],
  entry: PostComponentRenderEntry<T>,
): void {
  registry.set(type, entry as PostComponentRenderEntry);
}

/**
 * Remove a renderer. Primarily for tests — production code should leave
 * registrations in place for the lifetime of the app.
 */
export function unregisterPostComponentRenderer(type: MetadataComponentType): void {
  registry.delete(type);
}

export function resolvePostComponentRenderer(
  type: MetadataComponentType,
): PostComponentRenderEntry | undefined {
  return registry.get(type);
}

/**
 * Returns the components from `metadata.components` that have a registered
 * renderer AND pass any `shouldRender` gate, in their original order. The
 * post-detail slot uses this to drive its v-for; passing the resolved list
 * (rather than re-filtering inside the template) makes the dispatch behavior
 * unit-testable without mounting Vue.
 */
export function selectRenderableComponents(
  components: MetadataComponentV2[] | undefined,
): Array<{ component: MetadataComponentV2; entry: PostComponentRenderEntry }> {
  if (!components || components.length === 0) return [];
  const out: Array<{ component: MetadataComponentV2; entry: PostComponentRenderEntry }> = [];
  for (const comp of components) {
    if (!comp || typeof comp !== "object") continue;
    const entry = registry.get(comp.type);
    if (!entry) continue;
    if (entry.shouldRender && !entry.shouldRender(comp)) continue;
    out.push({ component: comp, entry });
  }
  return out;
}

/**
 * Test helper — wipe the registry. Production code should not call this.
 */
export function __resetPostComponentRegistryForTests(): void {
  registry.clear();
}
