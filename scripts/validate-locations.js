import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const locationsPath = path.join(rootDir, "data", "locations.json");
const layersPath = path.join(rootDir, "data", "map-v2-layers.json");

const MAP_V2_BOUNDS = {
  south: 18.37107,
  west: 109.98464,
  north: 18.41730,
  east: 110.04775,
};

const VALID_TYPES = new Set([
  "campus", "school", "study", "life", "transport",
  "food", "sports", "village", "landmark", "other",
]);

const VALID_ENV_TYPES = new Set(["beach", "forest", "water", "grass", "sand", "rock", "other"]);
const VALID_ROAD_TYPES = new Set(["main_road", "pedestrian_path", "shuttle_route", "service_path"]);

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

function validatePointArray(points, id, label, errors) {
  if (!Array.isArray(points)) {
    issue(errors, id, label, "must be an array");
    return;
  }
  for (const [i, p] of points.entries()) {
    if (typeof p.lat !== "number" || !Number.isFinite(p.lat)) {
      issue(errors, id, `${label}[${i}].lat`, "must be a finite number");
    } else if (!inBounds(p.lat, p.lng)) {
      issue(errors, id, `${label}[${i}]`, `(${p.lat}, ${p.lng}) is outside bounds`);
    }
    if (typeof p.lng !== "number" || !Number.isFinite(p.lng)) {
      issue(errors, id, `${label}[${i}].lng`, "must be a finite number");
    }
  }
}

function validateBuilding(bldg, errors, warnings) {
  const id = bldg.id || "(no id)";
  if (typeof bldg.id !== "string" || !bldg.id.trim()) issue(errors, id, "id", "must be a non-empty string");
  if (typeof bldg.name !== "string" || !bldg.name.trim()) issue(errors, id, "name", "must be a non-empty string");
  if (!Array.isArray(bldg.polygon) || bldg.polygon.length < 3) {
    issue(errors, id, "polygon", "must be an array with at least 3 points");
  } else {
    validatePointArray(bldg.polygon, id, "polygon", errors);
  }
  if (Array.isArray(bldg.entrances)) {
    for (const [i, ent] of bldg.entrances.entries()) {
      if (typeof ent.lat === "number" && typeof ent.lng === "number" && !inBounds(ent.lat, ent.lng)) {
        issue(errors, id, `entrances[${i}]`, `(${ent.lat}, ${ent.lng}) is outside bounds`);
      }
    }
  }
}

function validateEnvironmentElement(env, errors) {
  const id = env.id || "(no id)";
  if (typeof env.id !== "string" || !env.id.trim()) issue(errors, id, "id", "must be a non-empty string");
  if (typeof env.name !== "string" || !env.name.trim()) issue(errors, id, "name", "must be a non-empty string");
  if (env.type && !VALID_ENV_TYPES.has(env.type)) issue(errors, id, "type", `invalid env type "${env.type}"`);
  if (env.shape === "polygon") {
    if (!Array.isArray(env.points) || env.points.length < 3) {
      issue(errors, id, "points", "polygon shape requires at least 3 points");
    } else {
      validatePointArray(env.points, id, "points", errors);
    }
  } else if (env.shape === "point") {
    if (Array.isArray(env.points) && env.points.length > 0) {
      validatePointArray(env.points.slice(0, 1), id, "points", errors);
    }
  }
}

function validateBuildingGroup(group, buildingIds, errors) {
  const id = group.id || "(no id)";
  if (typeof group.id !== "string" || !group.id.trim()) issue(errors, id, "id", "must be a non-empty string");
  if (typeof group.name !== "string" || !group.name.trim()) issue(errors, id, "name", "must be a non-empty string");
  if (Array.isArray(group.buildingIds)) {
    for (const bid of group.buildingIds) {
      if (!buildingIds.has(bid)) {
        issue(errors, id, "buildingIds", `references unknown building "${bid}"`);
      }
    }
  }
}

