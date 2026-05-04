import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const publicDir = path.join(rootDir, "public");
export const rulesPath = path.join(rootDir, "data", "feed-rules.json");
export const metadataPath = path.join(rootDir, "data", "post-metadata.json");
export const channelReadsPath = path.join(rootDir, "data", "channel-reads.json");
export const authUsersPath = path.join(rootDir, "data", "auth-users.json");
export const locationsPath = path.join(rootDir, "data", "locations.json");
export const mapV2LayersPath = path.join(rootDir, "data", "map-v2-layers.json");
export const aiPostDraftsPath = path.join(rootDir, "data", "ai-post-drafts.jsonl");
export const aiPostRecordsPath = path.join(rootDir, "data", "ai-post-records.jsonl");
export const aliasPoolPath = path.join(rootDir, "data", "alias-pool.json");
export const userCachePath = path.join(rootDir, "data", "user-cache.json");
export const envPath = path.join(rootDir, ".env");
export const taskBoardPath = path.join(rootDir, "docs", "agent", "05_TASK_BOARD.md");
