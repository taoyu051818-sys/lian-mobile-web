import { describe, it, expect } from "vitest";
import {
  getShellLayoutMode,
  shellLayoutModes,
  type AppViewKey,
  type ShellLayoutMode,
} from "../../src/app/view-types";

const ALL_VIEWS: AppViewKey[] = [
  "feed",
  "map",
  "publish",
  "messages",
  "profile",
  "admin",
  "verification",
  "merchant",
  "errand-order",
  "runner",
  "commerce",
];

describe("shellLayoutModes", () => {
  it("maps every view key to a layout mode", () => {
    for (const key of ALL_VIEWS) {
      expect(shellLayoutModes[key]).toBeDefined();
    }
  });

  it("uses content mode for feed, publish, and profile", () => {
    expect(shellLayoutModes.feed).toBe("content");
    expect(shellLayoutModes.publish).toBe("content");
    expect(shellLayoutModes.profile).toBe("content");
    expect(shellLayoutModes.commerce).toBe("content");
  });

  it("uses full-bleed mode for map", () => {
    expect(shellLayoutModes.map).toBe("full-bleed");
  });

  it("uses composer-safe mode for messages", () => {
    expect(shellLayoutModes.messages).toBe("composer-safe");
  });
});

describe("getShellLayoutMode", () => {
  it("returns the mapped mode for each view", () => {
    expect(getShellLayoutMode("feed")).toBe("content");
    expect(getShellLayoutMode("map")).toBe("full-bleed");
    expect(getShellLayoutMode("messages")).toBe("composer-safe");
    expect(getShellLayoutMode("commerce")).toBe("content");
  });

  it("returns content as fallback for unmapped keys", () => {
    expect(getShellLayoutMode("unknown" as AppViewKey)).toBe("content");
  });
});

describe("ShellLayoutMode type", () => {
  it("only allows the three expected mode strings", () => {
    const validModes: ShellLayoutMode[] = ["content", "full-bleed", "composer-safe"];
    for (const mode of validModes) {
      expect(typeof mode).toBe("string");
    }
    expect(validModes).toHaveLength(3);
  });
});
