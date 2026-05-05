import type { FeedItemId } from "./feed";

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

export interface MapAsset {
  id?: string;
  kind?: string;
  url?: string;
  position?: MapPoint;
  opacity?: number;
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
