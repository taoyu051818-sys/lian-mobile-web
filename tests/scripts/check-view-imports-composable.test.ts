import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Tests for scripts/check-view-imports-composable.mjs (issue #758).
//
// Strategy: invoke the real script via `node` against a fixture repo built
// in a temp dir, with LIAN_VIEW_BOUNDARY_ROOT pointing at the fixture so the
// script scans the fixture instead of the actual repo. Each fixture lays
// out src/features/<name>/<X>.vue and a scripts/<allowlist>.txt as needed.

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const guardScript = path.join(repoRoot, "scripts", "check-view-imports-composable.mjs");

let fixtureRoot: string;

beforeEach(async () => {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lian-view-boundary-"));
});

afterEach(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

async function writeFile(relativePath: string, content: string): Promise<void> {
  const absolute = path.join(fixtureRoot, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
}

interface RunResult {
  status: "pass" | "fail";
  stdout: string;
  stderr: string;
  combined: string;
}

async function runGuard(): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [guardScript], {
      env: { ...process.env, LIAN_VIEW_BOUNDARY_ROOT: fixtureRoot },
    });
    return { status: "pass", stdout, stderr, combined: `${stdout}${stderr}` };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const stdout = e.stdout ?? "";
    const stderr = e.stderr ?? "";
    return { status: "fail", stdout, stderr, combined: `${stdout}${stderr}` };
  }
}

describe("check-view-imports-composable", () => {
  it("fails when a non-allowlisted view imports directly from src/api", async () => {
    await writeFile(
      "src/features/widget/WidgetView.vue",
      `<script setup lang="ts">
import { fetchWidget } from "../../api/widget";
const _ = fetchWidget;
</script>
<template><div /></template>
`,
    );
    // Allowlist file deliberately absent.

    const result = await runGuard();

    expect(result.status).toBe("fail");
    expect(result.combined).toMatch(/src\/features\/widget\/WidgetView\.vue:\d+/);
    expect(result.combined).toMatch(/\.\.\/\.\.\/api\/widget/);
    expect(result.combined).toMatch(/new violations detected/i);
  });

  it("passes with a [warn] line when the offender is on the allowlist", async () => {
    await writeFile(
      "src/features/legacy/LegacyView.vue",
      `<script setup lang="ts">
import { logoutAuth } from "../../api/profile";
const _ = logoutAuth;
</script>
<template><div /></template>
`,
    );
    await writeFile(
      "scripts/check-view-imports-composable.allow.txt",
      "src/features/legacy/LegacyView.vue\n",
    );

    const result = await runGuard();

    expect(result.status).toBe("pass");
    expect(result.combined).toMatch(/\[warn\]\s+src\/features\/legacy\/LegacyView\.vue:\d+/);
    expect(result.combined).toMatch(/0 violation\(s\)/);
    expect(result.combined).toMatch(/1 allowlisted warning\(s\)/);
  });

  it("passes silently when a view imports only from a composable", async () => {
    await writeFile(
      "src/features/clean/CleanView.vue",
      `<script setup lang="ts">
import { useClean } from "./useClean";
const _ = useClean;
</script>
<template><div /></template>
`,
    );
    await writeFile(
      "src/features/clean/useClean.ts",
      "export function useClean() { return {}; }\n",
    );

    const result = await runGuard();

    expect(result.status).toBe("pass");
    expect(result.combined).not.toMatch(/new violations detected/i);
    expect(result.combined).not.toMatch(/\[warn\]/);
    expect(result.combined).toMatch(/0 violation\(s\), 0 allowlisted warning\(s\)/);
  });

  it("flags @/api and src/api alias imports as violations too", async () => {
    await writeFile(
      "src/features/alias/AliasView.vue",
      `<script setup lang="ts">
import { fetchA } from "@/api/a";
import { fetchB } from "src/api/b";
import { fetchC } from "~/api/c";
const _ = [fetchA, fetchB, fetchC];
</script>
<template><div /></template>
`,
    );

    const result = await runGuard();

    expect(result.status).toBe("fail");
    expect(result.combined).toMatch(/@\/api\/a/);
    expect(result.combined).toMatch(/src\/api\/b/);
    expect(result.combined).toMatch(/~\/api\/c/);
  });
});
