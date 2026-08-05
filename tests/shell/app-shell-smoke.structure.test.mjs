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
  assert.match(
    src,
    /<AppViewHost[\s\S]*?:active-view-key="activeViewKey"[\s\S]*?@chrome="onChrome"[\s\S]*?@close="setActiveView\('profile'\)"[\s\S]*?\/>/,
  );
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

test("ShellChrome keeps detail teleport targets stable outside animated transitions", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /v-if="rendersStableTopTarget"[\s\S]*id="lian-shell-top-slot"/);
  assert.match(src, /v-if="rendersStableBottomTarget"[\s\S]*id="lian-shell-bottom-slot"/);
  assert.match(
    src,
    /<Transition v-if="rendersRegularChrome" :name="`shell-slot-\$\{region\}`" mode="out-in">/,
  );
});

test("DetailSurface owns the active detail overlay", () => {
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /<Teleport to="body">/);
  assert.match(src, /v-if="detail\.detailOpen\.value"/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /@click\.self="detail\.close\('user-tap'\)"/);
  assert.match(src, /<PostDetailPanel/);
});
