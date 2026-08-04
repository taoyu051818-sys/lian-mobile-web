/**
 * SSR contract entry — phase 1.2 of `docs/architecture/SSR_PWA_RFC_2026_05_23.md`.
 *
 * `render(url)` is the boundary between the Node http service
 * (`src/server/ssr/index.ts`) and the per-route HTML producer:
 *
 *   1. Match `url` against the SSR-rendered path set defined by RFC §3:
 *        - `/post/:tid`     → fetch ps `share-card`, render per-kind meta + a
 *                             noscript-friendly degraded body + a SPA redirect.
 *        - `/u/:username`   → phase 1.5 stub. Returns the brand-default shell
 *                             without calling ps, so this layer can ship before
 *                             profile rendering does.
 *        - `/` (and any unknown path) → brand-default homepage shell.
 *   2. ps share-card upstream is taken **as-is** per RFC §4. We never
 *      re-derive `kind`, `summary`, or `thumbnailUrl` here; ps is the
 *      source of truth and follow-ups (event time / merchant name /
 *      errand price) live there (RFC §12).
 *   3. Phase 1.2 does **not** call `renderToString`. The SPA owns
 *      hydration; SSR's job is the meta block + a degraded body that
 *      crawlers read while real browsers run the redirect script. Vue
 *      SSR rendering returns in a later phase.
 *   4. ps timeout / non-2xx / malformed envelope → throw. The Node
 *      http service maps the throw to a 503 so Caddy can fall back to
 *      the static `index.html` per RFC §5.
 *
 * Note on share-card normalization: the SPA's `src/api/share-card.ts`
 * client is browser-shaped (uses `apiGet` which assumes relative URLs
 * + cookie auth). SSR must call ps over loopback with its own
 * internal URL, so we inline a small normalizer here rather than
 * carve out a shared module — same field cascade, no new abstraction.
 */

const PS_TIMEOUT_MS = 5_000;
const DEFAULT_PS_INTERNAL_URL = "http://127.0.0.1:3000";
const BRAND_TITLE = "LIAN";
const BRAND_DESCRIPTION = "校园生活信息站";
const BRAND_THUMBNAIL = "/assets/campus-base-map.png";
const BRAND_LOCALE = "zh_CN";
/** Default image dimensions for the brand thumbnail (used for og:image:width/height hints). */
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

const POST_ROUTE = /^\/post\/(\d+)$/;
const PROFILE_ROUTE = /^\/u\/[^/]+$/;
const SSR_URL_BASE = "http://lian.ssr.invalid";

export interface RenderResult {
  html: string;
  head: string;
}

/** Mirrors the V1 share-card envelope (ps#484 + ps#536). Local to SSR. */
interface ShareCardSlim {
  tid: number;
  title: string;
  summary: string;
  thumbnailUrl: string;
  url: string;
  kind: string;
  authorName: string;
  audienceLabel: string;
  wechat?: WechatChannelOverrides;
}

/** WeChat-specific channel overrides from share-card V1 envelope. */
interface WechatChannelOverrides {
  title?: string;
  description?: string;
  imageUrl?: string;
}

export class SsrUpstreamError extends Error {
  status: number;
  reason: "not-found" | "network" | "malformed";
  constructor(reason: "not-found" | "network" | "malformed", status: number, message?: string) {
    super(message || reason);
    this.name = "SsrUpstreamError";
    this.reason = reason;
    this.status = status;
  }
}

/**
 * Extract the route-bearing part of an incoming origin-form or absolute URL.
 * Query and hash data never participate in route selection. Keep WHATWG URL's
 * encoded pathname as-is so percent-encoded separators cannot change segments.
 */
export function resolveSsrPathname(url: string): string {
  try {
    return new URL(url, SSR_URL_BASE).pathname;
  } catch {
    return "/";
  }
}

/**
 * Resolve the route to a renderer. Phase 1.2 ships three classes:
 * post detail (live ps fetch), profile stub (no fetch — phase 1.5),
 * homepage / fallback (no fetch).
 */
