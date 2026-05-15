import { describe, it, expect } from "vitest";
import { placeTypeLabel } from "../../src/domain/place";

describe("placeTypeLabel", () => {
  it("maps known raw type values to stable Chinese labels", () => {
    expect(placeTypeLabel("canteen")).toBe("食堂");
    expect(placeTypeLabel("library")).toBe("图书馆");
    expect(placeTypeLabel("building")).toBe("教学楼");
    expect(placeTypeLabel("dormitory")).toBe("宿舍");
    expect(placeTypeLabel("transit")).toBe("交通站点");
    expect(placeTypeLabel("sports")).toBe("体育场馆");
    expect(placeTypeLabel("lab")).toBe("实验室");
    expect(placeTypeLabel("office")).toBe("办公楼");
    expect(placeTypeLabel("garden")).toBe("校园绿地");
    expect(placeTypeLabel("shop")).toBe("商店");
  });

  it("maps synonyms to the same label", () => {
    expect(placeTypeLabel("cafeteria")).toBe("食堂");
    expect(placeTypeLabel("food_court")).toBe("食堂");
    expect(placeTypeLabel("dining")).toBe("食堂");
    expect(placeTypeLabel("dorm")).toBe("宿舍");
    expect(placeTypeLabel("residence")).toBe("宿舍");
    expect(placeTypeLabel("laboratory")).toBe("实验室");
    expect(placeTypeLabel("gym")).toBe("体育场馆");
    expect(placeTypeLabel("stadium")).toBe("体育场馆");
    expect(placeTypeLabel("classroom")).toBe("教学楼");
    expect(placeTypeLabel("academic")).toBe("教学楼");
  });

  it("is case-insensitive", () => {
    expect(placeTypeLabel("Canteen")).toBe("食堂");
    expect(placeTypeLabel("LIBRARY")).toBe("图书馆");
    expect(placeTypeLabel("Dormitory")).toBe("宿舍");
    expect(placeTypeLabel("Food_Court")).toBe("食堂");
  });

  it("trims whitespace before matching", () => {
    expect(placeTypeLabel("  canteen  ")).toBe("食堂");
    expect(placeTypeLabel(" library ")).toBe("图书馆");
  });

  it("falls back to secondary when primary is empty", () => {
    expect(placeTypeLabel(undefined, "canteen")).toBe("食堂");
    expect(placeTypeLabel(null, "library")).toBe("图书馆");
    expect(placeTypeLabel("", "building")).toBe("教学楼");
  });

  it("prefers primary over secondary", () => {
    expect(placeTypeLabel("canteen", "library")).toBe("食堂");
  });

  it("returns raw value for unknown types", () => {
    expect(placeTypeLabel("fountain")).toBe("fountain");
    expect(placeTypeLabel("unknown_type")).toBe("unknown_type");
  });

  it("returns fallback when both inputs are empty", () => {
    expect(placeTypeLabel()).toBe("校园地点");
    expect(placeTypeLabel(null, null)).toBe("校园地点");
    expect(placeTypeLabel("", "")).toBe("校园地点");
    expect(placeTypeLabel(undefined, undefined)).toBe("校园地点");
  });
});
