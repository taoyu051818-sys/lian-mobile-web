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

function scriptSetupOf(source, label) {
  const match = source.match(/<script\s+setup(?:\s+lang=["']ts["'])?[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, `expected ${label} to expose one script setup block`);
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

function closestFunction(node) {
  let current = node.parent;
  while (current) {
    if (isFunctionNode(current)) return current;
    current = current.parent;
  }
  return null;
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    (typeof ts.isSatisfiesExpression === "function" && ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function exportedInterface(sourceFile, name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  assert.ok(declaration, `expected exported interface ${name}`);
  assert.ok(
    declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    `${name} must remain exported`,
  );
  return declaration;
}

function namedImportsFrom(sourceFile, modulePath) {
  const imports = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== modulePath ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const specifier of statement.importClause.namedBindings.elements) {
      imports.push({
        imported: specifier.propertyName?.text ?? specifier.name.text,
        local: specifier.name.text,
        typeOnly: Boolean(statement.importClause.isTypeOnly || specifier.isTypeOnly),
      });
    }
  }
  return imports;
}

function importedBinding(sourceFile, modulePath, imported, { typeOnly } = {}) {
  const matches = namedImportsFrom(sourceFile, modulePath).filter(
    (entry) =>
      entry.imported === imported && (typeOnly === undefined || entry.typeOnly === typeOnly),
  );
  assert.equal(
    matches.length,
    1,
    `expected one ${typeOnly ? "type " : ""}${imported} named import from ${modulePath}`,
  );
  return matches[0].local;
}

function functionDeclarations(sourceFile) {
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

function functionNamed(sourceFile, name) {
  const result = functionDeclarations(sourceFile).get(name);
  assert.ok(result, `expected function ${name}`);
  return result;
}

function resolveFunctionExpression(sourceFile, expression, label) {
  const candidate = unwrap(expression);
  if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) return candidate;
  if (ts.isIdentifier(candidate)) {
    const resolved = functionDeclarations(sourceFile).get(candidate.text);
    assert.ok(resolved, `expected ${label} callback ${candidate.text} to resolve locally`);
    return resolved;
  }
  assert.fail(`expected ${label} to use an inline or named callback`);
}

function reachableFunctions(sourceFile, entry) {
  const functions = functionDeclarations(sourceFile);
  const reachable = new Set();
  const pending = [entry];
  while (pending.length) {
    const current = pending.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    walkOwnFunctionBody(current, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(unwrap(node.expression))) return;
      const target = functions.get(unwrap(node.expression).text);
      if (target && !reachable.has(target)) pending.push(target);
    });
  }
  return [...reachable];
}

function walkOwnFunctionBody(functionNode, visitor) {
  function visit(node) {
    visitor(node);
    node.forEachChild((child) => {
      if (isFunctionNode(child)) return;
      visit(child);
    });
  }
  functionNode.body?.forEachChild(visit);
}

function constructionFunctions(sourceFile, entry) {
  const functions = functionDeclarations(sourceFile);
  const reachable = new Set();
  const pending = [entry];
  while (pending.length) {
    const current = pending.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    walkOwnFunctionBody(current, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(unwrap(node.expression))) return;
      const target = functions.get(unwrap(node.expression).text);
      if (target && !reachable.has(target)) pending.push(target);
    });
  }
  return [...reachable];
}

function returnedObject(functionNode) {
  let returnExpression = null;
  walk(functionNode.body, (node) => {
    if (
      !returnExpression &&
      ts.isReturnStatement(node) &&
      node.expression &&
      closestFunction(node) === functionNode
    ) {
      returnExpression = unwrap(node.expression);
    }
  });
  assert.ok(returnExpression, "useProfileTabs must return one public API value");
  if (ts.isObjectLiteralExpression(returnExpression)) {
    return { object: returnExpression, binding: null };
  }
  assert.ok(
    ts.isIdentifier(returnExpression),
    "useProfileTabs must return an object literal or one local API binding",
  );
  const candidates = [];
  walk(functionNode.body, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === returnExpression.text &&
      node.initializer &&
      ts.isObjectLiteralExpression(unwrap(node.initializer)) &&
      closestFunction(node) === functionNode
    ) {
      candidates.push(unwrap(node.initializer));
    }
  });
  assert.equal(candidates.length, 1, "the returned API binding must resolve to one local object");
  return { object: candidates[0], binding: returnExpression.text };
}

