import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function typeUnion(source: string, name: string) {
  const match = source.match(new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`));
  expect(match, `${name} type declaration should exist`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("Club card types", () => {
  it("FeedPresentationIntent includes club", () => {
    const feedTypes = readRepoFile("../../src/types/feed.ts");
    expect(typeUnion(feedTypes, "FeedPresentationIntent")).toMatch(/\|\s*"club"/);
  });

  it("FeedItem has optional club field", () => {
    const feedTypes = readRepoFile("../../src/types/feed.ts");
    expect(feedTypes).toMatch(/club\?:\s*ClubMetadata/);
  });

  it("ClubMetadata interface has required fields", () => {
    const postTypes = readRepoFile("../../src/types/post.ts");
    expect(postTypes).toMatch(/export interface ClubMetadata/);
    expect(postTypes).toMatch(/clubId:\s*string/);
    expect(postTypes).toMatch(/name:\s*string/);
    expect(postTypes).toMatch(/category:\s*ClubCategory/);
    expect(postTypes).toMatch(/president:\s*string/);
    expect(postTypes).toMatch(/foundedAt:\s*string/);
    expect(postTypes).toMatch(/memberCount:\s*number/);
  });

  it("ClubCategory includes expected values", () => {
    const postTypes = readRepoFile("../../src/types/post.ts");
    expect(postTypes).toMatch(/export type ClubCategory/);
    expect(postTypes).toMatch(/"academic"/);
    expect(postTypes).toMatch(/"sports"/);
    expect(postTypes).toMatch(/"arts"/);
    expect(postTypes).toMatch(/"volunteer"/);
    expect(postTypes).toMatch(/"tech"/);
    expect(postTypes).toMatch(/"culture"/);
    expect(postTypes).toMatch(/"other"/);
  });
});

describe("Club card component", () => {
  it("FeedItemClubCard.vue exists and imports required dependencies", () => {
    const component = readRepoFile("../../src/features/feed/FeedItemClubCard.vue");
    expect(component).toMatch(/import.*FeedItem.*from.*types\/feed/);
    expect(component).toMatch(/import.*ClubMetadata.*from.*types\/post/);
    const brandImport = component.match(
      /import\s*\{([^}]*)\}\s*from\s*"\.\.\/\.\.\/config\/brand"/,
    );
    expect(brandImport, "club card should import its labels from the brand module").not.toBeNull();
    for (const name of [
      "CLUB_CARD_PRESIDENT_LABEL",
      "CLUB_CARD_FOUNDED_LABEL",
      "CLUB_CARD_MEMBERS_LABEL",
      "CLUB_CATEGORY_LABELS",
      "FEED_CARD_MARK_CLUB",
    ]) {
      expect(brandImport?.[1]).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("FeedItemClubCard.vue uses useCardPointerInteraction", () => {
    const component = readRepoFile("../../src/features/feed/FeedItemClubCard.vue");
    expect(component).toMatch(/import.*useCardPointerInteraction/);
    expect(component).toMatch(/handlePointerDown/);
    expect(component).toMatch(/handlePointerUp/);
    expect(component).toMatch(/openCard/);
  });

  it("FeedItemClubCard.vue renders club metadata fields", () => {
    const component = readRepoFile("../../src/features/feed/FeedItemClubCard.vue");
    expect(component).toMatch(/clubName/);
    expect(component).toMatch(/categoryLabel/);
    expect(component).toMatch(/president/);
    expect(component).toMatch(/memberCount/);
    expect(component).toMatch(/foundedYear/);
    expect(component).toMatch(/logoUrl/);
  });

  it("FeedItemClubCard.vue guards against invalid founded dates rendering NaN", () => {
    const component = readRepoFile("../../src/features/feed/FeedItemClubCard.vue");
    expect(component).toMatch(/Number\.isFinite\(year\)/);
    expect(component).not.toMatch(/getFullYear\(\)\.toString\(\)/);
  });

  it("FeedItemClubCard.vue has proper accessibility attributes", () => {
    const component = readRepoFile("../../src/features/feed/FeedItemClubCard.vue");
    expect(component).toMatch(/role="button"/);
    expect(component).toMatch(/tabindex="0"/);
    expect(component).toMatch(/:aria-label/);
  });
});

describe("FeedList club card routing", () => {
  it("FeedList.vue imports FeedItemClubCard", () => {
    const feedList = readRepoFile("../../src/features/feed/FeedList.vue");
    expect(feedList).toMatch(/import FeedItemClubCard from/);
  });

  it("FeedList.vue has isClubItem helper", () => {
    const feedList = readRepoFile("../../src/features/feed/FeedList.vue");
    expect(feedList).toMatch(/function isClubItem/);
    expect(feedList).toMatch(/contentType === "club"/);
    expect(feedList).toMatch(/presentationIntent === "club"/);
    expect(feedList).toMatch(/cardTemplate === "club"/);
  });

  it("FeedList.vue conditionally renders FeedItemClubCard", () => {
    const feedList = readRepoFile("../../src/features/feed/FeedList.vue");
    expect(feedList).toMatch(/v-if="isClubItem\(item\)"/);
    expect(feedList).toMatch(/<FeedItemClubCard/);
  });
});

describe("Club card brand constants", () => {
  it("feed.ts exports club card constants", () => {
    const feedBrand = readRepoFile("../../src/config/brand/feed.ts");
    expect(feedBrand).toMatch(/export const FEED_CARD_MARK_CLUB/);
    expect(feedBrand).toMatch(/export const CLUB_CARD_PRESIDENT_LABEL/);
    expect(feedBrand).toMatch(/export const CLUB_CARD_FOUNDED_LABEL/);
    expect(feedBrand).toMatch(/export const CLUB_CARD_MEMBERS_LABEL/);
    expect(feedBrand).toMatch(/export const CLUB_CATEGORY_LABELS/);
  });

  it("CLUB_CATEGORY_LABELS has all category translations", () => {
    const feedBrand = readRepoFile("../../src/config/brand/feed.ts");
    expect(feedBrand).toMatch(/academic:\s*"学术"/);
    expect(feedBrand).toMatch(/sports:\s*"体育"/);
    expect(feedBrand).toMatch(/arts:\s*"艺术"/);
    expect(feedBrand).toMatch(/volunteer:\s*"志愿"/);
    expect(feedBrand).toMatch(/tech:\s*"科技"/);
    expect(feedBrand).toMatch(/culture:\s*"文化"/);
    expect(feedBrand).toMatch(/other:\s*"其他"/);
  });
});
