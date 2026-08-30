import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = fs.readFileSync(
  path.join(repoRoot, ".github", "workflows", "e2e-pr-gate.yml"),
  "utf8",
);

const expectedJourneys = [
  {
    stepName: "Run store-read commerce journey",
    spec: "tests/e2e/local/commerce-store-read-journeys.spec.ts",
    flags: {
      VITE_COMMERCE_CATALOG_VISIBLE: "true",
      VITE_COMMERCE_PRODUCT_VISIBLE: "false",
      VITE_COMMERCE_CART_VISIBLE: "false",
      VITE_COMMERCE_CHECKOUT_QUOTE_VISIBLE: "false",
    },
  },
  {
    stepName: "Run product-read commerce journey",
    spec: "tests/e2e/local/commerce-product-read-journeys.spec.ts",
    flags: {
      VITE_COMMERCE_CATALOG_VISIBLE: "true",
      VITE_COMMERCE_PRODUCT_VISIBLE: "true",
      VITE_COMMERCE_CART_VISIBLE: "false",
      VITE_COMMERCE_CHECKOUT_QUOTE_VISIBLE: "false",
    },
  },
  {
    stepName: "Run cart commerce journey",
    spec: "tests/e2e/local/commerce-cart-journeys.spec.ts",
    flags: {
      VITE_COMMERCE_CATALOG_VISIBLE: "true",
      VITE_COMMERCE_PRODUCT_VISIBLE: "true",
      VITE_COMMERCE_CART_VISIBLE: "true",
      VITE_COMMERCE_CHECKOUT_QUOTE_VISIBLE: "false",
    },
  },
];

function count(source, needle) {
  return source.split(needle).length - 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workflowStep(name) {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next === -1 ? workflow.length : next);
}

test("the local commerce inventory is exactly the three explicitly gated journeys", () => {
  const localE2eRoot = path.join(repoRoot, "tests", "e2e", "local");
  const commerceSpecs = fs
    .readdirSync(localE2eRoot)
    .filter((name) => /^commerce-.*-journeys\.spec\.ts$/.test(name))
    .map((name) => `tests/e2e/local/${name}`)
    .sort();

  assert.deepEqual(commerceSpecs, expectedJourneys.map(({ spec }) => spec).sort());

  for (const spec of commerceSpecs) {
    const source = fs.readFileSync(path.join(repoRoot, spec), "utf8");
    assert.match(source, /test\.describe\(["']@local-commerce\b/);
    assert.equal(count(source, "@local-commerce"), 1, `${spec} must have exactly one suite tag`);
  }
});

test("the broad deterministic run excludes commerce before explicit journeys run", () => {
  const exclusion = "npm run test:e2e:local -- --grep-invert @local-commerce";
  assert.equal(count(workflow, exclusion), 1);
  assert.doesNotMatch(workflow, /--grep\s+@local-commerce\b/);
});

test("store, product, and cart run exactly once with an explicit visibility envelope", () => {
  const workflowSpecs = [
    ...workflow.matchAll(/tests\/e2e\/local\/commerce-[a-z0-9-]+-journeys\.spec\.ts/g),
  ].map(([spec]) => spec);

  assert.deepEqual(
    workflowSpecs,
    expectedJourneys.map(({ spec }) => spec),
  );

  for (const journey of expectedJourneys) {
    const step = workflowStep(journey.stepName);
    assert.equal(count(step, journey.spec), 1, `${journey.spec} must run exactly once`);

    for (const [flag, value] of Object.entries(journey.flags)) {
      assert.match(
        step,
        new RegExp(`^\\s+${escapeRegExp(flag)}:\\s+"${value}"\\s*$`, "m"),
        `${journey.stepName} must set ${flag}=${value}`,
      );
    }
  }
});
