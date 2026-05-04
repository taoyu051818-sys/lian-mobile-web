#!/usr/bin/env node

// Unit tests for hydrateAudienceUser and auto-hydration in permission functions.
// Usage: node scripts/test-audience-hydration.js

import {
  hydrateAudienceUser,
  canViewPost,
  canModeratePost,
  canReplyToPost,
  canCreatePostWithAudience,
  canSeeAudienceOption,
  deriveSchoolId
} from "../src/server/audience-service.js";

let passed = 0, failed = 0;

function assert(cond, name) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function assertDeepEqual(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name} — got ${JSON.stringify(actual)}`); failed++; }
}

// --- Auth-store-shaped users (institution + tags, no schoolId/orgIds/roleIds) ---

const rawCucUser = {
  id: "u-cuc",
  email: "xy@cuc.edu.cn",
  username: "linxiaoyu",
  institution: "中国传媒大学海南国际学院",
  tags: ["中国传媒大学", "高校认证"],
  status: "active"
};

const rawBuptUser = {
  id: "u-bupt",
  email: "zty@bupt.edu.cn",
  username: "zhaotianyu",
  institution: "北京邮电大学玛丽女王海南学院",
  tags: ["北京邮电大学", "高校认证"],
  status: "active"
};

const rawExternalUser = {
  id: "u-ext",
  email: "zhangsan@gmail.com",
  username: "zhangsan",
  institution: "",
  tags: ["邀请注册"],
  status: "active"
};

const rawUserWithOrgIds = {
  id: "u-org",
  email: "org@test.com",
  username: "orguser",
  institution: "中国传媒大学海南国际学院",
  tags: ["中国传媒大学", "高校认证"],
  orgIds: ["council", "photo-club"],
  status: "active"
};

const rawUserWithSchoolId = {
  id: "u-pre",
  email: "pre@test.com",
  username: "preuser",
  institution: "中国传媒大学海南国际学院",
  tags: ["中国传媒大学", "高校认证"],
  schoolId: "中国传媒大学",
  orgIds: [],
  roleIds: ["moderator"],
  status: "active"
};

function main() {
  console.log("═══ Audience Hydration 单元测试 ═══\n");

  // === hydrateAudienceUser ===
  console.log("▶ hydrateAudienceUser");

  // H1: null → guest
  const guest = hydrateAudienceUser(null);
  assert(guest.isGuest === true, "H1a: null → isGuest=true");
  assert(guest.id === "", "H1b: null → id empty");
  assert(guest.schoolId === "", "H1c: null → schoolId empty");
  assertDeepEqual(guest.orgIds, [], "H1d: null → orgIds=[]");
  assertDeepEqual(guest.roleIds, [], "H1e: null → roleIds=[]");
  assert(guest.isAdmin === false, "H1f: null → isAdmin=false");

  // H2: raw user with institution → derives schoolId
  const cucViewer = hydrateAudienceUser(rawCucUser);
  assert(cucViewer.isGuest === false, "H2a: CUC user → not guest");
  assert(cucViewer.id === "u-cuc", "H2b: CUC user → id preserved");
  assert(cucViewer.schoolId === "中国传媒大学", "H2c: CUC user → schoolId derived");
  assertDeepEqual(cucViewer.orgIds, [], "H2d: CUC user → orgIds=[]");
  assert(cucViewer.isAdmin === false, "H2e: CUC user → not admin");

  // H3: BUPT user
  const buptViewer = hydrateAudienceUser(rawBuptUser);
  assert(buptViewer.schoolId === "北京邮电大学", "H3: BUPT user → schoolId derived");

  // H4: external user (no institution)
  const extViewer = hydrateAudienceUser(rawExternalUser);
  assert(extViewer.schoolId === "", "H4: external user → schoolId empty");
  assert(extViewer.isGuest === false, "H4b: external user → not guest (has id)");

  // H5: user with orgIds preserved
  const orgViewer = hydrateAudienceUser(rawUserWithOrgIds);
  assertDeepEqual(orgViewer.orgIds, ["council", "photo-club"], "H5: orgIds preserved");

  // H6: user with pre-set schoolId + roleIds
  const preViewer = hydrateAudienceUser(rawUserWithSchoolId);
  assert(preViewer.schoolId === "中国传媒大学", "H6a: pre-set schoolId preserved");
  assertDeepEqual(preViewer.roleIds, ["moderator"], "H6b: pre-set roleIds preserved");

  // H7: isAdmin option
  const adminViewer = hydrateAudienceUser(rawCucUser, { isAdmin: true });
  assert(adminViewer.isAdmin === true, "H7a: isAdmin option → true");
  assert(adminViewer.roleIds.includes("admin"), "H7b: admin added to roleIds");

  // H8: isAdmin with pre-existing roleIds
  const modAdmin = hydrateAudienceUser(rawUserWithSchoolId, { isAdmin: true });
  assert(modAdmin.roleIds.includes("admin"), "H8a: admin appended to existing roles");
  assert(modAdmin.roleIds.includes("moderator"), "H8b: existing roles preserved");

  console.log("");

  // === canViewPost with raw auth-store users ===
  console.log("▶ canViewPost auto-hydration");

  const publicPost = { visibility: "public", audience: { visibility: "public" } };
  const cucSchoolPost = {
    visibility: "school",
    audience: { visibility: "school", schoolIds: ["中国传媒大学"] }
  };
  const buptSchoolPost = {
    visibility: "school",
    audience: { visibility: "school", schoolIds: ["北京邮电大学"] }
  };
  const campusPost = { visibility: "campus" };
  const councilPost = {
    visibility: "private",
    audience: { visibility: "private", orgIds: ["council"] }
  };

  // V1: public — everyone can see
  assert(canViewPost(null, publicPost) === true, "V1a: guest sees public");
  assert(canViewPost(rawCucUser, publicPost) === true, "V1b: CUC user sees public");

  // V2: campus — login required
  assert(canViewPost(null, campusPost) === false, "V2a: guest cannot see campus");
  assert(canViewPost(rawCucUser, campusPost) === true, "V2b: CUC user sees campus");
  assert(canViewPost(rawExternalUser, campusPost) === true, "V2c: external user sees campus");

  // V3: school — institution-derived schoolId match
  assert(canViewPost(null, cucSchoolPost) === false, "V3a: guest cannot see CUC school");
  assert(canViewPost(rawCucUser, cucSchoolPost) === true, "V3b: CUC user sees CUC school post");
  assert(canViewPost(rawBuptUser, cucSchoolPost) === false, "V3c: BUPT user cannot see CUC school");
  assert(canViewPost(rawExternalUser, cucSchoolPost) === false, "V3d: external cannot see CUC school");
  assert(canViewPost(rawBuptUser, buptSchoolPost) === true, "V3e: BUPT user sees BUPT school post");
  assert(canViewPost(rawCucUser, buptSchoolPost) === false, "V3f: CUC user cannot see BUPT school");

  // V4: private + org — orgIds derived from auth user
  assert(canViewPost(null, councilPost) === false, "V4a: guest cannot see org post");
  assert(canViewPost(rawCucUser, councilPost) === false, "V4b: CUC user without orgIds cannot see org");
  assert(canViewPost(rawUserWithOrgIds, councilPost) === true, "V4c: user with council orgIds sees org post");

  // V5: linkOnly — feed/map never see, detail checks base visibility
  const linkOnlyPublic = {
    visibility: "public",
    audience: { visibility: "public", linkOnly: true }
  };
  assert(canViewPost(rawCucUser, linkOnlyPublic, "feed") === false, "V5a: linkOnly not in feed");
  assert(canViewPost(rawCucUser, linkOnlyPublic, "map") === false, "V5b: linkOnly not in map");
  assert(canViewPost(rawCucUser, linkOnlyPublic, "detail") === true, "V5c: linkOnly public detail ok");
  assert(canViewPost(null, linkOnlyPublic, "detail") === true, "V5d: linkOnly public detail anonymous ok");

  console.log("");

  // === canModeratePost ===
  console.log("▶ canModeratePost auto-hydration");
  const post = { authorUserId: "someone-else" };
  assert(canModeratePost(null, post) === false, "M1: guest cannot moderate");
  assert(canModeratePost(rawCucUser, post) === false, "M2: normal user cannot moderate");
  assert(canModeratePost(rawCucUser, { ...post }) === false, "M3: raw user without roleIds cannot moderate");

  // Note: canModeratePost doesn't take options — admin must be pre-hydrated or have roleIds
  assert(canModeratePost(rawUserWithSchoolId, post) === true, "M4: moderator can moderate");
  const adminUser = { ...rawCucUser, roleIds: ["admin"] };
  assert(canModeratePost(adminUser, post) === true, "M5: admin can moderate");
  const authorPost = { authorUserId: "u-cuc" };
  assert(canModeratePost(rawCucUser, authorPost) === true, "M6: author can moderate own post");

  console.log("");

  // === canReplyToPost ===
  console.log("▶ canReplyToPost auto-hydration");
  assert(canReplyToPost(null, publicPost) === false, "R1: guest cannot reply (login required)");
  assert(canReplyToPost(rawCucUser, publicPost) === true, "R2: CUC user can reply to public");
  assert(canReplyToPost(rawCucUser, cucSchoolPost) === true, "R3: CUC user can reply to CUC school");
  assert(canReplyToPost(rawBuptUser, cucSchoolPost) === false, "R4: BUPT user cannot reply to CUC school");

  console.log("");

  // === canCreatePostWithAudience ===
  console.log("▶ canCreatePostWithAudience auto-hydration");
  assert(canCreatePostWithAudience(rawCucUser, { visibility: "public" }) === true, "CP1: anyone can create public");
  assert(canCreatePostWithAudience(rawCucUser, { visibility: "school", schoolIds: ["中国传媒大学"] }) === true, "CP2: CUC user can create CUC school post");
  assert(canCreatePostWithAudience(rawBuptUser, { visibility: "school", schoolIds: ["中国传媒大学"] }) === false, "CP3: BUPT user cannot create CUC school post");

  console.log("");

  // === canSeeAudienceOption ===
  console.log("▶ canSeeAudienceOption auto-hydration");
  assert(canSeeAudienceOption(null, { visibility: "public" }) === true, "SA1: guest sees public option");
  assert(canSeeAudienceOption(null, { visibility: "school" }) === false, "SA2: guest cannot see school option");
  assert(canSeeAudienceOption(rawCucUser, { visibility: "school" }) === true, "SA3: CUC user sees school option");
  assert(canSeeAudienceOption(rawExternalUser, { visibility: "school" }) === false, "SA4: external cannot see school option");

  console.log("");

  // === deriveSchoolId ===
  console.log("▶ deriveSchoolId");
  assert(deriveSchoolId("中国传媒大学海南国际学院") === "中国传媒大学", "DS1: full name → short");
  assert(deriveSchoolId("北京邮电大学玛丽女王海南学院") === "北京邮电大学", "DS2: BUPT full → short");
  assert(deriveSchoolId("") === "", "DS3: empty → empty");
  assert(deriveSchoolId(null) === "", "DS4: null → empty");
  assert(deriveSchoolId("未知学校") === "", "DS5: unknown → empty");

  console.log("");
  console.log("═══ 结果 ═══");
  console.log(`通过: ${passed}, 失败: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n全部通过！");
  }
}

main();
