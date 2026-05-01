import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const publicDir = path.join(rootDir, "public");
export const rulesPath = path.join(rootDir, "data", "feed-rules.json");
export const metadataPath = path.join(rootDir, "data", "post-metadata.json");
export const channelReadsPath = path.join(rootDir, "data", "channel-reads.json");
export const authUsersPath = path.join(rootDir, "data", "auth-users.json");
export const envPath = path.join(rootDir, ".env");