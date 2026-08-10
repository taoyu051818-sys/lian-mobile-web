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
const contextActionsSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/useFeedCardContextActions.ts"),
  "utf8",
);
const wrapperTemplateMatch = wrapperSource.match(/<template>([\s\S]*?)<\/template>/);
assert.ok(wrapperTemplateMatch, "FeedItemCard must have one template block");
const wrapperTemplateSource = wrapperTemplateMatch[1];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function functionBody(source, name) {
  const signature = new RegExp(`function\\s+${escapeRegExp(name)}\\s*\\(`);
  const signatureMatch = signature.exec(source);
  assert.ok(signatureMatch, `expected function ${name}`);
  const parametersStart = source.indexOf("(", signatureMatch.index);
  let parenthesisDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parenthesisDepth += 1;
    if (source[index] === ")") parenthesisDepth -= 1;
    if (parenthesisDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `expected ${name} parameter list`);
  const bodyStart = source.indexOf("{", parametersEnd + 1);
  assert.notEqual(bodyStart, -1, `expected ${name} function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  assert.fail(`unterminated ${name} function body`);
}

function interfaceBody(source, name) {
  const signature = new RegExp(
    `export\\s+interface\\s+${escapeRegExp(name)}(?:\\s+extends[^\\{]+)?\\s*\\{`,
  );
  const signatureMatch = signature.exec(source);
  assert.ok(signatureMatch, `expected exported interface ${name}`);
  const bodyStart = source.indexOf("{", signatureMatch.index);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  assert.fail(`unterminated interface ${name}`);
}

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

test("FeedItemCard wires its real item owner and open transition into context actions", () => {
  assert.match(wrapperSource, /import\s+\{[^}]*\btoRef\b[^}]*\}\s+from\s+["']vue["']/);
  assert.match(
    wrapperSource,
    /import\s+\{[^}]*useFeedCardContextActions[^}]*\}\s+from\s+["']\.\/useFeedCardContextActions["']/,
  );
  const actionOwnerCall = wrapperSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*useFeedCardContextActions\(\{([\s\S]*?)\}\);/,
  );
  assert.ok(actionOwnerCall, "FeedItemCard must retain one production context-action owner");
  const [, actionOwnerName, actionOptions] = actionOwnerCall;
  const escapedOwner = escapeRegExp(actionOwnerName);

  const itemRefDeclaration = wrapperSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*toRef\(props,\s*["']item["']\);/,
  );
  const hasInlineItemRef = /item:\s*toRef\(props,\s*["']item["']\)/.test(actionOptions);
  const hasNamedItemRef = Boolean(
    itemRefDeclaration &&
    new RegExp(`item:\\s*${escapeRegExp(itemRefDeclaration[1])}\\b`).test(actionOptions),
  );
  assert.ok(hasInlineItemRef || hasNamedItemRef, "action owner must receive toRef(props, 'item')");
  assert.match(actionOptions, /title:\s*\(\)\s*=>\s*cardDisplayData\.value\.title/);
  assert.match(actionOptions, /\bemitOpen(?:\s*:\s*emitOpen)?[,\n]/);

  const emitOpenSignature = wrapperSource.match(
    /function\s+emitOpen\s*\(\s*([A-Za-z_$][\w$]*)\s*:[^,]+,\s*([A-Za-z_$][\w$]*)\s*\??\s*:/,
  );
  assert.ok(emitOpenSignature, "emitOpen must accept the captured item id and open payload");
  const [, emitOpenIdParameter, emitOpenPayloadParameter] = emitOpenSignature;
  const emitOpenBody = functionBody(wrapperSource, "emitOpen");
  assert.match(
    emitOpenBody,
    new RegExp(
      `emit\\(\\s*["']open["']\\s*,\\s*${escapeRegExp(emitOpenIdParameter)}\\s*,\\s*${escapeRegExp(emitOpenPayloadParameter)}\\s*\\)`,
    ),
  );

  const pointerCall = wrapperSource.match(
    /useCardPointerInteraction\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*?)\}\s*\)/,
  );
  assert.ok(
    pointerCall,
    "pointer interaction must receive an explicit second-argument owner contract",
  );
  const [, pointerOpenName, pointerOptions] = pointerCall;
  assert.match(pointerOptions, /ownerToken:\s*\(\)\s*=>\s*props\.item/);
  assert.match(pointerOptions, new RegExp(`openContextMenu:\\s*${escapedOwner}\\.openMenu\\b`));
  if (pointerOpenName !== "emitOpen") {
    assert.match(
      functionBody(wrapperSource, pointerOpenName),
      /\bemitOpen\s*\(/,
      "the pointer's first callback must reach the production emitOpen transition",
    );
  }
});

