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
const footerSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCardFooter.vue"),
  "utf8",
);
const listSource = fs.readFileSync(path.join(repoRoot, "src/features/feed/FeedList.vue"), "utf8");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/feed/FeedView.vue"), "utf8");
let cardLikeSource = "";
try {
  cardLikeSource = fs.readFileSync(
    path.join(repoRoot, "src/features/feed/useFeedCardLike.ts"),
    "utf8",
  );
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}
const wrapperTemplateMatch = wrapperSource.match(/<template>([\s\S]*?)<\/template>/);
assert.ok(wrapperTemplateMatch, "FeedItemCard must have one template block");
const wrapperTemplateSource = wrapperTemplateMatch[1];
const footerScriptMatch = footerSource.match(
  /<script\s+setup(?:\s+lang=["']ts["'])?>([\s\S]*?)<\/script>/,
);
assert.ok(footerScriptMatch, "FeedItemCardFooter must have one script-setup block");
const footerScriptSource = footerScriptMatch[1];
const footerTemplateMatch = footerSource.match(/<template>([\s\S]*?)<\/template>/);
assert.ok(footerTemplateMatch, "FeedItemCardFooter must have one template block");
const footerTemplateSource = footerTemplateMatch[1];

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

function importStatements(source) {
  return [...source.matchAll(/^\s*import\s+([^;]+?)\s+from\s+["']([^"']+)["']\s*;/gm)].map(
    (match) => ({ bindings: match[1], modulePath: match[2] }),
  );
}

function namedImportsFrom(source, modulePath) {
  return importStatements(source)
    .filter((statement) => statement.modulePath === modulePath)
    .flatMap(({ bindings }) => {
      const namedBlock = bindings.match(/\{([^}]*)\}/);
      if (!namedBlock) return [];
      const statementIsTypeOnly = /^\s*type\b/.test(bindings);
      return namedBlock[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const inlineTypeOnly = /^type\s+/.test(entry);
          const specifier = entry.replace(/^type\s+/, "");
          const parts = specifier.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
          assert.ok(parts, `unsupported named import specifier: ${entry}`);
          return {
            imported: parts[1],
            local: parts[2] ?? parts[1],
            typeOnly: statementIsTypeOnly || inlineTypeOnly,
          };
        });
    });
}

function assertNoFeedbackDependencies(source, ownerLabel) {
  for (const { bindings, modulePath } of importStatements(source)) {
    assert.doesNotMatch(
      modulePath,
      /(?:feedback|haptic|toast)/i,
      `${ownerLabel} must not import a feedback module`,
    );
    assert.doesNotMatch(
      bindings,
      /\b(?:useToast|haptic[A-Za-z_$]*|[A-Za-z_$]*(?:Toast|Feedback)|showMessage|showError)\b/i,
      `${ownerLabel} must not import feedback through a barrel or alias`,
    );
  }
  assert.doesNotMatch(
    source,
    /import\s*\([^)]*(?:feedback|haptic|toast)[^)]*\)/i,
    `${ownerLabel} must not dynamically import feedback`,
  );
  assert.doesNotMatch(
    source,
    /\b(?:navigator\.vibrate|window\.alert|alert)\s*\(/,
    `${ownerLabel} must not create an alternate imperative feedback path`,
  );
}

function callArguments(source, callee) {
  const calls = [];
  const signature = new RegExp(`\\b${escapeRegExp(callee)}\\s*\\(`, "g");
  let signatureMatch;
  while ((signatureMatch = signature.exec(source)) !== null) {
    const argumentsStart = source.indexOf("(", signatureMatch.index);
    let depth = 0;
    for (let index = argumentsStart; index < source.length; index += 1) {
      if (source[index] === "(") depth += 1;
      if (source[index] === ")") depth -= 1;
      if (depth === 0) {
        calls.push(source.slice(argumentsStart + 1, index));
        signature.lastIndex = index + 1;
        break;
      }
    }
  }
  return calls;
}

function firstObjectArgument(source, callee) {
  const call = callArguments(source, callee)[0];
  assert.ok(call, `expected a call to ${callee}`);
  const objectStart = call.indexOf("{");
  assert.notEqual(objectStart, -1, `expected ${callee} to receive an options object`);
  let depth = 0;
  for (let index = objectStart; index < call.length; index += 1) {
    if (call[index] === "{") depth += 1;
    if (call[index] === "}") depth -= 1;
    if (depth === 0) return call.slice(objectStart + 1, index);
  }
  assert.fail(`unterminated options object passed to ${callee}`);
}

