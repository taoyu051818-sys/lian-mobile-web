import { authInstitutions } from "./static-data.js";

const SCHOOL_ID_MAP = new Map(
  authInstitutions.map((inst) => [inst.name, inst.tags[0] || ""])
);

const SUPPORTED_VISIBILITIES = new Set(["public", "campus", "school", "private"]);

function deriveSchoolId(institution) {
  if (!institution) return "";
  const direct = SCHOOL_ID_MAP.get(institution);
  if (direct) return direct;
  for (const inst of authInstitutions) {
    if (institution.includes(inst.name) || inst.name.includes(institution)) return inst.tags[0] || "";
  }
  return "";
}

// Normalize raw auth-store user into canonical viewer context.
// Auth store users have `institution` + `tags` but NOT `schoolId`, `orgIds`, `roleIds`.
// options.isAdmin: pass true when ADMIN_TOKEN header matched (not stored in user object).
function hydrateAudienceUser(user, options = {}) {
  if (!user) {
    return { id: "", schoolId: "", orgIds: [], roleIds: [], isGuest: true, isAdmin: false };
  }
  const schoolId = user.schoolId || deriveSchoolId(user.institution);
  const orgIds = Array.isArray(user.orgIds) ? user.orgIds : [];
  let roleIds = Array.isArray(user.roleIds) ? [...user.roleIds] : [];
  if (options.isAdmin && !roleIds.includes("admin")) {
    roleIds.push("admin");
  }
  return { id: user.id || "", schoolId, orgIds, roleIds, isGuest: false, isAdmin: roleIds.includes("admin") };
}

function normalizeAudience(audience, flatVisibility) {
  if (audience && typeof audience === "object" && audience.visibility) {
    return {
      visibility: audience.visibility === "linkOnly" ? "public" : audience.visibility,
      schoolIds: Array.isArray(audience.schoolIds) ? audience.schoolIds : [],
      orgIds: Array.isArray(audience.orgIds) ? audience.orgIds : [],
      roleIds: Array.isArray(audience.roleIds) ? audience.roleIds : [],
      userIds: Array.isArray(audience.userIds) ? audience.userIds : [],
      linkOnly: audience.visibility === "linkOnly" || Boolean(audience.linkOnly)
    };
  }
  const vis = flatVisibility || "public";
  return {
    visibility: vis === "linkOnly" ? "public" : vis,
    schoolIds: [],
    orgIds: [],
    roleIds: [],
    userIds: [],
    linkOnly: vis === "linkOnly"
  };
}

// Normalize a write-side audience without expanding scope.
// This fills safe defaults only; canCreatePostWithAudience remains responsible for rejecting escalation.
function normalizeAudienceForCreate(user, audience, flatVisibility) {
  const viewer = hydrateAudienceUser(user);
  const normalized = normalizeAudience(audience, flatVisibility);
  if (normalized.visibility === "school" && !normalized.schoolIds.length && viewer.schoolId) {
    normalized.schoolIds = [viewer.schoolId];
  }
  if (normalized.visibility === "private" && !normalized.userIds.length && !normalized.orgIds.length && !normalized.roleIds.length && viewer.id) {
    normalized.userIds = [viewer.id];
  }
  return normalized;
}

function sameStringSet(actual = [], allowed = []) {
  const allow = new Set(allowed.map((item) => String(item || "")).filter(Boolean));
  return actual.map((item) => String(item || "")).filter(Boolean).every((item) => allow.has(item));
}

// context: "feed" | "map" | "detail" (default)
// - feed/map: linkOnly posts are NEVER distributed, always return false
// - detail: linkOnly posts are accessible by direct link, check base visibility
// user: raw auth-store user or pre-hydrated viewer (auto-hydrated internally)
function canViewPost(user, post, context = "detail") {
  const viewer = hydrateAudienceUser(user);
  const audience = normalizeAudience(post.audience, post.visibility);

  if (audience.linkOnly) {
    if (context === "feed" || context === "map") return false;
    // detail access: check base visibility + author/admin override
    if (post.authorUserId && !viewer.isGuest && post.authorUserId === viewer.id) return true;
    if (viewer.isAdmin) return true;
    switch (audience.visibility) {
      case "public":
        return true;
      case "campus":
        return !viewer.isGuest;
      case "school":
        if (viewer.isGuest) return false;
        if (!audience.schoolIds.length) return true;
        return audience.schoolIds.includes(viewer.schoolId);
      case "private":
        if (viewer.isGuest) return false;
        if (audience.userIds.length && audience.userIds.includes(viewer.id)) return true;
        if (audience.orgIds.length && audience.orgIds.some((id) => viewer.orgIds.includes(id))) return true;
        return false;
      default:
        return false;
    }
  }

  if (post.authorUserId && !viewer.isGuest && post.authorUserId === viewer.id) return true;
  if (viewer.isAdmin) return true;

  switch (audience.visibility) {
    case "public":
      return true;
    case "campus":
      return !viewer.isGuest;
    case "school":
      if (viewer.isGuest) return false;
      if (!audience.schoolIds.length) return true;
      return audience.schoolIds.includes(viewer.schoolId);
    case "private":
      if (viewer.isGuest) return false;
      if (audience.userIds.length && audience.userIds.includes(viewer.id)) return true;
      if (audience.orgIds.length && audience.orgIds.some((id) => viewer.orgIds.includes(id))) return true;
      return false;
    default:
      return false;
  }
}

function canCreatePostWithAudience(user, audience) {
  const viewer = hydrateAudienceUser(user);
  const normalized = normalizeAudience(audience, audience?.visibility || "public");
  if (viewer.isGuest) return false;
  if (viewer.isAdmin) return true;
  if (!SUPPORTED_VISIBILITIES.has(normalized.visibility)) return false;

  if (normalized.visibility === "public" || normalized.visibility === "campus") return true;

  if (normalized.visibility === "school") {
    if (!viewer.schoolId || !normalized.schoolIds.length) return false;
    return sameStringSet(normalized.schoolIds, [viewer.schoolId]);
  }

  if (normalized.visibility === "private") {
    // Minimum first cut: private/self only. Do not allow role/org/multi-user targeting yet.
    if (normalized.orgIds.length || normalized.roleIds.length) return false;
    if (!normalized.userIds.length) return Boolean(viewer.id);
    return sameStringSet(normalized.userIds, [viewer.id]);
  }

  return false;
}

function canReplyToPost(user, post) {
  if (!user) return false;
  return canViewPost(user, post);
}

function canModeratePost(user, post) {
  const viewer = hydrateAudienceUser(user);
  if (viewer.isGuest) return false;
  if (viewer.roleIds.includes("admin")) return true;
  if (viewer.roleIds.includes("moderator")) return true;
  if (post.authorUserId && post.authorUserId === viewer.id) return true;
  return false;
}

function canSeeAudienceOption(user, option) {
  if (option.visibility === "public") return true;
  if (option.visibility === "campus") return true;
  if (option.visibility === "school") {
    const viewer = hydrateAudienceUser(user);
    return Boolean(viewer.schoolId);
  }
  if (option.visibility === "private") return true;
  return false;
}

export {
  canCreatePostWithAudience,
  canModeratePost,
  canReplyToPost,
  canSeeAudienceOption,
  canViewPost,
  deriveSchoolId,
  hydrateAudienceUser,
  normalizeAudience,
  normalizeAudienceForCreate
};
