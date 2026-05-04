import { handleAdmin } from "./admin-routes.js";
import { handleAiPostDraft, handleAiPostPublish } from "./ai-light-publish.js";
import { handleAiPostPreview } from "./ai-post-preview.js";
import {
  handleActivateAlias,
  handleAuthAvatar,
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  handleAuthRegister,
  handleAuthRules,
  handleCreateAlias,
  handleCreateInvite,
  handleDeactivateAlias,
  handleGetAliases,
  handleGetAliasPool,
  handleMe,
  handleSendEmailCode
} from "./auth-routes.js";
import { memory } from "./cache.js";
import { handleChannel, handleChannelMessage, handleChannelRead, handleCreateReply } from "./channel-service.js";
import { handleMessages } from "./notification-service.js";
import { config, isSetupRequired, saveSetupConfig } from "./config.js";
import { handleFeed, handleFeedDebug, handlePostDetail } from "./feed-service.js";
import { sendJson } from "./http-response.js";
import { handleMapV2Items } from "./map-v2-service.js";
import { handleTaskBoard } from "./task-board-service.js";
import { nodebbFetch } from "./nodebb-client.js";
import {
  handleCreatePost,
  handleGetHistory,
  handleGetLikedPosts,
  handleGetSavedPosts,
  handleReportPost,
  handleTogglePostLike,
  handleTogglePostSave
} from "./post-service.js";
import { requireSameOrigin } from "./request-security.js";
import { matchRoute } from "./route-matcher.js";
import { isProductionMode, securityModeName } from "./security-mode.js";
import { readJsonBody, requireAdmin } from "./request-utils.js";
import { mapItems } from "./static-data.js";
import { handleUploadImage } from "./upload.js";

function setupStatusPayload() {
  const base = {
    required: isSetupRequired(),
    configured: !isSetupRequired(),
    securityMode: securityModeName(),
    cloudinaryConfigured: Boolean(config.cloudinaryUrl),
    mailConfigured: Boolean(config.resendApiKey || config.smtpHost)
  };
  if (isProductionMode()) return base;
  return {
    ...base,
    nodebbBaseUrl: config.nodebbBaseUrl,
    nodebbPublicBaseUrl: config.nodebbPublicBaseUrl,
    nodebbUid: config.nodebbUid,
    nodebbCid: config.nodebbCid,
    nodebbChannelCid: config.nodebbChannelCid,
    dataSource: "api",
    remoteAuthBaseUrl: config.remoteAuthBaseUrl
  };
}

function mapItemsPayload() {
  return {
    bounds: { southWest: { lat: 18.37305, lng: 109.99538 }, northEast: { lat: 18.413856, lng: 110.036262 } },
    items: mapItems
  };
}

async function dispatchRoute(route, req, reqUrl, res) {
  switch (route.routeId) {
    case "setup-status":
      return sendJson(res, 200, setupStatusPayload());
    case "setup": {
      if (!isSetupRequired() && isProductionMode()) requireAdmin(req);
      const payload = await readJsonBody(req);
      await saveSetupConfig(payload, () => {
        memory.feedPages.clear();
        memory.topicDetails.clear();
      });
      return sendJson(res, 200, { ok: true, configured: true });
    }
    case "internal-task-board":
      if (isProductionMode()) requireAdmin(req);
      return await handleTaskBoard(req, res);
    case "alias-pool":
      return await handleGetAliasPool(req, res);
    case "ai-post-preview":
      return await handleAiPostPreview(req, res);
    case "admin":
      return await handleAdmin(req, reqUrl, res);
    case "ai-post-drafts":
      return await handleAiPostDraft(req, res);
    case "ai-post-publish":
      return await handleAiPostPublish(req, res);
    case "auth-rules":
      return await handleAuthRules(res);
    case "auth-me":
      return await handleAuthMe(req, res);
    case "auth-avatar":
      return await handleAuthAvatar(req, res);
    case "auth-email-code":
      return await handleSendEmailCode(req, res);
    case "auth-register":
      return await handleAuthRegister(req, res);
    case "auth-login":
      return await handleAuthLogin(req, res);
    case "auth-logout":
      return await handleAuthLogout(req, res);
    case "auth-invites":
      return await handleCreateInvite(req, res);
    case "auth-aliases-get":
      return await handleGetAliases(req, res);
    case "auth-aliases-post":
      return await handleCreateAlias(req, res);
    case "auth-alias-deactivate":
      return await handleDeactivateAlias(req, res);
    case "auth-alias-activate":
      return await handleActivateAlias(req, res);
    case "feed":
      return await handleFeed(req, reqUrl, res);
    case "feed-debug":
      return await handleFeedDebug(req, reqUrl, res);
    case "tags":
      return sendJson(res, 200, await nodebbFetch("/api/tags"));
    case "map-v2-items":
      return await handleMapV2Items(req, res);
    case "map-items":
      return sendJson(res, 200, mapItemsPayload());
    case "channel":
      return await handleChannel(reqUrl, req, res);
    case "channel-read":
      return await handleChannelRead(req, res);
    case "channel-messages":
      return await handleChannelMessage(req, res);
    case "messages":
      return await handleMessages(req, res);
    case "me":
      return await handleMe(req, res);
    case "me-saved":
      return await handleGetSavedPosts(req, res);
    case "me-liked":
      return await handleGetLikedPosts(req, res);
    case "me-history":
      return await handleGetHistory(req, res);
    case "post-detail":
      return await handlePostDetail(req, Number(route.params.tid), res);
    case "post-replies":
      return await handleCreateReply(Number(route.params.tid), req, res);
    case "post-like":
      return await handleTogglePostLike(Number(route.params.tid), req, res);
    case "post-save":
      return await handleTogglePostSave(Number(route.params.tid), req, res);
    case "post-report":
      return await handleReportPost(Number(route.params.tid), req, res);
    case "upload-image":
      return await handleUploadImage(req, res, reqUrl);
    case "create-post":
      return await handleCreatePost(req, res);
    default:
      return sendJson(res, 404, { error: "not found" });
  }
}

const PRE_SETUP_ROUTE_IDS = new Set([
  "setup-status",
  "setup",
  "internal-task-board",
  "alias-pool",
  "ai-post-preview",
  "admin"
]);

async function handleApi(req, reqUrl, res) {
  try {
    requireSameOrigin(req);

    const route = matchRoute(req.method, reqUrl.pathname);
    if (!route) return sendJson(res, 404, { error: "not found" });

    if (isSetupRequired() && !PRE_SETUP_ROUTE_IDS.has(route.routeId)) {
      return sendJson(res, 428, { error: "setup required" });
    }

    return await dispatchRoute(route, req, reqUrl, res);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "server error" });
  }
}

export { handleApi, setupStatusPayload };
