import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedCardSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCard.vue"),
  "utf8",
);
const feedShellSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCardShell.vue"),
  "utf8",
);
const feedFooterSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/FeedItemCardFooter.vue"),
  "utf8",
);
const detailPanelSource = fs.readFileSync(
  path.join(repoRoot, "src/features/detail/PostDetailPanel.vue"),
  "utf8",
);
const detailTopbarSource = fs.readFileSync(
  path.join(repoRoot, "src/features/detail/PostDetailTopbar.vue"),
  "utf8",
);
const repliesSource = fs.readFileSync(
  path.join(repoRoot, "src/features/detail/PostReplies.vue"),
  "utf8",
);
const channelThreadSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/ChannelThread.vue"),
  "utf8",
);
const brandSource = fs.readFileSync(path.join(repoRoot, "src/config/brand/shared.ts"), "utf8");

describe("trust signal structure", () => {
  it("provides Chinese-first fallback labels", () => {
    expect(brandSource).toMatch(/TRUST_SIGNAL_VERIFIED\s*=\s*"已验证"/);
    expect(brandSource).toMatch(/TRUST_SIGNAL_IDENTITY_PREFIX\s*=\s*"身份："/);
    expect(brandSource).toMatch(/TRUST_SIGNAL_UNKNOWN\s*=\s*"身份待确认"/);
  });

  it("forwards feed source and actor identity without changing absent items", () => {
    expect(feedCardSource).toMatch(
      /function resolveTrustSignal\(source: FeedItem\["source"\], identityTag\?: string\)/,
    );
    expect(feedCardSource).toMatch(/if \(source\?\.visible === false\) return null;/);
    expect(feedCardSource).toMatch(/if \(source\?\.label\) return source\.label;/);
    expect(feedCardSource).toMatch(
      /if \(identityTag\) return `\$\{TRUST_SIGNAL_IDENTITY_PREFIX\}\$\{identityTag\}`;/,
    );
    expect(feedCardSource).toMatch(/if \(source\) return TRUST_SIGNAL_UNKNOWN;/);
    expect(feedCardSource).toMatch(/return null;/);
    expect(feedCardSource).toMatch(
      /trustSignal: resolveTrustSignal\(item\.source, actor\.identityTag\)/,
    );
    expect(feedShellSource).toMatch(/trustSignal: string \| null;/);
    expect(feedShellSource).toMatch(/:trust-signal="trustSignal"/);
    expect(feedFooterSource).toMatch(
      /import \{ TrustBadge, VisibilityBadge \} from "\.\.\/\.\.\/ui";/,
    );
    expect(feedFooterSource).toMatch(/trustSignal\?: string \| null;/);
    expect(feedFooterSource).toMatch(/<TrustBadge\s+v-if="trustSignal"/);
  });

  it("renders detail and replies conditional badges with safe fallback", () => {
    expect(detailPanelSource).toMatch(/function resolveDetailTrustSignal\(\)/);
    expect(detailPanelSource).toMatch(
      /if \(post\.value\?\.source\?\.visible === false\) return null;/,
    );
    expect(detailPanelSource).toMatch(
      /post\.value\?\.source\?\.label \|\|\s+post\.value\?\.actor\?\.identityTag \|\|\s+\(post\.value\?\.source \? TRUST_SIGNAL_UNKNOWN : null\)/,
    );
    expect(detailPanelSource).toMatch(/:trust-signal="resolveDetailTrustSignal\(\)"/);
    expect(detailTopbarSource).toMatch(/trustSignal\?: string \| null;/);
    expect(detailTopbarSource).toMatch(/<TrustBadge\s+v-if="trustSignal"/);
    expect(repliesSource).toMatch(/function replyTrustSignal\(reply: PostReply\)/);
    expect(repliesSource).toMatch(/if \(reply\.source\?\.visible === false\) return null;/);
    expect(repliesSource).toMatch(
      /return reply\.source\?\.label \|\| reply\.actor\?\.identityTag \|\| \(reply\.source \? TRUST_SIGNAL_UNKNOWN : null\);/,
    );
    expect(repliesSource).toMatch(/<TrustBadge\s+v-if="replyTrustSignal\(reply\)"/);
  });

  it("marks channel thread authoritative actors and identity values", () => {
    expect(channelThreadSource).toMatch(
      /import \{ EmptyState, InlineError, LianButton, TrustBadge \} from "\.\.\/\.\.\/ui";/,
    );
    expect(channelThreadSource).toMatch(/function messageTrustSignal\(item: ChannelMessage\)/);
    expect(channelThreadSource).toMatch(
      /if \(actor\.authoritative\) return TRUST_SIGNAL_VERIFIED;/,
    );
    expect(channelThreadSource).toMatch(
      /return item\.source\?\.label \|\| actor\.identityTag \|\| null;/,
    );
    expect(channelThreadSource).toMatch(/<TrustBadge\s+v-if="messageTrustSignal\(item\)"/);
  });
});
