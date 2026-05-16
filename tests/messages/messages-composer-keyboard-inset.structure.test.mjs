import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const viewSource = read("src/features/messages/MessagesView.vue");
const threadSource = read("src/features/messages/ChannelThread.vue");

// --- MessagesView imports and activates useVisualViewport ---

test("MessagesView imports useVisualViewport composable", () => {
  assert.match(
    viewSource,
    /import\s*\{[^}]*useVisualViewport[^}]*\}\s*from\s*"[\./]*composables\/useVisualViewport"/,
  );
});

test("MessagesView calls useVisualViewport to activate keyboard-inset CSS token", () => {
  assert.match(viewSource, /useVisualViewport\(\)/);
});

// --- Composer positioned above keyboard ---

test("MessagesView composer bottom includes keyboard-inset-bottom token", () => {
  assert.match(viewSource, /--keyboard-inset-bottom/);
});

test("MessagesView composer bottom calc includes keyboard inset", () => {
  const composerMatch = viewSource.match(
    /\.messages-view__chrome-composer\s*\{[^}]*bottom:\s*([^;]+)/,
  );
  assert.ok(composerMatch, "composer should have bottom property");
  const bottom = composerMatch[1];
  assert.match(bottom, /--keyboard-inset-bottom/);
  assert.match(bottom, /--floating-bar/);
});

// --- Message list padding accounts for raised composer ---

test("MessagesView padding-bottom includes keyboard-inset-bottom for scroll clearance", () => {
  const viewMatch = viewSource.match(/\.messages-view\s*\{[^}]*padding-bottom:\s*([^;]+)/);
  assert.ok(viewMatch, "messages-view should have padding-bottom");
  assert.match(viewMatch[1], /--keyboard-inset-bottom/);
});

test("ChannelThread pane padding includes keyboard-inset-bottom", () => {
  assert.match(threadSource, /--keyboard-inset-bottom/);
});

// --- Preserved existing contracts ---

test("MessagesView preserves safe-area-inset-bottom in padding", () => {
  assert.match(viewSource, /env\(safe-area-inset-bottom\)/);
});

test("MessagesView preserves safe-area-inset-bottom in view padding", () => {
  assert.match(viewSource, /env\(safe-area-inset-bottom\)/);
});

test("ChannelThread preserves safe-area-inset-bottom in pane padding", () => {
  assert.match(threadSource, /env\(safe-area-inset-bottom\)/);
});

// --- Pure JS: keyboard inset defaults to 0 when keyboard closed ---

test("keyboard-inset-bottom defaults to 0px in CSS custom property", () => {
  const tokensSource = read("src/styles/lian-tokens.css");
  assert.match(tokensSource, /--keyboard-inset-bottom:\s*0px/);
});
