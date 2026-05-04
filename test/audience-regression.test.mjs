import test from "node:test";
import assert from "node:assert/strict";

import {
  canCreatePostWithAudience,
  canViewPost,
  normalizeAudience,
  normalizeAudienceForCreate
} from "../src/server/audience-service.js";

const cucUser = {
  id: "user-cuc",
  username: "CUC User",
  institution: "中国传媒大学海南国际学院"
};

const buptUser = {
  id: "user-bupt",
  username: "BUPT User",
  institution: "北京邮电大学玛丽女王海南学院"
};

test("normalizeAudience keeps linkOnly as public base visibility with linkOnly flag", () => {
  assert.deepEqual(normalizeAudience(null, "linkOnly"), {
    visibility: "public",
    schoolIds: [],
    orgIds: [],
    roleIds: [],
    userIds: [],
    linkOnly: true
  });

  assert.deepEqual(normalizeAudience({ visibility: "linkOnly" }), {
    visibility: "public",
    schoolIds: [],
    orgIds: [],
    roleIds: [],
    userIds: [],
    linkOnly: true
  });
});

test("normalizeAudienceForCreate fills safe school and private/self defaults", () => {
  assert.deepEqual(normalizeAudienceForCreate(cucUser, { visibility: "school" }), {
    visibility: "school",
    schoolIds: ["中国传媒大学"],
    orgIds: [],
    roleIds: [],
    userIds: [],
    linkOnly: false
  });

  assert.deepEqual(normalizeAudienceForCreate(cucUser, { visibility: "private" }), {
    visibility: "private",
    schoolIds: [],
    orgIds: [],
    roleIds: [],
    userIds: ["user-cuc"],
    linkOnly: false
  });
});

test("canCreatePostWithAudience preserves public, campus, own school, and private/self", () => {
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "public" }), true);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "campus" }), true);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "school", schoolIds: ["中国传媒大学"] }), true);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "private", userIds: ["user-cuc"] }), true);
});

test("canCreatePostWithAudience rejects obvious audience escalation", () => {
  assert.equal(canCreatePostWithAudience(null, { visibility: "public" }), false);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "unknown" }), false);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "school", schoolIds: ["北京邮电大学"] }), false);
  assert.equal(canCreatePostWithAudience(buptUser, { visibility: "school", schoolIds: ["中国传媒大学"] }), false);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "private", orgIds: ["student-union"] }), false);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "private", roleIds: ["admin"] }), false);
  assert.equal(canCreatePostWithAudience(cucUser, { visibility: "private", userIds: ["user-cuc", "other-user"] }), false);
});

test("canViewPost allows author/admin override but keeps linkOnly out of distributed contexts", () => {
  const post = {
    authorUserId: "user-cuc",
    audience: { visibility: "private", userIds: ["other-user"] }
  };
  assert.equal(canViewPost(cucUser, post, "detail"), true);

  const admin = { id: "admin-user", roleIds: ["admin"] };
  assert.equal(canViewPost(admin, post, "detail"), true);

  const linkOnly = { audience: { visibility: "public", linkOnly: true } };
  assert.equal(canViewPost(null, linkOnly, "detail"), true);
  assert.equal(canViewPost(null, linkOnly, "feed"), false);
  assert.equal(canViewPost(null, linkOnly, "map"), false);
});
