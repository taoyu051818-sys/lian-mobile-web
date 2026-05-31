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
  assert.match(feedTypeSource, /export interface FeedRelationHint \{/);
  assert.match(feedTypeSource, /type: string;/);
  assert.match(feedTypeSource, /targetTid\?: number;/);
  assert.match(feedTypeSource, /relationHint\?: FeedRelationHint;/);
  assert.match(feedTypeSource, /relations\?: FeedRelation\[];/);
});

test("Feed relation hint: adapter preserves explicit hint and derives fallback from relations", () => {
  assert.match(
    feedApiSource,
    /function normalizeFeedRelationHint\(value: unknown\): string \| undefined/,
  );
  assert.match(feedApiSource, /function deriveFeedRelationHint\(/);
  assert.match(feedApiSource, /if \(relationHint\) return \{ type: relationHint \};/);
  assert.match(feedApiSource, /function relationHintFromRelation\(/);
  assert.match(feedApiSource, /const knownRelation = relations/);
  assert.match(feedApiSource, /FEED_RELATION_HINTS\.has\(hint\.type\)/);
  assert.match(
    feedApiSource,
    /return relations\?\.map\(relationHintFromRelation\)\.find\(Boolean\);/,
  );
  assert.match(feedApiSource, /const relationHint = deriveFeedRelationHint\(/);
});

test("Feed relation hint: wrapper defines a single typed label map so brand copy cannot drift", () => {
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_HELP_EVENT = "已关联活动";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_TRADE_OFFER = "相关转让";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_EVENT_FOLLOWUP = "活动续报";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_SOLUTION_EVENT = "求助有进展";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_MERCHANT_ERRAND = "商家相关";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_PROJECT_SUBMISSION = "项目投稿";/);
  assert.match(feedBrandSource, /export const FEED_RELATION_HINT_EVENT_REWARD = "活动奖励";/);
  const labelDecls = feedItemCardSource.match(/const RELATION_HINT_LABELS:/g) || [];
  assert.equal(
    labelDecls.length,
    1,
    "FeedItemCard.vue must declare exactly one RELATION_HINT_LABELS map",
  );
  assert.match(feedItemCardSource, /const RELATION_HINT_LABELS:/);
  assert.match(feedItemCardSource, /help_event_link: FEED_RELATION_HINT_HELP_EVENT/);
  assert.match(feedItemCardSource, /trade_offer_link: FEED_RELATION_HINT_TRADE_OFFER/);
  assert.match(feedItemCardSource, /event_followup: FEED_RELATION_HINT_EVENT_FOLLOWUP/);
  assert.match(feedItemCardSource, /solution_event: FEED_RELATION_HINT_SOLUTION_EVENT/);
  assert.match(feedItemCardSource, /merchant_errand: FEED_RELATION_HINT_MERCHANT_ERRAND/);
  assert.match(feedItemCardSource, /project_submission: FEED_RELATION_HINT_PROJECT_SUBMISSION/);
  assert.match(feedItemCardSource, /event_reward: FEED_RELATION_HINT_EVENT_REWARD/);
  assert.match(
    feedItemCardSource,
    /const relationHint = item\.relationHint\s+\? \{\s+label: RELATION_HINT_LABELS\[item\.relationHint\.type\] \?\? item\.relationHint\.type,\s+targetTid: item\.relationHint\.targetTid,\s+\}\s+: null;/,
  );
});

test("Feed relation hint: shell renders a lightweight chip above the title", () => {
  assert.match(feedShellSource, /relationHint: \{ label: string; targetTid\?: number \} \| null;/);
  assert.match(feedShellSource, /const emit = defineEmits<\{/);
  assert.match(feedShellSource, /openRelation: \[targetTid: number\];/);
  assert.match(feedShellSource, /function openRelationHint\(\)/);
  assert.match(feedShellSource, /emit\("openRelation", props\.relationHint\.targetTid\);/);
  assert.match(
    feedShellSource,
    /<button\s+v-if="relationHint"\s+class="feed-item-card__relation-hint"\s+type="button"\s+:disabled="!relationHint\.targetTid"\s+@click\.stop="openRelationHint"\s+@keydown\.enter\.stop\s+@keydown\.space\.stop\s+>\s+\{\{ relationHint\.label \}\}\s+<\/button>/,
  );
  assert.match(feedShellSource, /\.feed-item-card__relation-hint \{/);
  assert.match(feedShellSource, /display: inline-flex;/);
  assert.match(feedShellSource, /justify-self: start;/);
  assert.match(feedShellSource, /border-radius: var\(--radius-pill\);/);
  assert.match(feedShellSource, /\.feed-item-card__relation-hint:disabled \{/);
});