function returnedCallable(sourceFile, objectLiteral, publicName) {
  const member = objectLiteral.properties.find(
    (property) => propertyName(property.name) === publicName,
  );
  assert.ok(member, `expected useProfileTabs return object to expose ${publicName}`);
  if (ts.isMethodDeclaration(member)) return { functionNode: member, binding: null };
  if (ts.isShorthandPropertyAssignment(member)) {
    const functionNode = functionDeclarations(sourceFile).get(member.name.text);
    assert.ok(functionNode, `expected public ${publicName} binding to resolve locally`);
    return { functionNode, binding: member.name.text };
  }
  if (ts.isPropertyAssignment(member) && ts.isIdentifier(unwrap(member.initializer))) {
    const binding = unwrap(member.initializer).text;
    const functionNode = functionDeclarations(sourceFile).get(binding);
    assert.ok(functionNode, `expected public ${publicName} binding to resolve locally`);
    return { functionNode, binding };
  }
  if (
    ts.isPropertyAssignment(member) &&
    (ts.isArrowFunction(unwrap(member.initializer)) ||
      ts.isFunctionExpression(unwrap(member.initializer)))
  ) {
    return { functionNode: unwrap(member.initializer), binding: null };
  }
  assert.fail(`expected public ${publicName} to resolve to one callable`);
}

function directBindingAssignedFromCall(call) {
  if (call.parent && ts.isVariableDeclaration(call.parent) && ts.isIdentifier(call.parent.name)) {
    return call.parent.name.text;
  }
  if (
    call.parent &&
    ts.isBinaryExpression(call.parent) &&
    call.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(unwrap(call.parent.left))
  ) {
    return unwrap(call.parent.left).text;
  }
  return null;
}

function bindingAssignedFromConstructionCall(sourceFile, call, callRoot, label) {
  const directBinding = directBindingAssignedFromCall(call);
  if (directBinding) return directBinding;

  const returnedDirectly =
    (ts.isBlock(callRoot.body) &&
      ts.isReturnStatement(call.parent) &&
      closestFunction(call.parent) === callRoot) ||
    (!ts.isBlock(callRoot.body) && unwrap(callRoot.body) === call);
  assert.ok(returnedDirectly, `${label} must be assigned directly or returned by one helper`);
  const helperBinding = [...functionDeclarations(sourceFile)].find(
    ([, functionNode]) => functionNode === callRoot,
  )?.[0];
  assert.ok(helperBinding, `${label} return helper must resolve locally`);

  const assignedCalls = [];
  for (const root of constructionFunctions(sourceFile, useProfileTabsFunction)) {
    walkOwnFunctionBody(root, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(unwrap(node.expression)) &&
        unwrap(node.expression).text === helperBinding
      ) {
        const binding = directBindingAssignedFromCall(node);
        if (binding) assignedCalls.push(binding);
      }
    });
  }
  assert.equal(assignedCalls.length, 1, `${label} helper result must have one local owner`);
  return assignedCalls[0];
}

function rootsCallCleanupBinding(roots, binding) {
  let called = false;
  for (const root of roots) {
    walkOwnFunctionBody(root, (node) => {
      if (!ts.isCallExpression(node)) return;
      const expression = unwrap(node.expression);
      if (ts.isIdentifier(expression) && expression.text === binding) called = true;
      if (
        ts.isPropertyAccessExpression(expression) &&
        expression.name.text === "stop" &&
        ts.isIdentifier(unwrap(expression.expression)) &&
        unwrap(expression.expression).text === binding
      ) {
        called = true;
      }
    });
  }
  return called;
}

function resolveObjectLiteral(sourceFile, expression, label) {
  const candidate = unwrap(expression);
  if (ts.isObjectLiteralExpression(candidate)) return candidate;
  assert.ok(ts.isIdentifier(candidate), `${label} must be an object or one local constant`);
  const matches = [];
  walk(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === candidate.text &&
      node.initializer &&
      ts.isObjectLiteralExpression(unwrap(node.initializer))
    ) {
      matches.push(unwrap(node.initializer));
    }
  });
  assert.equal(matches.length, 1, `${label} binding must resolve to one object literal`);
  return matches[0];
}

