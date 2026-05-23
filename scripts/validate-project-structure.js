import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "index.html",
  "src/app.ts",
  "src/entry-client.ts",
  "src/entry-server.ts",
  "src/App.vue",
  "src/styles/main.css",
  "src/styles/lian-tokens.css",
  "src/vite-env.d.ts",
  "src/ui/index.ts",
  "src/ui/primitives.css",
  "src/ui/BottomTabBar.vue",
  "src/ui/GlassPanel.vue",
  "src/ui/IdentityBadge.vue",
  "src/ui/InlineError.vue",
  "src/ui/LianButton.vue",
  "src/ui/LocationChip.vue",
  "src/ui/Sheet.vue",
  "src/ui/TagChip.vue",
  "src/ui/Toast.vue",
  "src/ui/TopBar.vue",
  "src/ui/TrustBadge.vue",
  "src/ui/TypeChip.vue",
  "src/ui/feedback/ToastHost.vue",
  "src/ui/feedback/toast-state.ts",
  "src/ui/feedback/useToast.ts",
  "vite.config.ts",
  "tsconfig.json",
  "docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md",
  "docs/architecture/0001-vue3-vite-typescript-ui-entry.md",
  "scripts/guard-unsafe-dom-sinks.js",
  "scripts/guard-public-runtime-exposure.js",
  "scripts/test-guard-public-runtime-exposure.js",
  "package.json",
  "README.md",
];

const jsonFiles = ["package.json", "tsconfig.json"];

const frontendJsFiles = [
  "scripts/guard-unsafe-dom-sinks.js",
  "scripts/guard-public-runtime-exposure.js",
  "scripts/test-guard-public-runtime-exposure.js",
];

const backendOnlyPaths = [
  "server.js",
  "scripts/test-routes.js",
  "scripts/prepare-backend-repo-export.js",
  "test/audience-regression.test.mjs",
];

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

async function checkFileExists(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    ok(file);
  } catch {
    fail(file, "文件不存在");
  }
}

async function checkJsonValid(file) {
  const fullPath = path.join(rootDir, file);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    JSON.parse(raw);
    ok(`${file} (JSON valid)`);
  } catch (error) {
    fail(`${file} (JSON)`, error.message);
  }
}

async function checkPathExcluded(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    fail(file, "backend-only 路径仍存在于 frontend repo");
  } catch {
    ok(`${file} excluded`);
  }
}

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  try {
    execFileSync(process.execPath, ["--check", fullPath], { stdio: "pipe" });
    ok(`${file} (语法正确)`);
  } catch {
    fail(`${file} (语法检查)`, "node --check 失败");
  }
}

