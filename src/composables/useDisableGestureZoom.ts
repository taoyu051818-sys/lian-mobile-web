// Block iOS Safari pinch zoom. Apple has ignored `user-scalable=no` and
// `maximum-scale` since iOS 10 for accessibility reasons; only JS
// `preventDefault` on `gesturestart` / `gesturechange` / `gestureend` stops
// the gesture. This matches the locked-viewport behavior of WeChat /
// 小红书 / 抖音 — a deliberate departure from Apple HIG.
//
// Double-tap zoom is handled separately by `touch-action: manipulation`
// in `src/styles/main.css` (less invasive than calling preventDefault on
// `dblclick`, which can break selection and button activation).
//
// Idempotent: a module-level flag plus a per-document marker prevents
// double-registration if the installer is called more than once.

const INSTALL_FLAG = "__lianGestureZoomInstalled";

export function installDisableGestureZoom(): void {
  if (typeof document === "undefined") return;

  const doc = document as Document & Record<typeof INSTALL_FLAG, boolean | undefined>;
  if (doc[INSTALL_FLAG]) return;
  doc[INSTALL_FLAG] = true;

  const block = (event: Event): void => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", block, { passive: false });
  document.addEventListener("gesturechange", block, { passive: false });
  document.addEventListener("gestureend", block, { passive: false });
}