function rootIdentifier(expression) {
  let current = unwrap(expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrap(current.expression);
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function mutatedModuleBindings(sourceFile) {
  const moduleBindings = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) moduleBindings.add(declaration.name.text);
    }
  }

  const mutated = new Set();
  const assignmentOperators = new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
  ]);
  const mutatingMethods = new Set([
    "add",
    "clear",
    "copyWithin",
    "delete",
    "fill",
    "pop",
    "push",
    "reverse",
    "set",
    "shift",
    "sort",
    "splice",
    "unshift",
  ]);

  function record(expression) {
    const binding = rootIdentifier(expression);
    if (binding && moduleBindings.has(binding)) mutated.add(binding);
  }

  walk(sourceFile, (node) => {
    if (ts.isBinaryExpression(node) && assignmentOperators.has(node.operatorToken.kind)) {
      record(node.left);
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      record(node.operand);
      return;
    }
    if (!ts.isCallExpression(node)) return;
    const expression = unwrap(node.expression);
    if (ts.isPropertyAccessExpression(expression)) {
      if (mutatingMethods.has(expression.name.text)) record(expression.expression);
      if (
        expression.name.text === "assign" &&
        ts.isIdentifier(unwrap(expression.expression)) &&
        unwrap(expression.expression).text === "Object" &&
        node.arguments[0]
      ) {
        record(node.arguments[0]);
      }
    }
  });
  return [...mutated].sort();
}

function objectArgumentForCall(sourceFile, calleeBinding) {
  const calls = [];
  walk(sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(unwrap(node.expression)) &&
      unwrap(node.expression).text === calleeBinding
    ) {
      calls.push(node);
    }
  });
  assert.equal(calls.length, 1, `expected one production ${calleeBinding} call`);
  assert.ok(
    calls[0].arguments[0] && ts.isObjectLiteralExpression(unwrap(calls[0].arguments[0])),
    `${calleeBinding} must receive an inline options object`,
  );
  return unwrap(calls[0].arguments[0]);
}

const runtimeSource = read("src/features/profile/useProfileTabs.ts");
const profileViewSource = read("src/features/profile/ProfileView.vue");
const collectionSource = read("src/features/profile/ProfileCollectionList.vue");
const profileTypesSource = read("src/types/profile.ts");

const profileViewScript = scriptSetupOf(profileViewSource, "ProfileView");
const collectionScript = scriptSetupOf(collectionSource, "ProfileCollectionList");

const runtimeFile = parseTypeScript(runtimeSource, "useProfileTabs.ts");
const profileViewFile = parseTypeScript(profileViewScript, "ProfileView.script.ts");
const collectionFile = parseTypeScript(collectionScript, "ProfileCollectionList.script.ts");
const profileTypesFile = parseTypeScript(profileTypesSource, "profile.ts");

const useProfileTabsFunction = functionNamed(runtimeFile, "useProfileTabs");

function resolvedPortBinding(singletonLocal) {
  const optionsParameter = useProfileTabsFunction.parameters[0];
  assert.ok(
    optionsParameter && ts.isIdentifier(optionsParameter.name),
    "expected one options parameter",
  );
  const optionsLocal = optionsParameter.name.text;
  const resolutions = [];
  for (const root of constructionFunctions(runtimeFile, useProfileTabsFunction)) {
    walkOwnFunctionBody(root, (node) => {
      if (
        !ts.isBinaryExpression(node) ||
        node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
      )
        return;
      const left = unwrap(node.left);
      const right = unwrap(node.right);
      if (
        ts.isPropertyAccessExpression(left) &&
        ts.isIdentifier(unwrap(left.expression)) &&
        unwrap(left.expression).text === optionsLocal &&
        left.name.text === "settlements" &&
        ts.isIdentifier(right) &&
        right.text === singletonLocal
      ) {
        resolutions.push(node);
      }
    });
  }
  assert.equal(resolutions.length, 1, "the optional port must resolve to the named singleton once");
  assert.ok(
    resolutions[0].parent &&
      ts.isVariableDeclaration(resolutions[0].parent) &&
      ts.isIdentifier(resolutions[0].parent.name),
    "the resolved port must have one stable construction-time binding",
  );
  return resolutions[0].parent.name.text;
}

