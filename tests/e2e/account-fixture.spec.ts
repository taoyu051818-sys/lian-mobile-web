import { expect, test } from "@playwright/test";

import { ROLES, isRoleConfigured, loginAs, roleDefinition, type RoleId } from "./fixtures/accounts";

const VERIFIABLE_ROLES = ROLES.filter((role) => role.id !== "anonymous");

test.describe("@account-fixture E2E account matrix", () => {
  test("anonymous role is always available without credentials", () => {
    expect(isRoleConfigured("anonymous")).toBe(true);
  });

  for (const role of VERIFIABLE_ROLES) {
    test(`@account-fixture ${role.id} can log in and carries expected tags`, async () => {
      if (!isRoleConfigured(role.id)) {
        test.skip(
          true,
          `role "${role.id}" not configured — set ${role.envUser}/${role.envPass} to enable`,
        );
        return;
      }

      const { api, user } = await loginAs(role.id);
      try {
        const tags = new Set<string>([...(user.tags ?? []), ...(user.verificationTags ?? [])]);

        for (const expected of role.expectedTags) {
          expect(
            tags.has(expected),
            `role "${role.id}" expected tag "${expected}" but got [${[...tags].join(", ") || "<none>"}]`,
          ).toBe(true);
        }

        const allowed = new Set<string>([...role.expectedTags, ...(role.toleratedExtraTags ?? [])]);
        for (const tag of tags) {
          if (!allowed.has(tag)) {
            console.warn(
              `[account-fixture] role "${role.id}" carries unexpected tag "${tag}" — update fixture if this is intentional`,
            );
          }
        }

        expect(user.username, `role "${role.id}" login response missing username`).toBeTruthy();
      } finally {
        await api.dispose();
      }
    });
  }

  test("@account-fixture summary lists which roles are runnable", () => {
    const status = ROLES.map((role) => ({
      id: role.id,
      configured: isRoleConfigured(role.id),
      expects: role.expectedTags,
    }));
    console.log("[account-fixture] role configuration:", JSON.stringify(status, null, 2));
    expect(status.find((entry) => entry.id === "anonymous")?.configured).toBe(true);
  });
});

test("@account-fixture role definitions are internally consistent", () => {
  for (const role of ROLES) {
    const def = roleDefinition(role.id as RoleId);
    expect(def.id).toBe(role.id);
    if (role.id === "anonymous") {
      expect(def.envUser).toBeNull();
      expect(def.envPass).toBeNull();
    } else {
      expect(def.envUser, `role "${role.id}" must declare envUser`).toMatch(
        /^LIAN_E2E_[A-Z]+_USERNAME$/,
      );
      expect(def.envPass, `role "${role.id}" must declare envPass`).toMatch(
        /^LIAN_E2E_[A-Z]+_PASSWORD$/,
      );
    }
  }
});
