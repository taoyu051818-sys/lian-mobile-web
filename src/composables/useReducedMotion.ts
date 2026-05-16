import { onBeforeUnmount, ref } from "vue";

/**
 * Reactive reduced-motion preference composable.
 *
 * SSR-safe: returns `false` when `window` / `matchMedia` are unavailable.
 * Listens for runtime preference changes via the `change` event.
 */
export function useReducedMotion() {
  const reduced = ref(false);

  if (typeof window === "undefined") return reduced;

  const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!mql) return reduced;

  reduced.value = mql.matches;

  function onChange(e: MediaQueryListEvent) {
    reduced.value = e.matches;
  }

  mql.addEventListener("change", onChange);
  onBeforeUnmount(() => mql.removeEventListener("change", onChange));

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
