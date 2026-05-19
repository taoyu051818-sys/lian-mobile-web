import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("App wires AppShell tab changes through active view state", () => {
  const src = read("src/App.vue");
  assert.match(src, /const tabs = appViews\.map\(\(view\) => \(\{/);
  assert.match(src, /<AppShell[\s\S]*@view-change="handleViewChange"/);
  assert.match(src, /:layout-mode="getShellLayoutMode\(activeViewKey\)"/);
  assert.match(src, /<AppViewHost :active-view-key="activeViewKey" @chrome="onChrome" \/>/);
});

test("AppShell applies page chrome spec via useShellChrome", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /applyPageChrome/);
  assert.match(src, /ensureBottomSlot\("tabs"\)/);
  assert.match(src, /function handleChrome\(spec: PageChromeSpec\)/);
});

test("ShellChrome uses isVisible for data-visible attribute", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /:data-visible="isVisible"/);
  assert.doesNotMatch(src, /chromePhase/);
});

test("ShellChrome renders detail teleport targets outside animated transitions", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /v-if="isReplyDockSlot"[\s\S]*id="lian-shell-bottom-slot"/);
  assert.match(src, /v-else-if="isDetailTopbarSlot"[\s\S]*id="lian-shell-top-slot"/);
  assert.match(src, /<Transition v-else :name="`shell-slot-\$\{region\}`" mode="out-in">/);
});

test("DetailSheet owns overlay close behavior through body teleport, backdrop close, and Escape cleanup", () => {
  const src = read("src/shell/DetailSheet.vue");
  assert.match(src, /<Teleport to="body">/);
  assert.match(src, /v-if="state\.open"/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /class="detail-sheet__backdrop" @click="handleClose"/);
  assert.match(src, /event\.key === "Escape" && state\.open/);
  assert.match(src, /document\.removeEventListener\("keydown", handleKeydown\)/);
  assert.match(src, /<slot :kind="state\.kind" :payload="state\.payload" \/>/);
});
