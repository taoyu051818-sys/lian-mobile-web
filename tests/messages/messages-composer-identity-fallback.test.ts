import { describe, expect, it, vi } from "vitest";

import { useMessageComposer } from "../../src/features/messages/useMessageComposer";
import { DEFAULT_USER_LABEL } from "../../src/config/brand";
import type { ProfileUser } from "../../src/types/profile";

/**
 * Bounded slice for #952. The composer surface in messages must never expose
 * the real `username` while the user is acting through an alias — even when
 * the alias has no `name` set. The test owns just that fallback behavior so
 * the privacy regression cannot silently come back.
 */
function makeComposer() {
  const onSend = vi.fn(async () => {});
  const onRetry = vi.fn(async () => {});
  return useMessageComposer({ onSend, onRetry });
}

describe("useMessageComposer composerActorName fallback", () => {
  it("uses alias.name when the active alias has a display name", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      activeAliasId: "a1",
      aliases: [{ id: "a1", name: "蓝色海豚" }],
    };
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe("蓝色海豚");
    expect(composer.composerActorName.value).not.toContain("real-name-alice");
  });

  it("falls back to the anonymity-safe label when the active alias has no name", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      activeAliasId: "a1",
      aliases: [{ id: "a1", name: "" }],
    };
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe(DEFAULT_USER_LABEL);
    expect(composer.composerActorName.value).not.toContain("real-name-alice");
  });

  it("falls back to the anonymity-safe label when the active alias name is missing", () => {
    const composer = makeComposer();
    const user = {
      username: "real-name-alice",
      activeAliasId: "a1",
      aliases: [{ id: "a1" }],
    } as ProfileUser;
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe(DEFAULT_USER_LABEL);
    expect(composer.composerActorName.value).not.toContain("real-name-alice");
  });

  it("does not leak username when activeAliasId points at an unnamed alias amongst many", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      activeAliasId: "a2",
      aliases: [
        { id: "a1", name: "蓝色海豚" },
        { id: "a2", name: "" },
      ],
    };
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe(DEFAULT_USER_LABEL);
    expect(composer.composerActorName.value).not.toContain("real-name-alice");
  });

  it("falls back to first alias when activeAliasId is missing — and still anonymity-safe if that alias has no name", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      activeAliasId: null,
      aliases: [{ id: "a1", name: "" }],
    };
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe(DEFAULT_USER_LABEL);
    expect(composer.composerActorName.value).not.toContain("real-name-alice");
  });

  it("uses username as a real-identity display only when there is no alias at all", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      aliases: [],
    };
    composer.currentUser.value = user;

    expect(composer.composerActorName.value).toBe("real-name-alice");
  });

  it("returns the default label when there is no signed-in user", () => {
    const composer = makeComposer();
    composer.currentUser.value = null;

    expect(composer.composerActorName.value).toBe(DEFAULT_USER_LABEL);
  });

  it("derives the avatar text from the actor name, never from the leaked username", () => {
    const composer = makeComposer();
    const user: ProfileUser = {
      username: "real-name-alice",
      activeAliasId: "a1",
      aliases: [{ id: "a1", name: "" }],
    };
    composer.currentUser.value = user;

    expect(composer.composerAvatarText.value).toBe(DEFAULT_USER_LABEL.slice(0, 2));
    expect(composer.composerAvatarText.value).not.toContain("re");
  });
});
