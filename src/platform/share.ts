/**
 * Share helper for post detail surfaces.
 *
 * - Builds a canonical post URL using the hash-route convention (`#/post/{tid}`).
 * - Distinguishes native-share cancellation (AbortError) from real failures.
 * - Falls back to clipboard copy when the Web Share API is unavailable.
 */

import {
  SHARE_ERROR_NO_URL,
  SHARE_ERROR_SHARE_FAILED,
  SHARE_ERROR_NO_CLIPBOARD,
  SHARE_ERROR_COPY_FAILED,
} from "../config/brand";

export interface SharePostInput {
  tid: number;
  title: string;
  text?: string;
}

export type SharePostResult =
  | { outcome: "shared" }
  | { outcome: "copied" }
  | { outcome: "cancelled" }
  | { outcome: "failed"; message: string };

/**
 * Build a canonical share URL for a post detail view.
 *
 * Uses the hash-route convention (`#/post/{tid}`) that the legacy public
 * app already relies on, appended to the current origin + pathname so
 * the link resolves correctly regardless of deployment path.
 */
export function buildCanonicalPostUrl(tid: number): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin + window.location.pathname;
  return `${base}#/post/${tid}`;
}

/**
 * Share a post via the native Web Share API, falling back to clipboard copy.
 *
 * - Returns `{ outcome: "shared" }` when the native share sheet completed.
 * - Returns `{ outcome: "cancelled" }` when the user dismissed the share
 *   sheet (AbortError) — callers should treat this as a no-op, not an error.
 * - Returns `{ outcome: "copied" }` when the URL was copied to the clipboard
 *   as a fallback (Web Share API unavailable).
 * - Returns `{ outcome: "failed", message }` on real failures.
 */
export async function sharePost(input: SharePostInput): Promise<SharePostResult> {
  const shareUrl = buildCanonicalPostUrl(input.tid);
  if (!shareUrl) return { outcome: "failed", message: SHARE_ERROR_NO_URL };

  const nav = typeof navigator !== "undefined" ? navigator : null;

  const shareText = input.text ?? input.title;

  // WeChat WebView opens navigator.share() but strips the `url` field when
  // forwarding to a conversation — the recipient sees no link.  Embedding
  // the URL in the `text` body works around this: WeChat preserves the full
  // text content even when it discards the dedicated URL field.
  const shareData: ShareData = {
    title: input.title,
    text: `${shareText}\n${shareUrl}`,
    url: shareUrl,
  };

  if (nav && "share" in nav && typeof nav.share === "function") {
    try {
      await nav.share(shareData);
      return { outcome: "shared" };
    } catch (err: unknown) {
      if (isAbortError(err)) return { outcome: "cancelled" };
      return { outcome: "failed", message: SHARE_ERROR_SHARE_FAILED };
    }
  }

  // Clipboard fallback
  try {
    const clipboard = nav?.clipboard;
    if (!clipboard) return { outcome: "failed", message: SHARE_ERROR_NO_CLIPBOARD };
    await clipboard.writeText(shareUrl);
    return { outcome: "copied" };
  } catch {
    return { outcome: "failed", message: SHARE_ERROR_COPY_FAILED };
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
