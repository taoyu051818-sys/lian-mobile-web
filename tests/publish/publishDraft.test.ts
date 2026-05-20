import { describe, expect, it } from "vitest";
import {
  buildPublishDraftSnapshot,
  clearAllPublishDrafts,
  clearPublishDraft,
  hasMeaningfulPublishDraft,
  PUBLISH_DRAFT_SCOPE_ANONYMOUS,
  PUBLISH_DRAFT_SESSION_KEY,
  readPublishDraft,
  resolvePublishDraftScope,
  restorePublishDraftLocation,
  savePublishDraft,
} from "../../src/features/publish/publishDraftSession";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const SAMPLE_INPUT = {
  title: "夜跑约吗",
  body: "八点图书馆门口集合",
  tagInput: "#夜跑",
  placeName: "图书馆",
  visibility: "campus" as const,
  selectedMapLocation: null,
  selectedFileCount: 0,
};

describe("publish draft session helpers", () => {
  it("treats empty default-state input as not meaningful", () => {
    expect(
      hasMeaningfulPublishDraft({
        title: "",
        body: "",
        tagInput: "",
        placeName: "",
        visibility: "public",
        selectedMapLocation: null,
        selectedFileCount: 0,
      }),
    ).toBe(false);

    expect(
      buildPublishDraftSnapshot({
        title: "",
        body: "",
        tagInput: "",
        placeName: "",
        visibility: "public",
        selectedMapLocation: null,
        selectedFileCount: 0,
      }),
    ).toBeNull();
  });

  it("captures same-session metadata without persisting raw files", () => {
    const snapshot = buildPublishDraftSnapshot({
      title: "夜跑约吗",
      body: "八点图书馆门口集合",
      tagInput: "#夜跑",
      placeName: "图书馆",
      visibility: "campus",
      selectedMapLocation: {
        id: "lib-1",
        name: "主图书馆",
        type: "library",
        placeId: "place-lib-1",
        lat: 31.23,
        lng: 121.47,
      },
      selectedFileCount: 2,
    });

    expect(snapshot).toEqual({
      title: "夜跑约吗",
      body: "八点图书馆门口集合",
      tagInput: "#夜跑",
      placeName: "图书馆",
      visibility: "campus",
      selectedMapLocation: {
        id: "lib-1",
        name: "主图书馆",
        type: "library",
        placeId: "place-lib-1",
        lat: 31.23,
        lng: 121.47,
      },
      pendingImageCount: 2,
    });
  });

  it("reads back valid stored drafts and ignores invalid visibility safely", () => {
    const storage = createMemoryStorage();

    savePublishDraft(
      {
        title: "午饭搭子",
        body: "",
        tagInput: "",
        placeName: "",
        visibility: "public",
        selectedMapLocation: null,
        selectedFileCount: 1,
      },
      PUBLISH_DRAFT_SCOPE_ANONYMOUS,
      storage,
    );

    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)).toEqual({
      title: "午饭搭子",
      body: "",
      tagInput: "",
      placeName: "",
      visibility: "public",
      selectedMapLocation: null,
      pendingImageCount: 1,
    });

    storage.setItem(
      `${PUBLISH_DRAFT_SESSION_KEY}::${PUBLISH_DRAFT_SCOPE_ANONYMOUS}`,
      JSON.stringify({ title: "测试", visibility: "everyone" }),
    );
    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)).toEqual({
      title: "测试",
      body: "",
      tagInput: "",
      placeName: "",
      visibility: "public",
      selectedMapLocation: null,
      pendingImageCount: 0,
    });
  });

  it("clears stored draft state for a single scope", () => {
    const storage = createMemoryStorage();

    savePublishDraft(
      {
        title: "测试",
        body: "",
        tagInput: "",
        placeName: "",
        visibility: "public",
        selectedMapLocation: null,
        selectedFileCount: 0,
      },
      PUBLISH_DRAFT_SCOPE_ANONYMOUS,
      storage,
    );

    clearPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage);
    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)).toBeNull();
  });

  it("restores map-location metadata back into a view-friendly object", () => {
    expect(
      restorePublishDraftLocation({
        id: "canteen-1",
        name: "第一食堂",
        type: "canteen",
        placeId: "place-canteen-1",
        lat: 30.1,
        lng: 120.2,
      }),
    ).toEqual({
      id: "canteen-1",
      name: "第一食堂",
      type: "canteen",
      placeId: "place-canteen-1",
      lat: 30.1,
      lng: 120.2,
    });
  });
});

