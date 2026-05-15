import { describe, it, expect } from "vitest";
import * as brand from "../../src/config/brand";

const STRING_CONSTANTS = [
  "APP_NAME",
  "DEFAULT_USER_LABEL",
  "GUEST_DISPLAY_NAME",
  "CHANNEL_DEFAULT_TAG",
  "MAP_ARIA_LABEL",
  "LOADING_PROFILE",
  "LOADING_FEED",
  "LOADING_MAP",
  "LOADING_LIST",
  "LOADING_DETAIL",
  "LOADING_CHANNEL",
  "LOADING_NOTIFICATION",
  "LOADING_PLACE",
  "EMPTY_HISTORY",
  "EMPTY_SAVED",
  "EMPTY_LIKED",
  "EMPTY_FEED",
  "EMPTY_CHANNEL",
  "EMPTY_NOTIFICATION",
  "EMPTY_REPLIES",
  "ERROR_LOAD_GENERIC",
  "ERROR_SEND_GENERIC",
  "ERROR_LOAD_MAP",
  "ERROR_LOAD_PLACE",
  "ERROR_LOAD_DETAIL",
  "ERROR_LOAD_CHANNEL",
  "ERROR_LOAD_NOTIFICATION",
  "ERROR_SEND_MESSAGE",
  "ERROR_SEND_REPLY",
  "ERROR_PUBLISH_IMAGE",
  "ERROR_PUBLISH_LOCATION",
  "ERROR_LIKE_ACTION",
  "ERROR_SAVE_ACTION",
  "ERROR_AUTH_GENERIC",
  "ERROR_SEND_CODE",
  "ERROR_PUBLISH_GENERIC",
  "ERROR_LOGOUT",
  "UNTITLED_CONTENT",
  "MESSAGE_EMPTY_CONTENT",
];

describe("brand constants", () => {
  for (const key of STRING_CONSTANTS) {
    it(`${key} is a non-empty string`, () => {
      const value = brand[key as keyof typeof brand];
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    });

    it(`${key} has no leading or trailing whitespace`, () => {
      const value = brand[key as keyof typeof brand] as string;
      expect(value).toBe(value.trim());
    });
  }

  it("exports expected number of string constants", () => {
    const exportedStrings = Object.entries(brand).filter(
      ([, value]) => typeof value === "string",
    );
    expect(exportedStrings.length).toBe(STRING_CONSTANTS.length);
  });
});