function validateRoad(road, errors, warnings) {
  const id = road.id || "(no id)";
  if (typeof road.id !== "string" || !road.id.trim()) issue(errors, id, "id", "must be a non-empty string");
  if (typeof road.name !== "string" || !road.name.trim()) issue(errors, id, "name", "must be a non-empty string");
  if (road.type && !VALID_ROAD_TYPES.has(road.type)) {
    issue(warnings, id, "type", `unknown road type "${road.type}"`);
  }
  if (!Array.isArray(road.points) || road.points.length < 2) {
    issue(errors, id, "points", "must be an array with at least 2 points");
  } else {
    validatePointArray(road.points, id, "points", errors);
  }
}

const VALID_JUNCTION_TYPES = new Set(["endpoint", "T", "cross", "multi"]);

function validateJunction(jx, roadIds, errors, warnings) {
  const id = jx.id || "(no id)";
  if (typeof jx.id !== "string" || !jx.id.trim()) issue(errors, id, "id", "must be a non-empty string");
  if (jx.type && !VALID_JUNCTION_TYPES.has(jx.type)) issue(warnings, id, "type", `unknown junction type "${jx.type}"`);
  if (!jx.position || typeof jx.position.lat !== "number" || !Number.isFinite(jx.position.lat)) {
    issue(errors, id, "position.lat", "must be a finite number");
  } else if (!inBounds(jx.position.lat, jx.position.lng)) {
    issue(errors, id, "position", `(${jx.position.lat}, ${jx.position.lng}) is outside bounds`);
  }
  if (jx.position && typeof jx.position.lng !== "number" && !Number.isFinite(jx.position.lng)) {
    issue(errors, id, "position.lng", "must be a finite number");
  }
  if (Array.isArray(jx.connectedRoadIds)) {
    for (const rid of jx.connectedRoadIds) {
      if (!roadIds.has(rid)) issue(errors, id, "connectedRoadIds", `references unknown road "${rid}"`);
    }
  }
}

function checkCrossCollectionIds(locations, layers, errors) {
  const allIds = new Map();
  function check(collection, collectionName) {
    for (const item of collection) {
      if (!item.id) continue;
      if (allIds.has(item.id)) {
        issue(errors, item.id, "id", `duplicate id across collections (also in ${allIds.get(item.id)})`);
      }
      allIds.set(item.id, collectionName);
    }
  }
  check(locations, "locations");
  check(layers.areas || [], "areas");
  check(layers.routes || [], "routes");
  check(layers.roads || [], "roads");
  check(layers.junctions || [], "junctions");
  check(layers.buildings || [], "buildings");
  check(layers.environmentElements || [], "environmentElements");
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

  // Validate layers file
  let layers = {};
  let checkedLayers = 0;
  try {
    const layersRaw = await fs.readFile(layersPath, "utf8");
    layers = JSON.parse(layersRaw);

    if (Array.isArray(layers.buildings)) {
      for (const bldg of layers.buildings) {
        validateBuilding(bldg, errors, warnings);
      }
      checkedLayers += layers.buildings.length;
    }

    if (Array.isArray(layers.environmentElements)) {
      for (const env of layers.environmentElements) {
        validateEnvironmentElement(env, errors);
      }
      checkedLayers += layers.environmentElements.length;
    }

    if (Array.isArray(layers.roads)) {
      for (const road of layers.roads) {
        validateRoad(road, errors, warnings);
      }
      checkedLayers += layers.roads.length;
    }

    if (Array.isArray(layers.junctions)) {
      const roadIds = new Set((layers.roads || []).map((r) => r.id));
      for (const jx of layers.junctions) {
        validateJunction(jx, roadIds, errors, warnings);
      }
      checkedLayers += layers.junctions.length;
    }

    if (Array.isArray(layers.buildingGroups)) {
      const buildingIds = new Set((layers.buildings || []).map((b) => b.id));
      for (const group of layers.buildingGroups) {
        validateBuildingGroup(group, buildingIds, errors);
      }
      checkedLayers += layers.buildingGroups.length;
    }

    checkCrossCollectionIds(data.items, layers, errors);
  } catch (e) {
    if (e.code !== "ENOENT") {
      issue(warnings, "(layers)", "", `could not read layers file: ${e.message}`);
    }
  }

  const result = {
    ok: errors.length === 0,
    checked: data.items.length + checkedLayers,
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
