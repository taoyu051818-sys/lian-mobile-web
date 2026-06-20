import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const shellSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCardShell.vue"),
  "utf8",
);
const wrapperSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCard.vue"),
  "utf8",
);

// Step A of PRD_POST_CREATION_REVOLUTION_V0.2:
// FeedItemCardShell.vue is the pure-presentation skeleton that publish (step G) will
// mount without dragging feed domain types or pointer-interaction wiring along.
// These assertions exist so a future regression — e.g. someone adds an
// `import "...domain..."` to the shell, or accidentally imports the pointer
// composable to "centralize click handling" — fails loudly in CI rather than
// silently re-coupling the layers.

test("FeedItemCardShell does not import useCardPointerInteraction (pointer wiring stays in wrapper)", () => {
  // We assert on the import path, not on any mention of the symbol, because
  // explanatory comments in the shell may reference the composable to document why
  // the shell does *not* own pointer wiring. The ban is on the runtime dependency.
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*useCardPointerInteraction[^"']*["']/);
  assert.doesNotMatch(shellSource, /^\s*import[^\n;]*useCardPointerInteraction/m);
});

test("FeedItemCardShell does not import from domain/", () => {
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*\/domain\//);
});

test("FeedItemCardShell does not import from types/feed (no FeedItem domain dependency)", () => {
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*\/types\/feed/);
});

test("FeedItemCardShell does not import from composables/, app/, or api/ layers", () => {
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*\/composables\//);
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*\/app\//);
  assert.doesNotMatch(shellSource, /from\s+["'][^"']*\/api\//);
});

test("FeedItemCardShell only imports vue, config/brand, types/audience, and the two existing leaf SFCs", () => {
  const importRe = /import[^;]*from\s+["']([^"']+)["']/g;
  const allowed = new Set([
    "vue",
    "../../config/brand",
    "../../types/audience",
    "./FeedItemCardFooter.vue",
    "./FeedItemCardMedia.vue",
  ]);
  const seen = [];
  let m;
  while ((m = importRe.exec(shellSource)) !== null) {
    seen.push(m[1]);
    assert.ok(
      allowed.has(m[1]),
      `FeedItemCardShell.vue imports forbidden module "${m[1]}" — shell must stay leaf-only`,
    );
  }
  assert.ok(seen.length > 0, "expected FeedItemCardShell.vue to declare at least one import");
});

test("FeedItemCardShell exposes the display props enumerated in PRD step A", () => {
  // We grep the source for `defineProps<{ ... }>()`. The point is to lock in the
  // shape so publish (step G) can rely on the shell taking primitives, not FeedItem.
  const propsBlockMatch = shellSource.match(/defineProps<\{([\s\S]*?)\}>\(\)/);
  assert.ok(propsBlockMatch, "FeedItemCardShell.vue must declare defineProps<{...}>()");
  const propsBlock = propsBlockMatch[1];
  for (const propName of [
    "title",
    "coverUrl",
    "primaryTag",
    "timeLabel",
    "authorName",
    "authorAvatarUrl",
    "authorInitial",
    "cardTemplate",
    "templateMark",
    "relationHint",
    "graphCue",
    "intentSignal",
    "bodyPreview",
    "cardWarning",
  ]) {
    assert.match(
      propsBlock,
      new RegExp(`\\b${propName}\\??:`),
      `FeedItemCardShell.vue defineProps must declare \`${propName}\``,
    );
  }
});

test('FeedItemCardShell renders the focusable <article role="button"> root surface', () => {
  // The shell owns the focusable root. The wrapper attaches pointer/keyboard
  // listeners by attribute fallthrough onto this same <article>.
  assert.match(shellSource, /<article\b[\s\S]*role="button"[\s\S]*tabindex="0"/);
  assert.match(shellSource, /:aria-label="ariaLabel"/);
});

test("FeedItemCardShell owns text-card clamp/toggle UI and stops card navigation on toggle interactions", () => {
  // Expand/collapse stays inside the shell because publish also mounts this leaf.
  // The toggle must stop propagation so activating it does not trigger the wrapper's
  // card-open click/keyboard handlers.
  assert.match(
    shellSource,
    /import\s+\{[^}]*FEED_COLLAPSE[^}]*FEED_EXPAND[^}]*\}\s+from\s+["']\.\.\/\.\.\/config\/brand["']/,
  );
  assert.match(shellSource, /class="feed-item-card__body-preview"/);
  assert.match(shellSource, /'is-expanded':\s*bodyExpanded/);
  assert.match(shellSource, /class="feed-item-card__body-toggle"/);
  assert.match(shellSource, /@click\.stop="toggleBody"/);
  assert.match(shellSource, /@keydown\.enter\.stop/);
  assert.match(shellSource, /@keydown\.space\.stop/);
  assert.match(shellSource, /\{\{\s*bodyExpanded\s*\?\s*FEED_COLLAPSE\s*:\s*FEED_EXPAND\s*\}\}/);
  assert.match(shellSource, /-webkit-line-clamp:\s*4/);
});

test("FeedItemCardShell accepts trade/project/review as calm first-class shell templates", () => {
  assert.match(shellSource, /\| "trade"[\s\S]*\| "project"[\s\S]*\| "review"/);
  assert.match(shellSource, /feed-item-card--trade/);
  assert.match(shellSource, /feed-item-card--project/);
  assert.match(shellSource, /feed-item-card--review/);
});

test("FeedItemCardShell renders an optional non-interactive intent signal chip", () => {
  assert.match(shellSource, /intentSignal: \{ label: string; stateLabel\?: string \} \| null/);
  assert.match(shellSource, /v-if="intentSignal"/);
  assert.match(shellSource, /class="feed-item-card__intent-signal"/);
  assert.match(shellSource, /\{\{\s*intentSignal\.label\s*\}\}/);
  assert.match(shellSource, /v-if="intentSignal\.stateLabel"/);
  assert.match(shellSource, /\{\{\s*intentSignal\.stateLabel\s*\}\}/);
});
test("FeedItemCard wrapper still owns useCardPointerInteraction and the open emit", () => {
  // The wrapper is what translates raw DOM events into `emit("open", ...)` for
  // FeedView. Step A must not move that responsibility into the shell.
  assert.match(wrapperSource, /import\s+\{[^}]*useCardPointerInteraction[^}]*\}\s+from/);
  assert.match(wrapperSource, /emit\(\s*"open"/);
  assert.match(wrapperSource, /<FeedItemCardShell\b/);
});

test("FeedItemCard routes club items to FeedItemClubCard instead of the generic shell", () => {
  assert.match(
    wrapperSource,
    /import\s+FeedItemClubCard\s+from\s+["']\.\/FeedItemClubCard\.vue["']/,
  );
  assert.match(
    wrapperSource,
    /<FeedItemClubCard\b[\s\S]*v-if="cardDisplayData\.cardTemplate === 'club'"/,
  );
  assert.match(wrapperSource, /@open="handleClubOpen"/);
  assert.match(wrapperSource, /function handleClubOpen\(/);
  assert.match(wrapperSource, /<FeedItemCardShell\b[\s\S]*v-else/);
});
