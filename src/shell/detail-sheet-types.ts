export type DetailSheetKind = "post" | "place" | "profile";

export interface DetailSheetPostPayload {
  postId: string;
  /** When true, the sheet skips the loading phase and waits for external data. */
  suppressLoading?: boolean;
}

export interface DetailSheetPlacePayload {
  placeId: string;
}

export interface DetailSheetProfilePayload {
  actorId: string;
}

export type DetailSheetPayloadMap = {
  post: DetailSheetPostPayload;
  place: DetailSheetPlacePayload;
  profile: DetailSheetProfilePayload;
};

export interface DetailSheetState {
  open: boolean;
  kind: DetailSheetKind | null;
  payload: DetailSheetPostPayload | DetailSheetPlacePayload | DetailSheetProfilePayload | null;
}

export function createDefaultDetailSheetState(): DetailSheetState {
  return { open: false, kind: null, payload: null };
}
