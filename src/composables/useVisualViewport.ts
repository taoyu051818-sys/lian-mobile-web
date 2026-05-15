import { onBeforeUnmount, ref } from "vue";

/**
 * Reactive visual-viewport keyboard-inset composable.
 *
 * Tracks `window.visualViewport` resize/scroll events and exposes the
 * estimated keyboard occlusion as a reactive `px` value.  Also pushes
 * the value to `--keyboard-inset-bottom` on `:root` so pure-CSS
 * consumers can use `var(--keyboard-inset-bottom)` without JS wiring.
 *
 * SSR-safe: returns `0` and becomes a no-op when `window` or
 * `visualViewport` are unavailable.
 */
export function useVisualViewport() {
  const keyboardInsetBottom = ref(0);

  if (typeof window === "undefined") return { keyboardInsetBottom };

  const viewport = window.visualViewport;
  if (!viewport) return { keyboardInsetBottom };

  const vp: VisualViewport = viewport;
  let rafId = 0;

  function updateInset() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const inset = Math.max(
        0,
        window.innerHeight - vp.height - vp.offsetTop,
      );
      keyboardInsetBottom.value = inset;
      document.documentElement.style.setProperty(
        "--keyboard-inset-bottom",
        `${inset}px`,
      );
    });
  }

  vp.addEventListener("resize", updateInset);
  vp.addEventListener("scroll", updateInset);

  function cleanup() {
    cancelAnimationFrame(rafId);
    vp.removeEventListener("resize", updateInset);
    vp.removeEventListener("scroll", updateInset);
    document.documentElement.style.removeProperty("--keyboard-inset-bottom");
  }

  onBeforeUnmount(cleanup);

  // Sync initial value.
  updateInset();

  return { keyboardInsetBottom };
}
