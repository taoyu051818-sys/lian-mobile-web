#!/usr/bin/env node

// Creates 10 test users, 3 orgs, and 15 test posts for audience system testing.
// Usage: node scripts/setup-audience-test.js
// Requires: NODEBB_BASE_URL, NODEBB_API_TOKEN, NODEBB_UID in .env or environment

import crypto from "node:crypto";
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
const TEST_PASSWORD = "Test@2026";

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(salt + pw).digest("hex");
  return { salt, hash };
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

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const INST_SCHOOL_MAP = {
  "中国传媒大学海南国际学院": "中国传媒大学",
  "北京邮电大学玛丽女王海南学院": "北京邮电大学",
  "北京体育大学阿尔伯塔国际休闲体育与旅游学院": "北京体育大学",
  "中央民族大学海南国际学院": "中央民族大学"
};

// --- Test user definitions ---

const TEST_USERS = [
  {
    tag: "U1-linxiaoyu",
    id: "U1",
    username: "test_linxiaoyu",
    displayName: "林小雨",
    email: "linxy@cuc.edu.cn",
    institution: "中国传媒大学海南国际学院",
    tags: ["中国传媒大学", "高校认证"],
    orgIds: ["council", "photo-club"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U2-wanghaoran",
    id: "U2",
    username: "test_wanghaoran",
    displayName: "王浩然",
    email: "wanghr@bupt.edu.cn",
    institution: "北京邮电大学玛丽女王海南学院",
    tags: ["北京邮电大学", "高校认证"],
    orgIds: ["council"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U3-chensiqi",
    id: "U3",
    username: "test_chensiqi",
    displayName: "陈思琪",
    email: "chensq@cuc.edu.cn",
    institution: "中国传媒大学海南国际学院",
    tags: ["中国传媒大学", "高校认证"],
    orgIds: ["photo-club"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U4-zhaotianyu",
    id: "U4",
    username: "test_zhaotianyu",
    displayName: "赵天宇",
    email: "zhaoty@bupt.edu.cn",
    institution: "北京邮电大学玛丽女王海南学院",
    tags: ["北京邮电大学", "高校认证"],
    orgIds: ["basketball-club"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U5-liujiayi",
    id: "U5",
    username: "test_liujiayi",
    displayName: "刘佳怡",
    email: "liujy@bsu.edu.cn",
    institution: "北京体育大学阿尔伯塔国际休闲体育与旅游学院",
    tags: ["北京体育大学", "高校认证"],
    orgIds: [],
    registerMethod: "email",
    invitePermission: false
  },
  {
    tag: "U6-teacher-yang",
    id: "U6",
    username: "test_teacher_yang",
    displayName: "杨老师",
    email: "yang@cuc.edu.cn",
    institution: "中国传媒大学海南国际学院",
    tags: ["中国传媒大学", "高校认证"],
    orgIds: [],
    registerMethod: "email",
    invitePermission: true,
    makeAdmin: true
  },
  {
    tag: "U7-zhangsan",
    id: "U7",
    username: "test_zhangsan",
    displayName: "张三",
    email: "zhangsan@gmail.com",
    institution: "",
    tags: ["邀请注册"],
    orgIds: [],
    registerMethod: "invite",
    invitePermission: false
  },
  {
    tag: "U8-liwenjing",
    id: "U8",
    username: "test_liwenjing",
    displayName: "李文静",
    email: "liwj@cuc.edu.cn",
    institution: "中国传媒大学海南国际学院",
    tags: ["中国传媒大学", "高校认证"],
    orgIds: ["photo-club"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U9-zhouzixuan",
    id: "U9",
    username: "test_zhouzixuan",
    displayName: "周子轩",
    email: "zhouzx@bupt.edu.cn",
    institution: "北京邮电大学玛丽女王海南学院",
    tags: ["北京邮电大学", "高校认证"],
    orgIds: ["basketball-club"],
    registerMethod: "email",
    invitePermission: true
  },
  {
    tag: "U10-huangyuxuan",
    id: "U10",
    username: "test_huangyuxuan",
    displayName: "黄雨萱",
    email: "huangyx@muc.edu.cn",
    institution: "中央民族大学海南国际学院",
    tags: ["中央民族大学", "高校认证"],
    orgIds: ["council"],
    registerMethod: "email",
    invitePermission: true
  }
];

// --- Test post definitions ---

function buildTestPosts(userMap) {
  const u = (tag) => userMap[tag];
  const uid = (tag) => u(tag)?.id || "";

  return [
    // === 公开与校园 ===
    {
      tag: "T01",
      title: "五一假期图书馆开放时间调整",
      content: "各位同学好，五一假期期间图书馆开放时间调整为 9:00-17:00，5月5日起恢复正常。自习室座位预约系统照常运行，请提前预约。祝大家假期愉快！",
      author: "U6-teacher-yang",
      visibility: "public",
      audience: { visibility: "public", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life",
      locationArea: "图书馆"
    },
    {
      tag: "T02",
      title: "试验区首届草地音乐节来啦！",
      content: "5月10日晚7点，生活一区大草坪！有乐队演出、街舞battle、美食摊位，凭学生证入场。转发集赞20个可领荧光手环～期待和大家一起嗨！",
      author: "U1-linxiaoyu",
      visibility: "campus",
      audience: { visibility: "campus", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_activity",
      locationArea: "生活一区"
    },
    {
      tag: "T03",
      title: "食堂二楼新窗口测评",
      content: "试了二食堂新开的螺蛳粉窗口，味道还不错！加了酸笋和腐竹，一碗12块，分量很足。推荐指数四颗星，唯一的缺点是排队太长了，建议避开12点高峰期。",
      author: "U5-liujiayi",
      visibility: "campus",
      audience: { visibility: "campus", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life",
      locationArea: "二食堂"
    },

    // === 校内帖子 ===
    {
      tag: "T04",
      title: "中传选课系统即将开放",
      content: "提醒中传的同学们，下学期选课系统5月8日早上9点开放，热门课拼手速！建议提前看好课表，准备好备选方案。有疑问可以去教务处咨询。",
      author: "U3-chensiqi",
      visibility: "school",
      audience: { visibility: "school", schoolIds: ["中国传媒大学"], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life"
    },
    {
      tag: "T05",
      title: "北邮实验室招助研",
      content: "张教授课题组招两名助研，方向是5G边缘计算。要求有Python基础，每周至少10小时。有兴趣的同学私信我发简历，截止日期5月15日。",
      author: "U4-zhaotianyu",
      visibility: "school",
      audience: { visibility: "school", schoolIds: ["北京邮电大学"], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life"
    },
    {
      tag: "T06",
      title: "民大期末考试安排已出",
      content: "民大的同学们注意啦，期末考试安排已出，请登录教务系统查看。考试周从6月16日开始，大家提前复习哦。图书馆延长开放到晚上10点半。",
      author: "U10-huangyuxuan",
      visibility: "school",
      audience: { visibility: "school", schoolIds: ["中央民族大学"], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life"
    },

    // === 组织帖子 ===
    {
      tag: "T07",
      title: "学生会全体大会通知",
      content: "本周六下午3点，学生会堂201开全体大会。议程：①五一活动总结 ②毕业季活动策划 ③新学期预算讨论。请各部部长准时出席，不能到场的提前请假。",
      author: "U2-wanghaoran",
      visibility: "private",
      audience: { visibility: "private", schoolIds: [], orgIds: ["council"], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_activity"
    },
    {
      tag: "T08",
      title: "摄影社外拍活动报名",
      content: "本周日早上8点，清水湾外拍活动！主题是「海与建筑」。自带器材，社里提供三脚架和反光板。名额15人，先到先得，群里接龙报名。",
      author: "U8-liwenjing",
      visibility: "private",
      audience: { visibility: "private", schoolIds: [], orgIds: ["photo-club"], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_activity"
    },
    {
      tag: "T09",
      title: "篮球社友谊赛对手征集",
      content: "下周三晚上想打一场友谊赛，3v3或5v5都行。有没有队伍愿意切磋一下？场地已经订好了综合体育馆二楼。有意的社长联系我。",
      author: "U9-zhouzixuan",
      visibility: "private",
      audience: { visibility: "private", schoolIds: [], orgIds: ["basketball-club"], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_activity"
    },
    {
      tag: "T10",
      title: "学生会四月财务公示",
      content: "四月份财务公示：活动经费支出￥3,200（草地音乐节筹备），办公用品￥180，交通费￥95。明细表已上传共享文档，请各部门负责人核对。",
      author: "U1-linxiaoyu",
      visibility: "private",
      audience: { visibility: "private", schoolIds: [], orgIds: ["council"], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life"
    },

    // === 私密与仅链接 ===
    {
      tag: "T11",
      title: "给小雨的生日惊喜",
      content: "小雨生日快乐！我们几个偷偷准备了一个惊喜派对，周五晚上7点在食堂三楼包间。记得装作不知道哦～",
      author: "U3-chensiqi",
      visibility: "private",
      audience: { visibility: "private", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: false },
      contentType: "campus_life"
    },
    {
      tag: "T12",
      title: "校园卡充值链接",
      content: "校园卡线上充值链接：http://card.lian.edu.cn/recharge（仅供校内使用，请勿外传）",
      author: "U6-teacher-yang",
      visibility: "public",
      audience: { visibility: "public", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: true },
      contentType: "campus_life"
    },
    {
      tag: "T13",
      title: "转让一台iPad Air 5",
      content: "出一台iPad Air 5，256G，国行，保修到明年3月。带Apple Pencil二代和键盘。价格私聊，校区面交。",
      author: "U7-zhangsan",
      visibility: "public",
      audience: { visibility: "public", schoolIds: [], orgIds: [], roleIds: [], userIds: [], linkOnly: true },
      contentType: "campus_life"
    },

    // === 向后兼容 ===
    {
      tag: "T14",
      title: "旧版帖子-无audience字段",
      content: "这是一条模拟旧版帖子，没有audience字段。应默认向所有人可见。",
      author: "U1-linxiaoyu",
      visibility: "public",
      audience: null,
      contentType: "general"
    },
    {
      tag: "T15",
      title: "旧版帖子-仅有visibility",
      content: "这是另一条旧版帖子，只有flat visibility字段为campus，没有audience对象。登录用户应可见。",
      author: "U3-chensiqi",
      visibility: "campus",
      audience: null,
      contentType: "general"
    }
  ];
}

// --- Main ---

async function main() {
  if (!TOKEN) {
    console.error("错误: NODEBB_API_TOKEN 未设置。请在 .env 中配置。");
    process.exit(1);
  }

  console.log("=== 受众系统测试环境搭建 ===\n");

  const authStore = loadJson(AUTH_PATH);
  const metadata = loadJson(META_PATH);
  const userMap = {};

  // 1. Create test users
  console.log("▶ 创建测试用户...");
  for (const def of TEST_USERS) {
    const existing = authStore.users.find((u) => u.username === def.username);
    if (existing) {
      console.log(`  ${def.displayName}(${def.tag}): 已存在 (${existing.id})`);
      userMap[def.tag] = existing;
      continue;
    }
    const user = {
      id: crypto.randomUUID(),
      email: def.email,
      username: def.username,
      password: hashPassword(TEST_PASSWORD),
      institution: def.institution,
      tags: def.tags,
      orgIds: def.orgIds,
      status: "active",
      registerMethod: def.registerMethod,
      invitePermission: def.invitePermission,
      invitedBy: null,
      createdAt: new Date().toISOString()
    };
    authStore.users.push(user);
    userMap[def.tag] = user;
    console.log(`  ${def.displayName}(${def.tag}): 创建成功 (${user.id})`);
  }

  // Set admin role
  for (const def of TEST_USERS) {
    const u = userMap[def.tag];
    if (!u) continue;
    if (def.makeAdmin && !u.roleIds) {
      u.roleIds = ["admin"];
      console.log(`  ${def.displayName}: 设置 roleIds=["admin"]`);
    }
    // Derive schoolId
    if (u.institution && !u.schoolId) {
      u.schoolId = INST_SCHOOL_MAP[u.institution] || "";
    }
    if (!u.orgIds) u.orgIds = def.orgIds || [];
  }

  saveJson(AUTH_PATH, authStore);
  console.log(`  已保存 ${Object.keys(userMap).length} 个用户到 ${AUTH_PATH}\n`);

  // 2. Create test posts via NodeBB API
  console.log("▶ 创建测试帖子...");
  const testPosts = buildTestPosts(userMap);
  const createdTids = {};

  for (const post of testPosts) {
    const author = userMap[post.author];
    if (!author) {
      console.log(`  ${post.tag}「${post.title}」: 跳过 (作者不存在)`);
      continue;
    }

    // Check if post already exists
    const existingEntry = Object.entries(metadata).find(([, m]) => m.title === post.title);
    if (existingEntry) {
      const [tid] = existingEntry;
      createdTids[post.tag] = Number(tid);
      console.log(`  ${post.tag}「${post.title}」: 已存在 (tid ${tid})`);
      continue;
    }

    // Get or create NodeBB uid
    let nodebbUid = author.nodebbUid;
    if (!nodebbUid) {
      try {
        const userData = await bbFetch(`/api/user/username/${author.username}`);
        nodebbUid = userData?.uid;
      } catch {
        try {
          const created = await bbFetch("/api/v1/users", {
            method: "POST",
            body: JSON.stringify({
              username: author.username,
              email: author.email || `${author.username}@test.lian`,
              password: TEST_PASSWORD
            })
          });
          nodebbUid = created?.uid || created?.payload?.uid;
        } catch (e) {
          console.log(`  ${post.tag}「${post.title}」: 无法创建 NodeBB 用户 - ${e.message}`);
          continue;
        }
      }
      if (nodebbUid) {
        author.nodebbUid = nodebbUid;
        const stored = authStore.users.find((u) => u.id === author.id);
        if (stored) stored.nodebbUid = nodebbUid;
      }
    }

    if (!nodebbUid) {
      console.log(`  ${post.tag}「${post.title}」: 跳过 (无法获取 nodebbUid)`);
      continue;
    }

    try {
      const result = await bbFetch(`/api/v3/topics?_uid=${nodebbUid}`, {
        method: "POST",
        body: JSON.stringify({
          cid: Number(process.env.NODEBB_CID || 2),
          title: post.title,
          content: `<p>${post.content}</p>`
        })
      });
      const tid = result?.tid || result?.data?.tid || result?.payload?.tid;
      if (!tid) throw new Error("NodeBB 未返回 tid");

      createdTids[post.tag] = Number(tid);

      const metaEntry = {
        contentType: post.contentType,
        vibeTags: ["测试"],
        sceneTags: ["测试"],
        locationId: "",
        locationArea: post.locationArea || "",
        qualityScore: 0.5,
        imageImpactScore: 0.3,
        riskScore: 0,
        officialScore: 0,
        visibility: post.visibility,
        distribution: post.audience?.linkOnly ? [] : ["home", "search", "detail"],
        keepAfterExpired: false
      };
      if (post.audience) {
        metaEntry.audience = post.audience;
      }
      metadata[String(tid)] = metaEntry;

      console.log(`  ${post.tag}「${post.title}」: 创建成功 (tid ${tid})`);
    } catch (e) {
      console.log(`  ${post.tag}「${post.title}」: 失败 - ${e.message}`);
    }
  }

  // Update T11 private post userIds to target U1
  if (createdTids["T11"] && userMap["U1-linxiaoyu"]) {
    const tid = String(createdTids["T11"]);
    if (metadata[tid]?.audience) {
      metadata[tid].audience.userIds = [userMap["U1-linxiaoyu"].id];
      console.log(`  T11: 设置 userIds=[${userMap["U1-linxiaoyu"].id}] (${userMap["U1-linxiaoyu"].username})`);
    }
  }

  saveJson(META_PATH, metadata);
  saveJson(AUTH_PATH, authStore);
  console.log(`  已保存到 ${META_PATH}\n`);

  // 3. Summary
  console.log("=== 测试环境就绪 ===\n");
  console.log("用户:");
  for (const def of TEST_USERS) {
    const u = userMap[def.tag];
    console.log(`  ${def.displayName.padEnd(6)} ${def.tag.padEnd(18)} schoolId=${(u?.schoolId || "—").padEnd(8)} orgIds=${JSON.stringify(u?.orgIds || [])} roleIds=${JSON.stringify(u?.roleIds || [])}`);
  }
  console.log("\n帖子:");
  for (const post of testPosts) {
    const tid = createdTids[post.tag];
    const vis = post.audience?.linkOnly ? "linkOnly" : post.visibility;
    const extra = post.audience?.orgIds?.length ? ` org=${post.audience.orgIds.join(",")}`
      : post.audience?.schoolIds?.length ? ` school=${post.audience.schoolIds.join(",")}`
      : post.audience?.userIds?.length ? ` private`
      : "";
    console.log(`  ${post.tag.padEnd(4)} tid=${String(tid || "?").padEnd(5)} ${vis.padEnd(10)}${extra} 「${post.title}」`);
  }
  console.log(`\n密码: ${TEST_PASSWORD}`);
  console.log("\n下一步:");
  console.log("  1. 启动服务器: node server.js");
  console.log("  2. 运行测试: node scripts/test-audience.js");
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