async function checkPublicDir() {
  const publicDir = path.join(rootDir, "public");
  try {
    const entries = await fs.readdir(publicDir);
    console.log(`  ℹ public/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("public/ 目录", "目录不存在");
  }
}

async function checkSrcDir() {
  const srcDir = path.join(rootDir, "src");
  try {
    const entries = await fs.readdir(srcDir);
    console.log(`  ℹ src/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("src/ 目录", "目录不存在");
  }
}

console.log("\n═══ LIAN frontend repo structure check ═══\n");

console.log("▶ Frontend required files");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\n▶ JSON config check");
for (const file of jsonFiles) {
  await checkJsonValid(file);
}

console.log("\n▶ Frontend JS syntax check");
for (const file of frontendJsFiles) {
  checkSyntax(file);
}

console.log("\n▶ Backend-only exclusions");
for (const file of backendOnlyPaths) {
  await checkPathExcluded(file);
}

console.log("\n▶ Directory structure");
await checkPublicDir();
await checkSrcDir();

// ═══ Architecture boundary guards ═══

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readTextFile(p) {
  return fs.readFile(p, "utf8");
}

async function collectSourceFiles(dir, extensions) {
  const results = [];
  async function walk(d) {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

function extractImports(content) {
  const imports = [];
  const importRe = /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  let match;
  while ((match = importRe.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImportPath(importSpecifier, fromFile) {
  if (!importSpecifier.startsWith(".")) return null;
  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, importSpecifier);
  const normalized = normalizePath(resolved);
  if (normalized.match(/\.(ts|vue|js|tsx|jsx|mjs)$/)) return resolved;
  const candidates = [
    resolved + ".ts",
    resolved + ".vue",
    resolved + ".js",
    resolved + ".tsx",
    resolved + ".jsx",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.js"),
  ];
  return candidates[0];
}

function getFeatureName(filePath) {
  const rel = normalizePath(path.relative(rootDir, filePath));
  const prefix = "src/features/";
  if (!rel.startsWith(prefix)) return null;
  const rest = rel.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  return slashIdx === -1 ? null : rest.slice(0, slashIdx);
}

async function parseBarrelReExports(barrelPath) {
  try {
    const content = await readTextFile(barrelPath);
    const reExportRe = /export\s+.*\s+from\s+["']\.\/([^"']+)["']/g;
    const reExportDefaultRe =
      /export\s*\{\s*default\s+as\s+\w+\s*\}\s*from\s+["']\.\/([^"']+)["']/g;
    const files = new Set();
    let m;
    while ((m = reExportRe.exec(content)) !== null) {
      const target = m[1];
      const barrelDir = path.dirname(barrelPath);
      const resolved = path.resolve(barrelDir, target);
      const candidates = [
        resolved + ".ts",
        resolved + ".vue",
        resolved + ".js",
        path.join(resolved, "index.ts"),
      ];
      for (const c of candidates) {
        files.add(normalizePath(c));
      }
    }
    while ((m = reExportDefaultRe.exec(content)) !== null) {
      const target = m[1];
      const barrelDir = path.dirname(barrelPath);
      const resolved = path.resolve(barrelDir, target);
      const candidates = [
        resolved + ".ts",
        resolved + ".vue",
        resolved + ".js",
        path.join(resolved, "index.ts"),
      ];
      for (const c of candidates) {
        files.add(normalizePath(c));
      }
    }
    return files;
  } catch {
    return new Set();
  }
}

async function checkNoViewsDirectory() {
  const viewsDir = path.join(rootDir, "src", "views");
  if (await fileExists(viewsDir)) {
    fail(
      "src/views/ must not exist",
      "src/views/ directory detected — views were migrated to src/features/",
    );
  } else {
    ok("src/views/ does not exist");
  }
}

async function checkUiNoFeatureImports() {
  const uiDir = path.join(rootDir, "src", "ui");
  const files = await collectSourceFiles(uiDir, [".ts", ".vue"]);
  let violations = 0;
  for (const file of files) {
    const content = await readTextFile(file);
    const imports = extractImports(content);
    for (const imp of imports) {
      const resolved = resolveImportPath(imp, file);
      if (!resolved) continue;
      const resolvedNorm = normalizePath(resolved);
      const featuresPrefix = normalizePath(path.join(rootDir, "src", "features")) + "/";
      if (resolvedNorm.startsWith(featuresPrefix)) {
        const relFile = normalizePath(path.relative(rootDir, file));
        fail("ui → features boundary", `${relFile} imports ${imp}`);
        violations++;
      }
    }
  }
  if (violations === 0) ok("src/ui/** has no imports from src/features/**");
}

async function checkDomainPurity() {
  const domainDir = path.join(rootDir, "src", "domain");
  const files = await collectSourceFiles(domainDir, [".ts", ".vue"]);
  const forbiddenPrefixes = [
    normalizePath(path.join(rootDir, "src", "api")) + "/",
    normalizePath(path.join(rootDir, "src", "ui")) + "/",
    normalizePath(path.join(rootDir, "src", "features")) + "/",
  ];
  let violations = 0;
  for (const file of files) {
    const content = await readTextFile(file);
    const imports = extractImports(content);
    for (const imp of imports) {
      if (imp === "vue" || imp.startsWith("vue/")) {
        const relFile = normalizePath(path.relative(rootDir, file));
        fail("domain purity", `${relFile} imports Vue (${imp})`);
        violations++;
        continue;
      }
      const resolved = resolveImportPath(imp, file);
      if (!resolved) continue;
      const resolvedNorm = normalizePath(resolved);
      for (const forbidden of forbiddenPrefixes) {
        if (resolvedNorm.startsWith(forbidden)) {
          const relFile = normalizePath(path.relative(rootDir, file));
          const layer = forbidden.endsWith("api/")
            ? "api"
            : forbidden.endsWith("ui/")
              ? "ui"
              : "features";
          fail("domain purity", `${relFile} imports from ${layer} (${imp})`);
          violations++;
          break;
        }
      }
    }
  }
  if (violations === 0) ok("src/domain/** is pure (no Vue, API, UI, or feature imports)");
}

async function checkPlatformNoFeatureImports() {
  const platformDir = path.join(rootDir, "src", "platform");
  const files = await collectSourceFiles(platformDir, [".ts", ".vue"]);
  const forbiddenPrefixes = [
    normalizePath(path.join(rootDir, "src", "features")) + "/",
    normalizePath(path.join(rootDir, "src", "pages")) + "/",
  ];
  let violations = 0;
  for (const file of files) {
    const content = await readTextFile(file);
    const imports = extractImports(content);
    for (const imp of imports) {
      const resolved = resolveImportPath(imp, file);
      if (!resolved) continue;
      const resolvedNorm = normalizePath(resolved);
      for (const forbidden of forbiddenPrefixes) {
        if (resolvedNorm.startsWith(forbidden)) {
          const relFile = normalizePath(path.relative(rootDir, file));
          const layer = forbidden.endsWith("features/") ? "features" : "pages";
          fail("platform boundary", `${relFile} imports from ${layer} (${imp})`);
          violations++;
          break;
        }
      }
    }
  }
  if (violations === 0) ok("src/platform/** has no feature/page component imports");
}

async function checkFeatureCrossImports() {
  const featuresDir = path.join(rootDir, "src", "features");
  const files = await collectSourceFiles(featuresDir, [".ts", ".vue"]);

  const featureBarrelPaths = new Map();
  const featureBarrelReExports = new Map();
  const featureDirs = [];
  try {
    const entries = await fs.readdir(featuresDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        featureDirs.push(entry.name);
        const barrelPath = path.join(featuresDir, entry.name, "index.ts");
        if (await fileExists(barrelPath)) {
          featureBarrelPaths.set(entry.name, barrelPath);
          featureBarrelReExports.set(entry.name, await parseBarrelReExports(barrelPath));
        }
      }
    }
  } catch {
    return;
  }

  let violations = 0;
  const featuresMissingBarrel = new Set();
  for (const file of files) {
    const sourceFeature = getFeatureName(file);
    if (!sourceFeature) continue;

    const content = await readTextFile(file);
    const imports = extractImports(content);

    for (const imp of imports) {
      const resolved = resolveImportPath(imp, file);
      if (!resolved) continue;
      const resolvedNorm = normalizePath(resolved);
      const featuresPrefix = normalizePath(path.join(rootDir, "src", "features")) + "/";
      if (!resolvedNorm.startsWith(featuresPrefix)) continue;

      const targetFeature = getFeatureName(resolved);
      if (!targetFeature || targetFeature === sourceFeature) continue;

      const hasBarrel = featureBarrelPaths.has(targetFeature);
      const barrelNorm = hasBarrel ? normalizePath(featureBarrelPaths.get(targetFeature)) : null;
      const isBarrelImport = resolvedNorm === barrelNorm;
      const reExports = featureBarrelReExports.get(targetFeature) || new Set();
      const isReExported = reExports.has(resolvedNorm);

      if (!hasBarrel) {
        featuresMissingBarrel.add(targetFeature);
        const relFile = normalizePath(path.relative(rootDir, file));
        fail(
          "feature cross-import",
          `${relFile} imports ${targetFeature} but ${targetFeature}/index.ts is missing — every feature must declare a public surface`,
        );
        violations++;
      } else if (!isBarrelImport && !isReExported) {
        const relFile = normalizePath(path.relative(rootDir, file));
        fail(
          "feature cross-import",
          `${relFile} imports private ${targetFeature} code (${imp}) — use barrel or re-exported symbol`,
        );
        violations++;
      }
    }
  }
  if (violations === 0) ok("feature-to-feature imports use public entrypoints");
}

console.log("\n═══ Architecture boundary guards ═══\n");

console.log("▶ src/views/ ban");
await checkNoViewsDirectory();

console.log("\n▶ src/ui → src/features boundary");
await checkUiNoFeatureImports();

console.log("\n▶ src/domain purity");
await checkDomainPurity();

console.log("\n▶ src/platform → features/pages boundary");
await checkPlatformNoFeatureImports();

console.log("\n▶ Feature cross-import boundaries");
await checkFeatureCrossImports();

console.log(`\n═══ Result: ${passed} passed, ${failed} failed ═══\n`);

if (failed > 0) process.exit(1);
