import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/frontend-auto-build.yml", import.meta.url),
  "utf8",
);
const frontendVerifyWorkflow = readFileSync(
  new URL("../../.github/workflows/frontend-verify.yml", import.meta.url),
  "utf8",
);
const releaseRunbook = readFileSync(
  new URL("../../docs/frontend/release-runbook.md", import.meta.url),
  "utf8",
);

function deployMainSection(): string {
  const marker = "  deploy-main:";
  const start = workflow.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return workflow.slice(start);
}

describe("frontend release artifact deployment", () => {
  it("keeps the release workflow manual-only", () => {
    expect(workflow).toMatch(/on:\s*\n\s*workflow_dispatch:/);
    expect(workflow).not.toMatch(/\n\s*push:/);
  });

  it("keeps frontend verification manually runnable without deployment", () => {
    expect(frontendVerifyWorkflow).toMatch(/on:\s*\n\s*workflow_dispatch:/);
    expect(frontendVerifyWorkflow).toMatch(/\n\s*pull_request:/);
    expect(frontendVerifyWorkflow).toMatch(/\n\s*push:/);
    expect(frontendVerifyWorkflow).toMatch(/npm run verify/);
    expect(frontendVerifyWorkflow).not.toMatch(/environment:\s*frontend-production/);
    expect(frontendVerifyWorkflow).not.toMatch(/\bdeploy-main\b/);
  });

  it("passes the reviewed dist artifact from verify to deploy-main", () => {
    const deploy = deployMainSection();

    expect(workflow).toMatch(/uses:\s*actions\/upload-artifact@v4/);
    expect(workflow).toMatch(/name:\s*frontend-dist-\$\{\{\s*github\.sha\s*\}\}/);
    expect(deploy).toMatch(/uses:\s*actions\/download-artifact@v4/);
    expect(deploy).toMatch(/name:\s*frontend-dist-\$\{\{\s*github\.sha\s*\}\}/);
    expect(deploy).toMatch(/path:\s*release-dist/);
  });

  it("does not rebuild or reset source on the production host", () => {
    const deploy = deployMainSection();

    expect(deploy).not.toMatch(/\bnpm ci\b/);
    expect(deploy).not.toMatch(/\bnpm run build\b/);
    expect(deploy).not.toMatch(/\bgit reset --hard\b/);
    expect(deploy).not.toMatch(/\bgit pull\b/);
    expect(deploy).not.toMatch(/\bgit fetch\b/);
  });

  it("verifies the downloaded artifact marker before and after upload", () => {
    const deploy = deployMainSection();

    expect(deploy).toMatch(/release-dist\/build-commit\.txt/);
    expect(deploy).toMatch(/EXPECTED_COMMIT/);
    expect(deploy).toMatch(/grep -qx "commit=\$EXPECTED_COMMIT"/);
    expect(deploy).toMatch(/cat dist\/build-commit\.txt/);
  });

  it("validates the production target directory before interpolating it into ssh", () => {
    const deploy = deployMainSection();

    expect(deploy).toContain("grep -Eq '^/[A-Za-z0-9._/-]+$'");
    expect(deploy).toContain("grep -Eq '(^|/)\\.\\.?(/|$)|//'");
    expect(deploy).toMatch(/LIAN_WEB_DIR must be an absolute path/);
    expect(deploy).toMatch(/LIAN_WEB_DIR must not contain dot segments/);
    expect(deploy).toContain('[ "$LIAN_WEB_DIR" = "/" ]');
    expect(deploy).toContain("grep -Eq '/$'");
    expect(deploy).toMatch(/LIAN_WEB_DIR must not be root or end with a slash/);
  });

  it("documents the artifact-only production boundary", () => {
    expect(releaseRunbook).toMatch(/uploads the reviewed `dist\/` artifact/i);
    expect(releaseRunbook).toMatch(/downloads\s+that exact artifact/i);
    expect(releaseRunbook).toMatch(/must not run dependency installation/i);
    expect(releaseRunbook).not.toMatch(
      /frontend-auto-build\.yml` is manual-only and still\s+rebuilds on the target host/i,
    );
  });
});
