import { describe, expect, it } from "vitest";
import {
  buildPublishDraftSnapshot,
  clearPublishDraft,
  hasMeaningfulPublishDraft,
  PUBLISH_DRAFT_SESSION_KEY,
  readPublishDraft,
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
      storage,
    );

    expect(readPublishDraft(storage)).toEqual({
      title: "午饭搭子",
      body: "",
      tagInput: "",
      placeName: "",
      visibility: "public",
      selectedMapLocation: null,
      pendingImageCount: 1,
    });

    storage.setItem(
      PUBLISH_DRAFT_SESSION_KEY,
      JSON.stringify({ title: "测试", visibility: "everyone" }),
    );
    expect(readPublishDraft(storage)).toEqual({
      title: "测试",
      body: "",
      tagInput: "",
      placeName: "",
      visibility: "public",
      selectedMapLocation: null,
      pendingImageCount: 0,
    });
  });

  it("clears stored draft state", () => {
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
      storage,
    );

    clearPublishDraft(storage);
    expect(storage.getItem(PUBLISH_DRAFT_SESSION_KEY)).toBeNull();
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
