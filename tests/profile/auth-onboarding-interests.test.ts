import { describe, expect, it } from "vitest";
import {
  AUTH_ONBOARDING_INTEREST_LIMIT,
  createAuthInterestSelectionState,
  loadAuthInterestSelectionState,
  toggleAuthInterestSelection,
} from "../../src/api/auth";

describe("auth onboarding interests", () => {
  it("marks loaded interests as ready and skippable", async () => {
    const state = await loadAuthInterestSelectionState(async () => ({
      interests: [
        { id: "study", label: "自习", description: "图书馆和安静角落" },
        { id: "sports", label: "运动", description: "球场和锻炼搭子" },
      ],
    }));

    expect(state.availability).toBe("ready");
    expect(state.canSkip).toBe(true);
    expect(state.options).toHaveLength(2);
  });

  it("treats empty interest rules as skippable", async () => {
    const state = await loadAuthInterestSelectionState(async () => ({ interests: [] }));

    expect(state.availability).toBe("empty");
    expect(state.canSkip).toBe(true);
    expect(state.options).toEqual([]);
  });

  it("falls back to unavailable state when auth rules fail", async () => {
    const state = await loadAuthInterestSelectionState(async () => {
      throw new Error("network down");
    });

    expect(state.availability).toBe("unavailable");
    expect(state.canSkip).toBe(true);
    expect(state.options).toEqual([]);
  });

  it("keeps zero or one selected interests within the contract", () => {
    expect(createAuthInterestSelectionState({ interests: [{ id: "art", label: "艺术", description: "展览和创作" }] }).availability).toBe("ready");

    let selected: string[] = [];
    expect(selected).toHaveLength(0);

    selected = toggleAuthInterestSelection(selected, "art");
    expect(selected).toEqual(["art"]);
  });

  it("caps interest selection at the configured limit", () => {
    const selected = ["1", "2", "3", "4", "5"];
    const next = toggleAuthInterestSelection(selected, "6", AUTH_ONBOARDING_INTEREST_LIMIT);

    expect(next).toEqual(selected);
  });
});
