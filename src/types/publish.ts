export type PublishVisibility = "public" | "campus" | "school" | "private";

export interface PublishLocationDraft {
  source: "manual" | "skipped";
  locationId: string;
  locationArea: string;
  displayName: string;
  lat: number | null;
  lng: number | null;
  legacyPoint: { x: number | null; y: number | null };
  imagePoint: { x: number | null; y: number | null };
  mapVersion: "legacy";
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
