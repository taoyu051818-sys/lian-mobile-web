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

test("AppShell keeps bottom tabs on the floating chrome lane and re-shows chrome on tab change", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /useFloatingChromeController\(\{ initialPhase: "visible" \}\)/);
  assert.match(src, /setRegion\("bottom", \{ slot: "tabs" \}\)/);
  assert.match(src, /function handleViewChange\(key: string\) \{[\s\S]*appBottomChrome\.show\(\);[\s\S]*emit\("view-change", key\);[\s\S]*\}/);
  assert.match(src, /data-floating-state="bottomChromeState"/);
  assert.match(src, /data-floating-progress="bottomChromeState === 'progress' \? chromeProgress : undefined"/);
});

test("ShellChrome exposes floating-state data attributes for transition-safe tab chrome", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /const floatingState = computed\(/);
  assert.match(src, /props\.chromePhase === "exiting"/);
  assert.match(src, /props\.chromePhase === "entering"/);
  assert.match(src, /props\.chromePhase === "progress"/);
  assert.match(src, /:data-floating-state="floatingState"/);
  assert.match(src, /:disabled="btn\.disabled \|\| isTransitioning"/);
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
