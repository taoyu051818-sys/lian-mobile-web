import crypto from "node:crypto";

import { config } from "./config.js";
import { loadAuthStore, saveAuthStore } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch } from "./nodebb-client.js";
import { readJsonBody } from "./request-utils.js";
import { authInstitutions } from "./static-data.js";
import {
  createEmailCode,
  createInviteCode,
  findInstitutionByEmail,
  findUserByLogin,
  getCurrentUser,
  hashEmailCode,
  hashPassword,
  normalizeLogin,
  parseCookies,
  publicAuthUser,
  requireUser,
  sendMail,
  sessionCookie,
  verifyEmailCode,
  verifyPassword
} from "./auth-service.js";

async function handleAuthRules(res) {
  sendJson(res, 200, {
    institutions: authInstitutions.map((item) => ({
      name: item.name,
      tags: item.tags,
      domains: item.domains
    }))
  });
}

async function handleAuthMe(req, res) {
  const auth = await getCurrentUser(req);
  sendJson(res, 200, { user: publicAuthUser(auth.user) });
}

async function handleAuthAvatar(req, res) {
  const auth = await requireUser(req);
  const payload = await readJsonBody(req);
  const avatarUrl = String(payload.avatarUrl || "").trim();
  if (avatarUrl && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(avatarUrl)) {
    return sendJson(res, 400, { error: "avatarUrl is not allowed" });
  }
  auth.user.avatarUrl = avatarUrl;
  await saveAuthStore(auth.store);
  sendJson(res, 200, { user: publicAuthUser(auth.user) });
}

async function handleSendEmailCode(req, res) {
  const payload = await readJsonBody(req);
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return sendJson(res, 400, { error: "valid email is required" });
  const institution = findInstitutionByEmail(email);
  if (!institution) return sendJson(res, 400, { error: "该邮箱后缀不在高校认证名单内；邀请码注册可以不填邮箱" });

  const store = await loadAuthStore();
  if (store.users.some((user) => user.email === email)) return sendJson(res, 409, { error: "email already registered" });
  store.verifications ||= {};
  const key = normalizeLogin(email);
  const existing = store.verifications[key];
  if (existing && Date.now() - Date.parse(existing.sentAt || 0) < 60_000) {
    return sendJson(res, 429, { error: "请稍后再发送验证码" });
  }

  const code = createEmailCode();
  store.verifications[key] = {
    email,
    hash: hashEmailCode(email, code),
    sentAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    usedAt: null
  };
  await sendMail({
    to: email,
    subject: "黎安账号邮箱验证码",
    text: `你的验证码是 ${code}，10 分钟内有效。`,
    html: `<p>你的验证码是 <strong style="font-size:20px">${code}</strong>，10 分钟内有效。</p>`
  });
  await saveAuthStore(store);
  sendJson(res, 200, { ok: true, expiresInSeconds: 600, institution: institution.name });
}

