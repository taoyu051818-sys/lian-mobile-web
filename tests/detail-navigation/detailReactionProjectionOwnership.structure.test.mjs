import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n?/g, "\n");
}

const fetcherSource = read("src/app/detail-navigation/fetcher.ts");
const storeSource = read("src/app/detail-navigation/store.ts");
const reactionsSource = read("src/features/detail/usePostReactions.ts");
const postsApiSource = read("src/api/posts.ts");
const httpSource = read("src/api/http.ts");
const stateSource = read("src/app/detail-navigation/state.ts");
const detailSurfaceSource = read("src/app/DetailSurface.vue");
const detailPanelSource = read("src/features/detail/PostDetailPanel.vue");
const detailSurfaceScript = scriptSetupOf(detailSurfaceSource, "DetailSurface");
const detailPanelScript = scriptSetupOf(detailPanelSource, "PostDetailPanel");

const REACTIONS_BARREL = "../../features/reactions";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scriptSetupOf(source, label) {
  const match = source.match(/<script\s+setup(?:\s+lang=["']ts["'])?[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, `expected ${label} script setup`);
  return match[1];
}

function templateOf(source, label) {
  const match = source.match(/<template[^>]*>([\s\S]*?)<\/template>/);
  assert.ok(match, `expected ${label} template`);
  return match[1];
}

function parseTypeScript(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.deepEqual(
    sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.messageText),
    [],
    `${fileName} must parse as TypeScript`,
  );
  return sourceFile;
}

function walk(node, visitor) {
  visitor(node);
  node.forEachChild((child) => walk(child, visitor));
}

function isFunctionNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function walkExecutable(root, visitor) {
  function visit(node) {
    if (node !== root && isFunctionNode(node)) return;
    visitor(node);
    node.forEachChild(visit);
  }
  visit(root);
}

function namedFunctions(sourceFile) {
  const functions = new Map();
  walk(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.set(node.name.text, node);
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      functions.set(node.name.text, node.initializer);
    }
  });
  return functions;
}

function resolveCallback(sourceFile, expression, label) {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression;
  if (ts.isIdentifier(expression)) {
    const resolved = namedFunctions(sourceFile).get(expression.text);
    assert.ok(resolved, `expected ${label} callback ${expression.text}`);
    return resolved;
  }
  assert.fail(`expected ${label} to use an inline or named callback`);
}

function executableNodes(sourceFile, rootFunction) {
  const functions = namedFunctions(sourceFile);
  const roots = [];
  const visited = new Set();

  function visitFunction(functionNode) {
    if (visited.has(functionNode)) return;
    visited.add(functionNode);
    roots.push(functionNode.body);
    walkExecutable(functionNode.body, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      const target = functions.get(node.expression.text);
      if (target) visitFunction(target);
    });
  }

  visitFunction(rootFunction);
  return roots;
}

function collectNodes(roots, predicate) {
  const matches = [];
  for (const root of roots) {
    walkExecutable(root, (node) => {
      if (predicate(node)) matches.push(node);
    });
  }
  return matches;
}

function callTargetsProperty(node, ownerLocal, property) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === ownerLocal &&
    node.expression.name.text === property
  );
}

function callTargetsIdentifier(node, identifier) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === identifier
  );
}

function compactNodeText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/g, "");
}

function participatesInIdentityComparison(node) {
  let current = node;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isNonNullExpression(current.parent))
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  if (
    parent &&
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return true;
  }
  return Boolean(
    parent &&
    ts.isCallExpression(parent) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    ts.isIdentifier(parent.expression.expression) &&
    parent.expression.expression.text === "Object" &&
    parent.expression.name.text === "is",
  );
}

function containsExactNode(root, targets) {
  let found = false;
  walk(root, (node) => {
    if (targets.has(node)) found = true;
  });
  return found;
}

function oneHopExpressionAliases(roots, targetNodes) {
  const targets = new Set(targetNodes);
  const aliases = new Set();
  for (const declaration of collectNodes(roots, ts.isVariableDeclaration)) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.initializer &&
      containsExactNode(declaration.initializer, targets)
    ) {
      aliases.add(declaration.name.text);
    }
  }
  for (const assignment of collectNodes(
    roots,
    (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left),
  )) {
    if (containsExactNode(assignment.right, targets)) aliases.add(assignment.left.text);
  }
  return aliases;
}

