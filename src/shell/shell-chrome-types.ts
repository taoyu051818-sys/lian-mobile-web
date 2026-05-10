export type ShellRegionKey = "top" | "bottom";

export interface ChromeButtonSpec {
  id: string;
  label: string;
  icon?: string;
  variant?: "ghost" | "tonal" | "primary";
  disabled?: boolean;
}

export interface ShellChromeRegionSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  /** Opaque slot hint for future slot-based rendering. */
  slot?: string;
}

export type ShellChromeRegionMap = Partial<Record<ShellRegionKey, ShellChromeRegionSpec>>;

export interface ShellChromeState {
  top: ShellChromeRegionSpec;
  bottom: ShellChromeRegionSpec;
}

export function createEmptyRegionSpec(): ShellChromeRegionSpec {
  return { buttons: [], visible: true };
}

export function createDefaultChromeState(): ShellChromeState {
  return {
    top: createEmptyRegionSpec(),
    bottom: createEmptyRegionSpec(),
  };
}
