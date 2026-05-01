import { handleAdmin } from "./admin-routes.js";
import { handleAiPostDraft, handleAiPostPublish } from "./ai-light-publish.js";
import { handleAiPostPreview } from "./ai-post-preview.js";
import {
  handleAuthAvatar,
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  handleAuthRegister,
  handleAuthRules,
  handleCreateInvite,
  handleMe,
  handleSendEmailCode
} from "./auth-routes.js";
import { memory } from "./cache.js";
import { handleChannel, handleChannelMessage, handleChannelRead, handleCreateReply, handleMessages } from "./channel-service.js";
import { config, isSetupRequired, saveSetupConfig } from "./config.js";
import { handleFeed, handleFeedDebug, handlePostDetail } from "./feed-service.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch } from "./nodebb-client.js";
import { handleCreatePost } from "./post-service.js";
import { readJsonBody } from "./request-utils.js";
import { mapItems } from "./static-data.js";
import { handleUploadImage } from "./upload.js";

async function handleApi(req, reqUrl, res) {
  try {
    if (req.method === "GET" && reqUrl.pathname === "/api/setup/status") {
      return sendJson(res, 200, {
        required: isSetupRequired(),
        configured: !isSetupRequired(),
        nodebbBaseUrl: config.nodebbBaseUrl,
        nodebbPublicBaseUrl: config.nodebbPublicBaseUrl,
        nodebbUid: config.nodebbUid,
        nodebbCid: config.nodebbCid,
        dataSource: "api",
        cloudinaryConfigured: Boolean(config.cloudinaryUrl),
        mailConfigured: Boolean(config.resendApiKey || config.smtpHost)
      });
    }
    if (req.method === "POST" && reqUrl.pathname === "/api/setup") {
      const payload = await readJsonBody(req);
      await saveSetupConfig(payload, () => {
        memory.feedPages.clear();
        memory.topicDetails.clear();
      });
      return sendJson(res, 200, { ok: true, configured: true });
    }
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
    if (req.method === "GET" && reqUrl.pathname === "/api/feed") return await handleFeed(reqUrl, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/feed-debug") return await handleFeedDebug(req, reqUrl, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/tags") return sendJson(res, 200, await nodebbFetch("/api/tags"));
    if (req.method === "GET" && reqUrl.pathname === "/api/map/items") {
      return sendJson(res, 200, {
        bounds: { southWest: { lat: 18.37305, lng: 109.99538 }, northEast: { lat: 18.413856, lng: 110.036262 } },
        items: mapItems
      });
    }
    if (req.method === "GET" && reqUrl.pathname === "/api/channel") return await handleChannel(reqUrl, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/channel/read") return await handleChannelRead(req, res);
    if (req.method === "POST" && reqUrl.pathname === "/api/channel/messages") return await handleChannelMessage(req, res);
    if (req.method === "GET" && reqUrl.pathname === "/api/messages") return await handleMessages(res);
    if (req.method === "GET" && reqUrl.pathname === "/api/me") return await handleMe(req, res);
    if (req.method === "GET" && /^\/api\/posts\/\d+$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").pop());
      return await handlePostDetail(tid, res);
    }
    if (req.method === "POST" && /^\/api\/posts\/\d+\/replies$/.test(reqUrl.pathname)) {
      const tid = Number(reqUrl.pathname.split("/").at(-2));
      return await handleCreateReply(tid, req, res);
    }
    if (req.method === "POST" && reqUrl.pathname === "/api/upload/image") return await handleUploadImage(req, res, reqUrl);
    if (req.method === "POST" && reqUrl.pathname === "/api/posts") return await handleCreatePost(req, res);
    sendJson(res, 404, { error: "not found" });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "server error" });
  }
}

export { handleApi };