export async function render(url: string): Promise<RenderResult> {
  const pathname = resolveSsrPathname(url);
  const postMatch = POST_ROUTE.exec(pathname);
  if (postMatch) {
    return renderPostRoute(Number(postMatch[1]));
  }
  if (PROFILE_ROUTE.test(pathname)) {
    return renderProfileStub();
  }
  return renderHomepageShell();
}

async function renderPostRoute(tid: number): Promise<RenderResult> {
  const card = await fetchInternalShareCard(tid);
  return renderPostHtml(card, card.wechat);
}

function renderProfileStub(): RenderResult {
  // Phase 1.5 lights this up against ps profile data + composable audit.
  // Until then, we emit a brand-default shell so the route is
  // behaviorally identical to `/` while the URL form is reserved.
  return renderHomepageShell();
}

function renderHomepageShell(): RenderResult {
  const title = BRAND_TITLE;
  const description = BRAND_DESCRIPTION;
  const thumbnail = BRAND_THUMBNAIL;
  const canonicalUrl = "/";
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    // Open Graph
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${escapeHtml(thumbnail)}">`,
    `<meta property="og:image:width" content="${DEFAULT_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${DEFAULT_IMAGE_HEIGHT}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_TITLE)}">`,
    `<meta property="og:locale" content="${BRAND_LOCALE}">`,
    // Twitter Card
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(thumbnail)}">`,
  ].join("\n");

  const html = [
    `<main class="ssr-shell ssr-shell--home">`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    `</main>`,
    // Real browsers: hand control to the SPA hash router immediately.
    // Crawlers ignore this script and keep the static body above.
    `<script>location.replace("/#/feed")</script>`,
  ].join("");

  return { head, html };
}

function renderPostHtml(card: ShareCardSlim, wechat?: WechatChannelOverrides): RenderResult {
  const baseTitle = card.title || BRAND_TITLE;
  const decoratedTitle = applyKindTitleDecoration(card.kind, baseTitle);
  const description = card.summary || "";
  const image = card.thumbnailUrl || BRAND_THUMBNAIL;
  const canonicalUrl = card.url || `/post/${card.tid}`;

  // WeChat crawlers may benefit from channel-specific overrides when available.
  // Fall back to the standard values if channel overrides are absent.
  const wechatTitle = wechat?.title || decoratedTitle;
  const wechatDescription = wechat?.description || description;
  const wechatImage = wechat?.imageUrl || image;

  const head = [
    `<title>${escapeHtml(decoratedTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    // Open Graph — primary tags for Facebook, WeChat, Weibo, etc.
    `<meta property="og:title" content="${escapeHtml(wechatTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(wechatDescription)}">`,
    `<meta property="og:image" content="${escapeHtml(wechatImage)}">`,
    `<meta property="og:image:width" content="${DEFAULT_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${DEFAULT_IMAGE_HEIGHT}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_TITLE)}">`,
    `<meta property="og:locale" content="${BRAND_LOCALE}">`,
    // Twitter Card
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(decoratedTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    // Article-specific meta (author attribution)
    card.authorName
      ? `<meta property="article:author" content="${escapeHtml(card.authorName)}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const authorMeta = card.authorName
    ? `<p class="ssr-shell__meta">作者：${escapeHtml(card.authorName)}</p>`
    : "";
  const audienceMeta = card.audienceLabel
    ? `<p class="ssr-shell__meta">可见范围：${escapeHtml(card.audienceLabel)}</p>`
    : "";

  const html = [
    `<main class="ssr-shell ssr-shell--post">`,
    `<h1>${escapeHtml(decoratedTitle)}</h1>`,
    description ? `<p>${escapeHtml(description)}</p>` : "",
    image
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(decoratedTitle)}" class="ssr-shell__hero">`
      : "",
    authorMeta,
    audienceMeta,
    `</main>`,
    // Real browsers immediately switch to the SPA hash route. Crawlers
    // and IM previewers (WeChat, WeCom) read the meta + body above and
    // ignore the script. Singular `/post/{tid}` is intentional —
    // RFC §3 + ps#536.
    `<script>location.replace(${JSON.stringify(`/#/post/${card.tid}`)})</script>`,
  ].join("");

  return { head, html };
}