test("FeedItemCard relies on the context-action production defaults", () => {
  const actionOwnerCall = wrapperSource.match(
    /const\s+[A-Za-z_$][\w$]*\s*=\s*useFeedCardContextActions\(\{([\s\S]*?)\}\);/,
  );
  assert.ok(actionOwnerCall, "FeedItemCard must retain one production context-action owner");
  const actionOptions = actionOwnerCall[1];

  assert.doesNotMatch(
    actionOptions,
    /\b(?:settlements|dependencies)\b/,
    "the production card must use the action composable's default settlement port and dependencies",
  );

  const imports = [...wrapperSource.matchAll(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g)];
  for (const [, bindings, modulePath] of imports) {
    assert.doesNotMatch(
      modulePath,
      /(?:^|\/)reactions(?:\/|$)|postReactionSettlements/,
      "FeedItemCard must not construct or import the reaction settlement channel",
    );
    assert.doesNotMatch(
      bindings,
      /\b(?:postReactionSettlements|createPostReactionSettlementChannel|PostReactionSettlementPort)\b/,
      "FeedItemCard must not wire settlement channel symbols into its action owner",
    );
  }
});

test("context actions expose and resolve the production settlement port", () => {
  const optionsBody = interfaceBody(contextActionsSource, "UseFeedCardContextActionsOptions");
  assert.match(
    optionsBody,
    /\bsettlements\?\s*:\s*PostReactionSettlementPort\s*;/,
    "the public options type must expose an optional typed settlement port",
  );

  const reactionImportBindings = [
    ...contextActionsSource.matchAll(
      /^\s*import\s+([^;]+?)\s+from\s+["']\.\.\/reactions["']\s*;/gm,
    ),
  ].map((match) => match[1]);
  assert.ok(
    reactionImportBindings.length > 0,
    "context actions must import the production reactions port",
  );

  const reactionNamedImports = reactionImportBindings.flatMap((bindings) => {
    const namedBlock = bindings.match(/\{([\s\S]*?)\}/);
    if (!namedBlock) return [];
    const statementIsTypeOnly = /^\s*type\b/.test(bindings);
    return namedBlock[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({ entry, statementIsTypeOnly }));
  });
  assert.ok(
    reactionNamedImports.some(
      ({ entry, statementIsTypeOnly }) =>
        (statementIsTypeOnly && entry === "PostReactionSettlementPort") ||
        (!statementIsTypeOnly && entry === "type PostReactionSettlementPort"),
    ),
    "PostReactionSettlementPort must be a named type import from ../reactions",
  );

  const singletonImport = reactionNamedImports
    .filter(({ statementIsTypeOnly }) => !statementIsTypeOnly)
    .map(({ entry }) => entry.match(/^postReactionSettlements(?:\s+as\s+([A-Za-z_$][\w$]*))?$/))
    .find(Boolean);
  assert.ok(singletonImport, "the named production singleton must come from ../reactions");
  const singletonLocalName = singletonImport[1] ?? "postReactionSettlements";
  assert.match(
    contextActionsSource,
    new RegExp(`options\\.settlements\\s*\\?\\?\\s*${escapeRegExp(singletonLocalName)}\\b`),
    "an injected port must take precedence over the named production singleton",
  );
});

test("FeedItemCard connects menu actions and per-action presentation state to the production owner", () => {
  const actionOwnerMatch = wrapperSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*useFeedCardContextActions\(/,
  );
  assert.ok(actionOwnerMatch, "FeedItemCard must retain its context-action owner");
  const escapedOwner = escapeRegExp(actionOwnerMatch[1]);
  const menuTags = wrapperTemplateSource.match(/<FeedContextMenu\b[\s\S]*?\/>/g) ?? [];
  assert.equal(menuTags.length, 1, "FeedItemCard must render one context-menu tag");
  const menuTag = menuTags[0];

  for (const [attribute, member] of [
    [":visible", "visible"],
    [":x", "x"],
    [":y", "y"],
    [":bookmarked", "bookmarked"],
    [":bookmark-busy", "bookmarkBusy"],
    [":share-busy", "shareBusy"],
    [":request-pending", "requestPending"],
  ]) {
    assert.match(
      menuTag,
      new RegExp(`${escapeRegExp(attribute)}=["']${escapedOwner}\\.${member}\\.value["']`),
    );
  }
  for (const [event, member] of [
    ["share", "handleShare"],
    ["bookmark", "handleBookmark"],
    ["report", "handleReport"],
    ["close", "closeMenu"],
  ]) {
    assert.match(menuTag, new RegExp(`@${event}=["']${escapedOwner}\\.${member}["']`));
  }
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
