import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PROFILE_VIEW_PATH = path.join(ROOT, "src/features/profile/ProfileView.vue");

/**
 * issue #829: Profile view structure test.
 *
 * Verifies the "identity + assets + history + settings" hierarchy:
 * - ProfileHeader (identity) comes first
 * - ProfileStatsBlock (contribution/rewards summary) comes before tabs
 * - ProfileTabs + collection content (activity history) comes before settings
 * - ProfileSettingsBlock (settings) comes after activity content
 *
 * This test ensures the first-screen fold promise is maintained:
 * - iPhone SE: avatar + name + identity tags + contribution/rewards entry
 * - iPhone 14: above + "我的发布" preview
 * - Settings must NOT appear on first screen
 */
describe("ProfileView structure (issue #829)", () => {
  let content: string;

  async function loadContent() {
    if (!content) {
      content = await fs.readFile(PROFILE_VIEW_PATH, "utf8");
    }
    return content;
  }

  function findComponentOrder(template: string, components: string[]): number[] {
    return components.map((comp) => {
      const pattern = new RegExp(`<${comp}[\\s/>]`, "i");
      const match = template.match(pattern);
      return match ? template.indexOf(match[0]) : -1;
    });
  }

  it("ProfileHeader appears before ProfileStatsBlock", async () => {
    const src = await loadContent();
    const [headerPos, statsPos] = findComponentOrder(src, ["ProfileHeader", "ProfileStatsBlock"]);
    expect(headerPos).toBeGreaterThan(-1);
    expect(statsPos).toBeGreaterThan(-1);
    expect(headerPos).toBeLessThan(statsPos);
  });

  it("ProfileStatsBlock appears before ProfileTabs", async () => {
    const src = await loadContent();
    const [statsPos, tabsPos] = findComponentOrder(src, ["ProfileStatsBlock", "ProfileTabs"]);
    expect(statsPos).toBeGreaterThan(-1);
    expect(tabsPos).toBeGreaterThan(-1);
    expect(statsPos).toBeLessThan(tabsPos);
  });

  it("ProfileTabs appears before ProfileSettingsBlock (settings below fold)", async () => {
    const src = await loadContent();
    const [tabsPos, settingsPos] = findComponentOrder(src, ["ProfileTabs", "ProfileSettingsBlock"]);
    expect(tabsPos).toBeGreaterThan(-1);
    expect(settingsPos).toBeGreaterThan(-1);
    expect(tabsPos).toBeLessThan(settingsPos);
  });

  it("ProfileCollectionList appears before ProfileSettingsBlock", async () => {
    const src = await loadContent();
    const [collectionPos, settingsPos] = findComponentOrder(src, [
      "ProfileCollectionList",
      "ProfileSettingsBlock",
    ]);
    expect(collectionPos).toBeGreaterThan(-1);
    expect(settingsPos).toBeGreaterThan(-1);
    expect(collectionPos).toBeLessThan(settingsPos);
  });

  it("ProfileSettingsBlock appears after activity content (below fold)", async () => {
    const src = await loadContent();
    // Settings should come after both ProfileCollectionList and ProfileErrandOrdersBlock
    const [ordersPos, collectionPos, settingsPos] = findComponentOrder(src, [
      "ProfileErrandOrdersBlock",
      "ProfileCollectionList",
      "ProfileSettingsBlock",
    ]);
    expect(ordersPos).toBeGreaterThan(-1);
    expect(collectionPos).toBeGreaterThan(-1);
    expect(settingsPos).toBeGreaterThan(-1);
    // Settings must be after both activity content blocks
    expect(settingsPos).toBeGreaterThan(ordersPos);
    expect(settingsPos).toBeGreaterThan(collectionPos);
  });

  it("identity summary block order: Header -> Stats -> Tabs", async () => {
    const src = await loadContent();
    const positions = findComponentOrder(src, [
      "ProfileHeader",
      "ProfileStatsBlock",
      "ProfileTabs",
    ]);
    // All components must exist
    expect(positions.every((p) => p > -1)).toBe(true);
    // Must be in ascending order
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("ProfileCollectionList has stable min-height to prevent layout jump", async () => {
    const collectionListPath = path.join(ROOT, "src/features/profile/ProfileCollectionList.vue");
    const collectionContent = await fs.readFile(collectionListPath, "utf8");
    // Check that min-height is set on .profile-collection
    expect(collectionContent).toMatch(/\.profile-collection\s*\{[^}]*min-height:/);
  });
});
