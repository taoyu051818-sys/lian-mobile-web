import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const source = readFileSync(path.join(repoRoot, "src/shell/ShellChrome.vue"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("ShellChrome button ownership", () => {
  it("renders configured chrome actions through LianButton", () => {
    expect(source).toContain('import { LianButton } from "../ui";');
    expect(source).toMatch(/<LianButton\s+[\s\S]*?v-for="btn in buttons"/);
    expect(source).toContain(":variant=\"btn.variant ?? 'ghost'\"");
    expect(source).toContain('size="md"');
    expect(source).toContain(':disabled="btn.disabled || !isVisible"');
    expect(source).toContain('@click="handleButtonClick(btn)"');
  });

  it("does not mimic the shared component with hand-authored classes", () => {
    expect(source).not.toMatch(/<button[\s\S]*?class="lian-button"/);
    expect(source).not.toContain("`lian-button--${btn.variant ?? 'ghost'}`");
  });
});
