import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const metadataPath = path.join(rootDir, "data", "post-metadata.json");

const allowedVisibility = new Set(["public", "campus", "school", "linkOnly", "private"]);
const allowedDistribution = new Set(["home", "hot", "nearby", "map", "search", "detail", "detailOnly", "all", "moment"]);
const knownContentTypes = new Set([
  "general",
  "official",
  "campus_activity",
  "activity_scene",
  "activity_review",
  "signup",
  "deadline",
  "travel",
  "club",
  "library_moment",
  "learning_scene",
  "food",
  "campus_moment",
  "campus_life",
  "abstract_campus",
  "place_memory",
  "map_tip",
  "campus_tip",
  "activity_archive",
  "club_archive",
  "official_recap",
  "system_test"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function issue(list, tid, field, message) {
  list.push({ tid, field, message });
}

function validateScore(value, field, tid, errors, warnings) {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issue(errors, tid, field, "must be a finite number");
    return;
  }
  if (value < 0 || value > 1) issue(warnings, tid, field, "usually should be between 0 and 1");
}

function validateStringArray(value, field, tid, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issue(errors, tid, field, "must be an array");
    return;
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || !item.trim()) issue(errors, tid, `${field}[${index}]`, "must be a non-empty string");
  }
}

function validateItem(tid, meta, errors, warnings) {
  if (!isObject(meta)) {
    issue(errors, tid, "", "metadata item must be an object");
    return;
  }

  if (meta.contentType !== undefined) {
    if (typeof meta.contentType !== "string" || !meta.contentType.trim()) {
      issue(errors, tid, "contentType", "must be a non-empty string");
    } else if (!knownContentTypes.has(meta.contentType)) {
      issue(warnings, tid, "contentType", `unknown contentType "${meta.contentType}"`);
    }
  } else {
    issue(warnings, tid, "contentType", "missing; default is general");
  }

  validateStringArray(meta.vibeTags, "vibeTags", tid, errors);
  validateStringArray(meta.sceneTags, "sceneTags", tid, errors);

  for (const field of ["locationId", "locationArea", "visibility", "sourceUrl", "timeLabel"]) {
    if (meta[field] !== undefined && typeof meta[field] !== "string") issue(errors, tid, field, "must be a string");
  }

  validateScore(meta.qualityScore, "qualityScore", tid, errors, warnings);
  validateScore(meta.imageImpactScore, "imageImpactScore", tid, errors, warnings);
  validateScore(meta.riskScore, "riskScore", tid, errors, warnings);
  validateScore(meta.officialScore, "officialScore", tid, errors, warnings);

  if (meta.visibility !== undefined && !allowedVisibility.has(meta.visibility)) {
    issue(errors, tid, "visibility", `must be one of ${Array.from(allowedVisibility).join(", ")}`);
  }

  if (meta.distribution !== undefined) {
    if (!Array.isArray(meta.distribution)) {
      issue(errors, tid, "distribution", "must be an array");
    } else if (!meta.distribution.length) {
      issue(warnings, tid, "distribution", "empty array means no natural distribution");
    } else {
      for (const [index, value] of meta.distribution.entries()) {
        if (typeof value !== "string" || !value.trim()) {
          issue(errors, tid, `distribution[${index}]`, "must be a non-empty string");
        } else if (!allowedDistribution.has(value)) {
          issue(errors, tid, `distribution[${index}]`, `unknown distribution "${value}"`);
        }
      }
      if (meta.distribution.includes("detailOnly") && meta.distribution.length > 1) {
        issue(warnings, tid, "distribution", "detailOnly should normally be used alone");
      }
    }
  } else {
    issue(warnings, tid, "distribution", "missing; default is home/search/detail");
  }

  if (meta.keepAfterExpired !== undefined && typeof meta.keepAfterExpired !== "boolean") {
    issue(errors, tid, "keepAfterExpired", "must be a boolean");
  }

  for (const field of ["startsAt", "endsAt", "expiresAt"]) {
    if (meta[field] !== undefined && meta[field] !== null && !isIsoDate(meta[field])) {
      issue(errors, tid, field, "must be an ISO-compatible date string or null");
    }
  }

  if (meta.expiresAt && meta.keepAfterExpired !== true && Date.now() > Date.parse(meta.expiresAt)) {
    issue(warnings, tid, "expiresAt", "expired content will be filtered from natural home feed");
  }

  if (meta.imageUrls !== undefined) {
    validateStringArray(meta.imageUrls, "imageUrls", tid, errors);
  }
}

async function main() {
  const raw = await fs.readFile(metadataPath, "utf8");
  const data = JSON.parse(raw);
  const errors = [];
  const warnings = [];

  if (!isObject(data)) issue(errors, "(root)", "", "file must contain a JSON object");
  if (!isObject(data.items)) issue(errors, "(root)", "items", "items must be an object");

  if (isObject(data.items)) {
    for (const [tid, meta] of Object.entries(data.items)) {
      if (!/^\d+$/.test(tid)) issue(warnings, tid, "", "tid key is not numeric");
      validateItem(tid, meta, errors, warnings);
    }
  }

  const result = {
    ok: errors.length === 0,
    checked: isObject(data.items) ? Object.keys(data.items).length : 0,
    errors,
    warnings
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
