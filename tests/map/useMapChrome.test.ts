import { describe, expect, it } from "vitest";

import { useMapChrome } from "../../src/features/map/useMapChrome.ts";

describe("useMapChrome", () => {
  it("exposes active Map V2 type filters and updates them when chrome filters toggle", () => {
    const { activeTypes, toggleFilter } = useMapChrome();

    expect(activeTypes.value).toEqual(["locations", "posts", "merchants", "relations"]);

    toggleFilter("merchants");
    expect(activeTypes.value).toEqual(["locations", "posts", "relations"]);

    toggleFilter("locations");
    expect(activeTypes.value).toEqual(["posts", "relations"]);

    toggleFilter("relations");
    expect(activeTypes.value).toEqual(["posts"]);

    toggleFilter("posts");
    expect(activeTypes.value).toEqual([]);
  });
});
