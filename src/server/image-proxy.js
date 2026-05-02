const ALLOWED_IMAGE_HOSTS = new Set(["res.cloudinary.com"]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function isAllowedImageUrl(value = "") {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" &&
      ALLOWED_IMAGE_HOSTS.has(url.hostname) &&
      url.pathname.startsWith("/dhvyvfu4n/image/upload/");
  } catch {
    return false;
  }
}

async function handleImageProxy(reqUrl, res) {
  const target = reqUrl.searchParams.get("url") || "";
  if (!isAllowedImageUrl(target)) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("invalid image url");
    return;
  }
  const fetchTarget = target.replace(
    /\/image\/upload\/([^/]*?)f_auto([^/]*?)\//,
    (_match, before, after) => `/image/upload/${before}f_jpg${after}/`
  );

  const response = await fetch(fetchTarget, {
    headers: {
      accept: "image/jpeg,image/png,image/*,*/*"
    }
  });
  if (!response.ok || !String(response.headers.get("content-type") || "").startsWith("image/")) {
    res.writeHead(response.ok ? 502 : response.status, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end("image fetch failed");
    return;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    res.writeHead(413, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("image too large");
    return;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    res.writeHead(413, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("image too large");
    return;
  }

  res.writeHead(200, {
    "content-type": response.headers.get("content-type") || "image/jpeg",
    "cache-control": "public, max-age=604800, immutable",
    "content-length": String(bytes.byteLength)
  });
  res.end(Buffer.from(bytes));
}

export { handleImageProxy, isAllowedImageUrl };
