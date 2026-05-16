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

test("FeedView delegates top tabs to shell chrome via declarative pageChrome spec", () => {
  assert.match(feedViewSource, /PageChromeSpec/);
  assert.match(feedViewSource, /const pageChrome = computed<PageChromeSpec>/);
  assert.match(feedViewSource, /kind:\s*"tabs"/);
  assert.match(feedViewSource, /items:\s*tabs\.value/);
  assert.match(feedViewSource, /activeKey:\s*activeTab\.value/);
  assert.match(feedViewSource, /onTabSelect:\s*switchTab/);
  assert.doesNotMatch(feedViewSource, /useShellChrome/);
});

test("FeedView delegates content list to FeedList and FeedLoadMore", () => {
  assert.match(feedViewSource, /import FeedList from "\.\/feed\/FeedList\.vue";/);
  assert.match(feedViewSource, /import FeedLoadMore from "\.\/feed\/FeedLoadMore\.vue";/);
  assert.match(feedViewSource, /function triggerLoadMore\(\) \{/);
  assert.match(feedViewSource, /if \(!canAutoLoadMore\.value\) return;/);
  assert.match(feedViewSource, /void loadFeed\(false\);/);
  assert.match(feedViewSource, /<FeedList .*:items="items"/);
  assert.match(feedViewSource, /@open="openItem"/);
  assert.match(feedViewSource, /<FeedLoadMore/);
  assert.match(feedViewSource, /:has-more="hasMore"/);
  assert.match(feedViewSource, /:loading-more="loadingMore"/);
  assert.match(feedViewSource, /:can-auto-load-more="canAutoLoadMore"/);
  assert.match(feedViewSource, /@load-more="triggerLoadMore"/);
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
    /import \{ useAutoLoadSentinel \} from "\.\.\/\.\.\/composables\/useAutoLoadSentinel";/,
  );
  assert.match(sentinelComponentSource, /const targetRef = ref<HTMLElement \| null>\(null\);/);
  assert.match(sentinelComponentSource, /useAutoLoadSentinel\(targetRef/);
  assert.match(sentinelComponentSource, /emit\("intersect"\);/);
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
  assert.match(sentinelComposableSource, /stopWatchingTarget = watch\(targetRef,/);
  assert.match(sentinelComposableSource, /onBeforeUnmount\(\(\) => \{/);
  assert.match(sentinelComposableSource, /stopWatchingTarget\?\.\(\);/);
  assert.match(sentinelComposableSource, /disconnect\(\);/);
});
