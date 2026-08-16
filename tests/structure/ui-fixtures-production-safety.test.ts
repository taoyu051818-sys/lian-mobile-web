/**
 * Structural guarantees that the offline fixture runtime cannot reach users.
 *
 * The runtime intercepts every `/api/**` call, so a build that shipped it with
 * the flag reachable would serve fake data in production. These checks are
 * static (source + built bundle) rather than behavioural, because the failure
 * they guard against is a build/config mistake, not a logic bug.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const FIXTURE_DIR = join(ROOT, "src", "platform", "ui-fixtures");

function fixtureSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? fixtureSourceFiles(path) : [path];
  });
}

describe("fixture runtime source guards", () => {
  it("gates every entry point on both import.meta.env.DEV and VITE_UI_FIXTURES", () => {
    const env = readFileSync(join(FIXTURE_DIR, "env.ts"), "utf8");

    expect(env).toContain("import.meta.env.DEV");
    expect(env).toContain("VITE_UI_FIXTURES");
    // DEV must be the first term so it short-circuits before any flag parsing.
    expect(env.indexOf("import.meta.env.DEV")).toBeLessThan(env.indexOf("VITE_UI_FIXTURES"));

    // The public entry needs the literal inline check, without which Rollup
    // cannot prove the branch dead and ships the whole runtime.
    const entry = readFileSync(join(FIXTURE_DIR, "index.ts"), "utf8");
    expect(entry).toMatch(/if\s*\(!import\.meta\.env\.DEV\)\s*return false/);
  });

  it("never imports feature or app code into the platform fixture subtree", () => {
    const offenders: string[] = [];
    for (const file of fixtureSourceFiles(FIXTURE_DIR)) {
      const source = readFileSync(file, "utf8");
      // `src/platform` must not depend on features/app/shell (structure rule).
      if (/from\s+["'].*(src\/)?(features|app|shell)\//.test(source)) {
        offenders.push(file.replace(ROOT, ""));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps fixture data out of the production API layer", () => {
    const apiDir = join(ROOT, "src", "api");
    const offenders = readdirSync(apiDir)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => readFileSync(join(apiDir, name), "utf8").includes("ui-fixtures"));

    // src/api must stay unaware of fixtures; interception happens at transport.
    expect(offenders).toEqual([]);
  });

  it("uses no external image or asset URLs anywhere in the fixture corpus", () => {
    const offenders: string[] = [];
    for (const file of fixtureSourceFiles(FIXTURE_DIR)) {
      const source = readFileSync(file, "utf8");
      const matches = source.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
      for (const url of matches) {
        // Not fetched assets: the transport's same-origin fallback base, and
        // the SVG XML namespace required by inline local placeholder SVGs.
        const allowed = url.includes("localhost") || url.startsWith("http://www.w3.org/");
        if (!allowed) offenders.push(`${file.replace(ROOT, "")}: ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("production bundle", () => {
  it("strips the fixture runtime from a production build", () => {
    const outDir = join(ROOT, "dist-fixture-guard");
    rmSync(outDir, { recursive: true, force: true });

    try {
      execFileSync(
        "npx",
        [
          "vite",
          "build",
          "--outDir",
          "dist-fixture-guard",
          "--mode",
          "production",
          "--logLevel",
          "error",
        ],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            // Vitest runs with NODE_ENV=test, and Vite derives `import.meta.env.DEV`
            // from NODE_ENV — inheriting it would build a DEV bundle and make this
            // assertion test the wrong thing.
            NODE_ENV: "production",
            // Hostile case: flags ON at build time. The runtime must still be
            // eliminated purely because this is a production build.
            VITE_UI_FIXTURES: "true",
            VITE_UI_FIXTURE_MODE: "offline",
          },
          stdio: "pipe",
        },
      );

      const assetsDir = join(outDir, "assets");
      expect(existsSync(assetsDir)).toBe(true);

      const bundle = readdirSync(assetsDir)
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFileSync(join(assetsDir, name), "utf8"))
        .join("\n");

      // Markers unique to the fixture runtime and its corpus.
      expect(bundle).not.toContain("UNMAPPED_FIXTURE_REQUEST");
      expect(bundle).not.toContain("BLOCKED_EXTERNAL_REQUEST");
      expect(bundle).not.toContain("lian.fixture.toolbar.open");
      expect(bundle).not.toContain("离线 Fixture 未映射该请求");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 300_000);
});