async function handleAuthRegister(req, res) {
  const payload = await readJsonBody(req);
  const email = String(payload.email || "").trim().toLowerCase();
  const username = String(payload.username || "").trim().slice(0, 30);
  const password = String(payload.password || "");
  const inviteCode = String(payload.inviteCode || "").trim().toUpperCase();
  const emailCode = String(payload.emailCode || "").trim();
  if (!username) return sendJson(res, 400, { error: "username is required" });
  if (password.length < 8) return sendJson(res, 400, { error: "password must be at least 8 characters" });

  const store = await loadAuthStore();
  if (store.users.some((user) => normalizeLogin(user.username) === normalizeLogin(username))) return sendJson(res, 409, { error: "username already registered" });
  if (email && store.users.some((user) => user.email === email)) return sendJson(res, 409, { error: "email already registered" });

  const institution = email ? findInstitutionByEmail(email) : null;
  let invitedBy = null;
  let registerMethod = "email";
  let tags = institution?.tags || ["高校认证"];
  let invitePermission = Boolean(institution);

  if (institution) {
    if (!verifyEmailCode(store, email, emailCode)) return sendJson(res, 400, { error: "email verification code is invalid or expired" });
    store.verifications[normalizeLogin(email)].usedAt = new Date().toISOString();
  } else {
    const invite = inviteCode ? store.invites[inviteCode] : null;
    if (!invite || invite.usedBy || invite.revokedAt) return sendJson(res, 400, { error: "valid invite code is required" });
    const inviter = store.users.find((user) => user.id === invite.createdBy);
    if (!inviter || !inviter.invitePermission || inviter.status !== "active") return sendJson(res, 403, { error: "inviter cannot invite new users" });
    invitedBy = inviter.id;
    registerMethod = "invite";
    tags = ["邀请注册"];
    invitePermission = false;
    invite.usedBy = email || username;
    invite.usedAt = new Date().toISOString();
  }

  const user = {
    id: crypto.randomUUID(),
    email: email || "",
    username,
    password: hashPassword(password),
    institution: institution?.name || "",
    tags,
    status: "active",
    registerMethod,
    invitePermission,
    invitedBy,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  const token = crypto.randomBytes(32).toString("base64url");
  store.sessions[token] = {
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
  };
  await saveAuthStore(store);
  res.setHeader("set-cookie", sessionCookie(token));
  sendJson(res, 200, { user: publicAuthUser(user) });
}

async function remoteAuthLogin(payload = {}) {
  if (!config.remoteAuthBaseUrl) return null;
  let response;
  try {
    response = await fetch(`${config.remoteAuthBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });
  } catch (cause) {
    const error = new Error(`remote auth unavailable: ${cause.message || cause}`);
    error.status = 502;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "remote auth failed");
    error.status = response.status;
    throw error;
  }
  return data?.user ? data.user : data;
}

function upsertRemoteAuthUser(store, remoteUser = {}, login = "") {
  const remoteId = String(remoteUser.id || remoteUser.userId || remoteUser.uid || login || "").trim();
  const email = String(remoteUser.email || (String(login).includes("@") ? login : "")).trim().toLowerCase();
  const username = String(remoteUser.username || remoteUser.name || login || email || "remote-user").trim().slice(0, 30);
  let user = store.users.find((item) =>
    item.remoteAuthId === remoteId ||
    (email && item.email === email) ||
    normalizeLogin(item.username) === normalizeLogin(username)
  );

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      username,
      password: hashPassword(crypto.randomBytes(24).toString("base64url")),
      institution: "",
      tags: ["远端账号"],
      status: "active",
      registerMethod: "remote",
      invitePermission: false,
      invitedBy: null,
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
  }

  user.remoteAuthId = remoteId || user.remoteAuthId || "";
  user.remoteAuthBaseUrl = config.remoteAuthBaseUrl;
  user.email = email || user.email || "";
  user.username = username || user.username;
  user.avatarUrl = remoteUser.avatarUrl || remoteUser.picture || user.avatarUrl || "";
  user.nodebbUid = remoteUser.nodebbUid || remoteUser.uid || user.nodebbUid || null;
  user.institution = remoteUser.institution || user.institution || "";
  user.tags = Array.isArray(remoteUser.tags) && remoteUser.tags.length ? remoteUser.tags : (user.tags || ["远端账号"]);
  user.status = remoteUser.status || user.status || "active";
  user.registerMethod = "remote";
  user.remoteSyncedAt = new Date().toISOString();
  return user;
}

async function handleAuthLogin(req, res) {
  const payload = await readJsonBody(req);
  const login = String(payload.login || payload.email || "").trim();
  const password = String(payload.password || "");
  const store = await loadAuthStore();
  const user = findUserByLogin(store, login);
  if (!user || !verifyPassword(password, user)) {
    try {
      const remoteUser = await remoteAuthLogin(payload);
      const localUser = upsertRemoteAuthUser(store, remoteUser, login);
      if (localUser.status === "banned") return sendJson(res, 403, { error: "account banned" });
      const token = crypto.randomBytes(32).toString("base64url");
      store.sessions[token] = {
        userId: localUser.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
      };
      await saveAuthStore(store);
      res.setHeader("set-cookie", sessionCookie(token));
      return sendJson(res, 200, { user: publicAuthUser(localUser), remoteAuth: true });
    } catch (error) {
      return sendJson(res, error.status === 502 ? 502 : 401, { error: error.status === 502 ? error.message : "email or password is incorrect" });
    }
  }
  if (user.status === "banned") return sendJson(res, 403, { error: "account banned" });
  const token = crypto.randomBytes(32).toString("base64url");
  store.sessions[token] = {
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
  };
  await saveAuthStore(store);
  res.setHeader("set-cookie", sessionCookie(token));
  sendJson(res, 200, { user: publicAuthUser(user) });
}

async function handleAuthLogout(req, res) {
  const store = await loadAuthStore();
  const token = parseCookies(req).lian_session || "";
  if (token) delete store.sessions[token];
  await saveAuthStore(store);
  res.setHeader("set-cookie", sessionCookie("", 0));
  sendJson(res, 200, { ok: true });
}

async function handleCreateInvite(req, res) {
  const auth = await requireUser(req);
  if (!auth.user.invitePermission || auth.user.status !== "active") return sendJson(res, 403, { error: "invite permission disabled" });
  const store = auth.store;
  let code = createInviteCode();
  while (store.invites[code]) code = createInviteCode();
  store.invites[code] = {
    code,
    createdBy: auth.user.id,
    createdAt: new Date().toISOString(),
    usedBy: null,
    usedAt: null
  };
  await saveAuthStore(store);
  sendJson(res, 200, { code });
}

async function handleMe(req, res) {
  const auth = await getCurrentUser(req);
  if (auth.user) {
    return sendJson(res, 200, {
      ...publicAuthUser(auth.user),
      uid: auth.user.nodebbUid || config.nodebbUid,
      reputation: 0,
      postcount: 0,
      topiccount: 0,
      localAuth: true
    });
  }
  try {
    const data = await nodebbFetch(`/api/user/uid/${config.nodebbUid}`);
    sendJson(res, 200, {
      uid: data?.uid || config.nodebbUid,
      username: data?.username || "同学",
      picture: data?.picture || "",
      reputation: data?.reputation || 0,
      postcount: data?.postcount || 0,
      topiccount: data?.topiccount || 0
    });
  } catch {
    sendJson(res, 200, { uid: config.nodebbUid, username: "同学", picture: "", reputation: 0, postcount: 0, topiccount: 0 });
  }
}

export {
  handleAuthAvatar,
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  handleAuthRegister,
  handleAuthRules,
  handleCreateInvite,
  handleMe,
  handleSendEmailCode
};

export {
  handleCreateAlias,
  handleDeactivateAlias,
  handleGetAliases,
  handleGetAliasPool
} from "./alias-service.js";
