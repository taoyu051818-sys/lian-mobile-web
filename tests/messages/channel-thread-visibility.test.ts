import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const threadSource = readFileSync(
  path.join(repoRoot, "src/features/messages/ChannelThread.vue"),
  "utf8",
).replace(/\r\n/g, "\n");
const badgeSource = readFileSync(path.join(repoRoot, "src/ui/VisibilityBadge.vue"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("ChannelThread visibility cue", () => {
  it("renders the shared non-interactive visibility badge for each message", () => {
    expect(threadSource).toContain('import VisibilityBadge from "../../ui/VisibilityBadge.vue";');
    expect(threadSource).toContain('<VisibilityBadge :visibility="item.visibility" />');
  });

  it("keeps visibility changes in the message memo dependencies", () => {
    expect(threadSource).toMatch(
      /v-memo="\[item\.id, item\.deliveryState, item\.content, item\.isSelf, item\.visibility\]"/,
    );
  });

  it("keeps the badge hidden when visibility is absent or public", () => {
    expect(badgeSource).toContain('v-if="visibilityLabel(props.visibility)"');
    expect(badgeSource).toMatch(/if \(!value \|\| value === "public"\) return null/);
  });

  it("keeps unsupported visibility values hidden as malformed data", () => {
    expect(badgeSource).not.toContain("可见：");
  });
});