function expressionCarriesEventField(node, objectAliases, valueAliases, field) {
  let carries = false;
  walk(node, (candidate) => {
    if (ts.isIdentifier(candidate) && valueAliases.has(candidate.text)) carries = true;
    if (
      ts.isPropertyAccessExpression(candidate) &&
      candidate.name.text === field &&
      ts.isIdentifier(candidate.expression) &&
      objectAliases.has(candidate.expression.text)
    ) {
      carries = true;
    }
  });
  return carries;
}

function eventFieldAliases(roots, callback, functions, field) {
  const firstParameter = callback.parameters[0];
  assert.ok(
    firstParameter && ts.isIdentifier(firstParameter.name),
    "ready subscriber must retain its settlement event parameter",
  );
  const objectAliases = new Set([firstParameter.name.text]);
  const valueAliases = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    for (const declaration of collectNodes(roots, ts.isVariableDeclaration)) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (
        ts.isIdentifier(declaration.initializer) &&
        objectAliases.has(declaration.initializer.text) &&
        !objectAliases.has(declaration.name.text)
      ) {
        objectAliases.add(declaration.name.text);
        changed = true;
      }
      if (
        expressionCarriesEventField(declaration.initializer, objectAliases, valueAliases, field) &&
        !valueAliases.has(declaration.name.text)
      ) {
        valueAliases.add(declaration.name.text);
        changed = true;
      }
    }

    for (const call of collectNodes(
      roots,
      (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression),
    )) {
      const target = functions.get(call.expression.text);
      if (!target) continue;
      for (let index = 0; index < call.arguments.length; index += 1) {
        const parameter = target.parameters[index];
        if (!parameter || !ts.isIdentifier(parameter.name)) continue;
        const argument = call.arguments[index];
        if (
          ts.isIdentifier(argument) &&
          objectAliases.has(argument.text) &&
          !objectAliases.has(parameter.name.text)
        ) {
          objectAliases.add(parameter.name.text);
          changed = true;
        }
        if (
          expressionCarriesEventField(argument, objectAliases, valueAliases, field) &&
          !valueAliases.has(parameter.name.text)
        ) {
          valueAliases.add(parameter.name.text);
          changed = true;
        }
      }
    }
  }

  return { objectAliases, valueAliases };
}

function enclosingFunction(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (isFunctionNode(parent)) return parent;
  }
  return null;
}

function moduleScopeMapOrSetConstructions(source, fileName) {
  const sourceFile = parseTypeScript(source, fileName);
  const constructions = [];
  walk(sourceFile, (node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Map", "Set"].includes(node.expression.text) &&
      !enclosingFunction(node)
    ) {
      constructions.push(node.getText(sourceFile));
    }
  });
  return constructions;
}

function functionBindingName(functionNode) {
  if (ts.isFunctionDeclaration(functionNode) && functionNode.name) {
    return functionNode.name.text;
  }
  if (
    (ts.isArrowFunction(functionNode) || ts.isFunctionExpression(functionNode)) &&
    functionNode.parent &&
    ts.isVariableDeclaration(functionNode.parent) &&
    ts.isIdentifier(functionNode.parent.name)
  ) {
    return functionNode.parent.name.text;
  }
  return null;
}

function hasTopLevelCall(sourceFile, callableName) {
  return sourceFile.statements.some((statement) => {
    if (!ts.isExpressionStatement(statement)) return false;
    const expression = statement.expression;
    return (
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === callableName
    );
  });
}

function matchingBraceEnd(source, bodyStart, label) {
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  assert.fail(`unterminated ${label}`);
}

function interfaceBody(source, name) {
  const signature = new RegExp(
    `export\\s+interface\\s+${escapeRegExp(name)}(?:\\s+extends[^\\{]+)?\\s*\\{`,
  );
  const match = signature.exec(source);
  assert.ok(match, `expected exported interface ${name}`);
  const bodyStart = source.indexOf("{", match.index);
  const bodyEnd = matchingBraceEnd(source, bodyStart, `interface ${name}`);
  return source.slice(bodyStart + 1, bodyEnd);
}

