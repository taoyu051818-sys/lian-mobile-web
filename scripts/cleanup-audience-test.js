#!/usr/bin/env node

// Removes all audience test data created by setup-audience-test.js.
// Usage: node scripts/cleanup-audience-test.js

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
const NODEBB_UID = process.env.NODEBB_UID || "2";
const AUTH_PATH = path.join(ROOT, "data", "auth-users.json");
const META_PATH = path.join(ROOT, "data", "post-metadata.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function bbFetch(apiPath, options = {}) {
  const url = new URL(apiPath, BASE);
  url.searchParams.set("_uid", NODEBB_UID);
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

const TEST_USERNAMES = [
  "test_linxiaoyu", "test_wanghaoran", "test_chensiqi",
  "test_zhaotianyu", "test_liujiayi", "test_teacher_yang",
  "test_zhangsan", "test_liwenjing", "test_zhouzixuan", "test_huangyuxuan"
];

const TEST_TITLE_FRAGMENTS = [
  "五一假期图书馆开放时间调整",
  "试验区首届草地音乐节来啦",
  "食堂二楼新窗口测评",
  "中传选课系统即将开放",
  "北邮实验室招助研",
  "民大期末考试安排已出",
  "学生会全体大会通知",
  "摄影社外拍活动报名",
  "篮球社友谊赛对手征集",
  "学生会四月财务公示",
  "给小雨的生日惊喜",
  "校园卡充值链接",
  "转让一台iPad",
  "旧版帖子-无audience字段",
  "旧版帖子-仅有visibility"
];

async function main() {
  console.log("=== 受众系统测试环境清理 ===\n");

  // 1. Remove test post metadata
  console.log("▶ 清理测试帖子元数据...");
  const metadata = loadJson(META_PATH);
  let removedPosts = 0;
  for (const [tid, meta] of Object.entries(metadata)) {
    if (TEST_TITLE_FRAGMENTS.some((f) => (meta.title || "").includes(f))) {
      delete metadata[tid];
      removedPosts++;
      console.log(`  移除 tid ${tid}: ${meta.title}`);
    }
  }
  saveJson(META_PATH, metadata);
  console.log(`  共移除 ${removedPosts} 条\n`);

  // 2. Remove test users from auth store
  console.log("▶ 清理测试用户...");
  const authStore = loadJson(AUTH_PATH);
  let removedUsers = 0;
  authStore.users = authStore.users.filter((u) => {
    if (TEST_USERNAMES.includes(u.username)) {
      console.log(`  移除 ${u.username} (${u.id})`);
      removedUsers++;
      return false;
    }
    return true;
  });
  for (const [token, session] of Object.entries(authStore.sessions || {})) {
    if (!authStore.users.some((u) => u.id === session.userId)) {
      delete authStore.sessions[token];
    }
  }
  saveJson(AUTH_PATH, authStore);
  console.log(`  共移除 ${removedUsers} 个用户\n`);

  // 3. Delete test posts from NodeBB
  if (TOKEN) {
    console.log("▶ 清理 NodeBB 测试帖子...");
    let deleted = 0;
    try {
      for (let page = 1; page <= 10; page++) {
        const data = await bbFetch(`/api/recent?page=${page}`);
        for (const t of (data.topics || [])) {
          if (TEST_TITLE_FRAGMENTS.some((f) => (t.title || "").includes(f))) {
            try {
              await bbFetch(`/api/v3/topics/${t.tid}/state`, { method: "PUT", body: "{}" });
              console.log(`  删除 tid ${t.tid}: ${t.title}`);
              deleted++;
            } catch (e) {
              console.log(`  跳过 tid ${t.tid}: ${e.message}`);
            }
          }
        }
        if ((data.topics || []).length < 20) break;
      }
    } catch (e) {
      console.log(`  NodeBB 清理失败: ${e.message}`);
    }
    console.log(`  共删除 ${deleted} 条\n`);
  } else {
    console.log("▶ 跳过 NodeBB 清理 (无 API Token)\n");
  }

  console.log("=== 清理完成 ===");
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
