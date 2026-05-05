export type PublishVisibility = "public" | "campus" | "school" | "private";
export type PublishLocationSource = "manual" | "skipped" | "map_v2";
export type PublishMapVersion = "legacy" | "gaode_v2";

export interface PublishLocationDraft {
  source: PublishLocationSource;
  locationId: string;
  locationArea: string;
  displayName: string;
  lat: number | null;
  lng: number | null;
  legacyPoint: { x: number | null; y: number | null };
  imagePoint: { x: number | null; y: number | null };
  mapVersion: PublishMapVersion;
  confidence: number;
  skipped: boolean;
  note: string;
}

export interface PublishPayload {
  imageUrl: string;
  imageUrls: string[];
  title: string;
  body: string;
  tags: string[];
  metadata: {
    locationArea?: string;
    visibility: PublishVisibility;
    distribution: string[];
  };
  locationDraft: PublishLocationDraft;
  riskFlags: Array<{ message?: string }>;
  confidence: number;
  needsHumanReview: boolean;
  aiMode: string;
  aliasId?: string;
}

export interface PublishResponse {
  tid?: string | number;
}

export interface UploadImageResponse {
  url: string;
}