test("useProfileTabs exposes the typed optional port and resolves the exact named singleton once", () => {
  const portTypeLocal = importedBinding(runtimeFile, "../reactions", "PostReactionSettlementPort", {
    typeOnly: true,
  });
  const singletonLocal = importedBinding(runtimeFile, "../reactions", "postReactionSettlements", {
    typeOnly: false,
  });

  const optionsInterface = exportedInterface(runtimeFile, "UseProfileTabsOptions");
  const settlementsMember = optionsInterface.members.find(
    (member) => ts.isPropertySignature(member) && propertyName(member.name) === "settlements",
  );
  assert.ok(settlementsMember, "UseProfileTabsOptions must expose settlements");
  assert.ok(settlementsMember.questionToken, "settlements must remain optional");
  assert.ok(
    settlementsMember.type &&
      ts.isTypeReferenceNode(settlementsMember.type) &&
      ts.isIdentifier(settlementsMember.type.typeName) &&
      settlementsMember.type.typeName.text === portTypeLocal,
    "settlements must use the imported PostReactionSettlementPort type",
  );

  const optionsParameter = useProfileTabsFunction.parameters[0];
  assert.ok(
    optionsParameter && ts.isIdentifier(optionsParameter.name),
    "expected one options parameter",
  );
  assert.ok(
    optionsParameter.type &&
      ts.isTypeReferenceNode(optionsParameter.type) &&
      ts.isIdentifier(optionsParameter.type.typeName) &&
      optionsParameter.type.typeName.text === "UseProfileTabsOptions",
    "useProfileTabs must consume UseProfileTabsOptions",
  );
  resolvedPortBinding(singletonLocal);
});

test("one construction-time subscriber owns the production membership consumer", () => {
  const subscribeCalls = [];
  for (const root of constructionFunctions(runtimeFile, useProfileTabsFunction)) {
    walkOwnFunctionBody(root, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(unwrap(node.expression)) &&
        unwrap(node.expression).name.text === "subscribe"
      ) {
        subscribeCalls.push({ call: node, root });
      }
    });
  }
  assert.equal(
    subscribeCalls.length,
    1,
    "the persistent subscriber must be installed exactly once during construction",
  );
  const { call: subscribeCall, root: subscribeRoot } = subscribeCalls[0];
  assert.equal(subscribeCall.arguments.length, 1, "subscribe must receive one consumer callback");
  const subscribeExpression = unwrap(subscribeCall.expression);
  const subscribeReceiver = unwrap(subscribeExpression.expression);
  assert.ok(
    ts.isIdentifier(subscribeReceiver),
    "subscribe must use the stable resolved port binding",
  );
  const singletonLocal = importedBinding(runtimeFile, "../reactions", "postReactionSettlements", {
    typeOnly: false,
  });
  const portBinding = resolvedPortBinding(singletonLocal);
  if (subscribeReceiver.text !== portBinding) {
    const portParameter = subscribeRoot.parameters.findIndex(
      (parameter) =>
        ts.isIdentifier(parameter.name) && parameter.name.text === subscribeReceiver.text,
    );
    assert.notEqual(
      portParameter,
      -1,
      "a helper subscriber receiver must be a parameter fed by the default-resolved port",
    );
    const helperBinding = [...functionDeclarations(runtimeFile)].find(
      ([, functionNode]) => functionNode === subscribeRoot,
    )?.[0];
    assert.ok(helperBinding, "a helper subscriber must resolve to one local construction helper");
    const bridgeCalls = [];
    for (const root of constructionFunctions(runtimeFile, useProfileTabsFunction)) {
      walkOwnFunctionBody(root, (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(unwrap(node.expression)) &&
          unwrap(node.expression).text === helperBinding &&
          node.arguments[portParameter] &&
          ts.isIdentifier(unwrap(node.arguments[portParameter])) &&
          unwrap(node.arguments[portParameter]).text === portBinding
        ) {
          bridgeCalls.push(node);
        }
      });
    }
    assert.equal(
      bridgeCalls.length,
      1,
      "the construction helper must receive the default-resolved port exactly once",
    );
  }

  const listener = resolveFunctionExpression(runtimeFile, subscribeCall.arguments[0], "subscribe");
  assert.equal(
    listener.parameters.length,
    1,
    "the consumer callback must receive one settlement event",
  );
  const roots = reachableFunctions(runtimeFile, listener);
  let reachesProfileItems = false;
  for (const root of roots) {
    walk(root.body ?? root, (node) => {
      if (ts.isIdentifier(node) && node.text === "profileItems") reachesProfileItems = true;
    });
  }
  assert.ok(
    reachesProfileItems,
    "the persistent consumer must reach the mounted Profile collection; request-only capture, branch independence, and malformed-tid rejection are proven by behavior tests",
  );
});

