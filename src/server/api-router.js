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

async function handleApi(req, reqUrl, res) {
  try {
    requireSameOrigin(req);

    if (req.method === "GET" && reqUrl.pathname === "/api/setup/status") {
      return sendJson(res, 200, setupStatusPayload());
    }
    if (req.method === "POST" && reqUrl.pathname === "/api/setup") {
      if (!isSetupRequired() && isProductionMode()) requireAdmin(req);
      const payload = await readJsonBody(req);
      await saveSetupConfig(payload, () => {
        memory.feedPages.clear();
        memory.topicDetails.clear();
      });
      return sendJson(res, 200, { ok: true, configured: true });
    }
    if (req.method === "GET" && reqUrl.pathname === "/api/internal/task-board") {
      if (isProductionMode()) requireAdmin(req);
      return await handleTaskBoard(req, res);
    }
    if (req.method === "GET" && reqUrl.pathname === "/api/alias-pool") return await handleGetAliasPool(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/ai/post-preview") return await handleAiPostPreview(req, res);
    if (reqUrl.pathname.startsWith("/api/admin/")) return await handleAdmin(req, reqUrl, res);
    if (isSetupRequired()) {
      return sendJson(res, 428, { error: "setup required" });
    }
    if (req.method === "POST" && reqUrl.pathname === "/api/ai/post-drafts") return await handleAiPostDraft(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/ai/post-publish") return await handleAiPostPublish(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/auth/rules") return await handleAuthRules(res);
    if (req.method === "GET" && reqUrl.pathname === "/api/auth/me") return await handleAuthMe(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/avatar") return await handleAuthAvatar(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/email-code") return await handleSendEmailCode(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/register") return await handleAuthRegister(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/login") return await handleAuthLogin(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/logout") return await handleAuthLogout(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/invites") return await handleCreateInvite(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/auth/aliases") return await handleGetAliases(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/aliases") return await handleCreateAlias(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/aliases/deactivate") return await handleDeactivateAlias(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/auth/aliases/activate") return await handleActivateAlias(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/feed") return await handleFeed(req, reqUrl, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/feed-debug") return await handleFeedDebug(req, reqUrl, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/tags") return sendJson(res, 200, await nodebbFetch("/api/tags"));
    if (req.method === "GET" && reqUrl.pathname === "/api/map/v2/items") return await handleMapV2Items(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/map/items") {
      return sendJson(res, 200, {
        bounds: { southWest: { lat: 18.37305, lng: 109.99538 }, northEast: { lat: 18.413856, lng: 110.036262 } },
        items: mapItems
      });
    }
    if (req.method === "GET" && reqUrl.pathname === "/api/channel") return await handleChannel(reqUrl, req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/channel/read") return await handleChannelRead(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/channel/messages") return await handleChannelMessage(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/messages") return await handleMessages(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/me") return await handleMe(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/me/saved") return await handleGetSavedPosts(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/me/liked") return await handleGetLikedPosts(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/me/history") return await handleGetHistory(req, res);
    if (req.method === "GET" && /^\/api\/posts\/\d+$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").pop());
      return await handlePostDetail(req, tid, res);
    }
    if (req.method === "POST" && /^\/api\/posts\/\d+\/replies$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").at(-2));
      return await handleCreateReply(tid, req, res);
    }
    if (req.method === "POST" && /^\/api\/posts\/\d+\/like$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").at(-2));
      return await handleTogglePostLike(tid, req, res);
    }
    if (req.method === "POST" && /^\/api\/posts\/\d+\/save$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").at(-2));
      return await handleTogglePostSave(tid, req, res);
    }
    if (req.method === "POST" && /^\/api\/posts\/\d+\/report$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").at(-2));
      return await handleReportPost(tid, req, res);
    }
    if (req.method === "POST" && reqUrl.pathname === "/api/upload/image") return await handleUploadImage(req, res, reqUrl);
    if (req.method === "POST" && reqUrl.pathname === "/api/posts") return await handleCreatePost(req, res);
    sendJson(res, 404, { error: "not found" });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "server error" });
  }
}

export { handleApi, setupStatusPayload };
