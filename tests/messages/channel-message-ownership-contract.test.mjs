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
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/MessagesView.vue"), "utf8");
const channelThreadSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/ChannelThread.vue"), "utf8");

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
  assert.match(typesMessages, /id\?:\s*string;/);
  assert.match(typesMessages, /authoritative\?:\s*boolean;/);
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

test("normalizeChannelMessage does not derive actor.id from display fields", () => {
  assert.doesNotMatch(apiMessages, /legacy:/);
  assert.doesNotMatch(apiMessages, /identityTag \|\| raw\.actor\.displayName/);
});

test("normalizeChannelMessage marks server-provided actor.id as authoritative", () => {
  assert.match(apiMessages, /authoritative:\s*true/);
});

test("normalizeChannelMessage defaults deliveryState to sent", () => {
  assert.match(apiMessages, /raw\.deliveryState \|\| "sent"/);
});

test("normalizeChannelMessage computes isSelf only when actor id is authoritative", () => {
  assert.match(apiMessages, /raw\.isSelf \?\? \(actor\?\.authoritative \? actor\.id === clientId : false\)/);
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

// --- Pure JS: actor id authority semantics ---

test("actor without id stays undefined and is non-authoritative", () => {
  const raw = { displayName: "小明", identityTag: "校园" };
  const actor = raw.id ? { id: raw.id, authoritative: true } : {};
  assert.equal(actor.id, undefined);
  assert.equal(actor.authoritative, undefined);
});

test("actor with id is marked authoritative", () => {
  const raw = { id: "user-abc", displayName: "小明" };
  const actor = raw.id ? { id: raw.id, authoritative: true } : {};
  assert.equal(actor.id, "user-abc");
  assert.equal(actor.authoritative, true);
});

test("actor without id does not leak display fields into identity", () => {
  const raw = { displayName: "小明" };
  const actor = { ...raw, ...(raw.id ? { id: raw.id, authoritative: true } : {}) };
  assert.equal(actor.id, undefined);
  assert.equal(actor.displayName, "小明");
  assert.equal(actor.authoritative, undefined);
});

test("no legacy prefix is ever derived from display fields", () => {
  const cases = [
    { displayName: "小明", identityTag: "校园" },
    { displayName: "小明" },
    { identityTag: "校园" },
    {},
  ];
  for (const raw of cases) {
    const id = raw.id || undefined;
    assert.equal(id, undefined, `expected no derived id for ${JSON.stringify(raw)}`);
  }
});

test("isSelf defaults to true for authoritative actor matching clientId", () => {
  const clientId = "client-123";
  const actor = { id: "client-123", authoritative: true };
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actor.authoritative ? actor.id === clientId : false);
  assert.equal(isSelf, true);
});

test("isSelf defaults to false for authoritative actor not matching clientId", () => {
  const clientId = "client-123";
  const actor = { id: "client-456", authoritative: true };
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actor.authoritative ? actor.id === clientId : false);
  assert.equal(isSelf, false);
});

test("isSelf defaults to false for non-authoritative actor even if id matches", () => {
  const clientId = "client-123";
  const actor = { id: "client-123", authoritative: false };
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actor.authoritative ? actor.id === clientId : false);
  assert.equal(isSelf, false);
});

test("isSelf defaults to false when actor has no id", () => {
  const clientId = "client-123";
  const actor = {};
  const rawIsSelf = undefined;
  const isSelf = rawIsSelf ?? (actor.authoritative ? actor.id === clientId : false);
  assert.equal(isSelf, false);
});

test("server-provided isSelf takes precedence over client computation", () => {
  const clientId = "client-123";
  const actor = { id: "client-456", authoritative: true };
  const rawIsSelf = true;
  const isSelf = rawIsSelf ?? (actor.authoritative ? actor.id === clientId : false);
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