function findCallableStart(source, name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escapedName}\\s*\\(`),
    new RegExp(
      `(?:export\\s+)?(?:const|let)\\s+${escapedName}\\s*=\\s*(?:async\\s+)?(?:\\([^;]*?\\)|[A-Za-z_$][\\w$]*)\\s*(?::[^=]+)?=>\\s*\\{`,
    ),
  ];
  const matches = patterns.map((pattern) => pattern.exec(source)).filter(Boolean);
  assert.ok(matches.length > 0, `expected callable ${name}`);
  return matches.sort((left, right) => left.index - right.index)[0];
}

function callableBody(source, name) {
  const match = findCallableStart(source, name);
  const bodyStart = source.indexOf("{", match.index + match[0].indexOf("("));
  assert.notEqual(bodyStart, -1, `expected ${name} body`);
  const bodyEnd = matchingBraceEnd(source, bodyStart, `callable ${name}`);
  return source.slice(bodyStart + 1, bodyEnd);
}

function functionDeclaration(source, name) {
  const signature = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${escapeRegExp(name)}\\s*\\(`,
  );
  const match = signature.exec(source);
  assert.ok(match, `expected function declaration ${name}`);
  const parametersStart = source.indexOf("(", match.index);
  let depth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) {
      parametersEnd = index;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `expected ${name} parameter list`);
  const bodyStart = source.indexOf("{", parametersEnd + 1);
  assert.notEqual(bodyStart, -1, `expected ${name} body`);
  const bodyEnd = matchingBraceEnd(source, bodyStart, `function ${name}`);
  return {
    parameters: source.slice(parametersStart + 1, parametersEnd),
    body: source.slice(bodyStart + 1, bodyEnd),
  };
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") round += 1;
    else if (char === ")") round -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "{") curly += 1;
    else if (char === "}") curly -= 1;
    else if (char === "," && round === 0 && square === 0 && curly === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalPart = source.slice(start).trim();
  if (finalPart) parts.push(finalPart);
  return parts;
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
      const block = bindings.match(/\{([^}]*)\}/);
      if (!block) return [];
      const statementIsTypeOnly = /^\s*type\b/.test(bindings);
      return block[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const inlineTypeOnly = /^type\s+/.test(entry);
          const specifier = entry.replace(/^type\s+/, "");
          const parsed = specifier.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
          assert.ok(parsed, `unsupported named import specifier: ${entry}`);
          return {
            imported: parsed[1],
            local: parsed[2] ?? parsed[1],
            typeOnly: statementIsTypeOnly || inlineTypeOnly,
          };
        });
    });
}

function requiredNamedImport(source, modulePath, imported, expectedTypeOnly) {
  const entry = namedImportsFrom(source, modulePath).find(
    (candidate) => candidate.imported === imported && candidate.typeOnly === expectedTypeOnly,
  );
  assert.ok(entry, `expected ${expectedTypeOnly ? "type " : ""}${imported} from ${modulePath}`);
  return entry.local;
}

function callArguments(source, callee) {
  const calls = [];
  const signature = new RegExp(`\\b${escapeRegExp(callee)}\\s*\\(`, "g");
  let match;
  while ((match = signature.exec(source)) !== null) {
    const start = source.indexOf("(", match.index);
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0) {
        calls.push(source.slice(start + 1, index));
        signature.lastIndex = index + 1;
        break;
      }
    }
  }
  return calls;
}

function directCalls(source) {
  const calls = new Set();
  for (const match of source.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!new Set(["if", "for", "while", "switch", "catch", "function", "return"]).has(match[1])) {
      calls.add(match[1]);
    }
  }
  return calls;
}

function callableNames(source) {
  const names = new Set();
  for (const match of source.matchAll(
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
  )) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(
    /(?:^|\n)\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^;]*?\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>\s*\{/g,
  )) {
    names.add(match[1]);
  }
  return names;
}

