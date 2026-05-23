/**
 * Errand order share composable (mw#892 / ps#552).
 *
 * Orchestrates the share flow for errand orders:
 *   1. User taps "招募跑腿" button
 *   2. ShareCardSheet opens with loading state
 *   3. Fetch share card from backend
 *   4. User confirms -> invoke platform share (Web Share API / WeChat menu / clipboard)
 *
 * Reuses the existing ShareCardSheet component for UI consistency.
 */

import { computed, type Ref } from "vue";
import { configureWeChatShare } from "../../platform/wechatShare";
import { SHARE_LINK_COPIED, SHARE_USE_WECHAT_MENU } from "../../config/brand";
import { useErrandOrderShareCard, type ErrandOrderShareCard } from "./useErrandOrderShareCard";

function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function useErrandOrderShare(options: {
  orderId: Ref<string | null> | (() => string | null);
  showActionMessage: (message: string) => void;
  showError: (error: unknown, fallback: string) => void;
}) {
  const preview = useErrandOrderShareCard();

  const orderId = computed(() => {
    const val = options.orderId;
    return typeof val === "function" ? val() : val.value;
  });

  /**
   * Share button click: open the share-card preview sheet.
   */
  function handleShare() {
    const id = orderId.value;
    if (!id) return;
    preview.start(id);
  }

  /**
   * Sheet "确认分享" -> run the platform-appropriate share flow.
   */
  async function handleShareConfirm() {
    const card = preview.card.value;
    if (!card) {
      preview.close();
      return;
    }

    // Configure WeChat share if in WeChat browser
    if (isWeChatBrowser()) {
      const wechat = card.channel.wechat;
      if (wechat) {
        await configureWeChatShare({
          title: wechat.title || card.title,
          desc: wechat.description || card.summary,
          link: card.url,
          imgUrl: wechat.imageUrl || card.thumbnailUrl,
        });
      }
      preview.close();
      options.showActionMessage(SHARE_USE_WECHAT_MENU);
      return;
    }

    // Try Web Share API
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const shareData: ShareData = {
      title: card.title,
      text: card.summary,
      url: card.url,
    };

    if (nav && "share" in nav && typeof nav.share === "function") {
      try {
        await nav.share(shareData);
        preview.close();
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          preview.close();
          return;
        }
        // Fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      const clipboard = nav?.clipboard;
      if (clipboard) {
        await clipboard.writeText(card.url);
        preview.close();
        options.showActionMessage(SHARE_LINK_COPIED);
        return;
      }
    } catch {
      // Ignore clipboard errors
    }

    preview.close();
    options.showError(null, "分享没有完成，可以稍后再试。");
  }

  function handleShareClose() {
    preview.close();
  }

  function handleShareRetry() {
    preview.retry();
  }

  return {
    handleShare,
    handleShareConfirm,
    handleShareClose,
    handleShareRetry,
    sharePreviewOpen: preview.open,
    sharePreviewStatus: preview.status,
    sharePreviewCard: computed(() => {
      // Map ErrandOrderShareCard to ShareCard shape for ShareCardSheet
      const card = preview.card.value;
      if (!card) return null;
      return {
        tid: 0, // Not used for errand orders
        title: card.title,
        summary: card.summary,
        thumbnailUrl: card.thumbnailUrl,
        url: card.url,
        kind: "errand-order",
        authorName: "",
        audienceLabel: "",
        channel: card.channel,
      };
    }),
    sharePreviewErrorMessage: preview.errorMessage,
    sharePreviewCanRetry: preview.canRetry,
  };
}
