import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- Map uses full-bleed layout mode ---

test("view-types.ts assigns full-bleed layout mode to map", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /map:\s*"full-bleed"/);
});

// --- ContentFrame full-bleed CSS ---

test("content-frame.css full-bleed modifier removes max-width constraint", () => {
  const css = read("src/shell/content-frame.css");
  const fullBleed = css.slice(css.indexOf(".content-frame--full-bleed"));
  assert.match(fullBleed, /max-width:\s*none/);
  assert.match(fullBleed, /width:\s*100%/);
});

test("main.css full-bleed grid removes border-radius on map stage wrapper", () => {
  const css = read("src/styles/main.css");
  assert.match(
    css,
    /vue-shell__grid--full-bleed[\s\S]*?map-view__stage-wrap[\s\S]*?border-radius:\s*0/,
  );
});

// --- Map chrome ---

test("useMapChrome does not depend on shell chrome (declarative pattern)", () => {
  const src = read("src/features/map/useMapChrome.ts");
  assert.doesNotMatch(src, /useShellChrome/);
});

test("useMapChrome exports composable with filter state and toggle", () => {
  const src = read("src/features/map/useMapChrome.ts");
  assert.match(src, /export function useMapChrome/);
  assert.match(src, /filterActive/);
  assert.match(src, /toggleFilter/);
  assert.match(src, /MAP_FILTERS/);
});

test("MapView delegates post detail rendering to the global feed detail host", () => {
  const src = read("src/features/map/MapView.vue");
  assert.doesNotMatch(src, /PostDetailPanel/);
  assert.match(src, /detail\.open\(Number\(place\.tid\), "card"\)/);
});

// --- MapCanvas Konva integration ---

test("MapCanvas.vue owns the Konva stage", () => {
  const src = read("src/features/map/MapCanvas.vue");
  assert.match(src, /from "vue-konva"/);
  assert.match(src, /<Stage/);
  assert.match(src, /data-testid="konva-map-stage"/);
  assert.doesNotMatch(src, /leaflet/i);
});

test("legacy Leaflet runtime and public editor are retired", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies.leaflet, undefined);
  assert.equal(pkg.devDependencies?.["@types/leaflet"], undefined);
  assert.equal(pkg.dependencies.konva, "^10.3.2");
  assert.equal(pkg.dependencies["vue-konva"], "^3.4.0");
  for (const rel of [
    "src/platform/leaflet.ts",
    "src/features/map/MapLeafletView.vue",
    "public/tools/map-v2-editor.html",
    "public/tools/map-v2-editor.js",
    "public/tools/map-georef.html",
    "public/tools/map-coastline-align.html",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, rel)), false, `${rel} must stay retired`);
  }
});