function reachableAbortHelpers(source, entryBody) {
  const knownCallables = callableNames(source);
  const abortHelpers = new Set();

  function visit(body, visited, depth) {
    if (depth > 4) return;
    for (const name of directCalls(body)) {
      if (!knownCallables.has(name) || visited.has(name)) continue;
      const nextVisited = new Set(visited).add(name);
      const nextBody = callableBody(source, name);
      if (/\.\s*abort\s*\(/.test(nextBody)) abortHelpers.add(name);
      visit(nextBody, nextVisited, depth + 1);
    }
  }

  visit(entryBody, new Set(), 0);
  return abortHelpers;
}

function withoutComments(source) {
  let output = "";
  let mode = "code";
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line-comment") {
      if (char === "\n") {
        mode = "code";
        output += "\n";
      } else {
        output += " ";
      }
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 1;
        mode = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;
      mode = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      output += "  ";
      index += 1;
      mode = "block-comment";
      continue;
    }
    output += char;
  }
  return output;
}

function assertOnlyPublicReactionImports(source, owner) {
  const reactionImports = importStatements(source).filter(({ modulePath }) =>
    /(?:^|\/)reactions(?:\/|$)|postReactionSettlements/.test(modulePath),
  );
  assert.ok(reactionImports.length > 0, `${owner} must import the public reactions barrel`);
  for (const { modulePath } of reactionImports) {
    assert.equal(modulePath, REACTIONS_BARREL, `${owner} must not deep-import reactions`);
  }
  assert.doesNotMatch(
    source,
    /import\s*\([^)]*(?:reactions|postReactionSettlements)[^)]*\)/,
    `${owner} must not dynamically import reactions`,
  );
}

test("fetch bridge exposes the typed optional port and logical signal from the public barrel", () => {
  const optionsBody = interfaceBody(fetcherSource, "FetchDetailWithTokenOptions");
  const singletonLocal = requiredNamedImport(
    fetcherSource,
    REACTIONS_BARREL,
    "postReactionSettlements",
    false,
  );
  const portTypeLocal = requiredNamedImport(
    fetcherSource,
    REACTIONS_BARREL,
    "PostReactionSettlementPort",
    true,
  );

  assert.match(
    optionsBody,
    new RegExp(`\\bsettlements\\s*\\?\\s*:\\s*${escapeRegExp(portTypeLocal)}\\b`),
  );
  assert.match(optionsBody, /\bsignal\s*\?\s*:\s*AbortSignal\b/);
  assertOnlyPublicReactionImports(fetcherSource, "fetch bridge");

  const fetchBody = functionDeclaration(fetcherSource, "fetchDetailWithToken").body;
  assert.match(
    fetchBody,
    new RegExp(`(?:\\?\\.|\\.)settlements\\s*\\?\\?\\s*${escapeRegExp(singletonLocal)}\\b`),
    "fetch bridge must resolve its optional port to the named singleton exactly once",
  );
});