describe("publish draft scope (issue #692)", () => {
  it("resolves a stable scope from the user identifier", () => {
    expect(resolvePublishDraftScope({ id: "user-123" })).toBe("u:user-123");
    expect(resolvePublishDraftScope({ id: "  user-456 " })).toBe("u:user-456");
    expect(resolvePublishDraftScope({ id: null, username: "alice" })).toBe("un:alice");
    expect(resolvePublishDraftScope(null)).toBe(PUBLISH_DRAFT_SCOPE_ANONYMOUS);
    expect(resolvePublishDraftScope(undefined)).toBe(PUBLISH_DRAFT_SCOPE_ANONYMOUS);
    expect(resolvePublishDraftScope({ id: "", username: "" })).toBe(PUBLISH_DRAFT_SCOPE_ANONYMOUS);
  });

  it("restores the same user's draft on a fresh read", () => {
    const storage = createMemoryStorage();
    const scope = resolvePublishDraftScope({ id: "alice" });

    savePublishDraft(SAMPLE_INPUT, scope, storage);

    const restored = readPublishDraft(scope, storage);
    expect(restored?.title).toBe(SAMPLE_INPUT.title);
    expect(restored?.body).toBe(SAMPLE_INPUT.body);
  });

  it("does not surface another user's draft when reading under a different scope", () => {
    const storage = createMemoryStorage();
    const aliceScope = resolvePublishDraftScope({ id: "alice" });
    const bobScope = resolvePublishDraftScope({ id: "bob" });

    savePublishDraft(SAMPLE_INPUT, aliceScope, storage);

    expect(readPublishDraft(bobScope, storage)).toBeNull();
    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)).toBeNull();
    // Alice's draft is untouched.
    expect(readPublishDraft(aliceScope, storage)?.title).toBe(SAMPLE_INPUT.title);
  });

  it("keeps anonymous drafts isolated from logged-in scopes", () => {
    const storage = createMemoryStorage();
    const aliceScope = resolvePublishDraftScope({ id: "alice" });

    savePublishDraft(
      { ...SAMPLE_INPUT, title: "anonymous note" },
      PUBLISH_DRAFT_SCOPE_ANONYMOUS,
      storage,
    );
    savePublishDraft({ ...SAMPLE_INPUT, title: "alice note" }, aliceScope, storage);

    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)?.title).toBe("anonymous note");
    expect(readPublishDraft(aliceScope, storage)?.title).toBe("alice note");
  });

  it("clearAllPublishDrafts removes every scoped slot on logout / account switch", () => {
    const storage = createMemoryStorage();

    savePublishDraft(SAMPLE_INPUT, resolvePublishDraftScope({ id: "alice" }), storage);
    savePublishDraft(SAMPLE_INPUT, resolvePublishDraftScope({ id: "bob" }), storage);
    savePublishDraft(SAMPLE_INPUT, PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage);
    // Pre-existing legacy key (before scoping was introduced) should also be wiped
    // so an upgrade from an older session doesn't leak across accounts.
    storage.setItem(PUBLISH_DRAFT_SESSION_KEY, JSON.stringify({ title: "legacy" }));
    // An unrelated key must remain.
    storage.setItem("lian.unrelated", "keep me");

    clearAllPublishDrafts(storage);

    expect(readPublishDraft(resolvePublishDraftScope({ id: "alice" }), storage)).toBeNull();
    expect(readPublishDraft(resolvePublishDraftScope({ id: "bob" }), storage)).toBeNull();
    expect(readPublishDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, storage)).toBeNull();
    expect(storage.getItem(PUBLISH_DRAFT_SESSION_KEY)).toBeNull();
    expect(storage.getItem("lian.unrelated")).toBe("keep me");
  });

  it("logout-then-login simulation: bob does not see alice's draft", () => {
    const storage = createMemoryStorage();
    const aliceScope = resolvePublishDraftScope({ id: "alice" });
    const bobScope = resolvePublishDraftScope({ id: "bob" });

    // Alice signs in, types a draft (autosave persists).
    savePublishDraft(SAMPLE_INPUT, aliceScope, storage);

    // Alice logs out — ProfileView calls clearAllPublishDrafts.
    clearAllPublishDrafts(storage);

    // Bob signs in, opens publish — restore must come back empty for bob.
    expect(readPublishDraft(bobScope, storage)).toBeNull();
  });
});
