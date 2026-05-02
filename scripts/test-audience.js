#!/usr/bin/env node

// Audience system integration tests — 10 users, 15 posts, org-aware.
// Usage: node scripts/test-audience.js [BASE_URL]

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://localhost:4100";
const AUTH_PATH = path.join(ROOT, "data", "auth-users.json");
const META_PATH = path.join(ROOT, "data", "post-metadata.json");
const PASSWORD = "Test@2026";

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function api(method, urlPath, { session, body } = {}) {
  const headers = { accept: "application/json" };
  if (session) headers.cookie = `lian_session=${session}`;
  if (body) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function getSessionToken(username) {
  const res = await api("POST", "/api/auth/login", { body: { login: username, password: PASSWORD } });
  return res.data?.session || null;
}

let passed = 0, failed = 0, skipped = 0;

function assert(cond, name, detail = "") {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

function skip(name, reason) { console.log(`  ○ ${name} (跳过: ${reason})`); skipped++; }

// --- Main ---

async function main() {
  console.log("═══ 受众系统集成测试 ═══");
  console.log(`目标: ${BASE}\n`);

  let authStore, metadata;
  try {
    authStore = loadJson(AUTH_PATH);
    metadata = loadJson(META_PATH);
  } catch {
    console.error("无法加载测试数据。请先运行: node scripts/setup-audience-test.js");
    process.exit(1);
  }

  // Map user tags to auth records
  const USER_TAGS = {
    "U1": "test_linxiaoyu", "U2": "test_wanghaoran", "U3": "test_chensiqi",
    "U4": "test_zhaotianyu", "U5": "test_liujiayi", "U6": "test_teacher_yang",
    "U7": "test_zhangsan", "U8": "test_liwenjing", "U9": "test_zhouzixuan", "U10": "test_huangyuxuan"
  };
  const users = {};
  for (const [id, username] of Object.entries(USER_TAGS)) {
    users[id] = authStore.users.find((u) => u.username === username);
  }

  // Map post tags to tids by title match
  const POST_TITLES = {
    "T01": "五一假期图书馆开放时间调整", "T02": "试验区首届草地音乐节来啦",
    "T03": "食堂二楼新窗口测评", "T04": "中传选课系统即将开放",
    "T05": "北邮实验室招助研", "T06": "民大期末考试安排已出",
    "T07": "学生会全体大会通知", "T08": "摄影社外拍活动报名",
    "T09": "篮球社友谊赛对手征集", "T10": "学生会四月财务公示",
    "T11": "给小雨的生日惊喜", "T12": "校园卡充值链接",
    "T13": "转让一台iPad", "T14": "旧版帖子-无audience字段",
    "T15": "旧版帖子-仅有visibility"
  };
  const tids = {};
  for (const [tag, fragment] of Object.entries(POST_TITLES)) {
    const entry = Object.entries(metadata).find(([, m]) => (m.title || "").includes(fragment));
    tids[tag] = entry ? entry[0] : null;
  }

  console.log("用户:");
  for (const [id, u] of Object.entries(users)) {
    console.log(`  ${id}: ${u?.username || "未找到"} (schoolId=${u?.schoolId || "—"}, orgIds=${JSON.stringify(u?.orgIds || [])})`);
  }
  console.log("\n帖子:");
  for (const [tag, tid] of Object.entries(tids)) {
    console.log(`  ${tag}: tid=${tid || "未找到"}`);
  }
  console.log("");

  // Login all users
  console.log("▶ 登录...");
  const sessions = {};
  for (const [id, u] of Object.entries(users)) {
    if (!u) { sessions[id] = null; continue; }
    sessions[id] = await getSessionToken(u.username);
    console.log(`  ${id} ${u.username}: ${sessions[id] ? "✓" : "✗"}`);
  }
  console.log("");

  // Helper
  const feedHas = async (userId, postTag) => {
    const res = await api("GET", "/api/feed", { session: sessions[userId] });
    const feedTids = (res.data?.items || []).map((i) => String(i.tid));
    return feedTids.includes(tids[postTag]);
  };

  const detailStatus = async (userId, postTag) => {
    const res = await api("GET", `/api/posts/${tids[postTag]}`, { session: sessions[userId] || undefined });
    return res.status;
  };

  const mapHas = async (userId, postTag) => {
    const res = await api("GET", "/api/map/v2/items", { session: sessions[userId] });
    const postTids = (res.data?.posts || []).map((p) => String(p.tid));
    return postTids.includes(tids[postTag]);
  };

  // === Feed Tests ===
  console.log("▶ Feed 测试");

  // F1: 匿名
  assert(!(await feedHas(null, "T02")), "F1: 匿名不可见校园帖 T02");
  assert(!(await feedHas(null, "T04")), "F1: 匿名不可见校内帖 T04");
  assert(!(await feedHas(null, "T07")), "F1: 匿名不可见组织帖 T07");
  assert(!(await feedHas(null, "T12")), "F1: 匿名不可见仅链接帖 T12");

  // F2: U1 林小雨 (中传+学生会+摄影社)
  assert(await feedHas("U1", "T01"), "F2: U1可见公开帖 T01");
  assert(await feedHas("U1", "T02"), "F2: U1可见校园帖 T02");
  assert(await feedHas("U1", "T04"), "F2: U1可见中传校内帖 T04");
  assert(!(await feedHas("U1", "T05")), "F2: U1不可见北邮校内帖 T05");
  assert(await feedHas("U1", "T07"), "F2: U1可见学生会帖 T07");
  assert(await feedHas("U1", "T08"), "F2: U1可见摄影社帖 T08");
  assert(!(await feedHas("U1", "T09")), "F2: U1不可见篮球社帖 T09");
  assert(await feedHas("U1", "T10"), "F2: U1可见学生会财务帖 T10");
  assert(!(await feedHas("U1", "T12")), "F2: U1不可见仅链接帖 T12");

  // F3: U2 王浩然 (北邮+学生会)
  assert(await feedHas("U2", "T02"), "F3: U2可见校园帖 T02");
  assert(!(await feedHas("U2", "T04")), "F3: U2不可见中传校内帖 T04");
  assert(await feedHas("U2", "T05"), "F3: U2可见北邮校内帖 T05");
  assert(await feedHas("U2", "T07"), "F3: U2可见学生会帖 T07");
  assert(!(await feedHas("U2", "T08")), "F3: U2不可见摄影社帖 T08");
  assert(!(await feedHas("U2", "T09")), "F3: U2不可见篮球社帖 T09");

  // F4: U3 陈思琪 (中传+摄影社)
  assert(await feedHas("U3", "T04"), "F4: U3可见中传校内帖 T04");
  assert(await feedHas("U3", "T08"), "F4: U3可见摄影社帖 T08");
  assert(!(await feedHas("U3", "T05")), "F4: U3不可见北邮校内帖 T05");
  assert(!(await feedHas("U3", "T07")), "F4: U3不可见学生会帖 T07");
  assert(!(await feedHas("U3", "T09")), "F4: U3不可见篮球社帖 T09");

  // F5: U4 赵天宇 (北邮+篮球社)
  assert(await feedHas("U4", "T05"), "F5: U4可见北邮校内帖 T05");
  assert(await feedHas("U4", "T09"), "F5: U4可见篮球社帖 T09");
  assert(!(await feedHas("U4", "T04")), "F5: U4不可见中传校内帖 T04");
  assert(!(await feedHas("U4", "T07")), "F5: U4不可见学生会帖 T07");
  assert(!(await feedHas("U4", "T08")), "F5: U4不可见摄影社帖 T08");

  // F6: U5 刘佳怡 (体大,无组织)
  assert(await feedHas("U5", "T02"), "F6: U5可见校园帖 T02");
  assert(!(await feedHas("U5", "T04")), "F6: U5不可见中传校内帖 T04");
  assert(!(await feedHas("U5", "T05")), "F6: U5不可见北邮校内帖 T05");
  assert(!(await feedHas("U5", "T07")), "F6: U5不可见学生会帖 T07");
  assert(!(await feedHas("U5", "T08")), "F6: U5不可见摄影社帖 T08");

  // F7: U10 黄雨萱 (民大+学生会)
  assert(await feedHas("U10", "T06"), "F7: U10可见民大校内帖 T06");
  assert(await feedHas("U10", "T07"), "F7: U10可见学生会帖 T07");
  assert(await feedHas("U10", "T10"), "F7: U10可见学生会财务帖 T10");
  assert(!(await feedHas("U10", "T04")), "F7: U10不可见中传校内帖 T04");
  assert(!(await feedHas("U10", "T05")), "F7: U10不可见北邮校内帖 T05");
  assert(!(await feedHas("U10", "T08")), "F7: U10不可见摄影社帖 T08");

  // F8: U7 张三 (外部访客)
  assert(await feedHas("U7", "T01"), "F8: U7可见公开帖 T01");
  assert(await feedHas("U7", "T02"), "F8: U7可见校园帖 T02 (已登录)");
  assert(!(await feedHas("U7", "T04")), "F8: U7不可见校内帖 T04");
  assert(!(await feedHas("U7", "T07")), "F8: U7不可见组织帖 T07");

  console.log("");

  // === Detail Tests ===
  console.log("▶ Detail 测试");

  assert((await detailStatus(null, "T01")) === 200, "D01: 公开帖匿名 200");
  assert((await detailStatus(null, "T02")) === 403, "D02: 校园帖匿名 403");
  assert((await detailStatus("U1", "T02")) === 200, "D03: 校园帖U1登录 200");
  assert((await detailStatus("U1", "T04")) === 200, "D04: 中传帖U1(中传) 200");
  assert((await detailStatus("U2", "T04")) === 403, "D05: 中传帖U2(北邮) 403");
  assert((await detailStatus("U4", "T05")) === 200, "D06: 北邮帖U4(北邮) 200");
  assert((await detailStatus("U1", "T05")) === 403, "D07: 北邮帖U1(中传) 403");
  assert((await detailStatus("U10", "T06")) === 200, "D08: 民大帖U10(民大) 200");
  assert((await detailStatus("U1", "T06")) === 403, "D09: 民大帖U1(中传) 403");
  assert((await detailStatus("U1", "T07")) === 200, "D10: 学生会帖U1(会员) 200");
  assert((await detailStatus("U5", "T07")) === 403, "D11: 学生会帖U5(非会员) 403");
  assert((await detailStatus("U3", "T08")) === 200, "D12: 摄影社帖U3(社员) 200");
  assert((await detailStatus("U4", "T08")) === 403, "D13: 摄影社帖U4(非社员) 403");
  assert((await detailStatus("U9", "T09")) === 200, "D14: 篮球社帖U9(社长) 200");
  assert((await detailStatus("U1", "T09")) === 403, "D15: 篮球社帖U1(非社员) 403");
  assert((await detailStatus("U1", "T11")) === 200, "D16: 私密帖U1(目标用户) 200");
  assert((await detailStatus("U2", "T11")) === 403, "D17: 私密帖U2(非目标) 403");
  assert((await detailStatus(null, "T12")) === 200, "D18: 仅链接帖(公开基础)匿名 200");
  assert((await detailStatus("U6", "T12")) === 200, "D19: 仅链接帖U6(作者) 200");
  assert((await detailStatus(null, "T14")) === 200, "D20: 旧版无audience匿名 200");
  assert((await detailStatus(null, "T15")) === 403, "D21: 旧版仅visibility匿名 403");
  assert((await detailStatus("U1", "T15")) === 200, "D22: 旧版仅visibility U1登录 200");

  console.log("");

  // === Map Tests ===
  console.log("▶ Map 测试");

  assert(!(await mapHas(null, "T02")), "M1: 匿名地图不可见校园帖 T02");
  assert(!(await mapHas(null, "T04")), "M1: 匿名地图不可见校内帖 T04");
  assert(await mapHas("U1", "T02"), "M2: U1地图可见校园帖 T02");
  assert(await mapHas("U1", "T04"), "M2: U1地图可见中传帖 T04");
  assert(!(await mapHas("U1", "T05")), "M2: U1地图不可见北邮帖 T05");
  assert(await mapHas("U4", "T05"), "M3: U4地图可见北邮帖 T05");
  assert(!(await mapHas("U4", "T04")), "M3: U4地图不可见中传帖 T04");

  console.log("");

  // === Reply Tests ===
  console.log("▶ Reply 测试");
  if (tids.T01) {
    const res = await api("POST", `/api/posts/${tids.T01}/replies`, { session: sessions.U7, body: { content: "收到，谢谢通知！" } });
    assert(res.status === 200, "R1: U7回复公开帖 200", `status=${res.status}`);
  }
  if (tids.T02) {
    const res = await api("POST", `/api/posts/${tids.T02}/replies`, { body: { content: "匿名回复" } });
    assert(res.status === 401, "R2: 匿名回复校园帖 401", `status=${res.status}`);
  }
  if (tids.T04) {
    const res = await api("POST", `/api/posts/${tids.T04}/replies`, { session: sessions.U2, body: { content: "北邮学生回复中传帖" } });
    assert(res.status === 403, "R3: U2(北邮)回复中传校内帖 403", `status=${res.status}`);
  }
  if (tids.T07) {
    const res = await api("POST", `/api/posts/${tids.T07}/replies`, { session: sessions.U1, body: { content: "收到，准时出席！" } });
    assert(res.status === 200, "R4: U1(学生会)回复学生会帖 200", `status=${res.status}`);
  }
  if (tids.T07) {
    const res = await api("POST", `/api/posts/${tids.T07}/replies`, { session: sessions.U5, body: { content: "非会员回复" } });
    assert(res.status === 403, "R5: U5(非学生会)回复学生会帖 403", `status=${res.status}`);
  }

  console.log("");

  // === Summary ===
  console.log("═══ 结果 ═══");
  console.log(`通过: ${passed}, 失败: ${failed}, 跳过: ${skipped}`);
  if (failed > 0) {
    console.log("\n有失败的测试用例，请检查实现。");
    process.exit(1);
  } else {
    console.log("\n全部通过！");
  }
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
