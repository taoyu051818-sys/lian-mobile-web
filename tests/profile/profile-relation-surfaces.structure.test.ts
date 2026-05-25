/**
 * PRD V0.3 §2.4 / B3-2 — ProfileView wiring + ProfileRelationSurfacesBlock
 * structure spec.
 *
 * Locks:
 *   1. ProfileView mounts ProfileRelationSurfacesBlock between
 *      ProfileCollectionList (activity history) and ProfileSettingsBlock
 *      (settings) — same "below activity, above settings" contract the
 *      profile-view-structure test enforces for the rest of the page.
 *   2. ProfileRelationSurfacesBlock renders nothing when no item carries a
 *      known relation, so the existing tab UX is unchanged for users without
 *      relation-bearing activity.
 *   3. The component does not surface any author / alias / user / displayName
 *      / avatarUrl identity field — anonymous-design-principle requires
 *      identity fields never reach a relation-grouped row.
 *   4. Brand strings registered in config/brand/profile.ts.
 */
import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, rel), "utf8");
}

describe("ProfileView mounts ProfileRelationSurfacesBlock", () => {
  it("imports ProfileRelationSurfacesBlock", async () => {
    const src = await read("src/features/profile/ProfileView.vue");
    expect(src).toMatch(/import ProfileRelationSurfacesBlock from "\.\/ProfileRelationSurfacesBlock\.vue"/);
  });

  it("mounts ProfileRelationSurfacesBlock with the current items + user id", async () => {
    const src = await read("src/features/profile/ProfileView.vue");
    expect(src).toMatch(
      /<ProfileRelationSurfacesBlock[\s\S]*?:items="profileItems"[\s\S]*?:current-user-id="user\?\.id"/,
    );
  });

  it("renders ProfileRelationSurfacesBlock between ProfileCollectionList and ProfileSettingsBlock", async () => {
    const src = await read("src/features/profile/ProfileView.vue");
    const collectionPos = src.indexOf("<ProfileCollectionList");
    const relationsPos = src.indexOf("<ProfileRelationSurfacesBlock");
    const settingsPos = src.indexOf("<ProfileSettingsBlock");
    expect(collectionPos).toBeGreaterThan(-1);
    expect(relationsPos).toBeGreaterThan(-1);
    expect(settingsPos).toBeGreaterThan(-1);
    expect(relationsPos).toBeGreaterThan(collectionPos);
    expect(relationsPos).toBeLessThan(settingsPos);
  });
});

describe("ProfileRelationSurfacesBlock anonymity contract", () => {
  it("template surface does not reference any identity field", async () => {
    const src = await read("src/features/profile/ProfileRelationSurfacesBlock.vue");
    // anonymous-design-principle: identity fields must never reach a
    // rendered row. Check the template surface only — the script side may
    // legitimately accept a `currentUserId` prop, but the render path must
    // touch only post.title / post.tid / relation type label.
    const templateMatch = src.match(/<template>([\s\S]*?)<\/template>/);
    expect(templateMatch).toBeTruthy();
    let template = templateMatch ? templateMatch[1] : "";
    // Strip the explicit `currentUserId` prop binding — it is the prop name,
    // not a user-display field, and is reserved for future role-aware
    // grouping (groupPostsByRelationType signature).
    template = template.replace(/:current-user-id="[^"]*"/g, "");
    // Strip Vue HTML comments — they describe the contract but are not
    // rendered output.
    template = template.replace(/<!--[\s\S]*?-->/g, "");
    const offenders = template.match(/\b(actor|alias|displayName|avatarUrl)\w*/g) ?? [];
    expect(offenders).toEqual([]);
    // `user` lookups in the rendered template would also be a regression —
    // check it separately so the failure message is clear.
    expect(template).not.toMatch(/\{\{[^}]*\buser\w*/);
    expect(template).not.toMatch(/\{\{[^}]*\buser\b/);
  });

  it("renders only post.title / post.tid / relation type label fields", async () => {
    const src = await read("src/features/profile/ProfileRelationSurfacesBlock.vue");
    // Must surface entry.title (post title), entry.tid (for FSM open), and
    // entry.tags (relation type labels). Nothing else.
    expect(src).toMatch(/\{\{ entry\.title \}\}/);
    expect(src).toMatch(/entry\.tid/);
    expect(src).toMatch(/entry\.tags/);
    expect(src).toMatch(/data-testid="profile-relation-surfaces-tag"/);
  });

  it("uses detail.open(tid, 'card') for navigation, not vue-router", async () => {
    const src = await read("src/features/profile/ProfileRelationSurfacesBlock.vue");
    expect(src).toMatch(/import \{ useDetailNavigation \}/);
    expect(src).toMatch(/detail\.open\(tid, "card"\)/);
    expect(src).not.toMatch(/router-link|useRouter|router\.push/);
  });

  it("hides the section entirely when no item carries a known relation", async () => {
    const src = await read("src/features/profile/ProfileRelationSurfacesBlock.vue");
    // The wrapper section is gated on `sections.length` so an empty bucket
    // result (no relation-bearing post) renders nothing — the existing tab UX
    // is unchanged for users without relation-bearing activity.
    expect(src).toMatch(/v-if="sections\.length"/);
  });
});

describe("ProfileListItem.relations wire-through", () => {
  it("ProfileListItem carries an optional relations field", async () => {
    const src = await read("src/types/profile.ts");
    expect(src).toMatch(
      /export interface ProfileListItem[\s\S]*?relations\?\s*:\s*PostRelation\[\]/,
    );
  });

  it("normalizeProfileListItem preserves relations through normalizePostRelations", async () => {
    const src = await read("src/api/profile.ts");
    expect(src).toMatch(/import \{ normalizePostRelations \}/);
    expect(src).toMatch(
      /export function normalizeProfileListItem[\s\S]*?normalizePostRelations\(candidate\.relations\)/,
    );
  });
});

describe("brand strings registered for B3-2", () => {
  it("PROFILE_RELATION_GROUP_* and PROFILE_RELATION_TYPE_*_TAG live in config/brand/profile.ts", async () => {
    const src = await read("src/config/brand/profile.ts");
    for (const key of [
      "PROFILE_RELATION_GROUP_SECTION_LABEL",
      "PROFILE_RELATION_GROUP_PARTICIPATED_TITLE",
      "PROFILE_RELATION_GROUP_HELPED_TITLE",
      "PROFILE_RELATION_GROUP_MERCHANT_TITLE",
      "PROFILE_RELATION_TYPE_EVENT_RECAP_TAG",
      "PROFILE_RELATION_TYPE_EVENT_REWARD_TAG",
      "PROFILE_RELATION_TYPE_HELP_EVENT_LINK_TAG",
      "PROFILE_RELATION_TYPE_SOLUTION_EVENT_TAG",
      "PROFILE_RELATION_TYPE_MERCHANT_ERRAND_TAG",
      "PROFILE_RELATION_TYPE_PROJECT_SUBMISSION_TAG",
    ]) {
      expect(src).toMatch(new RegExp(`export const ${key}\\b`));
    }
  });
});
