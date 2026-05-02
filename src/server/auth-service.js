import crypto from "node:crypto";

import { config } from "./config.js";
import { escapeHtml } from "./content-utils.js";
import { loadAuthStore, saveAuthStore } from "./data-store.js";
import { nodebbFetch } from "./nodebb-client.js";
import { authInstitutions } from "./static-data.js";

function allowedIdentityTags(user = {}) {
  const tags = Array.isArray(user.tags) ? user.tags : [];
  return tags.filter((tag) => tag && (tag === "高校认证" || tag !== "邀请注册"));
}

function selectIdentityTag(user = {}, requested = "") {
  const allowed = allowedIdentityTags(user);
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] || "同学";
}

function publicAuthUser(user = null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl || "",
    nodebbUid: user.nodebbUid || null,
    institution: user.institution || "",
    tags: user.tags || [],
    identityTags: allowedIdentityTags(user),
    status: user.status || "active",
    registerMethod: user.registerMethod || "",
    invitePermission: Boolean(user.invitePermission),
    invitedBy: user.invitedBy || null,
    createdAt: user.createdAt || "",
    aliases: Array.isArray(user.aliases) ? user.aliases : [],
    activeAliasId: user.activeAliasId || null,
    badges: Array.isArray(user.badges) ? user.badges : []
  };
}

function findInstitutionByEmail(email = "") {
  const domain = String(email).toLowerCase().split("@").pop() || "";
  return authInstitutions.find((item) => item.domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))) || null;
}

function normalizeLogin(value = "") {
  return String(value || "").trim().toLowerCase();
}

function findUserByLogin(store, login = "") {
  const value = normalizeLogin(login);
  return store.users.find((user) => normalizeLogin(user.email) === value || normalizeLogin(user.username) === value) || null;
}

function normalizeNodebbUsers(data) {
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data)) return data;
  if (data?.uid) return [data];
  return [];
}

async function findNodebbUserByUsername(username = "") {
  const target = normalizeLogin(username);
  if (!target) return null;
  const endpoints = [
    `/api/users?query=${encodeURIComponent(username)}`,
    `/api/search/users?query=${encodeURIComponent(username)}`
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await nodebbFetch(endpoint);
      const users = normalizeNodebbUsers(data);
      const found = users.find((item) => normalizeLogin(item.username) === target || normalizeLogin(item.userslug) === target);
      if (found?.uid) return found;
    } catch {
      // Try the next public lookup shape supported by this LIAN instance.
    }
  }
  return null;
}

async function createNodebbUserForLian(user = {}) {
  const email = user.email || `${String(user.id || crypto.randomUUID()).replace(/[^a-z0-9-]/gi, "")}@lian.local`;
  const password = crypto.randomBytes(18).toString("base64url");
  const body = {
    username: user.username,
    email,
    password
  };
  const data = await nodebbFetch("/api/v3/users", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: JSON.stringify(body)
  });
  const created = data?.response || data?.user || data;
  const uid = Number(created?.uid || data?.uid);
  if (!uid) throw new Error("LIAN user was created but uid was not returned");
  return { uid, username: created?.username || user.username };
}

async function ensureNodebbUid(auth) {
  if (!auth?.user) throw new Error("login required");
  if (!config.nodebbToken) throw new Error("LIAN API token is missing");
  const cached = Number(auth.user.nodebbUid || 0);
  if (cached) return cached;

  const existing = await findNodebbUserByUsername(auth.user.username);
  const nodebbUser = existing?.uid ? existing : await createNodebbUserForLian(auth.user);
  const uid = Number(nodebbUser.uid);
  if (!uid) throw new Error("cannot resolve LIAN uid for this user");

  auth.user.nodebbUid = uid;
  auth.user.nodebbUsername = nodebbUser.username || auth.user.username;
  auth.user.nodebbLinkedAt = new Date().toISOString();
  await saveAuthStore(auth.store);
  return uid;
}

function createEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashEmailCode(email, code) {
  return crypto.createHash("sha256").update(`${normalizeLogin(email)}:${String(code)}`).digest("hex");
}

async function sendMail({ to, subject, text, html }) {
  if (config.resendApiKey) {
    if (!config.mailFrom) throw new Error("MAIL_FROM is required");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.resendApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ from: config.mailFrom, to, subject, text, html })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || "email send failed");
    return data;
  }

  if (config.smtpHost) {
    if (!config.mailFrom) throw new Error("MAIL_FROM is required");
    return await sendSmtpMail({ to, subject, text, html });
  }

  throw new Error("邮件服务未配置");
}