function destructuredLocals(binding) {
  if (!binding.startsWith("{")) return null;
  return new Map(
    binding
      .slice(1, -1)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
        assert.ok(parts, `unsupported composable result binding: ${entry}`);
        return [parts[1], parts[2] ?? parts[1]];
      }),
  );
}

function resultExpression(source, callee, member) {
  const assignment = source.match(
    new RegExp(`const\\s+(\\{[^}]+\\}|[A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(callee)}\\s*\\(`),
  );
  assert.ok(assignment, `expected ${callee} result to have one production owner`);
  const directLocals = destructuredLocals(assignment[1]);
  if (directLocals) {
    assert.ok(directLocals.has(member), `expected ${callee} result to expose ${member}`);
    return directLocals.get(member);
  }

  const owner = assignment[1];
  const laterDestructure = source.match(
    new RegExp(`const\\s+(\\{[^}]+\\})\\s*=\\s*${escapeRegExp(owner)}\\s*;`),
  );
  if (laterDestructure) {
    const laterLocals = destructuredLocals(laterDestructure[1]);
    assert.ok(laterLocals.has(member), `expected ${callee} result to expose ${member}`);
    return laterLocals.get(member);
  }
  return `${owner}.${member}.value`;
}

function elementBlockWithAttribute(source, tagName, attribute) {
  const markerIndex = source.search(attribute);
  assert.notEqual(markerIndex, -1, `expected ${tagName} marker ${attribute}`);
  const blockStart = source.lastIndexOf(`<${tagName}`, markerIndex);
  assert.notEqual(blockStart, -1, `expected opening ${tagName} for ${attribute}`);
  const blockEnd = source.indexOf(`</${tagName}>`, markerIndex);
  assert.notEqual(blockEnd, -1, `expected closing ${tagName} for ${attribute}`);
  return source.slice(blockStart, blockEnd + tagName.length + 3);
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

test("useFeedCardLike exposes typed options and resolves the exact production defaults", () => {
  assert.notEqual(
    cardLikeSource,
    "",
    "F3h must add the production useFeedCardLike composable before this gate can pass",
  );
  assertNoFeedbackDependencies(cardLikeSource, "useFeedCardLike");

  const dependenciesBody = interfaceBody(cardLikeSource, "FeedCardLikeDependencies");
  const optionsBody = interfaceBody(cardLikeSource, "UseFeedCardLikeOptions");
  const reactionImports = namedImportsFrom(cardLikeSource, "../reactions");
  const portImport = reactionImports.find(
    ({ imported, typeOnly }) => imported === "PostReactionSettlementPort" && typeOnly,
  );
  assert.ok(portImport, "PostReactionSettlementPort must be a type import from ../reactions");
  const singletonImport = reactionImports.find(
    ({ imported, typeOnly }) => imported === "postReactionSettlements" && !typeOnly,
  );
  assert.ok(singletonImport, "the named production singleton must be imported from ../reactions");

  const apiImports = namedImportsFrom(cardLikeSource, "../../api/posts");
  const toggleImport = apiImports.find(
    ({ imported, typeOnly }) => imported === "togglePostLike" && !typeOnly,
  );
  assert.ok(toggleImport, "togglePostLike must be a value import from ../../api/posts");
  const functionSignature = cardLikeSource.match(
    /export\s+function\s+useFeedCardLike\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*UseFeedCardLikeOptions\s*\)/,
  );
  assert.ok(functionSignature, "useFeedCardLike must expose the public options interface");
  const optionsLocal = functionSignature[1];

  for (const optionName of ["tid", "liked", "likeCount"]) {
    const option = optionsBody.match(new RegExp(`\\b${optionName}\\s*:\\s*([^;]+)\\s*;`));
    assert.ok(option, `UseFeedCardLikeOptions must declare ${optionName}`);
    assert.doesNotMatch(option[1], /\b(?:any|unknown)\b/, `${optionName} must stay typed`);
    assert.match(
      option[1],
      /(?:\bReadonly\s*<[^;]*\bRef\s*<|\b(?:ComputedRef|ReadonlyRef)\s*<)/,
      `${optionName} must be a readonly Vue ref surface`,
    );
  }
  assert.match(
    optionsBody,
    new RegExp(`\\bsettlements\\?\\s*:\\s*${escapeRegExp(portImport.local)}\\s*;`),
    "the public options must expose the imported typed settlement port",
  );
  assert.match(
    optionsBody,
    /\bdependencies\?\s*:\s*FeedCardLikeDependencies\s*;/,
    "dependencies must remain an independent optional option",
  );
  assert.match(
    dependenciesBody,
    new RegExp(`\\btoggleLike\\?\\s*:\\s*typeof\\s+${escapeRegExp(toggleImport.local)}\\s*;`),
    "the dependency seam must preserve the production API function type",
  );
  assert.match(
    cardLikeSource,
    new RegExp(
      `${escapeRegExp(optionsLocal)}\\.settlements\\s*\\?\\?\\s*${escapeRegExp(singletonImport.local)}\\s*;`,
    ),
    "the injected port must fall back directly to the named production singleton",
  );
  assert.match(
    cardLikeSource,
    new RegExp(
      `${escapeRegExp(optionsLocal)}\\.dependencies\\?\\.toggleLike\\s*\\?\\?\\s*${escapeRegExp(toggleImport.local)}\\s*;`,
    ),
    "the injected transport must fall back directly to the production API",
  );
  assert.doesNotMatch(cardLikeSource, /\bcreatePostReactionSettlementChannel\b/);
  assert.doesNotMatch(cardLikeSource, /\b(?:process\.env|import\.meta\.env|NODE_ENV)\b/);
});