test("fetch bridge binds abort cleanup to a request-local subscription and keeps the API tid-only", () => {
  const singletonLocal = requiredNamedImport(
    fetcherSource,
    REACTIONS_BARREL,
    "postReactionSettlements",
    false,
  );
  const fetchPostLocal = requiredNamedImport(
    fetcherSource,
    "../../api/posts",
    "fetchPostDetail",
    false,
  );
  const declaration = functionDeclaration(fetcherSource, "fetchDetailWithToken");
  const parameterParts = splitTopLevel(declaration.parameters);
  const tidParameter = parameterParts[0]?.match(/^([A-Za-z_$][\w$]*)\s*:/)?.[1];
  assert.ok(tidParameter, "fetch bridge must have a typed requested-tid parameter");

  const fallback = declaration.body.match(
    new RegExp(
      `(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;]*?settlements\\s*\\?\\?\\s*${escapeRegExp(singletonLocal)}\\b`,
    ),
  );
  assert.ok(fallback, "fetch bridge must retain one request-local settlement port");
  const portLocal = fallback[1];
  assert.match(declaration.body, new RegExp(`\\b${escapeRegExp(portLocal)}\\.subscribe\\s*\\(`));
  assert.match(declaration.body, /\.addEventListener\s*\(\s*["']abort["']/);
  assert.match(declaration.body, /\.removeEventListener\s*\(\s*["']abort["']/);

  const detailCalls = callArguments(declaration.body, fetchPostLocal);
  assert.equal(detailCalls.length, 1, "fetch bridge must make exactly one physical Detail call");
  assert.deepEqual(splitTopLevel(detailCalls[0]), [tidParameter]);

  const apiDeclaration = functionDeclaration(postsApiSource, "fetchPostDetail");
  assert.equal(splitTopLevel(apiDeclaration.parameters).length, 1, "Detail API remains tid-only");
});

test("store owns the AbortController and passes only its signal to the physical fetch bridge", () => {
  const fetchBridgeLocal = requiredNamedImport(
    storeSource,
    "./fetcher",
    "fetchDetailWithToken",
    false,
  );
  const executableStore = withoutComments(storeSource);
  assert.match(executableStore, /new\s+AbortController\s*\(\s*\)/);
  assert.match(executableStore, /Object\.is\s*\(/, "loading ownership must compare raw tid");

  const bridgeCalls = callArguments(executableStore, fetchBridgeLocal);
  const productionCall = bridgeCalls
    .map((call) => splitTopLevel(call))
    .find((parts) => parts.length === 4 && /\bsignal\s*:/.test(parts[3]));
  assert.ok(
    productionCall,
    "production fetch effect must pass a fourth signal-only options object",
  );
  assert.match(
    productionCall[3],
    /^\{\s*signal\s*:\s*[^,{}]+\.signal\s*,?\s*\}$/,
    "the production bridge options must contain only the owner signal",
  );

  const controllerIndex = executableStore.indexOf("new AbortController");
  const guardRegion = executableStore.slice(Math.max(0, controllerIndex - 900), controllerIndex);
  assert.match(
    guardRegion,
    /\bif\s*\(/,
    "state ownership must be checked before controller creation",
  );
  assert.match(guardRegion, /\breturn\b/, "a stale fetch effect must return before owner creation");
});

test("store dispatch and testing reset reach the same pre-commit abort release path", () => {
  const executableStore = withoutComments(storeSource);
  const dispatchBody = callableBody(executableStore, "dispatch");
  const resetBody = callableBody(executableStore, "__resetStoreForTesting");
  const dispatchCommit = dispatchBody.search(/\bstateRef\.value\s*=/);
  const resetCommit = resetBody.search(/\bstateRef\.value\s*=\s*initialState\s*\(/);
  assert.notEqual(dispatchCommit, -1, "dispatch must commit the reducer state");
  assert.notEqual(resetCommit, -1, "testing reset must restore initial state");

  const dispatchAbortHelpers = reachableAbortHelpers(
    executableStore,
    dispatchBody.slice(0, dispatchCommit),
  );
  const resetAbortHelpers = reachableAbortHelpers(executableStore, resetBody.slice(0, resetCommit));
  const sharedHelpers = [...dispatchAbortHelpers].filter((name) => resetAbortHelpers.has(name));
  assert.ok(
    sharedHelpers.length > 0,
    "dispatch and testing reset must share an aborting release helper before state commit",
  );
  assert.ok(
    sharedHelpers.some((name) => {
      const body = callableBody(executableStore, name);
      const detach = body.search(
        /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*=\s*(?:null|undefined)\b/,
      );
      const abort = body.search(/\.\s*abort\s*\(/);
      return detach >= 0 && abort > detach;
    }),
    "the shared release path must detach its owner pointer before aborting",
  );
});

test("store installs one module-lifetime ready consumer with raw identity, per-kind floors, and exact in-place writes", () => {
  const singletonLocal = requiredNamedImport(
    storeSource,
    REACTIONS_BARREL,
    "postReactionSettlements",
    false,
  );
  const toRawLocal = requiredNamedImport(storeSource, "vue", "toRaw", false);
  const refLocal = requiredNamedImport(storeSource, "vue", "ref", false);
  assertOnlyPublicReactionImports(storeSource, "detail-navigation store");

  const sourceFile = parseTypeScript(storeSource, "store.ts");
  const functions = namedFunctions(sourceFile);
  const subscribeCalls = [];
  walk(sourceFile, (node) => {
    if (callTargetsProperty(node, singletonLocal, "subscribe")) subscribeCalls.push(node);
  });
  assert.equal(
    subscribeCalls.length,
    1,
    "the store must bind exactly one named-singleton ready subscriber",
  );

  const subscriptionOwner = enclosingFunction(subscribeCalls[0]);
  if (subscriptionOwner) {
    const ownerName = functionBindingName(subscriptionOwner);
    assert.ok(ownerName, "the ready subscription binder must have a stable module binding");
    assert.ok(
      hasTopLevelCall(sourceFile, ownerName),
      "the ready subscription binder must run once from module initialization",
    );
  }

  assert.equal(subscribeCalls[0].arguments.length, 1, "ready subscribe takes one callback");
  const callback = resolveCallback(sourceFile, subscribeCalls[0].arguments[0], "ready settlement");
  const callbackRoots = executableNodes(sourceFile, callback);

  const callbackText = callbackRoots.map((root) => root.getText(sourceFile)).join("\n");
  assert.match(callbackText, /\.kind\s*(?:===?|!==?)\s*["']ready["']/);
  assert.match(callbackText, /["']like["']/);
  assert.match(callbackText, /["']save["']/);

  const rawPostCalls = collectNodes(
    callbackRoots,
    (node) =>
      callTargetsIdentifier(node, toRawLocal) &&
      node.arguments.length === 1 &&
      ts.isPropertyAccessExpression(node.arguments[0]) &&
      node.arguments[0].name.text === "post",
  );
  assert.ok(rawPostCalls.length > 0, "ready callback must read the reactive post through toRaw");
  const rawPostAliases = oneHopExpressionAliases(callbackRoots, rawPostCalls);
  const aliasedRawComparisons = collectNodes(
    callbackRoots,
    (node) =>
      ts.isIdentifier(node) &&
      rawPostAliases.has(node.text) &&
      participatesInIdentityComparison(node),
  );
  assert.ok(
    rawPostCalls.some(participatesInIdentityComparison) || aliasedRawComparisons.length > 0,
    "the tracked raw post must be identity-compared with toRaw(current post)",
  );

  const statePostExpression = compactNodeText(rawPostCalls[0].arguments[0], sourceFile);
  const postRoots = new Set([statePostExpression]);
  let addedAlias = true;
  while (addedAlias) {
    addedAlias = false;
    for (const declaration of collectNodes(callbackRoots, ts.isVariableDeclaration)) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (!postRoots.has(compactNodeText(declaration.initializer, sourceFile))) continue;
      if (!postRoots.has(declaration.name.text)) {
        postRoots.add(declaration.name.text);
        addedAlias = true;
      }
    }
    for (const call of collectNodes(
      callbackRoots,
      (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression),
    )) {
      const target = functions.get(call.expression.text);
      if (!target) continue;
      for (let index = 0; index < call.arguments.length; index += 1) {
        const parameter = target.parameters[index];
        if (
          !parameter ||
          !ts.isIdentifier(parameter.name) ||
          !postRoots.has(compactNodeText(call.arguments[index], sourceFile))
        ) {
          continue;
        }
        if (!postRoots.has(parameter.name.text)) {
          postRoots.add(parameter.name.text);
          addedAlias = true;
        }
      }
    }
  }

  const assignments = collectNodes(
    callbackRoots,
    (node) => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken,
  );
  const assignedPostFields = new Set();
  for (const assignment of assignments) {
    const leftText = compactNodeText(assignment.left, sourceFile);
    for (const root of postRoots) {
      if (!leftText.startsWith(`${root}.`)) continue;
      const relativeField = leftText.slice(root.length + 1);
      assert.ok(
        ["liked", "likeCount", "bookmarked"].includes(relativeField),
        `ready consumer must not mutate non-reaction post field ${relativeField}`,
      );
      assignedPostFields.add(relativeField);
    }
  }
  const sequenceFlow = eventFieldAliases(callbackRoots, callback, functions, "sequence");
  const kindFlow = eventFieldAliases(callbackRoots, callback, functions, "kind");
  const floorAssignments = assignments.filter((assignment) =>
    expressionCarriesEventField(
      assignment.right,
      sequenceFlow.objectAliases,
      sequenceFlow.valueAliases,
      "sequence",
    ),
  );
  const floorTargets = new Set(
    floorAssignments.map((assignment) => compactNodeText(assignment.left, sourceFile)),
  );
  const kindIndexedFloor = floorAssignments.some(
    (assignment) =>
      ts.isElementAccessExpression(assignment.left) &&
      assignment.left.argumentExpression &&
      expressionCarriesEventField(
        assignment.left.argumentExpression,
        kindFlow.objectAliases,
        kindFlow.valueAliases,
        "kind",
      ),
  );
  assert.ok(
    floorTargets.size >= 2 || kindIndexedFloor,
    "Like and Save must retain independent greatest-sequence floors",
  );

  const objectAssignCalls = collectNodes(
    callbackRoots,
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Object" &&
      node.expression.name.text === "assign",
  );
  for (const call of objectAssignCalls) {
    assert.equal(
      call.arguments.length,
      2,
      "ready Object.assign must have one tracked target and one exact source",
    );
    assert.ok(
      postRoots.has(compactNodeText(call.arguments[0], sourceFile)),
      "ready Object.assign must target the tracked reactive post",
    );
    const source = call.arguments[1];
    assert.ok(
      ts.isObjectLiteralExpression(source),
      "ready Object.assign source must be an exact object literal",
    );
    const keys = source.properties.map((property) => {
      assert.ok(
        ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property),
        "ready Object.assign must not use spread, methods, or accessors",
      );
      const name = property.name;
      assert.ok(
        ts.isIdentifier(name) || ts.isStringLiteral(name),
        "ready Object.assign keys must be static",
      );
      return name.text;
    });
    const shape = [...keys].sort().join(",");
    assert.ok(
      shape === "bookmarked" || shape === "likeCount,liked",
      "ready Object.assign must use exactly the Like or Save reaction-field shape",
    );
    for (const key of keys) assignedPostFields.add(key);
  }
  assert.deepEqual(
    [...assignedPostFields].sort(),
    ["bookmarked", "likeCount", "liked"],
    "the ready consumer must project exactly all three reaction fields",
  );
  assert.ok(
    assignments.every(
      (assignment) => compactNodeText(assignment.left, sourceFile) !== statePostExpression,
    ),
    "ready projection must not replace the current post object",
  );

  let stateRefLocal = null;
  walk(sourceFile, (node) => {
    if (
      !stateRefLocal &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === refLocal &&
      node.initializer.typeArguments?.some(
        (argument) => argument.getText(sourceFile) === "DetailState",
      )
    ) {
      stateRefLocal = node.name.text;
    }
  });
  assert.ok(stateRefLocal, "expected the module DetailState ref owner");
  assert.ok(
    assignments.every(
      (assignment) => compactNodeText(assignment.left, sourceFile) !== `${stateRefLocal}.value`,
    ),
    "ready settlement callback must preserve the observable DetailState identity",
  );

  const dispatchFunction = functions.get("dispatch");
  assert.ok(dispatchFunction, "expected detail-navigation dispatch");
  const directDispatchNodes = [];
  walkExecutable(dispatchFunction.body, (node) => directDispatchNodes.push(node));
  const commit = directDispatchNodes.find(
    (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      compactNodeText(node.left, sourceFile) === `${stateRefLocal}.value`,
  );
  assert.ok(commit, "dispatch must commit the next reactive state");

  const preCommitRoots = dispatchFunction.body.statements.filter(
    (statement) => statement.getStart(sourceFile) < commit.getStart(sourceFile),
  );
  const preCommitCalls = collectNodes(
    preCommitRoots,
    (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression),
  );
  for (const call of preCommitCalls) {
    const target = functions.get(call.expression.text);
    if (target) preCommitRoots.push(...executableNodes(sourceFile, target));
  }
  assert.ok(
    collectNodes(preCommitRoots, (node) => callTargetsIdentifier(node, toRawLocal)).length > 0,
    "dispatch must install the next raw ready-post identity before commit",
  );
  assert.ok(
    collectNodes(preCommitRoots, (node) =>
      callTargetsProperty(node, singletonLocal, "currentSequence"),
    ).length > 0,
    "dispatch must install current-sequence floors before committing a new ready post",
  );
});

test("usePostReactions resolves one public port for both publication and subscription", () => {
  const singletonLocal = requiredNamedImport(
    reactionsSource,
    REACTIONS_BARREL,
    "postReactionSettlements",
    false,
  );
  requiredNamedImport(reactionsSource, REACTIONS_BARREL, "PostReactionSettlementPort", true);
  assertOnlyPublicReactionImports(reactionsSource, "usePostReactions");

  const body = functionDeclaration(reactionsSource, "usePostReactions").body;
  const fallback = body.match(
    new RegExp(
      `(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;]*?settlements\\s*\\?\\?\\s*${escapeRegExp(singletonLocal)}\\b`,
    ),
  );
  assert.ok(fallback, "usePostReactions must resolve exactly one injected/default port");
  const portLocal = fallback[1];
  assert.match(body, new RegExp(`\\b${escapeRegExp(portLocal)}\\.publish\\s*\\(`));
  assert.match(body, new RegExp(`\\b${escapeRegExp(portLocal)}\\.subscribe\\s*\\(`));
});

test("usePostReactions exposes one idempotent disposal path for explicit and scope cleanup", () => {
  const body = functionDeclaration(reactionsSource, "usePostReactions").body;
  const subscription = body.match(
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\.subscribe\s*\(/,
  );
  assert.ok(subscription, "subscription must retain its unsubscribe function");
  const unsubscribeLocal = subscription[1];
  const disposeBody = callableBody(reactionsSource, "dispose");

  assert.match(disposeBody, /\bif\s*\([^)]*\)\s*(?:\{\s*)?return\b/, "dispose must be idempotent");
  assert.match(disposeBody, new RegExp(`\\b${escapeRegExp(unsubscribeLocal)}\\s*\\(`));
  assert.match(body, /\bonScopeDispose\s*\(\s*dispose\s*\)/);
  assert.match(body, /\breturn\s*\{[\s\S]*?\bdispose\s*[,}]/);
});

test("Detail state, components, and API layers do not receive channel or lease ownership", () => {
  const forbiddenOwners = [
    ["detail-navigation state", stateSource],
    ["DetailSurface script", detailSurfaceScript],
    ["PostDetailPanel script", detailPanelScript],
    ["posts API", postsApiSource],
    ["HTTP layer", httpSource],
  ];
  const forbiddenSymbols =
    /\b(?:AbortController|AbortSignal|PostReactionSettlement(?:Port)?|postReactionSettlements|settlements|signal)\b/;

  for (const [owner, source] of forbiddenOwners) {
    assert.doesNotMatch(withoutComments(source), forbiddenSymbols, `${owner} must not own a relay`);
  }

  const relayProp = /(?:^|\s):?(?:signal|settlements)\s*=/m;
  assert.doesNotMatch(templateOf(detailSurfaceSource, "DetailSurface"), relayProp);
  assert.doesNotMatch(templateOf(detailPanelSource, "PostDetailPanel"), relayProp);
});

test("F3i runtime adds no alternate channel, environment branch, replay store, or transport-post mutation", () => {
  const runtimeSources = [fetcherSource, storeSource, reactionsSource].map(withoutComments);
  const combined = runtimeSources.join("\n");

  assert.doesNotMatch(combined, /\bcreatePostReactionSettlementChannel\b/);
  assert.doesNotMatch(combined, /\b(?:localStorage|sessionStorage|indexedDB|BroadcastChannel)\b/);
  assert.doesNotMatch(combined, /\b(?:NODE_ENV|VITEST|vitest|process\.env|import\.meta\.env)\b/);
  assert.deepEqual(
    [
      ...moduleScopeMapOrSetConstructions(fetcherSource, "fetcher.ts"),
      ...moduleScopeMapOrSetConstructions(storeSource, "store.ts"),
      ...moduleScopeMapOrSetConstructions(reactionsSource, "usePostReactions.ts"),
    ],
    [],
    "F3i must not introduce a module-scope replay cache",
  );
  const nonStoreSources = [withoutComments(fetcherSource), withoutComments(reactionsSource)].join(
    "\n",
  );
  assert.doesNotMatch(
    nonStoreSources,
    /\b(?:post|nextPost|response|result)\s*\.\s*(?:liked|likeCount|bookmarked)\s*=(?!=)/,
    "fetch and action consumers must not mutate a transport or reducer-owned post object",
  );
  assert.doesNotMatch(fetcherSource, /new\s+AbortController\s*\(/);
  assert.doesNotMatch(reactionsSource, /new\s+AbortController\s*\(/);
});
