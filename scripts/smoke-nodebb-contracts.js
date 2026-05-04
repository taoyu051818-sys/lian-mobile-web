#!/usr/bin/env node

// NodeBB contract smoke tests — diagnostic, read-only by default.
// Usage: node scripts/smoke-nodebb-contracts.js
// Write mode: NODEBB_SMOKE_WRITE=1 node scripts/smoke-nodebb-contracts.js

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env
async function loadEnv() {
  try {
    const text = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}
await loadEnv();

const BASE = (process.env.NODEBB_BASE_URL || "http://149.104.21.74:4567").replace(/\/$/, "");
const TOKEN = process.env.NODEBB_API_TOKEN || "";
const DEFAULT_UID = Number(process.env.NODEBB_UID || 2);
const WRITE_MODE = process.env.NODEBB_SMOKE_WRITE === "1";

let passed = 0, failed = 0;

function ok(name) { console.log(`  ✓ ${name}`); passed++; }
function fail(name, detail) { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
function info(label, value) { console.log(`  ℹ ${label}: ${value}`); }

function redact(str) {
  return String(str || "").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/x-api-token:\s*\S+/gi, "x-api-token: [REDACTED]");
}

async function bbFetch(apiPath, options = {}) {
  const url = new URL(apiPath, BASE);
  if (!url.searchParams.has("_uid")) url.searchParams.set("_uid", String(DEFAULT_UID));
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    ...options.headers
  };
  if (TOKEN && !headers.authorization && !headers["x-api-token"]) {
    headers["x-api-token"] = TOKEN;
  }
  const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { status: res.status, ok: res.ok, data, url: `${url.pathname}${url.search}` };
}

