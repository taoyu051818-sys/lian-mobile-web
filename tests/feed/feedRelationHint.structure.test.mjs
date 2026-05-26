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
const feedShellSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCardShell.vue"),
  "utf8",
);
const feedBrandSource = fs.readFileSync(path.join(repoRoot, "src/config/brand/feed.ts"), "utf8");

test("Feed relation hint: types the feed relation fields", () => {
  assert.match(
    feedTypeSource,
    /export type FeedRelationHint = "help_event_link" \| "trade_offer_link" \| "event_followup";/,
  );
  assert.match(feedTypeSource, /relationHint\?: FeedRelationHint;/);
  assert.match(feedTypeSource, /relations\?: FeedRelation\[];/);
});

test("Feed relation hint: adapter preserves explicit hint and derives fallback from relations", () => {
  assert.match(feedApiSource, /function normalizeFeedRelationHint\(value: unknown\): FeedItem\["relationHint"\]/);
  assert.match(feedApiSource, /function deriveFeedRelationHint\(/);
  assert.match(feedApiSource, /if \(relationHint\) return relationHint;/);
  assert.match(feedApiSource, /return normalizeFeedRelationHint\(relations\?\.\[0\]\?\.type\);/);
  assert.match(feedApiSource, /const relationHint = deriveFeedRelationHint\(/);
});

test("Feed relation hint: wrapper defines a single typed label map so brand copy cannot drift", () => {
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_HELP_EVENT = "已关联活动";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_TRADE_OFFER = "相关转让";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_EVENT_FOLLOWUP = "活动续报";/);
  const labelDecls = feedItemCardSource.match(/const RELATION_HINT_LABELS:/g) || [];
  assert.equal(labelDecls.length, 1, "FeedItemCard.vue must declare exactly one RELATION_HINT_LABELS map");
  assert.match(feedItemCardSource, /const RELATION_HINT_LABELS:/);
  assert.match(feedItemCardSource, /help_event_link: FEED_RELATION_HINT_HELP_EVENT/);
  assert.match(feedItemCardSource, /trade_offer_link: FEED_RELATION_HINT_TRADE_OFFER/);
  assert.match(feedItemCardSource, /event_followup: FEED_RELATION_HINT_EVENT_FOLLOWUP/);
  assert.match(feedItemCardSource, /const relationHint = item\.relationHint \? RELATION_HINT_LABELS\[item\.relationHint\] : "";/);
});

test("Feed relation hint: shell renders the hint above the title", () => {
  assert.match(feedShellSource, /relationHint: string;/);
  assert.match(feedShellSource, /<p v-if="relationHint" class="feed-item-card__relation-hint">\{\{ relationHint \}\}<\/p>/);
  assert.match(feedShellSource, /\.feed-item-card__relation-hint \{/);
});
