import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedTypeSource = fs.readFileSync(path.join(repoRoot, "src/types/feed.ts"), "utf8");
const feedApiSource = fs.readFileSync(path.join(repoRoot, "src/api/feed.ts"), "utf8");
const feedItemCardSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCard.vue"),
  "utf8",
);

test("Feed presentationIntent: types the normalized card template fields", () => {
  assert.match(
    feedTypeSource,
    /export type FeedPresentationIntent =\s*\| "image"[\s\S]*\| "help"[\s\S]*\| "club";/,
  );
  assert.match(
    feedTypeSource,
    /export type FeedItemShellCardTemplate =\s*\| "image"[\s\S]*\| "help";/,
  );
  assert.match(
    feedTypeSource,
    /export type FeedItemCardTemplateSource = "server" \| "content-type" \| "cover-fallback";/,
  );
  assert.match(feedTypeSource, /presentationIntent\?: FeedPresentationIntent \| string \| null;/);
  assert.match(feedTypeSource, /cardTemplate\?: FeedPresentationIntent \| null;/);
  assert.match(feedTypeSource, /cardTemplateSource\?: FeedItemCardTemplateSource;/);
});

test("Feed presentationIntent: normalizes card templates in the feed adapter before rendering", () => {
  assert.match(feedApiSource, /export function normalizeFeedCardTemplate\(/);
  assert.match(
    feedApiSource,
    /const normalizedServerTemplate =[\s\S]*normalizeFeedPresentationIntent\(item\.cardTemplate\)[\s\S]*\|\|[\s\S]*normalizeFeedPresentationIntent\(item\.presentationIntent\);/,
  );
  assert.match(feedApiSource, /cardTemplateSource: "content-type"/);
  assert.match(feedApiSource, /cardTemplate: item\.cover \? "image" : "text"/);
  assert.match(feedApiSource, /items: Array\.isArray\(data\.items\)/);
  assert.match(feedApiSource, /normalizeFeedItem\(item\)/);
});

test("Feed presentationIntent: keeps FeedItemCard on normalized template inputs and club fallback seam", () => {
  assert.match(
    feedItemCardSource,
    /function normalizePresentationIntent\(\s*value: FeedItem\["cardTemplate"\] \| FeedItem\["presentationIntent"\],\s*\): FeedCardVariant \| null/,
  );
  assert.match(
    feedItemCardSource,
    /const FEED_CARD_VARIANTS: ReadonlySet<FeedCardVariant> = new Set\(\[/,
  );
  assert.match(feedItemCardSource, /"club",/);
  assert.match(
    feedItemCardSource,
    /const shellCardTemplate: CardTemplate = cardTemplate === "club" \? "text" : cardTemplate;/,
  );
  assert.match(
    feedItemCardSource,
    /<FeedItemClubCard v-if="cardDisplayData\.cardTemplate === 'club'" :item="props\.item" \/>/,
  );
  assert.doesNotMatch(feedItemCardSource, /const searchText = computed/);
  assert.doesNotMatch(feedItemCardSource, /raw\.includes\(/);
});
