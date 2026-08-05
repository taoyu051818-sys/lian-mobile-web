import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("retired frontend code stays retired", () => {
  it("keeps errand transport in the dedicated API module", () => {
    const eventApi = read("src/api/events.ts");
    const errandApi = read("src/api/errands.ts");

    expect(eventApi).not.toContain("/api/errands");
    expect(eventApi).not.toMatch(/\bCreateErrandOrderInput\b/);
    expect(eventApi).not.toMatch(/\breportRunnerLocation\b/);
    expect(errandApi).toMatch(/export async function createErrandOrder/);
    expect(errandApi).toMatch(/export async function fetchErrandOrder/);
  });

  it("keeps errand lifecycle types in their dedicated module", () => {
    const postExtensions = read("src/types/post-extensions.ts");
    const errandTypes = read("src/types/errand.ts");

    expect(postExtensions).not.toMatch(/export (?:interface|type) Errand/);
    expect(errandTypes).toMatch(/export type ErrandMode/);
    expect(errandTypes).toMatch(/export type ErrandStatus/);
    expect(errandTypes).toMatch(/export interface ErrandOrder/);
  });

  it("does not restore the test-only feed id helper", () => {
    expect(existsSync(path.join(repoRoot, "src/features/feed/feedItemId.ts"))).toBe(false);
  });

  it("keeps browser storage focused on active read-history helpers", () => {
    const source = read("src/platform/browser-storage.ts");

    expect(source).not.toMatch(/HOME_UPDATE_PROBE_PREFIX/);
    expect(source).not.toMatch(/export \{ CLIENT_ID_KEY, ensureClientId \}/);
    expect(source).toMatch(/export function readHistoryEntries/);
    expect(source).toMatch(/export function rememberReadItem/);
  });

  it("exports only haptic functions with active callers", () => {
    const source = read("src/composables/useHapticFeedback.ts");

    expect(source).not.toMatch(/export function hapticHeavy/);
    expect(source).not.toMatch(/export function useHapticFeedback/);
    for (const activeExport of ["hapticLight", "hapticMedium", "hapticSuccess", "hapticError"]) {
      expect(source).toContain(`export function ${activeExport}`);
    }
  });

  it("does not retain selectors with no matching template classes", () => {
    const styles = `${read("src/styles/main.css")}\n${read("src/styles/content-immersive-ui.css")}`;

    for (const retiredSelector of [
      ".vue-shell__hero",
      ".vue-shell__eyebrow",
      ".vue-shell__summary",
      ".vue-shell__section",
      ".vue-shell__row",
      ".vue-shell__sample-card",
      ".vue-shell__sample-title",
      ".vue-shell__sample-meta",
      ".feed-view__masonry",
      ".feed-view__masonry-column",
    ]) {
      expect(styles).not.toContain(retiredSelector);
    }
  });
});
