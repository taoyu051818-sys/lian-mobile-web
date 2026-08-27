import type { AdminMapDocument } from "../../api/adminMap";
import type { MapAsset, MapV2ItemsResponse } from "../../types/map";

export interface MapAssetTransform {
  id: string;
  lat?: number;
  lng?: number;
  rotation?: number;
  width?: number;
  height?: number;
  kind?: string;
  url?: string;
  opacity?: number;
}

function cloneAssets(document: AdminMapDocument): MapAsset[] {
  return (document.layers.assets || []).map((asset) => ({
    ...asset,
    ...(asset.position ? { position: { ...asset.position } } : {}),
    ...(asset.size ? { size: [...asset.size] as [number, number] } : {}),
    ...(asset.anchor ? { anchor: [...asset.anchor] as [number, number] } : {}),
  }));
}

function withAssets(document: AdminMapDocument, assets: MapAsset[]): AdminMapDocument {
  return {
    ...document,
    bounds: { ...document.bounds },
    locations: {
      ...document.locations,
      items: document.locations.items.map((item) => ({ ...item })),
    },
    layers: { ...document.layers, assets },
  };
}

export function buildEditableMapData(document: AdminMapDocument): MapV2ItemsResponse {
  return {
    bounds: { ...document.bounds },
    center: { ...document.layers.center },
    zoom: document.layers.zoom,
    locations: document.locations.items,
    layers: document.layers,
    posts: [],
  };
}

export function updateMapAsset(
  document: AdminMapDocument,
  update: MapAssetTransform,
): AdminMapDocument {
  let found = false;
  const assets = cloneAssets(document).map((asset) => {
    if (String(asset.id || "") !== update.id) return asset;
    found = true;
    const currentPosition = asset.position || document.layers.center;
    const currentSize = asset.size || [48, 48];
    const currentAnchor = asset.anchor || [currentSize[0] / 2, currentSize[1] / 2];
    const width = Math.max(
      8,
      Math.round(Number.isFinite(update.width) ? Number(update.width) : currentSize[0]),
    );
    const height = Math.max(
      8,
      Math.round(Number.isFinite(update.height) ? Number(update.height) : currentSize[1]),
    );
    return {
      ...asset,
      ...(update.kind !== undefined ? { kind: update.kind.trim() || "asset" } : {}),
      ...(update.url !== undefined ? { url: update.url.trim() } : {}),
      ...(update.opacity !== undefined
        ? { opacity: Math.max(0, Math.min(1, update.opacity)) }
        : {}),
      position: {
        lat: Number.isFinite(update.lat) ? Number(update.lat) : currentPosition.lat,
        lng: Number.isFinite(update.lng) ? Number(update.lng) : currentPosition.lng,
      },
      size: [width, height] as [number, number],
      anchor: [
        (currentAnchor[0] * width) / Math.max(1, currentSize[0]),
        (currentAnchor[1] * height) / Math.max(1, currentSize[1]),
      ] as [number, number],
      rotation: Number.isFinite(update.rotation)
        ? Number(update.rotation)
        : Number(asset.rotation || 0),
    };
  });
  if (!found) throw new Error(`地图素材不存在：${update.id}`);
  return withAssets(document, assets);
}

export function addMapAsset(document: AdminMapDocument, asset: MapAsset): AdminMapDocument {
  const id = String(asset.id || "").trim();
  if (!id || !asset.url || !asset.position) throw new Error("地图素材缺少 id、图片或位置。");
  const assets = cloneAssets(document);
  if (assets.some((item) => String(item.id || "") === id)) {
    throw new Error(`地图素材 ID 已存在：${id}`);
  }
  assets.push({
    ...asset,
    id,
    position: { ...asset.position },
    size: [...(asset.size || [48, 48])] as [number, number],
    rotation: Number(asset.rotation || 0),
    opacity: Number(asset.opacity ?? 1),
  });
  return withAssets(document, assets);
}

export function removeMapAsset(document: AdminMapDocument, id: string): AdminMapDocument {
  const assets = cloneAssets(document);
  const next = assets.filter((asset) => String(asset.id || "") !== id);
  if (next.length === assets.length) throw new Error(`地图素材不存在：${id}`);
  return withAssets(document, next);
}
