import type { PlaceRef } from "./place";
import type { Audience } from "./audience";

export type PublishVisibility = "public" | "campus" | "school" | "private";
export type PublishLocationSource = "manual" | "skipped" | "map_v2";
/** "manual" = display-only free-text fallback, "gaode_v2" = resolved map selection */
export type PublishMapVersion = "legacy" | "manual" | "gaode_v2";

export interface PublishLocationDraft {
  source: PublishLocationSource;
  locationId: string;
  placeId?: string;
  place?: PlaceRef;
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
  tag: string;
  identityTag: string;
  metadata: {
    locationArea?: string;
    visibility: PublishVisibility;
    distribution: string[];
    primaryTag?: string;
    identityTag?: string;
    /**
     * Optional full Audience descriptor (PRD V0.1 §6.2). Older backends ignore
     * this field and rely on `visibility` alone; newer backends use it to
     * authorize and persist scoped audience data.
     */
    audience?: Audience;
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
  place?: PlaceRef;
}

export interface UploadImageResponse {
  url: string;
}
