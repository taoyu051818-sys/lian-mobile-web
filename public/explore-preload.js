(function () {
  const LIAN_API_BASE = (typeof window !== "undefined" && window.LIAN_API_BASE_URL) || "";
  const LIAN_IMAGE_PROXY_BASE = (() => {
    const configured = (typeof window !== "undefined" && window.LIAN_IMAGE_PROXY_BASE_URL) || "";
    if (configured) return configured.replace(/\/$/, "");
    try {
      const url = new URL(LIAN_API_BASE || window.location.origin, window.location.origin);
      url.port = "4101";
      url.pathname = "";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  })();

  let started = false;

  function displayImageUrl(url = "") {
    const value = String(url || "");
    if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value)) {
      return `${LIAN_IMAGE_PROXY_BASE}/api/image-proxy?url=${encodeURIComponent(value)}`;
    }
    return value;
  }

  function addUrl(urls, value) {
    const url = displayImageUrl(value || "");
    if (!url) return;
    urls.add(url);
  }

  function collectExploreImageUrls(data = {}) {
    const urls = new Set([
      "/assets/campus-base-map.png",
      "/assets/lian-illustrated-map.webp"
    ]);
    for (const asset of data.layers?.assets || []) addUrl(urls, asset.url);
    for (const location of data.locations || []) {
      addUrl(urls, location.icon?.url);
      addUrl(urls, location.card?.imageUrl);
    }
    for (const post of data.posts || []) {
      addUrl(urls, post.imageUrl);
      for (const url of post.imageUrls || []) addUrl(urls, url);
    }
    return Array.from(urls);
  }

  function preloadImage(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.onload = resolve;
      image.onerror = resolve;
      image.src = url;
    });
  }

  async function preloadInBatches(urls, concurrency = 4) {
    const queue = urls.slice();
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        await preloadImage(url);
      }
    });
    await Promise.all(workers);
  }

  async function preloadExploreAssets() {
    if (started) return;
    started = true;
    try {
      const response = await fetch(`${LIAN_API_BASE}/api/map/v2/items`, { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const urls = collectExploreImageUrls(data);
      await preloadInBatches(urls);
    } catch (error) {
      console.warn("[explore-preload] failed", error);
    }
  }

  function scheduleExplorePreload() {
    const run = () => preloadExploreAssets();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 350);
    }
  }

  window.preloadExploreAssets = preloadExploreAssets;
  scheduleExplorePreload();
})();
