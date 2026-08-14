import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function commerceRuntimeSource() {
  const files = [
    "src/api/commerce.ts",
    "src/app/commerce-route.ts",
    "src/config/brand/commerce.ts",
    "src/features/commerce/CommerceView.vue",
    "src/features/commerce/useCommerceStoreRead.ts",
    "src/features/commerce/catalog/CommerceStoreListPage.vue",
    "src/features/commerce/catalog/CommerceStoreCard.vue",
    "src/features/commerce/store/CommerceStoreDetailPage.vue",
    "src/types/commerce.ts",
  ];
  return files.map((file) => read(file)).join("\n");
}

test("commerce is a lazy secret content view and never a sixth bottom tab", () => {
  const viewTypes = read("src/app/view-types.ts");
  const host = read("src/app/AppViewHost.vue");
  const appViews = viewTypes.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(appViews, "appViews array must remain explicit");
  assert.match(viewTypes, /\| "commerce"/);
  assert.match(viewTypes, /commerce:\s*"content"/);
  assert.doesNotMatch(appViews.groups.body, /key:\s*"commerce"/);
  assert.match(host, /commerce:\s*asyncView\(\(\)\s*=>\s*import\("\.\.\/features\/commerce"\)/);
});

test("commerce hashes delegate to the strict raw parser before legacy trimming", () => {
  const deepLink = read("src/app/deepLink.ts");
  const route = read("src/app/commerce-route.ts");
  assert.match(deepLink, /if \(parseCommerceRoute\(hash\)\) return \{ view: "commerce" \}/);
  assert.ok(
    deepLink.indexOf("parseCommerceRoute(hash)") < deepLink.indexOf("const trimmed = hash.trim()"),
    "commerce parsing must happen before legacy trimming",
  );
  assert.match(route, /if \(hash === "#\/commerce"\)/);
  assert.match(route, /\^\[1-9\]\[0-9\]\{0,9\}\$/);
  assert.doesNotMatch(route, /decodeURIComponent|parseInt|Number\(/);
});

test("the browser transport is direct same-origin fetch with no API-base or private-platform escape", () => {
  const api = read("src/api/commerce.ts");
  const allCommerce = commerceRuntimeSource();
  assert.match(api, /fetch\(path,\s*\{/);
  assert.match(api, /"\/api\/commerce\/stores"/);
  assert.match(api, /`\/api\/commerce\/stores\/\$\{storeId\}`/);
  assert.match(api, /credentials:\s*"same-origin"/);
  assert.match(api, /cache:\s*"no-store"/);
  assert.match(api, /redirect:\s*"error"/);
  assert.match(api, /signal,/);
  assert.doesNotMatch(api, /from ["']\.\/http["']/);
  assert.doesNotMatch(api, /buildApiUrl|LIAN_API_BASE_URL|x-client-id/i);
  assert.doesNotMatch(allCommerce, /https?:\/\//i);
  assert.doesNotMatch(allCommerce, /\/internal\//i);
  assert.doesNotMatch(allCommerce, /LAPlatform|legacy fallback|service credential/i);
});

test("success adoption is exact, correlated, no-store, and schema pinned", () => {
  const api = read("src/api/commerce.ts");
  assert.match(api, /response\.status !== 200/);
  assert.match(api, /content-type/);
  assert.match(api, /cache-control/);
  assert.match(api, /x-request-id/);
  assert.match(api, /UUID_V4_PATTERN/);
  assert.match(api, /value\.requestId !== responseRequestId/);
  assert.match(api, /value\.schemaVersion !== "1\.0\.0"/);
  assert.match(api, /assertExactKeys/);
  assert.match(api, /items must be dense/);
  assert.match(api, /value\.logoAssetRef !== null/);
});

test("read ownership has one 12-second abort boundary and generation-plus-route settlement", () => {
  const owner = read("src/features/commerce/useCommerceStoreRead.ts");
  assert.match(owner, /const DEFAULT_TIMEOUT_MS = 12_000/);
  assert.match(owner, /activeController\?\.abort\(\)/);
  assert.match(owner, /generation\.value \+= 1/);
  assert.match(owner, /generation\.value !== requestGeneration/);
  assert.match(owner, /activeRoute\.value\?\.name === "store"/);
  assert.match(owner, /return loadRoute\(activeRoute\.value\)/);
  assert.match(owner, /status\.value = "closed"/);
});

test("CommerceView deduplicates paired history events but explicit retry stays owned by the reader", () => {
  const view = read("src/features/commerce/CommerceView.vue");
  assert.match(view, /window\.addEventListener\("hashchange", syncRouteFromLocation\)/);
  assert.match(view, /window\.addEventListener\("popstate", syncRouteFromLocation\)/);
  assert.match(view, /if \(hash === observedHash\) return/);
  assert.match(view, /@retry="reader\.retry"/);
  assert.match(view, /reader\.dispose\(\)/);
});

test("closed, empty, not-found, and error surfaces reuse the shared UI vocabulary", () => {
  const shell = read("src/shell/AppShell.vue");
  const view = read("src/features/commerce/CommerceView.vue");
  const list = read("src/features/commerce/catalog/CommerceStoreListPage.vue");
  const detail = read("src/features/commerce/store/CommerceStoreDetailPage.vue");
  assert.match(shell, /<PageSurface\s+as="div"\s+:padded="false">/);
  assert.match(view, /<EmptyState/);
  assert.match(list, /<EmptyState/);
  assert.match(list, /<InlineError/);
  assert.match(detail, /<EmptyState/);
  assert.match(detail, /<InlineError/);
});

test("guest and authenticated Profile states share one loading-safe real commerce anchor", () => {
  const profile = read("src/features/profile/ProfileView.vue");
  assert.match(profile, /VITE_COMMERCE_CATALOG_VISIBLE === "true"/);
  assert.match(profile, /v-if="commerceEntryVisible && !loading"/);
  assert.match(profile, /<a class="profile-view__commerce-link" href="#\/commerce">/);
  assert.ok(
    profile.indexOf("profile-view__commerce-entry") >
      profile.indexOf('<section v-else class="profile-view__guest">'),
    "the shared anchor must sit after both authenticated and guest branches",
  );
  assert.match(read(".env.example"), /^VITE_COMMERCE_CATALOG_VISIBLE=false$/m);
});

test("null logo references render only local CSS placeholders and no browser image element", () => {
  const card = read("src/features/commerce/catalog/CommerceStoreCard.vue");
  const detail = read("src/features/commerce/store/CommerceStoreDetailPage.vue");
  const combined = `${card}\n${detail}`;
  assert.match(combined, /data-testid="commerce-logo-placeholder"/);
  assert.match(combined, /commerce-store-card__logo/);
  assert.match(combined, /commerce-detail-page__logo/);
  assert.doesNotMatch(combined, /<img\b|<picture\b|background-image|url\(/i);
});
