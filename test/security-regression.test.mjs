import test from "node:test";
import assert from "node:assert/strict";

import { canViewPost } from "../src/server/audience-service.js";
import { escapeHtml, buildTextPostHtml } from "../src/server/content-utils.js";
import { isAllowedImageUrl } from "../src/server/image-proxy.js";

const campusUser = {
  id: "user-1",
  institution: "海南比勒费尔德应用科学大学",
  tags: ["海南比勒费尔德应用科学大学", "高校认证"],
  status: "active"
};

test("linkOnly posts are hidden from feed and map but visible on detail when public", () => {
  const post = { visibility: "public", audience: { visibility: "public", linkOnly: true } };
  assert.equal(canViewPost(null, post, "feed"), false);
  assert.equal(canViewPost(campusUser, post, "map"), false);
  assert.equal(canViewPost(null, post, "detail"), true);
});

test("school visibility denies guests and allows matching school users", () => {
  const post = {
    visibility: "school",
    audience: {
      visibility: "school",
      schoolIds: ["海南比勒费尔德应用科学大学"],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false
    }
  };
  assert.equal(canViewPost(null, post, "detail"), false);
  assert.equal(canViewPost(campusUser, post, "detail"), true);
});

test("private visibility only allows listed users or org members", () => {
  const post = {
    visibility: "private",
    audience: {
      visibility: "private",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: ["user-1"],
      linkOnly: false
    }
  };
  assert.equal(canViewPost(null, post, "detail"), false);
  assert.equal(canViewPost({ ...campusUser, id: "other" }, post, "detail"), false);
  assert.equal(canViewPost(campusUser, post, "detail"), true);
});

test("image proxy only accepts the configured HTTPS Cloudinary path", () => {
  assert.equal(isAllowedImageUrl("https://res.cloudinary.com/dhvyvfu4n/image/upload/v1/example.jpg"), true);
  assert.equal(isAllowedImageUrl("http://res.cloudinary.com/dhvyvfu4n/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("https://evil.example.com/dhvyvfu4n/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("https://res.cloudinary.com/other/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("not-a-url"), false);
});

test("text post helpers escape HTML before rendering", () => {
  const payload = `<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>`;
  const html = buildTextPostHtml(payload);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(escapeHtml('"<&>'), "&quot;&lt;&amp;&gt;");
});
