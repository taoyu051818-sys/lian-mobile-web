import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sheetSource = readFileSync(
  path.join(repoRoot, "src/features/map/MapPlaceSheet.vue"),
  "utf8",
).replace(/\r\n/g, "\n");
const viewSource = readFileSync(
  path.join(repoRoot, "src/features/map/MapView.vue"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("MapPlaceSheet DTO rendering contract", () => {
  it("accepts the backend place sheet DTO and map fetch states", () => {
    expect(sheetSource).toMatch(/placeSheet\?:\s*PlaceSheet \| null/);
    expect(sheetSource).toMatch(/placeSheetLoading\?:\s*boolean/);
    expect(sheetSource).toMatch(/placeSheetError\?:\s*string/);
  });

  it("renders loading, error, summary, empty, stats, and recent-post DTO branches", () => {
    expect(sheetSource).toMatch(/v-if="placeSheetLoading"/);
    expect(sheetSource).toMatch(/v-else-if="placeSheetError"/);
    expect(sheetSource).toMatch(/placeSheet\?\.summary\?\.text/);
    expect(sheetSource).toMatch(/PLACE_SHEET_SETTLING/);
    expect(sheetSource).toMatch(/placeSheet\?\.stats/);
    expect(sheetSource).toMatch(/placeSheet\?\.recentPosts\?\.length/);
  });

  it("renders recent DTO posts as detail-opening buttons without changing marker fallback", () => {
    expect(sheetSource).toMatch(
      /defineEmits<\{\n\s+close: \[\];\n\s+openPost: \[tid: FeedItemId \| string\];/,
    );
    expect(sheetSource).toMatch(/<button[\s\S]*@click="\$emit\('openPost', recent\.tid\)"/);
    expect(sheetSource).toMatch(/placeSheet\?\.name \|\| placeName\(selectedPlace\)/);
  });

  it("preserves the local selected-place title as fallback until the DTO arrives", () => {
    expect(sheetSource).toMatch(/placeSheet\?\.name \|\| placeName\(selectedPlace\)/);
    expect(sheetSource).toMatch(
      /"name" in place \? place\.name : place\.title \|\| place\.locationArea \|\| ""/,
    );
  });

  it("opens the backend place sheet when a map location is selected", () => {
    expect(viewSource).toMatch(/openPlaceSheet/);
    expect(viewSource).toMatch(/selectLocation\(place\);\n\s*void openPlaceSheet\(place\);/);
    expect(viewSource).toMatch(/@open-post="openRecentPost"/);
    expect(viewSource).toMatch(/function openRecentPost\(tid: FeedItemId \| string\)/);
  });
});
