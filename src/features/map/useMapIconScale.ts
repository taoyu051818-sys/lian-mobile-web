import type { LeafletMapLike } from "../../platform/leaflet";

const SCALED_ICON_SELECTOR = "[data-vue-map-scaled-icon]";
const ICON_BASE_ZOOM = 16;

export function createMapIconScale(getMap: () => LeafletMapLike | null) {
  const iconScaleBoundMaps = new WeakSet<LeafletMapLike>();

  function iconScaleForZoom(target: LeafletMapLike | null = getMap(), zoom = target?.getZoom?.()) {
    if (!target) return 1;
    const nextZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : ICON_BASE_ZOOM;
    return Math.pow(2, nextZoom - ICON_BASE_ZOOM);
  }

  function applyMapIconScale(target: LeafletMapLike | null = getMap(), zoom = target?.getZoom?.()) {
    const markerPane = target?.getPane("markerPane");
    if (!markerPane) return;
    const scale = iconScaleForZoom(target, zoom);
    markerPane.querySelectorAll<HTMLElement>(SCALED_ICON_SELECTOR).forEach((element) => {
      element.style.transform = `scale(${scale})`;
    });
  }

  function bindMapIconScale(target: LeafletMapLike) {
    if (iconScaleBoundMaps.has(target)) return;
    target.on("zoomanim", (e: unknown) => {
      const zoom =
        e && typeof e === "object" && "zoom" in e
          ? Number((e as { zoom?: unknown }).zoom)
          : target.getZoom();
      applyMapIconScale(target, Number.isFinite(zoom) ? zoom : target.getZoom());
    });
    target.on("viewreset moveend", (...args: unknown[]) => {
      const event = args[0];
      const zoom =
        event && typeof event === "object" && "zoom" in event
          ? Number((event as { zoom?: unknown }).zoom)
          : target.getZoom();
      applyMapIconScale(target, Number.isFinite(zoom) ? zoom : target.getZoom());
    });
    iconScaleBoundMaps.add(target);
  }

  return { iconScaleForZoom, applyMapIconScale, bindMapIconScale };
}