test("FeedItemCardFooter wires real prop refs and every Like button binding to one owner", () => {
  const likeImports = namedImportsFrom(footerScriptSource, "./useFeedCardLike");
  const composableImport = likeImports.find(
    ({ imported, typeOnly }) => imported === "useFeedCardLike" && !typeOnly,
  );
  assert.ok(composableImport, "Footer must import the production useFeedCardLike composable");
  const vueImports = namedImportsFrom(footerScriptSource, "vue");
  const toRefImport = vueImports.find(
    ({ imported, typeOnly }) => imported === "toRef" && !typeOnly,
  );
  assert.ok(toRefImport, "Footer must derive the composable inputs with Vue toRef");
  const propsDeclaration = footerScriptSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*defineProps\b/,
  );
  assert.ok(propsDeclaration, "Footer must retain one typed props owner");
  const propsLocal = propsDeclaration[1];

  const optionsBody = firstObjectArgument(footerScriptSource, composableImport.local);
  assert.doesNotMatch(
    optionsBody,
    /\b(?:settlements|dependencies)\b/,
    "the production Footer must rely on the composable defaults",
  );

  for (const propName of ["tid", "liked", "likeCount"]) {
    const propAccess = `${escapeRegExp(propsLocal)}\\.${propName}`;
    const derivation = `(?:${escapeRegExp(toRefImport.local)}\\(\\s*${escapeRegExp(propsLocal)}\\s*,\\s*["']${propName}["']\\s*\\)|${escapeRegExp(toRefImport.local)}\\(\\s*\\(\\)\\s*=>\\s*${propAccess}\\s*\\))`;
    const inlineRef = new RegExp(`\\b${propName}\\s*:\\s*${derivation}`).test(optionsBody);
    const namedRef = footerScriptSource.match(
      new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${derivation}\\s*;`),
    );
    const namedOption = Boolean(
      namedRef &&
      (new RegExp(`\\b${propName}\\s*:\\s*${escapeRegExp(namedRef[1])}\\b`).test(optionsBody) ||
        (namedRef[1] === propName &&
          new RegExp(`(?:^|,)\\s*${propName}\\s*(?:,|$)`).test(optionsBody))),
    );
    assert.ok(inlineRef || namedOption, `${propName} must come from its matching Footer prop ref`);
  }

  const output = Object.fromEntries(
    ["liked", "likeCount", "likeBusy", "likeLabel", "handleLike"].map((member) => [
      member,
      resultExpression(footerScriptSource, composableImport.local, member),
    ]),
  );
  const likeButtons = footerTemplateSource.match(/data-card-control\s*=\s*["']like["']/g) ?? [];
  assert.equal(likeButtons.length, 1, "Footer must retain one real Like control");
  const likeButton = elementBlockWithAttribute(
    footerTemplateSource,
    "button",
    /data-card-control\s*=\s*["']like["']/,
  );
  for (const [attribute, expression] of [
    [":aria-label", output.likeLabel],
    [":aria-pressed", output.liked],
    [":disabled", output.likeBusy],
    ["@click.stop", output.handleLike],
  ]) {
    assert.match(
      likeButton,
      new RegExp(`${escapeRegExp(attribute)}\\s*=\\s*["']${escapeRegExp(expression)}["']`),
      `${attribute} must bind the matching useFeedCardLike result`,
    );
  }
  assert.match(
    likeButton,
    new RegExp(`\\{\\{\\s*${escapeRegExp(output.likeCount)}\\s*\\}\\}`),
    "the visible count must come from the useFeedCardLike owner",
  );
});