test("request and owner state stay instance-local instead of becoming replay storage", () => {
  assert.deepEqual(
    mutatedModuleBindings(runtimeFile),
    [],
    "useProfileTabs must not mutate module-owned replay or membership state",
  );

  const moduleSubscribeCalls = [];
  walk(runtimeFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(unwrap(node.expression)) &&
      unwrap(node.expression).name.text === "subscribe" &&
      closestFunction(node) === null
    ) {
      moduleSubscribeCalls.push(node);
    }
  });
  assert.equal(
    moduleSubscribeCalls.length,
    0,
    "Profile membership must not install a module subscriber",
  );
  assert.doesNotMatch(runtimeSource, /\b(?:sessionStorage|indexedDB|BroadcastChannel)\b/);
  assert.doesNotMatch(runtimeSource, /\b(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(/);
});

test("the public and scope disposal paths own subscriber and account-watcher cleanup", () => {
  const publicApi = returnedObject(useProfileTabsFunction);
  const publicDispose = returnedCallable(runtimeFile, publicApi.object, "dispose");
  const disposeRoots = reachableFunctions(runtimeFile, publicDispose.functionNode);

  const constructionRoots = constructionFunctions(runtimeFile, useProfileTabsFunction);
  const subscribeCalls = [];
  for (const root of constructionRoots) {
    walkOwnFunctionBody(root, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(unwrap(node.expression)) &&
        unwrap(node.expression).name.text === "subscribe"
      ) {
        subscribeCalls.push({ call: node, root });
      }
    });
  }
  assert.equal(subscribeCalls.length, 1, "expected one construction-time subscribe call");
  const unsubscribeBinding = bindingAssignedFromConstructionCall(
    runtimeFile,
    subscribeCalls[0].call,
    subscribeCalls[0].root,
    "unsubscribe",
  );
  assert.ok(
    rootsCallCleanupBinding(disposeRoots, unsubscribeBinding),
    "public dispose must call the persistent subscriber's unsubscribe handle",
  );

  const watchLocal = importedBinding(runtimeFile, "vue", "watch", { typeOnly: false });
  const accountWatchCalls = [];
  for (const root of constructionRoots) {
    walkOwnFunctionBody(root, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(unwrap(node.expression)) &&
        unwrap(node.expression).text === watchLocal
      ) {
        accountWatchCalls.push({ call: node, root });
      }
    });
  }
  assert.equal(accountWatchCalls.length, 1, "expected one construction-time account-token watcher");
  const watchOptions = accountWatchCalls[0].call.arguments[2];
  assert.ok(watchOptions, "the account-token watcher must expose explicit options");
  const watchOptionsObject = resolveObjectLiteral(runtimeFile, watchOptions, "watch options");
  const flushOption = watchOptionsObject.properties.find(
    (property) => propertyName(property.name) === "flush",
  );
  assert.ok(
    flushOption &&
      ts.isPropertyAssignment(flushOption) &&
      ts.isStringLiteral(unwrap(flushOption.initializer)) &&
      unwrap(flushOption.initializer).text === "sync",
    "the account-token ownership fence must use flush: sync",
  );
  const stopAccountWatchBinding = bindingAssignedFromConstructionCall(
    runtimeFile,
    accountWatchCalls[0].call,
    accountWatchCalls[0].root,
    "account watcher stop",
  );
  assert.ok(
    rootsCallCleanupBinding(disposeRoots, stopAccountWatchBinding),
    "public dispose must stop the account-token watcher",
  );

  const onScopeDisposeLocal = importedBinding(runtimeFile, "vue", "onScopeDispose", {
    typeOnly: false,
  });
  const scopeCalls = [];
  for (const root of constructionRoots) {
    walkOwnFunctionBody(root, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(unwrap(node.expression)) &&
        unwrap(node.expression).text === onScopeDisposeLocal
      ) {
        scopeCalls.push(node);
      }
    });
  }
  assert.equal(scopeCalls.length, 1, "expected one construction-time onScopeDispose call");
  assert.ok(scopeCalls[0].arguments[0], "onScopeDispose must receive one cleanup callback");
  const scopeArgument = unwrap(scopeCalls[0].arguments[0]);
  let scopeRoots;
  if (ts.isArrowFunction(scopeArgument) || ts.isFunctionExpression(scopeArgument)) {
    scopeRoots = reachableFunctions(runtimeFile, scopeArgument);
    if (publicApi.binding) {
      let callsReturnedDispose = false;
      walk(scopeArgument.body, (node) => {
        if (!ts.isCallExpression(node)) return;
        const expression = unwrap(node.expression);
        if (
          ts.isPropertyAccessExpression(expression) &&
          expression.name.text === "dispose" &&
          ts.isIdentifier(unwrap(expression.expression)) &&
          unwrap(expression.expression).text === publicApi.binding
        ) {
          callsReturnedDispose = true;
        }
      });
      if (callsReturnedDispose) scopeRoots.push(...disposeRoots);
    }
  } else if (ts.isIdentifier(scopeArgument)) {
    const scopeFunction = functionDeclarations(runtimeFile).get(scopeArgument.text);
    assert.ok(scopeFunction, "onScopeDispose callback must resolve locally");
    scopeRoots = reachableFunctions(runtimeFile, scopeFunction);
  } else if (
    publicApi.binding &&
    ts.isPropertyAccessExpression(scopeArgument) &&
    scopeArgument.name.text === "dispose" &&
    ts.isIdentifier(unwrap(scopeArgument.expression)) &&
    unwrap(scopeArgument.expression).text === publicApi.binding
  ) {
    scopeRoots = [...disposeRoots];
  } else {
    assert.fail("onScopeDispose must receive dispose or an equivalent local cleanup callback");
  }
  assert.ok(
    rootsCallCleanupBinding(scopeRoots, unsubscribeBinding),
    "scope disposal must reach the persistent subscriber cleanup",
  );
  assert.ok(
    rootsCallCleanupBinding(scopeRoots, stopAccountWatchBinding),
    "scope disposal must reach the account-token watcher cleanup",
  );
});

