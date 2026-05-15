import type { LeafletDivIconLike } from "../platform/leaflet";
import { getLeaflet } from "../platform/leaflet";
import type { MapAsset, MapLocation, MapPost } from "../types/map";

export function escapeHtml(value = ""): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function scaledIconHtml(html: string, anchor: [number, number]): string {
  const x = Number(anchor[0] ?? 0);
  const y = Number(anchor[1] ?? 0);
  return `
    <span
      class="vue-map-scaled-icon-inner"
      data-vue-map-scaled-icon
      style="width:100%;height:100%;transform-origin:${escapeHtml(String(x))}px ${escapeHtml(String(y))}px;will-change:transform"
    >${html}</span>
  `;
}

export function htmlIcon(
  className: string,
  html: string,
  size: [number, number],
  anchor: [number, number],
): LeafletDivIconLike {
  return getLeaflet().divIcon({
    className,
    html: scaledIconHtml(html, anchor),
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -Math.round(size[1] * 0.72)],
  });
}

export function locationIcon(location: MapLocation): LeafletDivIconLike {
  const image = location.card?.imageUrl || location.icon?.url;
  if (image) {
    return htmlIcon(
      "vue-map-marker vue-map-marker--place-card",
      `<span class="vue-map-location-card"><img src="${escapeHtml(image)}" alt=""><span class="vue-map-sr-only">${escapeHtml(location.name)}</span></span>`,
      [142, 48],
      [71, 48],
    );
  }
  return htmlIcon(
    "vue-map-marker vue-map-marker--location",
    `<span class="vue-map-location-pin"><strong>${escapeHtml(location.name.slice(0, 2))}</strong></span>`,
    [46, 54],
    [23, 54],
  );
}

export function postIcon(post: MapPost): LeafletDivIconLike {
  const image = post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="">` : "<strong>帖</strong>";
  return htmlIcon(
    "vue-map-marker vue-map-marker--post",
    `<span class="vue-map-post-card">${image}<span>${escapeHtml(post.title || post.locationArea || "地图内容")}</span></span>`,
    [72, 78],
    [36, 78],
  );
}

export function assetIcon(asset: MapAsset): LeafletDivIconLike {
  const size: [number, number] = Array.isArray(asset.size) ? [Number(asset.size[0] ?? 64), Number(asset.size[1] ?? 64)] : [64, 64];
  const anchor: [number, number] = Array.isArray(asset.anchor) ? [Number(asset.anchor[0] ?? size[0] / 2), Number(asset.anchor[1] ?? size[1])] : [size[0] / 2, size[1]];
  const opacity = Math.max(0, Math.min(1, Number(asset.opacity ?? 1)));
  const rotation = Number(asset.rotation || 0);
  return htmlIcon(
    `vue-map-asset vue-map-asset--${escapeHtml(asset.kind || "other")}`,
    `<img src="${escapeHtml(asset.url || "")}" alt="" style="opacity:${opacity};transform:rotate(${rotation}deg)">`,
    size,
    anchor,
  );
}
