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
const feedBrandSource = fs.readFileSync(path.join(repoRoot, "src/config/brand/feed.ts"), "utf8");

test("Feed presentationIntent: types the normalized card template fields", () => {
  assert.match(
    feedTypeSource,
    /export type FeedPresentationIntent =\s*\| "image"[\s\S]*\| "trade"[\s\S]*\| "project"[\s\S]*\| "review"[\s\S]*\| "help"[\s\S]*\| "club";/,
  );
  assert.match(
    feedTypeSource,
    /export type FeedItemShellCardTemplate =\s*\| "image"[\s\S]*\| "trade"[\s\S]*\| "project"[\s\S]*\| "review"[\s\S]*\| "help";/,
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
    /const normalizedServerTemplate = normalizeFeedPresentationTemplate\(item\.cardTemplate\);[\s\S]*const normalizedServerIntent = normalizeFeedPresentationIntent\(item\.presentationIntent\);/,
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
  assert.doesNotMatch(feedItemCardSource, /const INTENT_CARD_TEMPLATES/);
  assert.match(feedItemCardSource, /trade:\s*"二"/);
  assert.match(feedItemCardSource, /project:\s*"项"/);
  assert.match(feedItemCardSource, /review:\s*"评"/);
  assert.match(
    feedItemCardSource,
    /const shellCardTemplate = toShellCardTemplate\(cardTemplate\);/,
  );
  assert.match(
    feedItemCardSource,
    /<FeedItemClubCard\b[\s\S]*v-if="cardDisplayData\.cardTemplate === 'club'"[\s\S]*:item="props\.item"[\s\S]*@open="handleClubOpen"/,
  );
  assert.match(feedItemCardSource, /const INTENT_SIGNAL_LABELS: Readonly<Record<string, string>>/);
  assert.match(feedItemCardSource, /trade:\s*FEED_INTENT_SIGNAL_TRADE/);
  assert.match(feedItemCardSource, /project:\s*FEED_INTENT_SIGNAL_PROJECT/);
  assert.match(feedItemCardSource, /review:\s*FEED_INTENT_SIGNAL_REVIEW/);
  assert.match(feedBrandSource, /FEED_INTENT_SIGNAL_TRADE = "二手交易"/);
  assert.match(feedBrandSource, /FEED_INTENT_SIGNAL_PROJECT = "项目"/);
  assert.match(feedBrandSource, /FEED_INTENT_SIGNAL_REVIEW = "评价"/);
  assert.match(
    feedItemCardSource,
    /const INTENT_SIGNAL_TYPES: ReadonlySet<string> = new Set\(\["trade", "project", "review"\]\)/,
  );
  assert.match(feedItemCardSource, /function resolveIntentSignal\(/);
  assert.match(feedItemCardSource, /const explicitIntent =/);
  assert.match(feedItemCardSource, /const contentIntent =/);
  assert.match(
    feedItemCardSource,
    /const knownExplicitIntent = INTENT_SIGNAL_TYPES\.has\(explicitIntent\)/,
  );
  assert.match(
    feedItemCardSource,
    /const knownContentIntent = INTENT_SIGNAL_TYPES\.has\(contentIntent\)/,
  );
  assert.match(feedItemCardSource, /if \(knownExplicitIntent\)/);
  assert.match(feedItemCardSource, /function buildIntentSignal\(/);
  assert.match(feedItemCardSource, /label: INTENT_SIGNAL_LABELS\[intent\] \?\? intent/);
  assert.match(
    feedItemCardSource,
    /const stateLabel = intent === "trade" \? resolveTradeStateLabel\(components\) : undefined;/,
  );
  assert.match(
    feedItemCardSource,
    /if \(explicitIntent && !FEED_CARD_VARIANTS\.has\(explicitIntent as FeedCardVariant\)\)/,
  );
  assert.match(feedItemCardSource, /return \{ label: explicitIntent \}/);
  assert.match(feedItemCardSource, /if \(knownContentIntent\)/);
  assert.match(feedItemCardSource, /return buildIntentSignal\(contentIntent, item\.components\)/);
  assert.match(feedItemCardSource, /return null/);
  assert.doesNotMatch(
    feedItemCardSource,
    /explicitIntent \|\| \(\["trade", "project", "review"\]\.includes\(contentIntent\) \? contentIntent : ""\)/,
  );
  assert.match(feedItemCardSource, /label: INTENT_SIGNAL_LABELS\[[^\]]+\] \?\? [^,}\n]+/);
  assert.match(feedItemCardSource, /stateLabel \? \{ stateLabel \} : \{\}/);
  assert.match(feedItemCardSource, /intentSignal: resolveIntentSignal\(item\)/);
  assert.match(feedItemCardSource, /:intent-signal="cardDisplayData\.intentSignal"/);
  assert.doesNotMatch(
    feedItemCardSource,
    /authorUserId|settledBy|joinerIds|requesterUserId|runnerUserId/,
  );
});
