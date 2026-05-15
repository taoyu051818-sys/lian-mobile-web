import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedTypeSource = fs.readFileSync(path.join(repoRoot, "src/types/feed.ts"), "utf8");
const feedApiSource = fs.readFileSync(path.join(repoRoot, "src/api/feed.ts"), "utf8");
const feedItemCardSource = fs.readFileSync(path.join(repoRoot, "src/views/feed/FeedItemCard.vue"), "utf8");

test("Feed presentationIntent: types the normalized card template fields", () => {
  assert.match(feedTypeSource, /export type FeedPresentationIntent = "image" \| "text" \| "activity" \| "place" \| "merchant" \| "help";/);
  assert.match(feedTypeSource, /export type FeedItemCardTemplateSource = "server" \| "content-type" \| "cover-fallback";/);
  assert.match(feedTypeSource, /presentationIntent\?: FeedPresentationIntent \| string \| null;/);
  assert.match(feedTypeSource, /cardTemplate\?: FeedPresentationIntent \| null;/);
  assert.match(feedTypeSource, /cardTemplateSource\?: FeedItemCardTemplateSource;/);
});

test("Feed presentationIntent: normalizes card templates in the feed adapter before rendering", () => {
  assert.match(feedApiSource, /export function normalizeFeedCardTemplate\(/);
  assert.match(feedApiSource, /const normalizedServerTemplate = normalizeFeedPresentationIntent\(item\.cardTemplate\) \|\| normalizeFeedPresentationIntent\(item\.presentationIntent\);/);
  assert.match(feedApiSource, /cardTemplateSource: "content-type"/);
  assert.match(feedApiSource, /cardTemplate: item\.cover \? "image" : "text"/);
  assert.match(feedApiSource, /items: Array\.isArray\(data\.items\)/);
  assert.match(feedApiSource, /normalizeFeedItem\(item\)/);
});

test("Feed presentationIntent: keeps FeedItemCard on normalized template inputs and safe fallback rendering", () => {
  assert.match(feedItemCardSource, /function normalizePresentationIntent\(value: FeedItem\["cardTemplate"\] \| FeedItem\["presentationIntent"\]\): CardTemplate \| null/);
  assert.match(feedItemCardSource, /const normalizedCardTemplate = computed\(\(\) => normalizePresentationIntent\(props\.item\.cardTemplate\)\);/);
  assert.match(feedItemCardSource, /if \(normalizedCardTemplate\.value\) return normalizedCardTemplate\.value;/);
  assert.match(feedItemCardSource, /return coverUrl\.value \? "image" : "text";/);
  assert.doesNotMatch(feedItemCardSource, /const searchText = computed/);
  assert.doesNotMatch(feedItemCardSource, /raw\.includes\(/);
});