// Try with Authorization: Bearer (some endpoints need this instead of x-api-token)
async function bbFetchBearer(apiPath, options = {}) {
  return bbFetch(apiPath, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${TOKEN}` }
  });
}

function shapeSummary(data, depth = 0) {
  if (depth > 2) return "...";
  if (data === null || data === undefined) return String(data);
  if (Array.isArray(data)) {
    if (!data.length) return "[]";
    return `[${shapeSummary(data[0], depth + 1)}] (len=${data.length})`;
  }
  if (typeof data === "object") {
    const keys = Object.keys(data).slice(0, 15);
    const entries = keys.map((k) => `${k}: ${shapeSummary(data[k], depth + 1)}`);
    if (Object.keys(data).length > 15) entries.push("...");
    return `{ ${entries.join(", ")} }`;
  }
  if (typeof data === "string") return data.length > 60 ? `"${data.slice(0, 60)}..."` : JSON.stringify(data);
  return String(data);
}

async function main() {
  console.log("═══ NodeBB Contract Smoke Tests ═══");
  console.log(`Base: ${BASE}`);
  console.log(`Default UID: ${DEFAULT_UID}`);
  console.log(`Write mode: ${WRITE_MODE ? "ON" : "OFF (set NODEBB_SMOKE_WRITE=1 to enable)"}`);
  console.log(`Token: ${TOKEN ? "(set)" : "(missing)"}`);
  console.log("");

  if (!TOKEN) {
    console.error("错误: NODEBB_API_TOKEN 未设置。请在 .env 中配置。");
    process.exit(1);
  }

  // === 1. Notifications ===
  console.log("▶ Notifications");
  try {
    let res = await bbFetch(`/api/notifications?_uid=${DEFAULT_UID}`);
    let authMethod = "x-api-token";
    if (!res.ok && res.status === 401) {
      res = await bbFetchBearer(`/api/notifications?_uid=${DEFAULT_UID}`);
      authMethod = "Bearer";
    }
    if (res.ok) {
      ok(`GET /api/notifications → ${res.status} (auth: ${authMethod})`);
      info("shape", shapeSummary(res.data));
      const notifs = res.data?.notifications || res.data?.items || [];
      if (notifs.length > 0) {
        info("first notification keys", Object.keys(notifs[0]).join(", "));
      } else {
        info("notifications", "empty (no notifications for this uid)");
      }
    } else {
      fail(`GET /api/notifications → ${res.status}`, `auth: ${authMethod}; ${redact(res.data?.error || res.data?.message)}`);
    }
  } catch (e) {
    fail("GET /api/notifications", e.message);
  }
  console.log("");

  // === 2. Topic detail (get a recent topic first) ===
  console.log("▶ Topic Detail");
  let sampleTid = null;
  let samplePid = null;
  try {
    const recent = await bbFetch("/api/recent?page=1");
    const topics = recent.data?.topics || [];
    if (topics.length > 0) {
      sampleTid = topics[0].tid;
      info("sample tid", sampleTid);
    }
  } catch (e) {
    fail("GET /api/recent (to find sample tid)", e.message);
  }

  if (sampleTid) {
    try {
      const res = await bbFetch(`/api/topic/${sampleTid}`);
      if (res.ok) {
        ok(`GET /api/topic/${sampleTid} → ${res.status}`);
        const posts = res.data?.posts || [];
        if (posts.length > 0) {
          samplePid = posts[0].pid;
          info("first post pid", samplePid);
          info("first post keys", Object.keys(posts[0]).join(", "));
          info("upvoted", String(posts[0].upvoted));
          info("bookmarked", String(posts[0].bookmarked));
          info("votes", String(posts[0].votes));
          const images = (posts[0].content || "").match(/!\[.*?\]\(.*?\)/g) || [];
          info("image count in first post", String(images.length));
        }
        info("topic title", res.data?.title || "(none)");
        info("topic postcount", String(res.data?.postcount));
      } else {
        fail(`GET /api/topic/${sampleTid} → ${res.status}`, redact(res.data?.error));
      }
    } catch (e) {
      fail(`GET /api/topic/${sampleTid}`, e.message);
    }
  }
  console.log("");

  // === 3. User bookmarks ===
  console.log("▶ User Bookmarks");
  try {
    const meRes = await bbFetch(`/api/user/uid/${DEFAULT_UID}`);
    const slug = meRes.data?.userslug || meRes.data?.slug || "";
    if (slug) {
      info("user slug", slug);
      let bmRes = await bbFetch(`/api/user/${slug}/bookmarks`);
      let authMethod = "x-api-token";
      if (!bmRes.ok && bmRes.status === 401) {
        bmRes = await bbFetchBearer(`/api/user/${slug}/bookmarks`);
        authMethod = "Bearer";
      }
      if (bmRes.ok) {
        ok(`GET /api/user/${slug}/bookmarks → ${bmRes.status} (auth: ${authMethod})`);
        info("shape", shapeSummary(bmRes.data));
      } else {
        fail(`GET /api/user/${slug}/bookmarks → ${bmRes.status}`, `auth: ${authMethod}; ${redact(bmRes.data?.error)}`);
      }
    } else {
      fail("resolve user slug", `uid ${DEFAULT_UID} slug not found`);
    }
  } catch (e) {
    fail("User bookmarks", e.message);
  }
  console.log("");

  // === 4. User upvoted ===
  console.log("▶ User Upvoted");
  try {
    const meRes = await bbFetch(`/api/user/uid/${DEFAULT_UID}`);
    const slug = meRes.data?.userslug || meRes.data?.slug || "";
    if (slug) {
      let upRes = await bbFetch(`/api/user/${slug}/upvoted`);
      let authMethod = "x-api-token";
      if (!upRes.ok && upRes.status === 401) {
        upRes = await bbFetchBearer(`/api/user/${slug}/upvoted`);
        authMethod = "Bearer";
      }
      if (upRes.ok) {
        ok(`GET /api/user/${slug}/upvoted → ${upRes.status} (auth: ${authMethod})`);
        info("shape", shapeSummary(upRes.data));
      } else {
        fail(`GET /api/user/${slug}/upvoted → ${upRes.status}`, `auth: ${authMethod}; ${redact(upRes.data?.error)}`);
      }
    }
  } catch (e) {
    fail("User upvoted", e.message);
  }
  console.log("");

  // === 5. Reply endpoint shape ===
  console.log("▶ Reply Endpoint (dry-run shape)");
  if (sampleTid) {
    info("target endpoint", `POST /api/v3/topics/${sampleTid} (with body { content })`);
    info("fallback endpoint", `POST /api/v3/topics/${sampleTid}/posts`);
    info("auth", `Authorization: Bearer [TOKEN] + _uid=${DEFAULT_UID}`);
    if (!WRITE_MODE) {
      info("status", "skipped (read-only mode)");
    }
  }
  console.log("");

  // === 6. Vote endpoint shape ===
  console.log("▶ Vote Endpoint (dry-run shape)");
  if (samplePid) {
    info("target endpoint", `PUT /api/v3/posts/${samplePid}/vote (body: { delta: 1 })`);
    info("unvote endpoint", `DELETE /api/v3/posts/${samplePid}/vote`);
    info("auth", `Authorization: Bearer [TOKEN] + _uid=${DEFAULT_UID}`);
    if (!WRITE_MODE) {
      info("status", "skipped (read-only mode)");
    }
  }
  console.log("");

  // === 7. Bookmark endpoint shape ===
  console.log("▶ Bookmark Endpoint (dry-run shape)");
  if (samplePid) {
    info("target endpoint", `PUT /api/v3/posts/${samplePid}/bookmark`);
    info("unbookmark endpoint", `DELETE /api/v3/posts/${samplePid}/bookmark`);
    info("auth", `Authorization: Bearer [TOKEN] + _uid=${DEFAULT_UID}`);
    if (!WRITE_MODE) {
      info("status", "skipped (read-only mode)");
    }
  }
  console.log("");

  // === 8. Flag endpoint shape ===
  console.log("▶ Flag/Report Endpoint (dry-run shape)");
  if (samplePid) {
    info("target endpoint", `POST /api/v3/posts/${samplePid}/flag (body: { reason })`);
    info("auth", `Authorization: Bearer [TOKEN] + _uid=${DEFAULT_UID}`);
    if (!WRITE_MODE) {
      info("status", "skipped (read-only mode)");
    }
  }
  console.log("");

  // === Write mode ===
  if (WRITE_MODE && sampleTid) {
    console.log("═══ Write Mode Tests ═══\n");

    // Create a test reply
    console.log("▶ Test Reply");
    let testReplyPid = null;
    try {
      const res = await bbFetch(`/api/v3/topics/${sampleTid}?_uid=${DEFAULT_UID}`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ content: "[LIAN SMOKE TEST] This is an automated test reply. Please ignore and delete." })
      });
      if (res.ok || res.status === 200) {
        testReplyPid = res.data?.pid || res.data?.data?.pid;
        ok(`POST /api/v3/topics/${sampleTid} → ${res.status} (pid=${testReplyPid || "?"})`);
        info("shape", shapeSummary(res.data));
      } else {
        // Try fallback
        const res2 = await bbFetch(`/api/v3/topics/${sampleTid}/posts?_uid=${DEFAULT_UID}`, {
          method: "POST",
          headers: { authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({ content: "[LIAN SMOKE TEST] This is an automated test reply. Please ignore and delete." })
        });
        if (res2.ok) {
          testReplyPid = res2.data?.pid || res2.data?.data?.pid;
          ok(`POST /api/v3/topics/${sampleTid}/posts (fallback) → ${res2.status} (pid=${testReplyPid || "?"})`);
          info("shape", shapeSummary(res2.data));
        } else {
          fail(`POST /api/v3/topics/${sampleTid} → ${res.status}`, redact(res.data?.error || res.data?.message));
        }
      }
    } catch (e) {
      fail("Test reply", e.message);
    }

    // Vote/unvote
    if (samplePid) {
      console.log("\n▶ Test Vote/Unvote");
      try {
        const voteRes = await bbFetch(`/api/v3/posts/${samplePid}/vote?_uid=${DEFAULT_UID}`, {
          method: "PUT",
          headers: { authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({ delta: 1 })
        });
        if (voteRes.ok) {
          ok(`PUT /api/v3/posts/${samplePid}/vote → ${voteRes.status}`);
          info("shape", shapeSummary(voteRes.data));
          // Unvote
          const unvoteRes = await bbFetch(`/api/v3/posts/${samplePid}/vote?_uid=${DEFAULT_UID}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${TOKEN}` }
          });
          if (unvoteRes.ok) {
            ok(`DELETE /api/v3/posts/${samplePid}/vote → ${unvoteRes.status}`);
          } else {
            fail(`DELETE /api/v3/posts/${samplePid}/vote → ${unvoteRes.status}`, redact(unvoteRes.data?.error));
          }
        } else {
          fail(`PUT /api/v3/posts/${samplePid}/vote → ${voteRes.status}`, redact(voteRes.data?.error));
        }
      } catch (e) {
        fail("Vote/unvote", e.message);
      }

      // Bookmark/unbookmark
      console.log("\n▶ Test Bookmark/Unbookmark");
      try {
        const bmRes = await bbFetch(`/api/v3/posts/${samplePid}/bookmark?_uid=${DEFAULT_UID}`, {
          method: "PUT",
          headers: { authorization: `Bearer ${TOKEN}` }
        });
        if (bmRes.ok) {
          ok(`PUT /api/v3/posts/${samplePid}/bookmark → ${bmRes.status}`);
          info("shape", shapeSummary(bmRes.data));
          // Unbookmark
          const unbmRes = await bbFetch(`/api/v3/posts/${samplePid}/bookmark?_uid=${DEFAULT_UID}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${TOKEN}` }
          });
          if (unbmRes.ok) {
            ok(`DELETE /api/v3/posts/${samplePid}/bookmark → ${unbmRes.status}`);
          } else {
            fail(`DELETE /api/v3/posts/${samplePid}/bookmark → ${unbmRes.status}`, redact(unbmRes.data?.error));
          }
        } else {
          fail(`PUT /api/v3/posts/${samplePid}/bookmark → ${bmRes.status}`, redact(bmRes.data?.error));
        }
      } catch (e) {
        fail("Bookmark/unbookmark", e.message);
      }

      // Flag
      console.log("\n▶ Test Flag/Report");
      if (testReplyPid) {
        try {
          const flagRes = await bbFetch(`/api/v3/posts/${testReplyPid}/flag?_uid=${DEFAULT_UID}`, {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}` },
            body: JSON.stringify({ reason: "[LIAN SMOKE TEST] Automated test report. Please dismiss." })
          });
          if (flagRes.ok) {
            ok(`POST /api/v3/posts/${testReplyPid}/flag → ${flagRes.status}`);
            info("shape", shapeSummary(flagRes.data));
          } else {
            fail(`POST /api/v3/posts/${testReplyPid}/flag → ${flagRes.status}`, redact(flagRes.data?.error));
          }
        } catch (e) {
          fail("Flag/report", e.message);
        }
      } else {
        info("flag", "skipped (no test reply pid)");
      }

      // Cleanup note
      console.log("\n▶ Cleanup");
      if (testReplyPid) {
        info("cleanup", `Delete test reply pid=${testReplyPid} via DELETE /api/v3/posts/${testReplyPid}`);
        info("note", "Or delete via NodeBB admin UI. Test reply is labeled [LIAN SMOKE TEST].");
      }
    }
  }

  console.log("");
  console.log("═══ 结果 ═══");
  console.log(`通过: ${passed}, 失败: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n全部通过！");
  }
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
