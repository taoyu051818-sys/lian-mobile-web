import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

function phaseOrderDocUrl() {
  return new URL("../../docs/product/CORE_PRODUCT_MODEL_V1_PHASE_ORDER.md", import.meta.url);
}

function packageJsonUrl() {
  return new URL("../../package.json", import.meta.url);
}

function readPhaseOrderDoc() {
  return readFileSync(phaseOrderDocUrl(), "utf8").replace(/\r\n/g, "\n");
}

function readPackageJson() {
  return JSON.parse(readFileSync(packageJsonUrl(), "utf8")) as {
    scripts?: Record<string, string>;
  };
}

function repoFileUrl(path: string) {
  return new URL(`../../${path}`, import.meta.url);
}

describe("Core Product Model V1 phase execution order", () => {
  it("publishes a maintained queue artifact", () => {
    expect(existsSync(phaseOrderDocUrl())).toBe(true);
  });

  it("keeps the phase queue in the intended execution order", () => {
    const source = readPhaseOrderDoc();
    const expectedHeadings = [
      "## Phase 0 — safety and localization baseline",
      "## Phase 1 — core post and audience vocabulary",
      "## Phase 2 — map and publish controls alignment",
      "## Phase 3 — AI-assisted publish flow",
      "## Phase 4 — event/help/errand action surfaces",
    ];

    let previousIndex = -1;
    for (const heading of expectedHeadings) {
      const currentIndex = source.indexOf(heading);
      expect(currentIndex, `${heading} is present`).toBeGreaterThanOrEqual(0);
      expect(currentIndex, `${heading} follows the previous phase`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("points every phase at the focused contract tests that protect it", () => {
    const source = readPhaseOrderDoc();
    const expectedPointers = [
      "tests/phase0/phase0-contract.test.ts",
      "tests/phase0/phase1-contract.test.ts",
      "tests/phase0/phase2-contract.test.ts",
      "tests/phase0/phase3-contract.test.ts",
      "tests/phase0/phase4-contract.test.ts",
      "tests/phase0/phase4-help-contract.test.ts",
      "tests/phase0/phase4-help-manage-contract.test.ts",
      "tests/phase0/phase4-deeplink-contract.test.ts",
      "tests/phase0/phase4-publish-event-contract.test.ts",
    ];

    for (const pointer of expectedPointers) {
      expect(source, `${pointer} is documented`).toContain(pointer);
      expect(existsSync(repoFileUrl(pointer)), `${pointer} exists`).toBe(true);
    }
  });

  it("documents the focused queue pointer command", () => {
    const source = readPhaseOrderDoc();

    expect(source).toContain("npm run test:phase-order");
  });

  it("exposes a focused queue pointer script", () => {
    const packageJson = readPackageJson();

    expect(packageJson.scripts?.["test:phase-order"]).toBe(
      "vitest run tests/phase0/phase-order-contract.test.ts",
    );
  });
});
