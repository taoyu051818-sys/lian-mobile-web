export { default as ShellChrome } from "./ShellChrome.vue";
export { default as ContentFrame } from "./ContentFrame.vue";
export { default as AppShell } from "./AppShell.vue";
export { useShellChrome } from "./useShellChrome";
export type {
  ShellRegionKey,
  ChromeButtonSpec,
  ShellChromeRegionSpec,
  ShellChromeRegionMap,
  ShellChromeState,
} from "./shell-chrome-types";
export { createEmptyRegionSpec, createDefaultChromeState } from "./shell-chrome-types";
