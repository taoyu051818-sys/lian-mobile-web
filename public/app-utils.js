const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const MAX_UPLOAD_IMAGE_BYTES = Math.floor(2.5 * 1024 * 1024);

function ensureClientId() {
  const key = "lian.clientId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatarHtml({ url = "", text = "同" } = {}) {
  const label = String(text || "同").slice(0, 2);
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">`
    : escapeHtml(label);
}

function displayImageUrl(url = "") {
  const value = String(url || "");
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value)) {
    return `/api/image-proxy?url=${encodeURIComponent(value)}`;
  }
  return value;
}

function fixFmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fmtMinute(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function uploadImage(file, purpose = "") {
  const form = new FormData();
  form.append("image", file, file.name || "image.jpg");
  const query = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  const response = await fetch(`/api/upload/image${query}`, {
    method: "POST",
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "图片上传失败");
  return data.url;
}

function loadImageBitmap(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file).then((bitmap) => ({
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close?.()
    }));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        image: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        close: () => {}
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败，请换一张图片试试"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), "image/jpeg", quality);
  });
}

async function compressImageForUpload(file, maxBytes = MAX_UPLOAD_IMAGE_BYTES) {
  if (!file?.type?.startsWith("image/")) return file;
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;

  const bitmap = await loadImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    let quality = 0.86;

    for (let resizeAttempt = 0; resizeAttempt < 10; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("图片压缩失败");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap.image, 0, 0, canvas.width, canvas.height);

      let low = 0.48;
      let high = quality;
      let bestBlob = null;
      for (let i = 0; i < 6; i += 1) {
        const nextQuality = (low + high) / 2;
        const blob = await canvasToBlob(canvas, nextQuality);
        if (blob.size <= maxBytes) {
          bestBlob = blob;
          low = nextQuality;
        } else {
          high = nextQuality;
        }
      }

      const fallbackBlob = bestBlob || await canvasToBlob(canvas, 0.48);
      if (fallbackBlob.size <= maxBytes) {
        const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
        return new File([fallbackBlob], `${baseName || "image"}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now()
        });
      }

      const ratio = Math.sqrt(maxBytes / fallbackBlob.size) * 0.92;
      const scale = Math.max(0.55, Math.min(0.85, ratio));
      width *= scale;
      height *= scale;
      quality = 0.76;
    }
    throw new Error("图片太大，压缩到 2.5MB 以下失败，请换一张图片试试");
  } finally {
    bitmap.close();
  }
  return file;
}

async function uploadPostImages(files, onProgress = () => {}) {
  const urls = [];
  for (let index = 0; index < files.length; index += 1) {
    onProgress(index, files.length, "compress");
    const compressed = await compressImageForUpload(files[index]);
    onProgress(index, files.length, "upload");
    urls.push(await uploadImage(compressed));
    onProgress(index, files.length, "done");
  }
  return urls;
}

function setPublishProgress({ visible = true, label = "", percent = 0 } = {}) {
  const progress = $("#publishProgress");
  if (!progress) return;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  progress.hidden = !visible;
  $("#publishProgressText").textContent = label;
  $("#publishProgressValue").textContent = `${value}%`;
  $("#publishProgressBar").style.width = `${value}%`;
  $(".publish-progress-track", progress).setAttribute("aria-valuenow", String(value));
}

function resetPublishProgress() {
  setPublishProgress({ visible: false, label: "准备上传", percent: 0 });
}
