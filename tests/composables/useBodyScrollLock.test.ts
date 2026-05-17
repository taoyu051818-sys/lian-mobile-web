import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(
  path.join(repoRoot, "src/composables/useBodyScrollLock.ts"),
  "utf8",
);

describe("useBodyScrollLock stacked-modal contract", () => {
  it("uses a module-level lock count for ref-counting", () => {
    expect(source).toMatch(/let lockCount\s*=\s*0/);
  });

  it("saves original overflow before first lock", () => {
    expect(source).toMatch(/savedOverflow\s*=\s*document\.body\.style\.overflow/);
  });

  it("increments lock count on lock", () => {
    expect(source).toMatch(/lockCount\+\+/);
  });

  it("decrements lock count on unlock", () => {
    expect(source).toMatch(/lockCount--/);
  });

  it("only restores overflow when count reaches zero", () => {
    expect(source).toMatch(/if\s*\(lockCount\s*===\s*0\)/);
  });

  it("restores saved overflow instead of blindly removing the property", () => {
    expect(source).toMatch(/document\.body\.style\.overflow\s*=\s*savedOverflow/);
    expect(source).not.toContain('removeProperty("overflow")');
  });

  it("guards against underflow (unlock when count is already 0)", () => {
    expect(source).toMatch(/if\s*\(lockCount\s*<=\s*0\)\s*return/);
  });

  it("watches the active ref for lock/unlock transitions", () => {
    expect(source).toMatch(/watch\(active/);
  });

  it("unlocks on unmount as a safety net", () => {
    expect(source).toMatch(/onBeforeUnmount\(unlock\)/);
  });
});
