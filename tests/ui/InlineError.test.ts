import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

const inlineErrorSource = read("src/ui/InlineError.vue");
const primitiveStyles = read("src/ui/primitives.css");

const retryCallers = [
  {
    file: "src/features/feed/FeedView.vue",
    label: ':action-label="CHANNEL_RELOAD"',
    action: '@action="feedData.loadFeed(true)"',
  },
  {
    file: "src/features/messages/ChannelThread.vue",
    label: ':action-label="CHANNEL_RELOAD"',
    action: `@action="emit('retry')"`,
  },
  {
    file: "src/features/profile/ProfileView.vue",
    label: ':action-label="PROFILE_RELOAD"',
    action: '@action="loadProfile"',
  },
  {
    file: "src/features/profile/ProfileCollectionList.vue",
    label: ':action-label="CHANNEL_RELOAD"',
    action: `@action="emit('retry')"`,
  },
  {
    file: "src/features/detail/PostDetailPanel.vue",
    label: ':action-label="DETAIL_RELOAD"',
    action: `@action="emit('retry')"`,
  },
  {
    file: "src/features/publish/PublishLocationControls.vue",
    label: ':action-label="CHANNEL_RELOAD"',
    action: `@action="emit('loadMapLocations')"`,
  },
  {
    file: "src/features/detail/PostPlaceSheetBlock.vue",
    label: ':action-label="PLACE_SHEET_RETRY"',
    action: `@action="emit('openPlaceSheet')"`,
  },
  {
    file: "src/features/profile/ProfileStatsBlock.vue",
    label: ':action-label="PROFILE_STATS_RELOAD"',
    action: '@action="loadStats"',
  },
] as const;

describe("InlineError action contract", () => {
  it("owns its retry action through LianButton", () => {
    expect(inlineErrorSource).toContain('import LianButton from "./LianButton.vue";');
    expect(inlineErrorSource).toMatch(/actionLabel\?: string;/);
    expect(inlineErrorSource).toMatch(/actionLoading\?: boolean;/);
    expect(inlineErrorSource).toMatch(/actionDisabled\?: boolean;/);
    expect(inlineErrorSource).toMatch(/action: \[\];/);
    expect(inlineErrorSource).toContain('<div class="inline-error" role="alert">');
    expect(inlineErrorSource).toContain('class="inline-error__action"');
    expect(inlineErrorSource).toContain('variant="ghost"');
    expect(inlineErrorSource).toContain('size="sm"');
    expect(inlineErrorSource).toContain(':loading="actionLoading"');
    expect(inlineErrorSource).toContain(':disabled="actionDisabled"');
    expect(inlineErrorSource).toContain("@click=\"emit('action')\"");
  });

  it("centralizes message and action alignment in primitive styles", () => {
    expect(primitiveStyles).toMatch(/\.inline-error \{[\s\S]*?align-items: center;/);
    expect(primitiveStyles).toMatch(/\.inline-error__message \{[\s\S]*?min-width: 0;/);
    expect(primitiveStyles).toMatch(
      /\.inline-error__action\.lian-button \{[\s\S]*?margin-left: auto;/,
    );
  });
});

describe("InlineError retry callers", () => {
  for (const caller of retryCallers) {
    it(`${caller.file} delegates its retry affordance to InlineError`, () => {
      const source = read(caller.file);
      expect(source).toContain(caller.label);
      expect(source).toContain(caller.action);
      expect(source).not.toMatch(/inline-error\s+button/);
    });
  }

  it("ProfileSettingsBlock only exposes retry for an initial load failure", () => {
    const source = read("src/features/profile/ProfileSettingsBlock.vue");
    expect(source).toContain("settings.errorPhase.value === 'load' && !settings.settings.value");
    expect(source).toContain("? PROFILE_SETTINGS_RELOAD");
    expect(source).toContain('@action="settings.retry()"');
    expect(source).not.toMatch(/profile-settings-block__error/);
  });

  it("does not leave local InlineError button styling in migrated feedback components", () => {
    const files = [
      ...retryCallers.map((caller) => caller.file),
      "src/features/profile/ProfileSettingsBlock.vue",
      "src/features/detail/PostActionFeedback.vue",
    ];

    for (const file of files) {
      expect(read(file), file).not.toMatch(/(?:\.inline-error|profile-\w+-block__error)\s+button/);
    }
  });
});
