import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Reactive reduced-motion preference composable.
 *
 * SSR contract (RFC §6 phase 1.5 — `docs/architecture/SSR_PWA_RFC_2026_05_23.md`):
 *
 *   - Module evaluation is side-effect free: importing this file on the Node
 *     SSR path never touches `window` / `matchMedia`.
 *   - The factory short-circuits when `typeof window === "undefined"` and
 *     returns the default-`false` ref. SSR HTML therefore renders against
 *     `reduced = false` (i.e. animations are not pre-stripped on the server),
 *     keeping the first paint identical between server and client so
 *     hydration does not mismatch on classes / styles that key off `reduced`.
 *   - On the client, reading the actual `(prefers-reduced-motion: reduce)`
 *     value and registering the `change` listener is deferred to `onMounted`.
 *     The real preference lands in the next tick after hydration.
 *
 * After mount the ref reflects `matchMedia` and stays in sync via the `change`
 * event. The listener is removed on `onBeforeUnmount`.
 */
export function useReducedMotion() {
  const reduced = ref(false);

  // SSR path: do not touch `window`. Default-`false` ref aligns with the
  // first-paint output the client will hydrate over.
  if (typeof window === "undefined") return reduced;

  let mql: MediaQueryList | null = null;
  function onChange(event: MediaQueryListEvent) {
    reduced.value = event.matches;
  }

  // Defer `matchMedia` + listener wiring until after mount. Both halves of the
  // hydration boundary therefore start from `reduced = false`, and the real
  // value is applied in the next tick once we have a real MediaQueryList.
  onMounted(() => {
    mql = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    if (!mql) return;
    reduced.value = mql.matches;
    mql.addEventListener("change", onChange);
  });

  onBeforeUnmount(() => {
    mql?.removeEventListener("change", onChange);
  });

  return reduced;
}

/**
 * One-shot reduced-motion check (non-reactive).
 *
 * Safe to call in SSR or non-browser contexts -- returns `false`.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