async function sendSmtpMail({ to, subject, text, html }) {
  const tls = await import("node:tls");
  const net = await import("node:net");
  const socket = config.smtpSecure
    ? tls.connect({ host: config.smtpHost, port: config.smtpPort, servername: config.smtpHost })
    : net.createConnection({ host: config.smtpHost, port: config.smtpPort });
  socket.setEncoding("utf8");
  socket.setTimeout(20_000);

  let buffer = "";
  const read = () => new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const onError = (error) => { cleanup(); reject(error); };
    const onTimeout = () => { cleanup(); reject(new Error("SMTP timeout")); };
    const onData = (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1) || "";
      if (/^\d{3}\s/.test(last)) {
        const response = buffer;
        buffer = "";
        cleanup();
        resolve(response);
      }
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("timeout", onTimeout);
  });
  const write = async (command, expected = /^[23]/) => {
    socket.write(`${command}\r\n`);
    const response = await read();
    if (!expected.test(response)) throw new Error(`SMTP rejected ${command.split(" ")[0]}: ${response.trim()}`);
    return response;
  };
  const encodeHeader = (value) => `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
  const boundary = `lian-${crypto.randomBytes(8).toString("hex")}`;
  const body = [
    `From: ${config.mailFrom}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html || `<p>${escapeHtml(text)}</p>`,
    "",
    `--${boundary}--`
  ].join("\r\n");

  try {
    await read();
    await write(`EHLO ${config.smtpHost}`);
    if (!config.smtpSecure) await write("STARTTLS", /^220/);
    if (config.smtpUser) {
      await write("AUTH LOGIN", /^334/);
      await write(Buffer.from(config.smtpUser).toString("base64"), /^334/);
      await write(Buffer.from(config.smtpPass).toString("base64"), /^235/);
    }
    await write(`MAIL FROM:<${config.mailFrom}>`);
    await write(`RCPT TO:<${to}>`);
    await write("DATA", /^354/);
    socket.write(`${body}\r\n.\r\n`);
    const dataResponse = await read();
    if (!/^250/.test(dataResponse)) throw new Error(`SMTP DATA rejected: ${dataResponse.trim()}`);
    await write("QUIT", /^[23]/).catch(() => null);
    return { ok: true };
  } finally {
    socket.end();
  }
}

function verifyEmailCode(store, email, code) {
  const key = normalizeLogin(email);
  const record = store.verifications?.[key];
  if (!record) return false;
  if (Date.now() > Date.parse(record.expiresAt || 0)) return false;
  if (record.usedAt) return false;
  return record.hash === hashEmailCode(email, code);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.password?.salt || !user?.password?.hash) return false;
  const next = hashPassword(password, user.password.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(user.password.hash, "hex"));
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index >= 0 ? [part.slice(0, index), decodeURIComponent(part.slice(index + 1))] : [part, ""];
    }));
}

function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `lian_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

async function getCurrentUser(req, store = null) {
  const data = store || await loadAuthStore();
  const token = parseCookies(req).lian_session || req.headers["x-session-token"] || "";
  const session = token ? data.sessions[token] : null;
  if (!session || Date.now() > Date.parse(session.expiresAt || 0)) return { store: data, token: "", user: null };
  const user = data.users.find((item) => item.id === session.userId) || null;
  return { store: data, token, user };
}

async function requireUser(req) {
  const auth = await getCurrentUser(req);
  if (!auth.user) {
    const error = new Error("login required");
    error.status = 401;
    throw error;
  }
  if (auth.user.status === "banned") {
    const error = new Error("account banned");
    error.status = 403;
    throw error;
  }
  return auth;
}

function createInviteCode() {
  return crypto.randomBytes(5).toString("base64url").toUpperCase();
}

function applyInviteViolation(store, bannedUserId) {
  const banned = store.users.find((item) => item.id === bannedUserId);
  if (!banned?.invitedBy) return;
  const inviter = store.users.find((item) => item.id === banned.invitedBy);
  if (!inviter) return;
  inviter.invitePermission = false;
  inviter.inviteDisabledAt = new Date().toISOString();
  for (const user of store.users) {
    if (user.invitedBy === inviter.id && user.status !== "banned") {
      user.status = "limited";
      user.limitedReason = "invited-account-violation";
      user.limitedAt = new Date().toISOString();
    }
  }
}

export {
  allowedIdentityTags,
  applyInviteViolation,
  createEmailCode,
  createInviteCode,
  ensureNodebbUid,
  findInstitutionByEmail,
  findUserByLogin,
  getCurrentUser,
  hashEmailCode,
  hashPassword,
  normalizeLogin,
  parseCookies,
  publicAuthUser,
  requireUser,
  selectIdentityTag,
  sendMail,
  sessionCookie,
  verifyEmailCode,
  verifyPassword
};