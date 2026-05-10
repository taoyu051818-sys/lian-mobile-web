import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedTypeSource = fs.readFileSync(path.join(repoRoot, "src/types/feed.ts"), "utf8");
const feedItemCardSource = fs.readFileSync(path.join(repoRoot, "src/views/feed/FeedItemCard.vue"), "utf8");

describe("Feed presentationIntent contract", () => {
  it("types the server-provided presentationIntent", () => {
    expect(feedTypeSource).toMatch(/export type FeedPresentationIntent = "image" \| "text" \| "activity" \| "place" \| "merchant" \| "help";/);
    expect(feedTypeSource).toMatch(/presentationIntent\?: FeedPresentationIntent \| string \| null;/);
  });

  it("prefers valid presentationIntent before frontend heuristics", () => {
    expect(feedItemCardSource).toMatch(/import type \{ FeedItem, FeedItemId, FeedPresentationIntent \}/);
    expect(feedItemCardSource).toMatch(/function normalizePresentationIntent\(value: FeedItem\["presentationIntent"\]\): CardTemplate \| null/);
    expect(feedItemCardSource).toMatch(/CARD_TEMPLATES\.has\(value as CardTemplate\)/);
    expect(feedItemCardSource).toMatch(/const serverPresentationIntent = computed\(\(\) => normalizePresentationIntent\(props\.item\.presentationIntent\)\);/);
    expect(feedItemCardSource).toMatch(/if \(serverPresentationIntent\.value\) return serverPresentationIntent\.value;/);
    expect(feedItemCardSource).toMatch(/const raw = searchText\.value;/);
  });
});
