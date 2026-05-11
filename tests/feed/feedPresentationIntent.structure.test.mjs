import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedTypeSource = fs.readFileSync(path.join(repoRoot, "src/types/feed.ts"), "utf8");
const feedApiSource = fs.readFileSync(path.join(repoRoot, "src/api/feed.ts"), "utf8");
const feedItemCardSource = fs.readFileSync(path.join(repoRoot, "src/views/feed/FeedItemCard.vue"), "utf8");

describe("Feed presentationIntent contract", () => {
  it("types the normalized card template fields", () => {
    expect(feedTypeSource).toMatch(/export type FeedPresentationIntent = "image" \| "text" \| "activity" \| "place" \| "merchant" \| "help";/);
    expect(feedTypeSource).toMatch(/export type FeedItemCardTemplateSource = "server" \| "content-type" \| "cover-fallback";/);
    expect(feedTypeSource).toMatch(/presentationIntent\?: FeedPresentationIntent \| string \| null;/);
    expect(feedTypeSource).toMatch(/cardTemplate\?: FeedPresentationIntent \| null;/);
    expect(feedTypeSource).toMatch(/cardTemplateSource\?: FeedItemCardTemplateSource;/);
  });

  it("normalizes card templates in the feed adapter before rendering", () => {
    expect(feedApiSource).toMatch(/export function normalizeFeedCardTemplate\(/);
    expect(feedApiSource).toMatch(/const normalizedServerTemplate = normalizeFeedPresentationIntent\(item\.cardTemplate\) \|\| normalizeFeedPresentationIntent\(item\.presentationIntent\);/);
    expect(feedApiSource).toMatch(/cardTemplateSource: "content-type"/);
    expect(feedApiSource).toMatch(/cardTemplate: item\.cover \? "image" : "text"/);
    expect(feedApiSource).toMatch(/items: Array\.isArray\(data\.items\)/);
    expect(feedApiSource).toMatch(/normalizeFeedItem\(item\)/);
  });

  it("keeps FeedItemCard on normalized template inputs and safe fallback rendering", () => {
    expect(feedItemCardSource).toMatch(/function normalizePresentationIntent\(value: FeedItem\["cardTemplate"\] \| FeedItem\["presentationIntent"\]\): CardTemplate \| null/);
    expect(feedItemCardSource).toMatch(/const normalizedCardTemplate = computed\(\(\) => normalizePresentationIntent\(props\.item\.cardTemplate\)\);/);
    expect(feedItemCardSource).toMatch(/if \(normalizedCardTemplate\.value\) return normalizedCardTemplate\.value;/);
    expect(feedItemCardSource).toMatch(/return coverUrl\.value \? "image" : "text";/);
    expect(feedItemCardSource).not.toMatch(/const searchText = computed/);
    expect(feedItemCardSource).not.toMatch(/raw\.includes\(/);
  });
});
