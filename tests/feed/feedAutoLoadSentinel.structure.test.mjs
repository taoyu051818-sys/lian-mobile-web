import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedViewSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedView.vue"),
  "utf8",
);
const feedLoadMoreSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedLoadMore.vue"),
  "utf8",
);
const feedListSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedList.vue"),
  "utf8",
);
const sentinelComponentSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedAutoLoadSentinel.vue"),
  "utf8",
);
const sentinelComposableSource = fs.readFileSync(
  path.join(repoRoot, "src/composables/useAutoLoadSentinel.ts"),
  "utf8",
);

test("FeedView owns the feed-filter chrome slot while detail is closed", () => {
  assert.match(feedViewSource, /PageChromeSpec/);
  assert.match(feedViewSource, /const pageChrome = computed<PageChromeSpec>/);
  assert.match(feedViewSource, /top:\s*detail\.detailOpen\.value/);
  assert.match(feedViewSource, /tabs:\s*null/);
  assert.match(feedViewSource, /slot:\s*"feed-filter"/);
  assert.match(feedViewSource, /chrome\.setSlot\("top",\s*"feed-filter"\)/);
  assert.match(
    feedViewSource,
    /<Teleport\s+v-if="filterBarMounted"\s+defer\s+to="#lian-shell-top-slot">/,
  );
  assert.match(feedViewSource, /<FeedFilterBar/);
  assert.match(feedViewSource, /:tabs="feedData\.tabs\.value"/);
  assert.match(feedViewSource, /:active-tab-id="feedData\.activeTab\.value"/);
  assert.match(feedViewSource, /@update:active-tab-id="handleTabChange"/);
});

test("FeedView delegates content list to FeedList and FeedLoadMore", () => {
  assert.match(feedViewSource, /import\s+FeedList\s+from\s+"\.\/FeedList\.vue"/);
  assert.match(feedViewSource, /import\s+FeedLoadMore\s+from\s+"\.\/FeedLoadMore\.vue"/);
  assert.match(feedViewSource, /<FeedList/);
  assert.match(feedViewSource, /:items="feedData\.items\.value"/);
  assert.match(feedViewSource, /@open="openItem"/);
  assert.match(feedViewSource, /<FeedLoadMore/);
  assert.match(feedViewSource, /:has-more="feedData\.hasMore\.value"/);
  assert.match(feedViewSource, /:loading-more="feedData\.loadingMore\.value"/);
  assert.match(feedViewSource, /:can-auto-load-more="feedData\.canAutoLoadMore\.value"/);
  assert.match(feedViewSource, /@load-more="feedData\.triggerLoadMore"/);
});

test("FeedLoadMore wires the auto-load sentinel and emits loadMore", () => {
  assert.match(
    feedLoadMoreSource,
    /import FeedAutoLoadSentinel from "\.\/FeedAutoLoadSentinel\.vue";/,
  );
  assert.match(feedLoadMoreSource, /import \{ LianButton \} from "\.\.\/\.\.\/ui";/);
  assert.match(feedLoadMoreSource, /const emit = defineEmits/);
  assert.match(feedLoadMoreSource, /loadMore/);
  assert.match(feedLoadMoreSource, /:enabled="canAutoLoadMore"/);
  assert.match(feedLoadMoreSource, /@intersect="emit\('loadMore'\)"/);
  assert.match(feedLoadMoreSource, /:loading="loadingMore"/);
});

test("FeedList renders FeedItemCard in a masonry layout", () => {
  assert.match(feedListSource, /import FeedItemCard from "\.\/FeedItemCard\.vue";/);
  assert.match(feedListSource, /splitIntoMasonryColumns/);
  assert.match(feedListSource, /estimateCardWeight/);
  assert.match(feedListSource, /v-for="item in column"/);
  assert.match(feedListSource, /@open/);
});

test("FeedAutoLoadSentinel component wraps the composable", () => {
  assert.match(
    sentinelComponentSource,
    /import\s*\{\s*useAutoLoadSentinel\s*\}\s*from\s*"\.\.\/\.\.\/composables\/useAutoLoadSentinel"/,
  );
  assert.match(sentinelComponentSource, /const targetRef = ref<HTMLElement \| null>\(null\);/);
  assert.match(sentinelComponentSource, /useAutoLoadSentinel\(\s*targetRef,/);
  assert.match(sentinelComponentSource, /emit\("intersect"\);/);
  assert.match(sentinelComponentSource, /enabled:\s*\(\)\s*=>\s*props\.enabled/);
  assert.match(sentinelComponentSource, /cooldownMs:\s*props\.cooldownMs/);
  assert.match(sentinelComponentSource, /ref="targetRef"/);
});

test("the shared sentinel composable keeps observer setup and cleanup explicit", () => {
  assert.match(sentinelComposableSource, /let observer: IntersectionObserver \| null = null;/);
  assert.match(sentinelComposableSource, /function disconnect\(\) \{/);
  assert.match(sentinelComposableSource, /observer\?\.disconnect\(\);/);
  assert.match(
    sentinelComposableSource,
    /function observeTarget\(target: HTMLElement \| null\) \{/,
  );
  assert.match(
    sentinelComposableSource,
    /if \(!target \|\| typeof IntersectionObserver === "undefined"\) return;/,
  );
  assert.match(sentinelComposableSource, /observer = new IntersectionObserver/);
  assert.match(sentinelComposableSource, /observer\.observe\(target\);/);
  assert.match(sentinelComposableSource, /stopWatchingTarget\s*=\s*watch\(\s*targetRef,/);
  assert.match(sentinelComposableSource, /onBeforeUnmount\(\(\) => \{/);
  assert.match(sentinelComposableSource, /stopWatchingTarget\?\.\(\);/);
  assert.match(sentinelComposableSource, /disconnect\(\);/);
});
