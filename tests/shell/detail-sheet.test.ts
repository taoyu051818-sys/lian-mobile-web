import { describe, it, expect, beforeEach } from "vitest";
import {
  createDefaultDetailSheetState,
  type DetailSheetKind,
} from "../../src/shell/detail-sheet-types";
import { useDetailSheet } from "../../src/shell/useDetailSheet";

describe("detail-sheet-types", () => {
  describe("createDefaultDetailSheetState", () => {
    it("returns closed state with null kind and payload", () => {
      const state = createDefaultDetailSheetState();
      expect(state.open).toBe(false);
      expect(state.kind).toBeNull();
      expect(state.payload).toBeNull();
    });
  });
});

describe("useDetailSheet", () => {
  let sheet: ReturnType<typeof useDetailSheet>;

  beforeEach(() => {
    sheet = useDetailSheet();
    sheet.close();
  });

  describe("initial state", () => {
    it("is closed with null kind and payload", () => {
      expect(sheet.state.open).toBe(false);
      expect(sheet.state.kind).toBeNull();
      expect(sheet.state.payload).toBeNull();
    });
  });

  describe("open", () => {
    it("sets open to true with kind and payload", () => {
      sheet.open("post", { postId: "t1" });
      expect(sheet.state.open).toBe(true);
      expect(sheet.state.kind).toBe("post");
      expect(sheet.state.payload).toEqual({ postId: "t1" });
    });

    it("replaces kind and payload on subsequent calls", () => {
      sheet.open("post", { postId: "t1" });
      sheet.open("place", { placeId: "p1" });
      expect(sheet.state.kind).toBe("place");
      expect(sheet.state.payload).toEqual({ placeId: "p1" });
    });

    it("accepts post kind", () => {
      sheet.open("post", { postId: "t1", suppressLoading: true });
      expect(sheet.state.kind).toBe("post");
    });

    it("accepts place kind", () => {
      sheet.open("place", { placeId: "p1" });
      expect(sheet.state.kind).toBe("place");
    });

    it("accepts profile kind", () => {
      sheet.open("profile", { actorId: "a1" });
      expect(sheet.state.kind).toBe("profile");
    });
  });

  describe("close", () => {
    it("resets to closed state", () => {
      sheet.open("post", { postId: "t1" });
      sheet.close();
      expect(sheet.state.open).toBe(false);
      expect(sheet.state.kind).toBeNull();
      expect(sheet.state.payload).toBeNull();
    });

    it("is a no-op when already closed", () => {
      sheet.close();
      expect(sheet.state.open).toBe(false);
    });
  });

  describe("singleton sharing", () => {
    it("returns the same state reference across calls", () => {
      const a = useDetailSheet();
      const b = useDetailSheet();
      a.open("post", { postId: "shared" });
      expect(b.state.open).toBe(true);
      expect(b.state.payload).toEqual({ postId: "shared" });
      b.close();
      expect(a.state.open).toBe(false);
    });
  });

  describe("kind exhaustiveness", () => {
    const kinds: DetailSheetKind[] = ["post", "place", "profile"];

    for (const kind of kinds) {
      it(`supports "${kind}" kind`, () => {
        const payloads: Record<
          DetailSheetKind,
          { postId?: string; placeId?: string; actorId?: string }
        > = {
          post: { postId: "t" },
          place: { placeId: "p" },
          profile: { actorId: "a" },
        };
        sheet.open(kind, payloads[kind] as any);
        expect(sheet.state.kind).toBe(kind);
        expect(sheet.state.open).toBe(true);
      });
    }
  });
});
