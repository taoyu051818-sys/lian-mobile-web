import { reactive, readonly } from "vue";
import {
  createDefaultDetailSheetState,
  type DetailSheetKind,
  type DetailSheetPayloadMap,
  type DetailSheetState,
} from "./detail-sheet-types";

const state: DetailSheetState = reactive(createDefaultDetailSheetState());

function open<K extends DetailSheetKind>(kind: K, payload: DetailSheetPayloadMap[K]) {
  state.kind = kind;
  state.payload = payload;
  state.open = true;
}

function close() {
  state.open = false;
  state.kind = null;
  state.payload = null;
}

export function useDetailSheet(): {
  state: Readonly<DetailSheetState>;
  open: <K extends DetailSheetKind>(kind: K, payload: DetailSheetPayloadMap[K]) => void;
  close: () => void;
} {
  return { state: readonly(state) as Readonly<DetailSheetState>, open, close };
}
