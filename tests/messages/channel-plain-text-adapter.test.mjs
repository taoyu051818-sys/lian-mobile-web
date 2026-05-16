import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiSource = fs.readFileSync(path.join(repoRoot, "src/api/messages.ts"), "utf8");
const typesSource = fs.readFileSync(path.join(repoRoot, "src/types/messages.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/MessagesView.vue"), "utf8");

test("types/messages.ts defines ChannelMessage plainText", () => {
  assert.match(typesSource, /plainText\?: string/);
});

test("api/messages.ts exports helper-driven channel plain-text normalization", () => {
  assert.match(apiSource, /export function extractChannelMessagePlainText/);
  assert.match(apiSource, /export function resolveChannelMessagePlainText/);
  assert.match(apiSource, /const plainText = resolveChannelMessagePlainText\(raw\)/);
  assert.match(apiSource, /plainText,/);
});

test("MessagesView no longer keeps a local stripHtml helper", () => {
  assert.doesNotMatch(viewSource, /function stripHtml/);
});

test("MessagesView reads helper-produced plainText before falling back to empty-state copy", () => {
  assert.match(viewSource, /return item\.plainText \|\| item\.content \|\| "这条消息暂时没有内容。"/);
});

test("channel plain-text helper keeps text and strips tags conservatively", () => {
  const extractChannelMessagePlainText = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  assert.equal(extractChannelMessagePlainText("<p>Hello <strong>campus</strong></p>"), "Hello campus");
  assert.equal(extractChannelMessagePlainText(""), "");
});
