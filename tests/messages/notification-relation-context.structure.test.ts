import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const source = readFileSync(
  path.join(repoRoot, "src/features/messages/NotificationList.vue"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("NotificationList relation target context", () => {
  it("uses the shared source-plus-id identity for Vue keys and memo invalidation", () => {
    expect(source).toContain('import { notificationIdentityKey } from "./useNotifications";');
    expect(source).toContain(':key="notificationIdentityKey(item)"');
    expect(source).toMatch(/v-memo="\[[\s\S]*item\.source,[\s\S]*item\.id,/);
  });

  it("declares a literal-fallback label mapper for known PostRelation types", () => {
    expect(source).toMatch(/help_event_link:\s*RELATION_TYPE_HELP_EVENT_LINK/);
    expect(source).toMatch(/solution_event:\s*RELATION_TYPE_SOLUTION_EVENT/);
    expect(source).toMatch(/event_recap:\s*RELATION_TYPE_EVENT_RECAP/);
    expect(source).toMatch(/merchant_errand:\s*RELATION_TYPE_MERCHANT_ERRAND/);
    expect(source).toMatch(/project_submission:\s*RELATION_TYPE_PROJECT_SUBMISSION/);
    expect(source).toMatch(/event_reward:\s*RELATION_TYPE_EVENT_REWARD/);
    expect(source).toMatch(/groupbuy_joined:\s*RELATION_TYPE_GROUPBUY_JOINED/);
    expect(source).toMatch(/groupbuy_created:\s*RELATION_TYPE_GROUPBUY_CREATED/);
    expect(source).toMatch(/RELATION_TYPE_LABEL\[type\]\s*\?\?\s*type/);
  });

  it("renders relation context only behind the existing relations array atom", () => {
    expect(source).toMatch(/item\.relations\?\.length/);
    expect(source).toMatch(/v-for="\(relation, index\) in item\.relations"/);
    expect(source).toMatch(/data-testid="notification-relation-context"/);
    expect(source).toMatch(/v-memo="\[[^\]]*item\.relations[^\]]*\]"/);
    expect(source).toMatch(/#\{\{ relation\.target\.id \}\}/);
    expect(source).not.toMatch(/item\.relation\b/);
    expect(source).not.toMatch(/relations\.components/);
    expect(source).not.toMatch(/Object\.values\([^)]*relations/);
  });

  it("keeps relation context display-only without relation target click contracts", () => {
    expect(source).toMatch(/data-testid="notification-relation-target"/);
    expect(source).not.toMatch(/openPostTarget|detail\.open\(|useDetailNavigation|router-link/);
  });
});
