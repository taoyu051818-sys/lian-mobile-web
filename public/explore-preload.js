(function () {
  let started = false;

  function resolveImageUrl(value) {
    if (typeof window.displayImageUrl === "function") return window.displayImageUrl(value || "");
    return String(value || "");
  }

  function addUrl(urls, value) {
    const url = resolveImageUrl(value || "");
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
      const data = typeof window.api === "function"
        ? await window.api("/api/map/v2/items")
        : await fetch("/api/map/v2/items", { credentials: "include" }).then((response) => response.ok ? response.json() : {});
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
