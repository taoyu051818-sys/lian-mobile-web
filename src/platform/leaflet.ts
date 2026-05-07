/**
 * Platform adapter for Leaflet loaded via CDN (window.L).
 *
 * All `any` usage is quarantined inside this file. Vue components
 * must import typed helpers from here and never access window.L directly.
 *
 * Leaflet remains loaded from unpkg CDN in index.html. This adapter
 * only provides the type/runtime boundary; it does not change the
 * loading strategy.
 */

export type LeafletLatLngTuple = [number, number];

export interface LeafletBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface LeafletMapOptions {
  center?: LeafletLatLngTuple;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: LeafletLatLngTuple[];
  maxBoundsViscosity?: number;
  zoomControl?: boolean;
  attributionControl?: boolean;
}

export interface LeafletMapLike {
  getZoom(): number;
  invalidateSize(): void;
  remove(): void;
  panTo(latlng: LeafletLatLngTuple, options?: { animate?: boolean }): void;
  on(event: string, handler: (...args: unknown[]) => void): LeafletMapLike;
}

/** Any object that can receive .addTo(): a map or a layer group. */
export type LeafletAddableTarget = LeafletMapLike | LeafletLayerGroupLike;

export interface LeafletLayerLike {
  addTo(target: LeafletAddableTarget): LeafletLayerLike;
  bindTooltip(content: string, options?: { sticky?: boolean }): LeafletLayerLike;
}

export interface LeafletLayerGroupLike {
  addTo(target: LeafletAddableTarget): LeafletLayerGroupLike;
  clearLayers(): void;
}

export interface LeafletMarkerLike extends LeafletLayerLike {
  on(event: string, handler: (...args: unknown[]) => void): LeafletMarkerLike;
}

export interface LeafletDivIconOptions {
  className?: string;
  html?: string;
  iconSize?: LeafletLatLngTuple;
  iconAnchor?: LeafletLatLngTuple;
  popupAnchor?: LeafletLatLngTuple;
}

export interface LeafletDivIconLike {
  /* opaque: passed to marker options */
}

export interface LeafletMarkerOptions {
  icon?: LeafletDivIconLike;
  title?: string;
  zIndexOffset?: number;
  interactive?: boolean;
  keyboard?: boolean;
}

export interface LeafletPolygonOptions {
  color?: string;
  weight?: number;
  fillColor?: string;
  fillOpacity?: number;
  className?: string;
}

export interface LeafletPolylineOptions {
  color?: string;
  weight?: number;
  dashArray?: string;
  opacity?: number;
  lineCap?: string;
  lineJoin?: string;
  interactive?: boolean;
  className?: string;
}

export interface LeafletTileLayerOptions {
  subdomains?: string[];
  maxZoom?: number;
  minZoom?: number;
  opacity?: number;
  attribution?: string;
}

export interface LeafletTileLayerLike {
  addTo(target: LeafletAddableTarget): LeafletTileLayerLike;
}

export interface LeafletImageOverlayOptions {
  interactive?: boolean;
  opacity?: number;
  zIndex?: number;
}

export interface LeafletImageOverlayLike {
  addTo(target: LeafletAddableTarget): LeafletImageOverlayLike;
  setBounds(bounds: LeafletLatLngTuple[]): void;
}

export interface LeafletZoomControlOptions {
  position?: string;
}

export interface LeafletZoomControlLike {
  addTo(target: LeafletAddableTarget): LeafletZoomControlLike;
}

/** The full Leaflet API surface used by MapLeafletView. */
export interface LeafletLike {
  map(element: HTMLElement, options?: LeafletMapOptions): LeafletMapLike;
  layerGroup(): LeafletLayerGroupLike;
  marker(latlng: LeafletLatLngTuple, options?: LeafletMarkerOptions): LeafletMarkerLike;
  polygon(latlngs: LeafletLatLngTuple[], options?: LeafletPolygonOptions): LeafletLayerLike;
  polyline(latlngs: LeafletLatLngTuple[], options?: LeafletPolylineOptions): LeafletLayerLike;
  tileLayer(urlTemplate: string, options?: LeafletTileLayerOptions): LeafletTileLayerLike;
  imageOverlay(imageUrl: string, bounds: LeafletLatLngTuple[], options?: LeafletImageOverlayOptions): LeafletImageOverlayLike;
  divIcon(options?: LeafletDivIconOptions): LeafletDivIconLike;
  control: {
    zoom(options?: LeafletZoomControlOptions): LeafletZoomControlLike;
  };
}

export class LeafletUnavailableError extends Error {
  constructor(message = "Leaflet map library is not loaded yet. Refresh and try again.") {
    super(message);
    this.name = "LeafletUnavailableError";
  }
}

export function isLeafletAvailable(): boolean {
  return typeof window !== "undefined" && !!window.L;
}

export function getLeaflet(): LeafletLike {
  if (!isLeafletAvailable()) {
    throw new LeafletUnavailableError();
  }
  // window.L is verified present; cast through the adapter boundary.
  // This is the only cast from the CDN global to the local Leaflet surface.
  return window.L as LeafletLike;
}

export function tryGetLeaflet(): LeafletLike | null {
  return isLeafletAvailable() ? (window.L as LeafletLike) : null;
}

declare global {
  interface Window {
    /** Leaflet library loaded via CDN. Typed via LeafletLike at the adapter boundary. */
    L?: LeafletLike;
  }
}
