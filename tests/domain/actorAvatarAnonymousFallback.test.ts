import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANONYMOUS_ALIAS_AVATAR_URL,
  actorAvatarUrl,
  actorDisplayName,
} from "../../src/domain/actor";
import { normalizeDisplayActor } from "../../src/platform/api-normalizers";

/**
 * Issue #938 — bounded anonymity slice.
 *
 * The avatar resolver `actorAvatarUrl` is the central rendering path for
 * every alias-post avatar surface (feed footer, post-detail topbar, share
 * card, etc.). This suite locks in three rules so a future refactor cannot
 * silently re-introduce the leak:
 *
 *   1. An alias-attributed actor with no avatarUrl resolves to the generic
 *      anonymous SVG, never to the real-account avatar.
 *   2. An alias-attributed actor whose avatarUrl points outside the shared
 *      `/assets/aliases/` pool is treated as a leak and replaced with the
 *      anonymous fallback (defense-in-depth — the wire payload should never
 *      carry such a value, but we refuse to render it if it ever does).
 *   3. A real-identity actor (no aliasId) still returns its own avatar or
 *      empty string — the fallback only kicks in for alias-attributed posts.
 */
describe("actorAvatarUrl alias / anonymous fallback (issue #938)", () => {
  it("returns the anonymous SVG for an alias actor with no avatarUrl", () => {
    expect(
      actorAvatarUrl({
        aliasId: "lumen-archivist",
        displayName: "微光档案员",
      }),
    ).toBe(ANONYMOUS_ALIAS_AVATAR_URL);
  });

  it("honors an alias actor's own avatar when sourced from the alias pool", () => {
    expect(
      actorAvatarUrl({
        aliasId: "lumen-archivist",
        avatarUrl: "/assets/aliases/lumen-archivist.svg",
      }),
    ).toBe("/assets/aliases/lumen-archivist.svg");
  });

  it("rejects an alias actor's avatar when it points outside the alias pool", () => {
    // If the wire payload ever leaks the real account avatar onto an alias
    // actor (e.g. a backend regression), the client must not surface it.
    expect(
      actorAvatarUrl({
        aliasId: "lumen-archivist",
        avatarUrl: "https://cdn.example.com/uploads/real-user-1234.jpg",
      }),
    ).toBe(ANONYMOUS_ALIAS_AVATAR_URL);

    expect(
      actorAvatarUrl({
        aliasId: "lumen-archivist",
        avatarUrl: "/upload/avatars/real-user.png",
      }),
    ).toBe(ANONYMOUS_ALIAS_AVATAR_URL);
  });

  it("returns the avatarUrl untouched for a non-alias actor", () => {
    expect(
      actorAvatarUrl({
        avatarUrl: "https://cdn.example.com/uploads/real-user.jpg",
        displayName: "Real User",
      }),
    ).toBe("https://cdn.example.com/uploads/real-user.jpg");
  });

  it("returns empty string for a non-alias actor with no avatarUrl", () => {
    // Empty string is the existing contract — the rendering surface falls
    // through to the avatar-text initial. Only alias actors trigger the
    // anonymous SVG; non-alias actors keep their initial-letter fallback so
    // we do not introduce a behavior change for real-identity surfaces.
    expect(actorAvatarUrl({ displayName: "Real User" })).toBe("");
    expect(actorAvatarUrl(null)).toBe("");
    expect(actorAvatarUrl(undefined)).toBe("");
  });

  it("does not fall back to username or name for alias actors", () => {
    expect(
      actorDisplayName(
        {
          aliasId: "masked-author",
          username: "real-account-name",
          name: "Real Name",
        },
        "匿名用户",
      ),
    ).toBe("匿名用户");
  });

  it("uses the anonymity fallback for empty alias display names even when real identity fields exist", () => {
    expect(
      actorDisplayName(
        {
          aliasId: "masked-author",
          displayName: "",
          username: "real-account-name",
          name: "Real Name",
        },
        "匿名用户",
      ),
    ).toBe("匿名用户");

    expect(
      actorDisplayName(
        {
          aliasId: "masked-author",
          displayName: "   ",
          username: "real-account-name",
          name: "Real Name",
        },
        "匿名用户",
      ),
    ).toBe("匿名用户");
  });

  it("still uses username/name fallbacks for non-alias actors", () => {
    expect(actorDisplayName({ username: "campus-user" }, "默认用户")).toBe("campus-user");
    expect(actorDisplayName({ name: "Campus User" }, "默认用户")).toBe("Campus User");
  });

  it("preserves aliasId through normalizeDisplayActor so resolver sees it", () => {
    // The wire-shape normalizer must round-trip aliasId — otherwise the
    // resolver above would never know the actor is alias-attributed.
    const actor = normalizeDisplayActor({
      id: "u-7",
      displayName: "微光档案员",
      aliasId: "lumen-archivist",
    });
    expect(actor?.aliasId).toBe("lumen-archivist");
    expect(actorAvatarUrl(actor)).toBe(ANONYMOUS_ALIAS_AVATAR_URL);
  });
});

describe("anonymous fallback asset is shipped (issue #938)", () => {
  it("anonymous SVG exists at the path the resolver returns", () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const assetPath = path.join(repoRoot, "public", ANONYMOUS_ALIAS_AVATAR_URL.replace(/^\//, ""));
    expect(fs.existsSync(assetPath)).toBe(true);
    const contents = fs.readFileSync(assetPath, "utf8");
    expect(contents).toMatch(/<svg/);
  });
});
