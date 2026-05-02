#!/usr/bin/env node

// 重写 [推荐测试] 帖子：去掉标题前缀，去掉测试标签
// 用法: node scripts/rewrite-test-posts.js

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
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
loadEnv();

const BASE = (process.env.NODEBB_BASE_URL || "http://149.104.21.74:4567").replace(/\/$/, "");
const TOKEN = process.env.NODEBB_API_TOKEN || "";
const UID = process.env.NODEBB_UID || "2";
const REMOVE_TAGS = ["推荐测试", "系统测试"];

async function bbFetch(apiPath, options = {}) {
  const url = new URL(apiPath, BASE);
  url.searchParams.set("_uid", UID);
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      ...options.headers
    },
    signal: options.signal || AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return data;
}

async function main() {
  if (!TOKEN) { console.error("错误: NODEBB_API_TOKEN 未设置"); process.exit(1); }

  // 1. find all test posts
  console.log("扫描 NodeBB 帖子...");
  const testPosts = [];
  for (let page = 1; page <= 10; page++) {
    const data = await bbFetch(`/api/recent?page=${page}`);
    for (const t of (data.topics || [])) {
      const tags = (t.tags || []).map(tg => tg.value || tg.name || tg);
      if (tags.includes("推荐测试") || (t.title || "").includes("[推荐测试]")) {
        testPosts.push({ tid: t.tid, title: t.title, tags });
      }
    }
    if ((data.topics || []).length < 20) break;
  }
  console.log(`找到 ${testPosts.length} 条 [推荐测试] 帖子\n`);

  let ok = 0, fail = 0;

  for (const post of testPosts) {
    const tid = post.tid;
    const oldTitle = post.title;
    let newTitle = oldTitle.replace(/^\[推荐测试\]\s*/, "");
    if (!newTitle) newTitle = oldTitle;

    const newTags = post.tags.filter(tg => !REMOVE_TAGS.includes(tg));
    const titleChanged = newTitle !== oldTitle;
    const tagsChanged = newTags.length !== post.tags.length;

    if (!titleChanged && !tagsChanged) {
      console.log(`  tid ${tid}: 无需修改`);
      continue;
    }

    try {
      // 1) update title via main post
      if (titleChanged) {
        const topic = await bbFetch(`/api/topic/${tid}`);
        const mainPost = topic.posts?.[0];
        if (!mainPost?.pid) throw new Error("无法获取主帖 pid");
        await bbFetch(`/api/v3/posts/${mainPost.pid}`, {
          method: "PUT",
          body: JSON.stringify({ title: newTitle, content: mainPost.content })
        });
      }

      // 2) update tags
      if (tagsChanged) {
        await bbFetch(`/api/v3/topics/${tid}/tags`, {
          method: "PUT",
          body: JSON.stringify({ tags: newTags })
        });
      }

      const changes = [];
      if (titleChanged) changes.push(`标题: "${oldTitle}" → "${newTitle}"`);
      if (tagsChanged) changes.push(`标签: [${newTags.join(", ")}]`);
      console.log(`  tid ${tid}: OK - ${changes.join(" | ")}`);
      ok++;
    } catch (e) {
      console.error(`  tid ${tid}: FAIL - ${e.message}`);
      fail++;
    }
  }

  console.log(`\n完成: ${ok} 成功, ${fail} 失败`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
