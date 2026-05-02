import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const locationsPath = path.join(rootDir, "data", "locations.json");

const MAP_V2_BOUNDS = {
  south: 18.3700734,
  west: 109.9940365,
  north: 18.4149043,
  east: 110.0503482,
};

const VALID_TYPES = new Set([
  "campus", "school", "study", "life", "transport",
  "food", "sports", "village", "landmark", "other",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(list, id, field, message) {
  list.push({ id, field, message });
}

function inBounds(lat, lng) {
  return (
    lat >= MAP_V2_BOUNDS.south &&
    lat <= MAP_V2_BOUNDS.north &&
    lng >= MAP_V2_BOUNDS.west &&
    lng <= MAP_V2_BOUNDS.east
  );
}

function validateLocation(loc, errors, warnings) {
  const id = loc.id || "(no id)";

  if (typeof loc.id !== "string" || !loc.id.trim()) {
    issue(errors, id, "id", "must be a non-empty string");
  }

  if (typeof loc.name !== "string" || !loc.name.trim()) {
    issue(errors, id, "name", "must be a non-empty string");
  }

  if (typeof loc.lat !== "number" || !Number.isFinite(loc.lat)) {
    issue(errors, id, "lat", "must be a finite number");
  } else if (!inBounds(loc.lat, loc.lng)) {
    issue(errors, id, "lat/lng", `(${loc.lat}, ${loc.lng}) is outside Map v2 bounds`);
  }

  if (typeof loc.lng !== "number" || !Number.isFinite(loc.lng)) {
    issue(errors, id, "lng", "must be a finite number");
  }

  if (loc.type !== undefined) {
    if (typeof loc.type !== "string" || !VALID_TYPES.has(loc.type)) {
      issue(warnings, id, "type", `unknown type "${loc.type}"`);
    }
  }

  if (loc.aliases !== undefined) {
    if (!Array.isArray(loc.aliases)) {
      issue(errors, id, "aliases", "must be an array");
    } else {
      for (const [i, a] of loc.aliases.entries()) {
        if (typeof a !== "string") {
          issue(errors, id, `aliases[${i}]`, "must be a string");
        }
      }
    }
  }

  if (loc.coordSystem !== undefined && loc.coordSystem !== "gcj02") {
    issue(warnings, id, "coordSystem", `unexpected value "${loc.coordSystem}"`);
  }

  if (loc.legacyPoint !== undefined) {
    if (!isObject(loc.legacyPoint)) {
      issue(errors, id, "legacyPoint", "must be an object");
    } else {
      if (typeof loc.legacyPoint.x !== "number") {
        issue(errors, id, "legacyPoint.x", "must be a number");
      }
      if (typeof loc.legacyPoint.y !== "number") {
        issue(errors, id, "legacyPoint.y", "must be a number");
      }
    }
  }

  if (loc.status !== undefined && loc.status !== "active" && loc.status !== "draft") {
    issue(warnings, id, "status", `unexpected status "${loc.status}"`);
  }
}

function checkDuplicates(items, errors) {
  const ids = new Map();
  const coords = new Map();

  for (const loc of items) {
    const id = loc.id;
    if (ids.has(id)) {
      issue(errors, id, "id", `duplicate id (also seen on "${ids.get(id)}")`);
    }
    ids.set(id, id);

    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      const key = `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
      if (coords.has(key)) {
        issue(errors, id, "lat/lng", `duplicate coordinates with "${coords.get(key)}"`);
      }
      coords.set(key, id);
    }
  }
}

async function main() {
  const raw = await fs.readFile(locationsPath, "utf8");
  const data = JSON.parse(raw);
  const errors = [];
  const warnings = [];

  if (!isObject(data)) {
    issue(errors, "(root)", "", "file must contain a JSON object");
    console.log(JSON.stringify({ ok: false, checked: 0, errors, warnings }, null, 2));
    process.exit(1);
  }

  if (!Array.isArray(data.items)) {
    issue(errors, "(root)", "items", "items must be an array");
    console.log(JSON.stringify({ ok: false, checked: 0, errors, warnings }, null, 2));
    process.exit(1);
  }

  for (const loc of data.items) {
    if (!isObject(loc)) {
      issue(errors, "(unknown)", "", "each item must be an object");
      continue;
    }
    validateLocation(loc, errors, warnings);
  }

  checkDuplicates(data.items, errors);

  const result = {
    ok: errors.length === 0,
    checked: data.items.length,
    errors,
    warnings,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
