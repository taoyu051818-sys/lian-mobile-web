export { default as ShellChrome } from "./ShellChrome.vue";
export { default as ContentFrame } from "./ContentFrame.vue";
export { default as AppShell } from "./AppShell.vue";
export { default as DetailSheet } from "./DetailSheet.vue";
export { useShellChrome } from "./useShellChrome";
export { useDetailSheet } from "./useDetailSheet";
export type {
  ShellRegionKey,
  ChromeButtonSpec,
  ShellChromeRegionSpec,
  ShellChromeRegionMap,
  ShellChromeState,
} from "./shell-chrome-types";
export { createEmptyRegionSpec, createDefaultChromeState } from "./shell-chrome-types";
export type {
  DetailSheetKind,
  DetailSheetPostPayload,
  DetailSheetPlacePayload,
  DetailSheetProfilePayload,
  DetailSheetPayloadMap,
  DetailSheetState,
} from "./detail-sheet-types";
export { createDefaultDetailSheetState } from "./detail-sheet-types";