test("FeedItemCardFooter keeps avatar reset separate and removes the dead Like event path", () => {
  assertNoFeedbackDependencies(footerScriptSource, "FeedItemCardFooter");
  const vueImports = namedImportsFrom(footerScriptSource, "vue");
  const watchImport = vueImports.find(
    ({ imported, typeOnly }) => imported === "watch" && !typeOnly,
  );
  assert.ok(watchImport, "Footer must retain its avatar URL watcher");
  const propsDeclaration = footerScriptSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*defineProps\b/,
  );
  assert.ok(propsDeclaration, "Footer must retain one typed props owner");
  const propsLocal = propsDeclaration[1];
  const avatarRefNames = [
    ...footerScriptSource.matchAll(
      new RegExp(
        `const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;]*${escapeRegExp(propsLocal)}\\.authorAvatarUrl[^;]*;`,
        "g",
      ),
    ),
  ].map((match) => match[1]);
  const avatarWatch = callArguments(footerScriptSource, watchImport.local).find(
    (call) =>
      new RegExp(`\\b${escapeRegExp(propsLocal)}\\.authorAvatarUrl\\b`).test(call) ||
      avatarRefNames.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(call)),
  );
  assert.ok(avatarWatch, "avatar URL changes must retain a dedicated avatar-error reset watcher");
  assert.match(
    avatarWatch,
    /\b[A-Za-z_$][\w$]*\.value\s*=\s*false/,
    "the avatar watcher must reset its owned error ref",
  );
  assert.doesNotMatch(
    avatarWatch,
    /\b(?:liked|likeCount|likeBusy|handleLike)\b/,
    "avatar reset must not share the Like owner watcher",
  );
  assert.doesNotMatch(
    avatarWatch,
    new RegExp(`${escapeRegExp(propsLocal)}\\.(?:liked|likeCount)\\b`),
    "avatar reset must not observe Like props",
  );

  for (const definition of footerScriptSource.matchAll(/\bdefineEmits\b/g)) {
    const statementEnd = footerScriptSource.indexOf(";", definition.index);
    const statement = footerScriptSource.slice(
      definition.index,
      statementEnd === -1 ? footerScriptSource.length : statementEnd + 1,
    );
    assert.doesNotMatch(
      statement,
      /(?:["']liked["']|\bliked\s*:)/,
      "the dead liked component event definition must be removed",
    );
  }
  for (const owner of footerScriptSource.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*defineEmits\b/g,
  )) {
    assert.doesNotMatch(
      footerScriptSource,
      new RegExp(`\\b${escapeRegExp(owner[1])}\\s*\\(\\s*["']liked["']`),
      "the dead liked component event must not be emitted through an aliased owner",
    );
  }
  assert.doesNotMatch(footerScriptSource, /\btogglePostLike\b/);
  for (const { bindings, modulePath } of importStatements(footerScriptSource)) {
    assert.doesNotMatch(modulePath, /(?:^|\/)reactions(?:\/|$)|postReactionSettlements/);
    assert.doesNotMatch(modulePath, /(?:^|\/)api\/posts$/);
    assert.doesNotMatch(
      bindings,
      /\b(?:postReactionSettlements|createPostReactionSettlementChannel|PostReactionSettlementPort)\b/,
    );
  }
});

test("Shell, Card, List, and View do not relay Footer settlements or the dead liked event", () => {
  for (const [surface, source] of [
    ["Shell", shellSource],
    ["Card", wrapperSource],
    ["List", listSource],
    ["View", viewSource],
  ]) {
    assert.doesNotMatch(source, /@liked(?:\.[\w-]+)?\s*=/, `${surface} must not relay @liked`);
    assert.doesNotMatch(source, /:settlements\s*=/, `${surface} must not relay a settlement prop`);
    assert.doesNotMatch(
      source,
      /\bsettlements\??\s*:/,
      `${surface} must not declare a settlement prop`,
    );
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
