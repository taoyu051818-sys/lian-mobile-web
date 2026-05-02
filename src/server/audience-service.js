import { authInstitutions } from "./static-data.js";

const SCHOOL_ID_MAP = new Map(
  authInstitutions.map((inst) => [inst.name, inst.tags[0] || ""])
);

function deriveSchoolId(institution) {
  if (!institution) return "";
  const direct = SCHOOL_ID_MAP.get(institution);
  if (direct) return direct;
  for (const inst of authInstitutions) {
    if (institution.includes(inst.name) || inst.name.includes(institution)) return inst.tags[0] || "";
  }
  return "";
}

function normalizeAudience(audience, flatVisibility) {
  if (audience && typeof audience === "object" && audience.visibility) {
    return {
      visibility: audience.visibility,
      schoolIds: Array.isArray(audience.schoolIds) ? audience.schoolIds : [],
      orgIds: Array.isArray(audience.orgIds) ? audience.orgIds : [],
      roleIds: Array.isArray(audience.roleIds) ? audience.roleIds : [],
      userIds: Array.isArray(audience.userIds) ? audience.userIds : [],
      linkOnly: Boolean(audience.linkOnly)
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

// context: "feed" | "map" | "detail" (default)
// - feed/map: linkOnly posts are NEVER distributed, always return false
// - detail: linkOnly posts are accessible by direct link, check base visibility
function canViewPost(user, post, context = "detail") {
  const audience = normalizeAudience(post.audience, post.visibility);

  if (audience.linkOnly) {
    if (context === "feed" || context === "map") return false;
    // detail access: check base visibility + author/admin override
    if (post.authorUserId && user && post.authorUserId === user.id) return true;
    if (user && user.roleIds && user.roleIds.includes("admin")) return true;
    switch (audience.visibility) {
      case "public":
        return true;
      case "campus":
        return Boolean(user);
      case "school":
        if (!user) return false;
        if (!audience.schoolIds.length) return true;
        return audience.schoolIds.includes(user.schoolId);
      case "private":
        if (!user) return false;
        if (audience.userIds.length && audience.userIds.includes(user.id)) return true;
        if (audience.orgIds.length && user.orgIds && audience.orgIds.some((id) => user.orgIds.includes(id))) return true;
        return false;
      default:
        return false;
    }
  }

  switch (audience.visibility) {
    case "public":
      return true;
    case "campus":
      return Boolean(user);
    case "school":
      if (!user) return false;
      if (!audience.schoolIds.length) return true;
      return audience.schoolIds.includes(user.schoolId);
    case "private":
      if (!user) return false;
      if (audience.userIds.length && audience.userIds.includes(user.id)) return true;
      if (audience.orgIds.length && user.orgIds && audience.orgIds.some((id) => user.orgIds.includes(id))) return true;
      return false;
    default:
      return true;
  }
}

function canCreatePostWithAudience(user, audience) {
  const vis = audience?.visibility || "public";
  if (vis === "public" || vis === "campus") return true;
  if (vis === "school") return Array.isArray(audience.schoolIds) && audience.schoolIds.includes(user.schoolId);
  if (vis === "private") return true;
  return true;
}

function canReplyToPost(user, post) {
  if (!user) return false;
  return canViewPost(user, post);
}

function canModeratePost(user, post) {
  if (!user) return false;
  if (user.roleIds && user.roleIds.includes("admin")) return true;
  if (user.roleIds && user.roleIds.includes("moderator")) return true;
  if (post.authorUserId && post.authorUserId === user.id) return true;
  return false;
}

function canSeeAudienceOption(user, option) {
  if (option.visibility === "public") return true;
  if (option.visibility === "campus") return true;
  if (option.visibility === "school") return user.schoolId != null;
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
  normalizeAudience
};
