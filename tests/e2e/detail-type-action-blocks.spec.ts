import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("journey: detail normalizer stamps a stable post.type even when the extension payload is absent", () => {
  const api = read("src/api/posts.ts");
  expect(api).toMatch(/const type = normalizeDetailPostType\(record, Boolean\(cover\)\)/);
  expect(api).toMatch(/return \{[\s\S]*\btype,\s*title:/);
});

test("journey: panel forwards the normalized type into the detail content surface", () => {
  const panel = read("src/features/detail/PostDetailPanel.vue");
  expect(panel).toMatch(/<PostDetailContent/);
  expect(panel).toMatch(/:post-type="post\?\.type"/);
});

test("journey: detail content falls back for event, help, merchant, and trade posts", () => {
  const content = read("src/features/detail/PostDetailContent.vue");
  for (const slug of ["event", "help", "merchant", "trade"]) {
    expect(content).toMatch(new RegExp(`show${slug[0]!.toUpperCase()}${slug.slice(1)}Fallback`));
  }
  expect(content).toMatch(/<PostDetailTypedFallbackBlock/);
});

test("journey: typed fallback surfaces an explicit blocked action instead of disappearing", () => {
  const fallback = read("src/features/detail/PostDetailTypedFallbackBlock.vue");
  expect(fallback).toMatch(/:data-testid="rootTestId"/);
  expect(fallback).toMatch(/:data-testid="actionTestId"/);
  expect(fallback).toMatch(/:data-testid="reasonTestId"/);
  expect(fallback).toMatch(/disabled/);
  expect(fallback).toMatch(/暂时无法报名/);
  expect(fallback).toMatch(/暂时无法投票/);
  expect(fallback).toMatch(/暂时无法帮我取/);
  expect(fallback).toMatch(/暂时无法查看交易状态/);
});