test("ProfileView keeps the production default port path and does not relay settlement state", () => {
  const useTabsImport = namedImportsFrom(profileViewFile, "./useProfileTabs").filter(
    (entry) => entry.imported === "useProfileTabs" && !entry.typeOnly,
  );
  assert.equal(useTabsImport.length, 1, "ProfileView must keep one useProfileTabs import");
  const optionsObject = objectArgumentForCall(profileViewFile, useTabsImport[0].local);
  assert.equal(
    optionsObject.properties.some((property) => propertyName(property.name) === "settlements"),
    false,
    "ProfileView must use the production default singleton instead of injecting a port",
  );

  for (const statement of profileViewFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    assert.doesNotMatch(
      statement.moduleSpecifier.text,
      /(?:^|\/)reactions(?:\/|$)/,
      "ProfileView must not import or relay the reaction channel",
    );
  }
  assert.doesNotMatch(
    profileViewScript,
    /\b(?:PostReactionSettlement(?:Port)?|settlement(?:s|Port)?|reactionSettlement(?:s|Port)?)\b/,
  );
});

test("runtime has no alternate channel, environment branch, persistence, or DTO/SFC relay", () => {
  const reactionImports = runtimeFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      /(?:^|\/)reactions(?:\/|$)/.test(statement.moduleSpecifier.text),
  );
  for (const statement of reactionImports) {
    assert.equal(
      statement.moduleSpecifier.text,
      "../reactions",
      "useProfileTabs may import reactions only through the feature-public barrel",
    );
  }
  assert.doesNotMatch(runtimeSource, /\bcreatePostReactionSettlementChannel\b/);
  assert.doesNotMatch(runtimeSource, /import\s*\([^)]*reactions[^)]*\)/);
  assert.doesNotMatch(
    runtimeSource,
    /\b(?:process\.env|import\.meta\.env|NODE_ENV|VITEST|__TEST__)\b/,
  );
  assert.doesNotMatch(runtimeSource, /\b(?:sessionStorage|indexedDB|BroadcastChannel)\b/);

  const profileItem = exportedInterface(profileTypesFile, "ProfileListItem");
  const forbiddenProfileFields = profileItem.members
    .map((member) => propertyName(member.name))
    .filter((name) =>
      name
        ? /^(?:liked|likeCount|bookmarked|saved|settlements?|reaction(?:State)?)$/i.test(name)
        : false,
    );
  assert.deepEqual(
    forbiddenProfileFields,
    [],
    "ProfileListItem must remain presentation DTO data rather than reaction settlement state",
  );

  for (const [label, sourceFile, source] of [
    ["ProfileView", profileViewFile, profileViewScript],
    ["ProfileCollectionList", collectionFile, collectionScript],
  ]) {
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      assert.doesNotMatch(
        statement.moduleSpecifier.text,
        /(?:^|\/)reactions(?:\/|$)/,
        `${label} must not import the reaction channel`,
      );
    }
    assert.doesNotMatch(
      source,
      /\b(?:PostReactionSettlement(?:Port)?|settlement(?:s|Port)?|reactionSettlement(?:s|Port)?)\b/,
      `${label} must not gain a settlement prop or type relay`,
    );
  }
});
