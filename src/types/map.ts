import type { FeedItemId } from "./feed";
import type { PlaceRef } from "./place";

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapLayerPoint extends MapPoint {
  x?: number;
  y?: number;
}

export interface MapStyle {
  color?: string;
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  dashArray?: string;
}

export interface MapArea {
  id?: string;
  name: string;
  points: MapLayerPoint[];
  style?: MapStyle;
}

export interface MapRoute {
  id?: string;
  name?: string;
  title?: string;
  points: MapLayerPoint[];
  style?: MapStyle;
}

export interface MapRoad {
  id?: string;
  name?: string;
  type?: string;
  points: MapLayerPoint[];
  style?: MapStyle;
  renderHint?: {
    surface?: string;
    curveStyle?: string;
    edgeStyle?: string;
  };
  interactive?: boolean;
  status?: string;
  source?: string;
}

export interface MapAsset {
  id?: string;
  kind?: string;
  url?: string;
  position?: MapPoint;
  size?: [number, number];
  anchor?: [number, number];
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  clickBehavior?: string;
}

export interface MapLocationCard {
  imageUrl?: string;
  alwaysShow?: boolean;
}

export interface MapLocationIcon {
  url?: string;
  className?: string;
}

export interface MapLocation {
  id: string;
  name: string;
  type?: string;
  placeId?: string;
  place?: PlaceRef;
  lat: number;
  lng: number;
  icon?: MapLocationIcon;
  card?: MapLocationCard;
}

export interface MapPost {
  tid: FeedItemId;
  title?: string;
  locationArea?: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  type?: string;
}

export interface MapLayerBundle {
  areas?: MapArea[];
  routes?: MapRoute[];
  roads?: MapRoad[];
  assets?: MapAsset[];
}

export interface MapV2ItemsResponse {
  bounds?: MapBounds;
  center?: MapPoint;
  zoom?: number;
  layers?: MapLayerBundle;
  locations?: MapLocation[];
  posts?: MapPost[];
}
