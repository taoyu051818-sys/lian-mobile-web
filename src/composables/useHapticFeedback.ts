/**
 * Apple-style haptic feedback composable.
 *
 * Provides tactile feedback for key interactions on supported devices (iOS Safari,
 * Android Chrome). Uses the Vibration API with patterns tuned to approximate
 * Apple's Haptic Engine feedback types.
 *
 * SSR contract (RFC §6 phase 1.5 — `docs/architecture/SSR_PWA_RFC_2026_05_23.md`):
 *
 *   - Module evaluation is side-effect free: importing this file on the Node
 *     SSR path never touches `navigator`.
 *   - All vibration calls short-circuit when `typeof navigator === "undefined"`
 *     or when the Vibration API is unavailable.
 *   - Respects the user's reduced-motion preference — haptics are suppressed
 *     when `prefers-reduced-motion: reduce` is active.
 *
 * Vibration patterns are tuned to feel similar to iOS UIFeedbackGenerator:
 *   - light:   UIImpactFeedbackGenerator.style.light   (~10ms)
 *   - medium:  UIImpactFeedbackGenerator.style.medium  (~20ms)
 *   - heavy:   UIImpactFeedbackGenerator.style.heavy   (~30ms)
 *   - success: UINotificationFeedbackGenerator.success (double tap pattern)
 *   - error:   UINotificationFeedbackGenerator.error   (triple tap pattern)
 *
 * Note: The Vibration API is a best-effort approximation. iOS Safari has limited
 * support, and actual haptic feel varies by device. The composable fails silently
 * on unsupported platforms.
 */

import { prefersReducedMotion } from "./useReducedMotion";

/** Vibration pattern type: single duration or array of [vibrate, pause, ...] */
type VibrationPattern = number | number[];

/**
 * Check if the Vibration API is available.
 *
 * Returns false in SSR, non-browser contexts, or when the API is missing.
 */
function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Trigger a vibration pattern if supported and allowed.
 *
 * Respects reduced-motion preference — returns early without vibrating.
 * Fails silently on unsupported platforms.
 */
function vibrate(pattern: VibrationPattern): void {
  if (!canVibrate()) return;
  if (prefersReducedMotion()) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Fail silently — some browsers throw on vibrate() in certain contexts
    // (e.g., background tabs, permission denied).
  }
}

/**
 * Light haptic feedback — use for button clicks, list item taps.
 *
 * Approximates UIImpactFeedbackGenerator.style.light.
 */
export function hapticLight(): void {
  vibrate(10);
}

/**
 * Medium haptic feedback — use for toggle switches, selection changes.
 *
 * Approximates UIImpactFeedbackGenerator.style.medium.
 */
export function hapticMedium(): void {
  vibrate(20);
}

/**
 * Heavy haptic feedback — use for destructive actions (delete, discard).
 *
 * Approximates UIImpactFeedbackGenerator.style.heavy.
 */
export function hapticHeavy(): void {
  vibrate(30);
}

/**
 * Success haptic feedback — use for completed actions (publish, save).
 *
 * Approximates UINotificationFeedbackGenerator.notificationOccurred(.success).
 * Pattern: two quick taps with a short pause.
 */
export function hapticSuccess(): void {
  vibrate([10, 50, 10]);
}

/**
 * Error haptic feedback — use for failed actions, validation errors.
 *
 * Approximates UINotificationFeedbackGenerator.notificationOccurred(.error).
 * Pattern: three quick taps with short pauses.
 */
export function hapticError(): void {
  vibrate([10, 30, 10, 30, 10]);
}

/**
 * Composable interface for haptic feedback.
 *
 * Usage:
 * ```ts
 * const haptic = useHapticFeedback();
 *
 * function handleClick() {
 *   haptic.light();
 *   // ... do something
 * }
 *
 * function handleToggle() {
 *   haptic.medium();
 *   // ... toggle state
 * }
 *
 * async function handleSubmit() {
 *   try {
 *     await submitForm();
 *     haptic.success();
 *   } catch {
 *     haptic.error();
 *   }
 * }
 * ```
 */
export function useHapticFeedback() {
  return {
    /** Light tap — button clicks, list item taps */
    light: hapticLight,
    /** Medium tap — toggle switches, selection changes */
    medium: hapticMedium,
    /** Heavy tap — destructive actions (delete, discard) */
    heavy: hapticHeavy,
    /** Success pattern — completed actions (publish, save) */
    success: hapticSuccess,
    /** Error pattern — failed actions, validation errors */
    error: hapticError,
    /** Check if haptic feedback is available on this device */
    isSupported: canVibrate,
  };
}
