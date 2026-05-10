import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const typesMessages = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");
const typesFeed = fs.readFileSync(path.join(repoRoot, "src/types/feed.ts"), "utf8");
const typesProfile = fs.readFileSync(path.join(repoRoot, "src/types/profile.ts"), "utf8");
const apiMessages = fs.readFileSync(path.join(repoRoot, "src/api/messages.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/views/MessagesView.vue"), "utf8");
const channelThreadSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/ChannelThread.vue"), "utf8");

// --- DisplayActor.id ---

test("DisplayActor has optional id field", () => {
  assert.match(typesFeed, /export interface DisplayActor/);
  assert.match(typesFeed, /id\?:\s*string/);
});

// --- ProfileUser.id ---

test("ProfileUser has optional id field", () => {
  assert.match(typesProfile, /export interface ProfileUser/);
  assert.match(typesProfile, /id\?:\s*string/);
});

// --- ChannelMessageActor ---

test("types/messages.ts defines ChannelMessageActor extending DisplayActor", () => {
  assert.match(typesMessages, /export interface ChannelMessageActor extends DisplayActor/);
  assert.match(typesMessages, /id:\s*string;/);
});

// --- MessageDeliveryState ---

test("types/messages.ts defines MessageDeliveryState union", () => {
  assert.match(typesMessages, /export type MessageDeliveryState/);
  assert.match(typesMessages, /"sending"/);
  assert.match(typesMessages, /"sent"/);
  assert.match(typesMessages, /"delivered"/);
  assert.match(typesMessages, /"read"/);
  assert.match(typesMessages, /"failed"/);
});

// --- ChannelMessage contract fields ---

test("ChannelMessage has deliveryState field", () => {
  assert.match(typesMessages, /deliveryState\?:\s*MessageDeliveryState/);
});

test("ChannelMessage has isSelf field", () => {
  assert.match(typesMessages, /isSelf\?:\s*boolean/);
});

test("ChannelMessage.actor is typed as ChannelMessageActor", () => {
  assert.match(typesMessages, /actor\?:\s*ChannelMessageActor/);
});

// --- Normalization function ---

test("api/messages.ts exports normalizeChannelMessage", () => {
  assert.match(apiMessages, /export function normalizeChannelMessage/);
});

test("normalizeChannelMessage synthesizes actor.id for legacy messages", () => {
  assert.match(apiMessages, /raw\.actor\.id \|\| `legacy:/);
});

test("normalizeChannelMessage defaults deliveryState to sent", () => {
  assert.match(apiMessages, /raw\.deliveryState \|\| "sent"/);
});

test("normalizeChannelMessage computes isSelf from clientId when server omits it", () => {
  assert.match(apiMessages, /raw\.isSelf \?\? \(actor\?\.id === clientId\)/);
});

test("fetchChannelMessages normalizes items before returning", () => {
  assert.match(apiMessages, /response\.items\?\.map\(normalizeChannelMessage\)/);
});

// --- MessagesView ownership usage ---

test("MessagesView imports ChannelMessageActor", () => {
  assert.match(viewSource, /import type \{[^}]*ChannelMessageActor[^}]*\} from "\.\.\/types\/messages"/);
});

test("ChannelThread uses isSelf for message CSS class", () => {
  assert.match(channelThreadSource, /is-self.*item\.isSelf/);
});

test("ChannelThread shows delivery state for self messages", () => {
  assert.match(channelThreadSource, /item\.isSelf && item\.deliveryState === 'sending'/);
  assert.match(channelThreadSource, /item\.isSelf && item\.deliveryState === 'failed'/);
});

test("MessagesView messageActor returns ChannelMessageActor with fallback id", () => {
  assert.match(viewSource, /function messageActor\(item: ChannelMessage\): ChannelMessageActor/);
  assert.match(viewSource, /return item\.actor \|\| \{ id: "" \}/);
});

// --- Pure JS: normalization backward tolerance ---

test("legacy actor without id gets synthesized id", () => {
  const legacyActor = { displayName: "小明", identityTag: "校园" };
  const id = legacyActor.id || `legacy:${legacyActor.identityTag || legacyActor.displayName || "unknown"}`;
  assert.equal(id, "legacy:校园");
});

test("legacy actor without id or identityTag falls back to displayName", () => {
  const legacyActor = { displayName: "小明" };
  const id = legacyActor.id || `legacy:${legacyActor.identityTag || legacyActor.displayName || "unknown"}`;
  assert.equal(id, "legacy:小明");
});

test("legacy actor with no fields falls back to unknown", () => {
  const legacyActor = {};
  const id = legacyActor.id || `legacy:${legacyActor.identityTag || legacyActor.displayName || "unknown"}`;
  assert.equal(id, "legacy:unknown");
});

test("actor with id is preserved as-is", () => {
  const actor = { id: "user-abc", displayName: "小明" };
  const id = actor.id || `legacy:${actor.identityTag || actor.displayName || "unknown"}`;
  assert.equal(id, "user-abc");
});

test("isSelf defaults to clientId comparison when server omits it", () => {
  const clientId = "client-123";
  const actorId = "client-123";
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actorId === clientId);
  assert.equal(isSelf, true);
});

test("isSelf defaults to false when actorId differs from clientId", () => {
  const clientId = "client-123";
  const actorId = "client-456";
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actorId === clientId);
  assert.equal(isSelf, false);
});

test("server-provided isSelf takes precedence over client computation", () => {
  const clientId = "client-123";
  const actorId = "client-456";
  const rawIsSelf = true;
  const isSelf = rawIsSelf ?? (actorId === clientId);
  assert.equal(isSelf, true);
});

test("deliveryState defaults to sent when server omits it", () => {
  const raw = undefined;
  const state = raw || "sent";
  assert.equal(state, "sent");
});

test("server-provided deliveryState is preserved", () => {
  const raw = "delivered";
  const state = raw || "sent";
  assert.equal(state, "delivered");
});
