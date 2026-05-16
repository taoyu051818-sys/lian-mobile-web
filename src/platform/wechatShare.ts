/**
 * WeChat JS-SDK share integration.
 *
 * When the page is opened inside WeChat's in-app browser, this module:
 * 1. Loads the WeChat JS-SDK (jweixin-1.6.0)
 * 2. Requests a signature from the backend
 * 3. Configures custom share title, description, link, and thumbnail
 *
 * Outside WeChat the module is a no-op — callers can fire-and-forget.
 */

import { apiSend } from "../api/http";

interface WxShareOptions {
  title: string;
  desc?: string;
  link: string;
  imgUrl?: string;
}

interface WxSignResponse {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WxInstance = any;

declare global {
  interface Window {
    wx?: WxInstance;
  }
}

const WX_SDK_URL = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";

let sdkLoading: Promise<void> | null = null;

function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function loadWxSdk(): Promise<void> {
  if (window.wx) return Promise.resolve();
  if (sdkLoading) return sdkLoading;

  sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WX_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load WeChat JS-SDK"));
    document.head.appendChild(script);
  });

  return sdkLoading;
}

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function configureWeChatShare(opts: WxShareOptions): Promise<void> {
  if (!isWeChatBrowser()) return;

  try {
    await loadWxSdk();

    const currentUrl = location.href.split("#")[0];
    const signData: WxSignResponse = await apiSend("/api/wechat/sign", {
      method: "POST",
      body: JSON.stringify({ url: currentUrl }),
    });

    const wx = window.wx;
    if (!wx) return;

    wx.config({
      debug: false,
      appId: signData.appId,
      timestamp: signData.timestamp,
      nonceStr: signData.nonceStr,
      signature: signData.signature,
      jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
    });

    wx.ready(() => {
      const shareUrl = opts.link;
      const imgUrl = toAbsoluteUrl(opts.imgUrl || "/assets/share-cover.png");

      wx.updateAppMessageShareData({
        title: opts.title,
        desc: opts.desc || opts.title,
        link: shareUrl,
        imgUrl,
      });

      wx.updateTimelineShareData({
        title: opts.title,
        link: shareUrl,
        imgUrl,
      });
    });
  } catch {
    // Silently fail — sharing still works via Web Share API fallback
  }
}
