// Pure route matcher — maps (method, pathname) to { routeId, params } or null.
// Extracted from api-router.js to freeze matching behavior as a safety net.

const EXACT_ROUTES = [
  { method: "GET", path: "/api/setup/status", id: "setup-status" },
  { method: "POST", path: "/api/setup", id: "setup" },
  { method: "GET", path: "/api/alias-pool", id: "alias-pool" },
  { method: "POST", path: "/api/ai/post-preview", id: "ai-post-preview" },
  // admin prefix handled separately
  { method: "POST", path: "/api/ai/post-drafts", id: "ai-post-drafts" },
  { method: "POST", path: "/api/ai/post-publish", id: "ai-post-publish" },
  { method: "GET", path: "/api/auth/rules", id: "auth-rules" },
  { method: "GET", path: "/api/auth/me", id: "auth-me" },
  { method: "POST", path: "/api/auth/avatar", id: "auth-avatar" },
  { method: "POST", path: "/api/auth/email-code", id: "auth-email-code" },
  { method: "POST", path: "/api/auth/register", id: "auth-register" },
  { method: "POST", path: "/api/auth/login", id: "auth-login" },
  { method: "POST", path: "/api/auth/logout", id: "auth-logout" },
  { method: "POST", path: "/api/auth/invites", id: "auth-invites" },
  { method: "GET", path: "/api/auth/aliases", id: "auth-aliases-get" },
  { method: "POST", path: "/api/auth/aliases", id: "auth-aliases-post" },
  { method: "POST", path: "/api/auth/aliases/deactivate", id: "auth-alias-deactivate" },
  { method: "POST", path: "/api/auth/aliases/activate", id: "auth-alias-activate" },
  { method: "GET", path: "/api/feed", id: "feed" },
  { method: "GET", path: "/api/feed-debug", id: "feed-debug" },
  { method: "GET", path: "/api/tags", id: "tags" },
  { method: "GET", path: "/api/map/v2/items", id: "map-v2-items" },
  { method: "GET", path: "/api/map/items", id: "map-items" },
  { method: "GET", path: "/api/channel", id: "channel" },
  { method: "POST", path: "/api/channel/read", id: "channel-read" },
  { method: "POST", path: "/api/channel/messages", id: "channel-messages" },
  { method: "GET", path: "/api/messages", id: "messages" },
  { method: "GET", path: "/api/me", id: "me" },
  { method: "GET", path: "/api/me/saved", id: "me-saved" },
  { method: "GET", path: "/api/me/liked", id: "me-liked" },
  { method: "POST", path: "/api/me/history", id: "me-history" },
  // regex routes handled separately (after exact routes)
  { method: "POST", path: "/api/upload/image", id: "upload-image" },
  { method: "POST", path: "/api/posts", id: "create-post" }
];

const REGEX_ROUTES = [
  { method: "GET", pattern: /^\/api\/posts\/(\d+)$/, id: "post-detail", keys: ["tid"] },
  { method: "POST", pattern: /^\/api\/posts\/(\d+)\/replies$/, id: "post-replies", keys: ["tid"] },
  { method: "POST", pattern: /^\/api\/posts\/(\d+)\/like$/, id: "post-like", keys: ["tid"] },
  { method: "POST", pattern: /^\/api\/posts\/(\d+)\/save$/, id: "post-save", keys: ["tid"] },
  { method: "POST", pattern: /^\/api\/posts\/(\d+)\/report$/, id: "post-report", keys: ["tid"] }
];

function matchRoute(method, pathname) {
  // 1. Admin prefix (any method)
  if (pathname.startsWith("/api/admin/")) {
    return { routeId: "admin", params: {} };
  }

  // 2. Exact routes (in priority order)
  for (const route of EXACT_ROUTES) {
    if (route.method === method && pathname === route.path) {
      return { routeId: route.id, params: {} };
    }
  }

  // 3. Regex routes (after exact routes)
  for (const route of REGEX_ROUTES) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params = {};
      for (let i = 0; i < route.keys.length; i++) {
        params[route.keys[i]] = match[i + 1];
      }
      return { routeId: route.id, params };
    }
  }

  return null;
}

export { matchRoute };
