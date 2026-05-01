import { config } from "./config.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseEscapedJsonComment(content = "", marker = "") {
  const raw = String(content).match(new RegExp(`<!--\\s*${marker}\\s+([\\s\\S]*?)\\s*-->`))?.[1];
  if (!raw) return {};
  try {
    return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } catch {
    return {};
  }
}

function parseLianUserMeta(content = "") {
  return parseEscapedJsonComment(content, "lian-user-meta");
}

function parseLianChannelMeta(content = "") {
  return parseEscapedJsonComment(content, "lian-channel-meta");
}

function stripHtml(html = "") {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractCover(html = "") {
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img?.[1]) return normalizePostImageUrl(img[1], { width: 600 });
  const md = html.match(/!\[[^\]]*]\(([^)\s]+)\)/i);
  return md?.[1] ? normalizePostImageUrl(md[1], { width: 600 }) : "";
}

function optimizeCloudinaryUrl(url = "", width = 900) {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  const transform = `f_auto,q_auto,c_limit,w_${width}`;
  if (url.includes("/image/upload/f_auto,") || url.includes("/image/upload/q_auto,")) {
    return url.replace(/\/image\/upload\/[^/]*?(?:f_auto|q_auto)[^/]*\//, `/image/upload/${transform}/`);
  }
  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}

function optimizeCloudinaryAvatarUrl(url = "") {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_512/");
}

function proxiedNodebbAssetUrl(pathname = "", search = "", hash = "") {
  if (!pathname.startsWith("/assets/")) return "";
  return `/lian-assets${pathname}${search}${hash}`;
}

function absoluteNodebbUrl(url = "") {
  if (!url) return "";
  const cleanUrl = String(url).replace(/&amp;/g, "&").trim();
  if (!cleanUrl) return "";
  if (/^https?:\/\//i.test(cleanUrl)) {
    try {
      const parsed = new URL(cleanUrl);
      const internal = new URL(config.nodebbBaseUrl);
      const isInternalLoopback = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
      const proxiedAsset = proxiedNodebbAssetUrl(parsed.pathname, parsed.search, parsed.hash);
      if (proxiedAsset && (parsed.origin === internal.origin || isInternalLoopback)) return proxiedAsset;
      if (parsed.origin === internal.origin || isInternalLoopback) {
        return `${config.nodebbPublicBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return cleanUrl;
    }
    return cleanUrl;
  }
  if (cleanUrl.startsWith("/assets/")) return proxiedNodebbAssetUrl(cleanUrl);
  if (cleanUrl.startsWith("/lian-assets/")) return cleanUrl;
  if (cleanUrl.startsWith("/")) return `${config.nodebbPublicBaseUrl}${cleanUrl}`;
  return cleanUrl;
}

function normalizePostImageUrl(url = "", { width = 900 } = {}) {
  return optimizeCloudinaryUrl(absoluteNodebbUrl(url), width);
}

function cloudinaryWarmupUrls(url = "") {
  const normalized = absoluteNodebbUrl(url);
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(normalized)) return [];
  return [600, 900, 1200].map((width) => optimizeCloudinaryUrl(normalized, width));
}

async function warmupImageUrl(url = "", timeoutMs = 15_000) {
  if (!url) return { url, ok: false, status: 0, error: "empty url" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { accept: "image/avif,image/webp,image/*,*/*" }
    });
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, status: 0, error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmupPostImages(urls = []) {
  const targets = [...new Set(urls.flatMap((url) => cloudinaryWarmupUrls(url)))];
  if (!targets.length) return [];
  return Promise.all(targets.map((url) => warmupImageUrl(url)));
}

function optimizePostImages(html = "", width = 900) {
  return html
    .replace(/(<img\b[^>]*\bsrc=["'])(https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):?\d*\/assets\/[^"']+)(["'][^>]*>)/gi, (_match, before, src, after) => {
      return `${before}${normalizePostImageUrl(src, { width })}${after}`;
    })
    .replace(/(<img\b[^>]*\bsrc=["'])(\/[^"']+)(["'][^>]*>)/gi, (_match, before, src, after) => {
      return `${before}${normalizePostImageUrl(src, { width })}${after}`;
    })
    .replace(/(<img\b[^>]*\bsrc=["'])(https:\/\/res\.cloudinary\.com\/[^"']+)(["'][^>]*>)/gi, (_match, before, src, after) => {
      return `${before}${normalizePostImageUrl(src, { width })}${after}`;
    });
}

function extractSourceUrl(html = "") {
  const linked = html.match(/href=["'](https?:\/\/[^"']+)["']/i);
  if (linked?.[1]) return linked[1].replace(/&amp;/g, "&");
  const text = stripHtml(html);
  const original = text.match(/原文[:：]\s*(https?:\/\/\S+)/);
  if (original?.[1]) return original[1];
  const anyUrl = text.match(/https?:\/\/\S+/);
  return anyUrl?.[0] || "";
}

function removeOriginalLinkBlocks(html = "") {
  return html
    .replace(/<p>\s*\?{2,}\s*<a[^>]+href=["']https?:\/\/[^"']+["'][\s\S]*?<\/a>\s*<\/p>/gi, "")
    .replace(/<p>\s*原文[:：]\s*<a[^>]+href=["']https?:\/\/[^"']+["'][\s\S]*?<\/a>\s*<\/p>/gi, "")
    .replace(/<p>\s*原文[:：]\s*https?:\/\/[^<\s]+?\s*<\/p>/gi, "")
    .trim();
}

function renderInlineMarkdown(value = "") {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderPostContent(content = "") {
  const cleaned = removeOriginalLinkBlocks(content);
  if (/<(p|img|h[1-6]|ul|ol|blockquote|div)\b/i.test(cleaned)) return optimizePostImages(cleaned, 900);
  return cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !/^#[^\s#]/.test(block))
    .map((block) => {
      const image = block.match(/^!\[([^\]]*)]\((https?:\/\/[^)\s]+)\)$/i);
      if (image) {
        return `<p><img src="${escapeHtml(optimizeCloudinaryUrl(image[2], 900))}" alt="${escapeHtml(image[1] || "image")}" loading="lazy" /></p>`;
      }
      const heading = block.match(/^\*\*([^*]+)\*\*$/);
      if (heading) return `<h3>${escapeHtml(heading[1])}</h3>`;
      return `<p>${renderInlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function extractSummary(html = "", title = "") {
  const lines = stripHtml(html)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^!\[[^\]]*]\(https?:\/\//.test(line))
    .filter((line) => !/^原文[:：]/.test(line))
    .filter((line) => !/^信息来自/.test(line))
    .filter((line) => line !== title);

  const summary = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!summary) return "点开看看详情。";
  return summary.length > 92 ? `${summary.slice(0, 92)}...` : summary;
}

function buildTextPostHtml(content = "") {
  return String(content || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("\n\n");
}

export {
  absoluteNodebbUrl,
  buildTextPostHtml,
  cloudinaryWarmupUrls,
  escapeHtml,
  extractCover,
  extractSourceUrl,
  extractSummary,
  normalizePostImageUrl,
  optimizeCloudinaryAvatarUrl,
  optimizeCloudinaryUrl,
  optimizePostImages,
  parseLianChannelMeta,
  parseLianUserMeta,
  proxiedNodebbAssetUrl,
  removeOriginalLinkBlocks,
  renderInlineMarkdown,
  renderPostContent,
  stripHtml,
  warmupImageUrl,
  warmupPostImages
};
