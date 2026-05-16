/**
 * Share helper for post detail surfaces.
 *
 * Three paths:
 * 1. WeChat browser → return "use-wechat-menu" (JS-SDK configures the menu)
 * 2. Standard browser → native Web Share API with canonical URL
 * 3. No Web Share support → copy URL to clipboard
 */

import {
  SHARE_ERROR_NO_URL,
  SHARE_ERROR_SHARE_FAILED,
  SHARE_ERROR_NO_CLIPBOARD,
  SHARE_ERROR_COPY_FAILED,
  SHARE_USE_WECHAT_MENU,
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
  | { outcome: "use-wechat-menu"; message: string }
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

function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * Share a post.
 *
 * - WeChat browser: returns `{ outcome: "use-wechat-menu" }` — the caller
 *   should prompt the user to share via the top-right menu (configured by
 *   WeChat JS-SDK).
 * - Standard browser: uses the native Web Share API with the canonical URL
 *   in the `url` field (not embedded in `text`).
 * - No Web Share support: copies the URL to the clipboard.
 */
export async function sharePost(input: SharePostInput): Promise<SharePostResult> {
  const shareUrl = buildCanonicalPostUrl(input.tid);
  if (!shareUrl) return { outcome: "failed", message: SHARE_ERROR_NO_URL };

  // WeChat: button-triggered navigator.share() is unreliable; the right-menu
  // share configured by JS-SDK is the correct path.
  if (isWeChatBrowser()) {
    return { outcome: "use-wechat-menu", message: SHARE_USE_WECHAT_MENU };
  }

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const shareData: ShareData = {
    title: input.title,
    text: input.text ?? input.title,
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