/**
 * Per-kind title decoration per RFC §4 table.
 *
 * `event` and `merchant` need richer fields (startTimeLocal /
 * merchantName / locality) that ps does not yet emit; those fall back
 * to plain title and the work is tracked in RFC §12 ps follow-ups.
 */
function applyKindTitleDecoration(kind: string, title: string): string {
  switch (kind) {
    case "errand":
      return `可下单：${title}`;
    case "help":
      return `求助：${title}`;
    case "event":
    case "merchant":
    case "post":
    default:
      return title;
  }
}

function getInternalPsBaseUrl(): string {
  const raw = (process.env.LIAN_PS_INTERNAL_URL ?? "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_PS_INTERNAL_URL;
}

/**
 * Reach ps `share-card` over loopback per RFC §5. The SSR layer must
 * never use the public hostname — that would create an SSR ↔ Caddy
 * loop and turn a single user request into an O(N) fanout.
 *
 * On any upstream failure the function throws so the http service
 * caller can map to 503 → Caddy fallback.
 */
async function fetchInternalShareCard(tid: number): Promise<ShareCardSlim> {
  const baseUrl = getInternalPsBaseUrl();
  const url = `${baseUrl}/api/posts/${tid}/share-card`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PS_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new SsrUpstreamError(
      "network",
      0,
      error instanceof Error ? error.message : "ps share-card unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new SsrUpstreamError("not-found", 404, "share-card not found");
  }
  if (!response.ok) {
    throw new SsrUpstreamError("network", response.status, `ps share-card ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new SsrUpstreamError(
      "malformed",
      response.status,
      error instanceof Error ? error.message : "share-card body not JSON",
    );
  }

  return normalizeShareCard(payload, tid);
}

/**
 * Coerce the V1 envelope into `ShareCardSlim`. Mirrors the cascade
 * `src/api/share-card.ts` uses (asString / asNumber semantics). Throws
 * `SsrUpstreamError("malformed")` when the response shape is missing
 * the `card` block entirely — that's a contract break and should not
 * silently render an empty page.
 */
function normalizeShareCard(payload: unknown, fallbackTid: number): ShareCardSlim {
  if (!payload || typeof payload !== "object") {
    throw new SsrUpstreamError("malformed", 200, "share-card envelope is not an object");
  }
  const envelope = payload as { ok?: unknown; card?: unknown };
  if (!envelope.card || typeof envelope.card !== "object") {
    throw new SsrUpstreamError("malformed", 200, "share-card envelope missing card");
  }
  const card = envelope.card as Record<string, unknown>;
  const tid = toFiniteInt(card.tid, fallbackTid);

  // Extract WeChat channel overrides if present (V1 envelope: card.channel.wechat)
  let wechat: WechatChannelOverrides | undefined;
  if (card.channel && typeof card.channel === "object") {
    const channelRecord = card.channel as Record<string, unknown>;
    if (channelRecord.wechat && typeof channelRecord.wechat === "object") {
      const wechatRecord = channelRecord.wechat as Record<string, unknown>;
      const title = toTrimmedString(wechatRecord.title);
      const description = toTrimmedString(wechatRecord.description);
      const imageUrl = toTrimmedString(wechatRecord.imageUrl);
      if (title || description || imageUrl) {
        wechat = {
          title: title || undefined,
          description: description || undefined,
          imageUrl: imageUrl || undefined,
        };
      }
    }
  }

  return {
    tid,
    title: toTrimmedString(card.title),
    summary: toTrimmedString(card.summary),
    thumbnailUrl: toTrimmedString(card.thumbnailUrl),
    url: toTrimmedString(card.url),
    kind: toTrimmedString(card.kind) || "post",
    authorName: toTrimmedString(card.authorName),
    audienceLabel: toTrimmedString(card.audienceLabel),
    wechat,
  };
}

function toTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toFiniteInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
