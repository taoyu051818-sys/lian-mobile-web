import { describe, expect, it } from "vitest";

import {
  isAdminMeRoleEligible,
  type AdminMeResponse,
} from "../../src/api/admin";

function response(partial: Partial<AdminMeResponse>): AdminMeResponse {
  return {
    ok: true,
    viaToken: false,
    user: null,
    ...partial,
  };
}

describe("isAdminMeRoleEligible", () => {
  it("returns false for nullish responses", () => {
    expect(isAdminMeRoleEligible(null)).toBe(false);
    expect(isAdminMeRoleEligible(undefined)).toBe(false);
  });

  it("returns false when ok is false", () => {
    expect(
      isAdminMeRoleEligible({ ok: false, viaToken: false, user: null }),
    ).toBe(false);
  });

  it("accepts the legacy ADMIN_TOKEN bearer fast-path", () => {
    expect(
      isAdminMeRoleEligible(response({ viaToken: true, user: null })),
    ).toBe(true);
  });

  it("accepts a session whose roleIds include admin", () => {
    expect(
      isAdminMeRoleEligible(
        response({ user: { id: "u-1", roleIds: ["admin"] } }),
      ),
    ).toBe(true);
  });

  it("accepts a session whose roleIds include moderator", () => {
    expect(
      isAdminMeRoleEligible(
        response({ user: { id: "u-1", roleIds: ["moderator"] } }),
      ),
    ).toBe(true);
  });

  it("normalizes case and surrounding whitespace on roleIds", () => {
    expect(
      isAdminMeRoleEligible(
        response({ user: { id: "u-1", roleIds: ["  Admin  "] } }),
      ),
    ).toBe(true);
  });

  it("rejects sessions without admin or moderator roles", () => {
    expect(
      isAdminMeRoleEligible(
        response({ user: { id: "u-1", roleIds: ["registered"] } }),
      ),
    ).toBe(false);
    expect(
      isAdminMeRoleEligible(response({ user: { id: "u-1", roleIds: [] } })),
    ).toBe(false);
    expect(isAdminMeRoleEligible(response({ user: null }))).toBe(false);
  });
});
