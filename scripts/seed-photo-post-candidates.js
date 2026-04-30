#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const metadataPath = path.join(rootDir, "data", "post-metadata.json");
const outputsDir = path.join(rootDir, "outputs");

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || !args.has("--execute");
const isExecute = args.has("--execute");
const repairExisting = args.has("--repair-existing");

if (args.has("--help")) {
  console.log(`Usage:
  node scripts/seed-photo-post-candidates.js --dry-run
  node scripts/seed-photo-post-candidates.js --execute
  node scripts/seed-photo-post-candidates.js --execute --repair-existing

Notes:
  - Dry-run is the default when --execute is absent.
  - --repair-existing re-uploads the mapped images and only replaces image URLs
    in already-created seed posts.
  - Requires NODEBB_BASE_URL, NODEBB_API_TOKEN, NODEBB_UID and NODEBB_CID from .env.
  - Requires CLOUDINARY_URL from .env or ../NodeBB-frontend/.env.local when uploading images.
`);
  process.exit(0);
}

if (isDryRun && isExecute) {
  throw new Error("Use either --dry-run or --execute, not both.");
}

const firstBatchDir = "C:\\Users\\LENOVO\\Pictures\\测试帖子图片";
const secondBatchDir = "C:\\Users\\LENOVO\\Pictures\\测试2";

const seedPosts = [
  {
    key: "photo-batch1-lizard-wheel",
    title: "[推荐测试] 车轮旁边发现一位“临时住户”",
    body: "晚上路过的时候看到一只小家伙躲在车轮旁边。\n感觉它比我还懂哪里凉快。\n路过骑车或者挪车的时候可以稍微看一眼，别压到它。",
    tags: ["推荐测试", "校园随手拍", "真实动态", "小动物", "有网感"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163737_526_2.jpg")],
    metadata: {
      contentType: "campus_moment",
      vibeTags: ["真实", "有网感", "抽象", "在地"],
      sceneTags: ["夜间", "小动物", "路过"],
      locationId: "",
      locationArea: "生活区",
      qualityScore: 0.75,
      imageImpactScore: 0.85,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-lizard-tile",
    title: "[推荐测试] 路上遇到一只校园小恐龙",
    body: "它走得很慢，但很有自己的路线规划。\n这种照片很适合放进“黎安记忆”。\n有时候校园生活感就是这些突然出现的小东西。",
    tags: ["推荐测试", "校园随手拍", "黎安记忆", "小动物", "抽象校园"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163801_537_2.jpg")],
    metadata: {
      contentType: "campus_moment",
      vibeTags: ["真实", "有网感", "抽象"],
      sceneTags: ["白天", "小动物", "路面"],
      locationId: "",
      locationArea: "校园公共区域",
      qualityScore: 0.72,
      imageImpactScore: 0.75,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-xixi-baker",
    title: "[推荐测试] XIXI BAKER 这家店适合顺手买点甜的",
    body: "店面整体很亮，蛋糕卷和泡芙看起来比较适合课后顺手带走。\n如果在附近想买一点甜食，可以先把它记到地图里。",
    tags: ["推荐测试", "美食菜单", "大墩村", "商家", "甜品"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163744_530_2.jpg")],
    metadata: {
      contentType: "food",
      vibeTags: ["在地", "实用"],
      sceneTags: ["甜品", "课后", "探店"],
      locationId: "",
      locationArea: "大墩村",
      qualityScore: 0.78,
      imageImpactScore: 0.7,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-night-congee",
    title: "[推荐测试] 晚上想吃点热的，这个粥摊可以记一下",
    body: "夜里如果不想吃太重的东西，粥会比较稳。\n这家看起来更像“晚课后补一口热的”的选择。\n适合做成大墩村夜宵地图里的一个点。",
    tags: ["推荐测试", "美食菜单", "夜宵", "大墩村", "真实动态"],
    imageFiles: [
      path.join(firstBatchDir, "微信图片_20260430163746_531_2.jpg"),
      path.join(firstBatchDir, "微信图片_20260430163748_532_2.jpg"),
    ],
    metadata: {
      contentType: "food",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["夜宵", "饭点", "晚课后"],
      locationId: "",
      locationArea: "大墩村",
      qualityScore: 0.76,
      imageImpactScore: 0.65,
      riskScore: 0.1,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-canteen-tray",
    title: "[推荐测试] 今天这份食堂组合看起来挺顶饱",
    body: "这类照片很适合做“今日食堂参考”。\n不用写得太正式，主要让大家知道今天窗口大概有什么、分量怎么样。\n如果以后能按食堂和窗口挂到地图上，会很实用。",
    tags: ["推荐测试", "食堂", "校园生活", "今日吃什么"],
    imageFiles: [
      path.join(firstBatchDir, "微信图片_20260430163755_535_2.jpg"),
      path.join(firstBatchDir, "微信图片_20260430163757_536_2.jpg"),
    ],
    metadata: {
      contentType: "food",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["饭点", "食堂", "今日吃什么"],
      locationId: "",
      locationArea: "食堂",
      qualityScore: 0.72,
      imageImpactScore: 0.62,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-shrimp",
    title: "[推荐测试] 这盘虾看起来比菜单更有说服力",
    body: "如果是大墩村或者附近店里的实拍，可以直接作为探店参考。\n比起菜单图，这种真实上桌图更容易让人判断值不值得去。",
    tags: ["推荐测试", "美食", "探店", "大墩村", "真实动态"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163742_529_2.jpg")],
    metadata: {
      contentType: "food",
      vibeTags: ["真实", "在地"],
      sceneTags: ["探店", "晚饭"],
      locationId: "",
      locationArea: "大墩村",
      qualityScore: 0.68,
      imageImpactScore: 0.7,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-climbing-tower",
    title: "[推荐测试] 傍晚的攀岩塔像游戏地图里的地标",
    body: "这个角度很适合做地图里的地点记忆。\n天色暗下来以后，攀岩塔会变得很像一个地标。\n如果以后做“拍照点”，这个位置可以标一下。",
    tags: ["推荐测试", "校园随手拍", "地标", "拍照点", "黎安记忆"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163803_538_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "有网感", "在地"],
      sceneTags: ["傍晚", "拍照", "地标"],
      locationId: "",
      locationArea: "运动区",
      qualityScore: 0.8,
      imageImpactScore: 0.88,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-road-crossing",
    title: "[推荐测试] 这个路口很适合放进地图说明里",
    body: "从高处看这个路口，能比较清楚地理解园区道路和湖边方向。\n这类照片适合做地图辅助，不一定是刷首页的内容。",
    tags: ["推荐测试", "地图探索", "路线提示", "园区道路"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163752_534_2.jpg")],
    metadata: {
      contentType: "map_tip",
      vibeTags: ["在地", "实用"],
      sceneTags: ["路线", "出门前", "地图"],
      locationId: "",
      locationArea: "园区主路",
      qualityScore: 0.7,
      imageImpactScore: 0.55,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-road-work",
    title: "[推荐测试] 这段路今天有施工，路过注意一下",
    body: "这类信息很适合放在地图和“此刻”里。\n它不是普通通知，但对走路、骑车、坐摆渡车的人很实用。\n如果以后能按地点更新，会比群聊里刷过去更好找。",
    tags: ["推荐测试", "校园反馈", "地图提示", "路况", "真实动态"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163739_528_2.jpg")],
    metadata: {
      contentType: "campus_tip",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["路况", "出门前", "施工"],
      locationId: "",
      locationArea: "园区道路",
      qualityScore: 0.82,
      imageImpactScore: 0.65,
      riskScore: 0.05,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-international-flags",
    title: "[推荐测试] 今晚这个活动现场很有国际感",
    body: "现场的旗帜和灯光很抓眼，属于那种路过也会停下来看一眼的活动。\n如果是公开活动，可以作为活动现场记录。\n如果用于首页，建议避免突出单个观众或个人特写。",
    tags: ["推荐测试", "活动现场", "校园活动", "国际交流"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163750_533_2.jpg")],
    metadata: {
      contentType: "activity_scene",
      vibeTags: ["真实", "现场感"],
      sceneTags: ["晚上", "活动", "国际交流"],
      locationId: "",
      locationArea: "活动现场",
      qualityScore: 0.76,
      imageImpactScore: 0.85,
      riskScore: 0.15,
      officialScore: 0.2,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch1-sports-stage",
    title: "[推荐测试] 体育精神主题活动现场，舞台效果挺强",
    body: "这类内容比普通新闻稿更适合用现场图来呈现。\n如果只写成官方回顾，用户可能不点；但如果作为“活动现场记录”，会更有真实感。",
    tags: ["推荐测试", "校园活动", "活动现场", "体育"],
    imageFiles: [path.join(firstBatchDir, "微信图片_20260430163738_527_2.jpg")],
    metadata: {
      contentType: "activity_scene",
      vibeTags: ["真实", "现场感"],
      sceneTags: ["活动", "体育", "晚上"],
      locationId: "",
      locationArea: "体育场馆",
      qualityScore: 0.72,
      imageImpactScore: 0.8,
      riskScore: 0.2,
      officialScore: 0.4,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-esports-room",
    title: "[推荐测试] 这间电脑教室有点像校园里的临时赛场",
    body: "一排电脑开起来以后，普通教室瞬间变成了临时赛场。\n这种内容比正式活动通知更有现场感，也很适合记录社团和校园活动的真实状态。",
    tags: ["推荐测试", "校园活动", "社团现场", "电竞训练", "真实动态"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164704_547_2.jpg")],
    metadata: {
      contentType: "activity_scene",
      vibeTags: ["真实", "有网感", "现场感"],
      sceneTags: ["社团", "电竞", "室内"],
      locationId: "",
      locationArea: "教学楼",
      qualityScore: 0.72,
      imageImpactScore: 0.75,
      riskScore: 0.25,
      officialScore: 0,
      visibility: "campus",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-labor-base",
    title: "[推荐测试] 这个“学生劳动实践教育基地”可以作为地图点位",
    body: "这个位置不像普通教学楼，更像一个园区边缘的实践空间。\n适合放进地图里，作为“实践基地 / 周边探索 / 园区边界”的地点说明。",
    tags: ["推荐测试", "地图探索", "实践基地", "地点"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164706_548_2.jpg")],
    metadata: {
      contentType: "map_tip",
      vibeTags: ["在地", "实用"],
      sceneTags: ["地点", "实践基地", "地图"],
      locationId: "",
      locationArea: "学生劳动实践教育基地",
      qualityScore: 0.72,
      imageImpactScore: 0.65,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-rooftop-view",
    title: "[推荐测试] 这个楼顶视角很适合看完整个园区",
    body: "从这个角度可以看到楼群、湖面和远处的山。\n它不只是风景照，也很适合当作地图里的“视野点”。\n刚来学校的人可能会更容易理解园区空间。",
    tags: ["推荐测试", "校园随手拍", "地图探索", "拍照点", "黎安记忆"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164708_549_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["视野点", "拍照", "地图"],
      locationId: "",
      locationArea: "楼顶观景点",
      qualityScore: 0.82,
      imageImpactScore: 0.82,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-bbq",
    title: "[推荐测试] 这盘烧烤看起来很适合晚课后补一顿",
    body: "这类真实上桌图比菜单更有参考价值。\n如果是在大墩村或附近店里拍的，可以挂到美食地图里。\n适合做“晚课后吃什么”的样本。",
    tags: ["推荐测试", "美食", "夜宵", "饭点", "探店"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164711_550_2.jpg")],
    metadata: {
      contentType: "food",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["夜宵", "饭点", "探店"],
      locationId: "",
      locationArea: "大墩村",
      qualityScore: 0.72,
      imageImpactScore: 0.78,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-night-stadium",
    title: "[推荐测试] 晚上从高处看体育场，像一个发光的地图点",
    body: "夜里的体育场很有空间感。\n这种图适合放进“校园夜间地图”，也适合做跑步、活动、拍照点的地点记忆。",
    tags: ["推荐测试", "校园夜景", "体育场", "地标", "黎安记忆"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164713_551_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "有网感", "在地"],
      sceneTags: ["夜间", "体育场", "地标"],
      locationId: "",
      locationArea: "体育场",
      qualityScore: 0.78,
      imageImpactScore: 0.8,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-seaside-sunset",
    title: "[推荐测试] 海南的日落有时候会把人骗出门",
    body: "如果说试验区有什么天然优势，日落和海边肯定算一个。\n这类内容适合放在“周边玩乐”，也能让首页更有生活感。",
    tags: ["推荐测试", "周边玩乐", "海南生活", "日落", "真实动态"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164715_552_2.jpg")],
    metadata: {
      contentType: "campus_life",
      vibeTags: ["真实", "有网感", "生活感"],
      sceneTags: ["日落", "海边", "周边玩乐"],
      locationId: "",
      locationArea: "陵水海边",
      qualityScore: 0.82,
      imageImpactScore: 0.92,
      riskScore: 0.05,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-shuttle-sunset",
    title: "[推荐测试] 等车的时候，天边突然变得很好看",
    body: "这种照片很适合当作“摆渡车站点记忆”。\n不是正式通知，但它能让地图上的一个点变得更容易被记住。",
    tags: ["推荐测试", "校园随手拍", "摆渡车", "等车", "黎安记忆"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164650_540_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "在地", "有网感"],
      sceneTags: ["傍晚", "摆渡车", "等车"],
      locationId: "",
      locationArea: "摆渡车站点",
      qualityScore: 0.78,
      imageImpactScore: 0.82,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-atrium",
    title: "[推荐测试] 这个中庭空间其实很适合标进地图",
    body: "有些地方不是活动点，但很适合作为“找路参照物”。\n这种中庭、楼梯、连廊空间，适合做室内地图或楼层记忆。",
    tags: ["推荐测试", "地图探索", "室内空间", "找路"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164651_541_2.jpg")],
    metadata: {
      contentType: "map_tip",
      vibeTags: ["在地", "实用"],
      sceneTags: ["室内", "找路", "建筑空间"],
      locationId: "",
      locationArea: "教学楼内部",
      qualityScore: 0.65,
      imageImpactScore: 0.45,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-detective-class",
    title: "[推荐测试] 这节课的现场像在玩真人推理游戏",
    body: "课堂不是只有听讲，有些课现场感很强。\n这种内容很适合记录“真实学习体验”，也能让外面的人知道这里的课不是只有 PPT。",
    tags: ["推荐测试", "课堂", "学习体验", "真实动态", "有网感"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164652_542_2.jpg")],
    metadata: {
      contentType: "learning_scene",
      vibeTags: ["真实", "有网感", "现场感"],
      sceneTags: ["课堂", "学习", "互动"],
      locationId: "",
      locationArea: "教室",
      qualityScore: 0.76,
      imageImpactScore: 0.75,
      riskScore: 0.3,
      officialScore: 0,
      visibility: "campus",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-library-book",
    title: "[推荐测试] 在图书馆看到一本很适合今天的书：《庆祝无意义》",
    body: "书名本身就很有意思。\n这种内容不一定是正式书单，但很适合做“图书馆偶遇”。\n比普通图书馆通知更容易被点开。",
    tags: ["推荐测试", "图书馆学习", "书单", "有网感", "校园随手拍"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164654_543_2.jpg")],
    metadata: {
      contentType: "library_moment",
      vibeTags: ["真实", "有网感", "抽象"],
      sceneTags: ["图书馆", "阅读", "书单"],
      locationId: "",
      locationArea: "图书馆",
      qualityScore: 0.8,
      imageImpactScore: 0.82,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-workshop",
    title: "[推荐测试] 这个实践教室比普通教室更像工作室",
    body: "木工台、工具和大窗户让这个空间很有实践感。\n如果以后做地图，这类教室应该不只是一个房间编号，而是一个可以被介绍的功能空间。",
    tags: ["推荐测试", "实践教室", "工作室", "教学空间", "地图探索"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164657_544_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["实践课", "工作室", "教学空间"],
      locationId: "",
      locationArea: "实践教室",
      qualityScore: 0.78,
      imageImpactScore: 0.72,
      riskScore: 0.15,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-mango-tree",
    title: "[推荐测试] 这棵树已经开始有海南味了",
    body: "路过的时候看到树上挂着果子，突然就很有海南校园的感觉。\n这种小地方很适合放进校园记忆里。",
    tags: ["推荐测试", "校园随手拍", "植物", "海南生活", "黎安记忆"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164700_545_2.jpg")],
    metadata: {
      contentType: "campus_moment",
      vibeTags: ["真实", "在地", "生活感"],
      sceneTags: ["白天", "庭院", "植物"],
      locationId: "",
      locationArea: "校园庭院",
      qualityScore: 0.7,
      imageImpactScore: 0.65,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "photo-batch2-studio",
    title: "[推荐测试] 原来这里还有一个像小型影棚的空间",
    body: "绿幕、灯光和设备都在，感觉不像普通教室。\n这种空间很适合做成地图里的“功能空间”，让有拍摄需求的同学知道哪里可以找。",
    tags: ["推荐测试", "拍摄空间", "影棚", "功能空间", "地图探索"],
    imageFiles: [path.join(secondBatchDir, "微信图片_20260430164702_546_2.jpg")],
    metadata: {
      contentType: "place_memory",
      vibeTags: ["真实", "在地", "实用"],
      sceneTags: ["拍摄", "影棚", "功能空间"],
      locationId: "",
      locationArea: "拍摄空间",
      qualityScore: 0.78,
      imageImpactScore: 0.72,
      riskScore: 0.2,
      officialScore: 0,
      visibility: "campus",
      distribution: ["home", "map", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "text-boundary-deadline-signup",
    title: "[推荐测试] 今天 22:00 前，有个报名别忘了",
    body: "这条是无图但重要提醒样本。\n适合测试：没有封面图的帖子，是否仍然能在首页以可读的方式出现。\n如果你正在看报名类信息，可以先把截止时间记一下：今天 22:00 前完成报名确认。",
    tags: ["推荐测试", "报名机会", "截止提醒", "无图实用信息"],
    imageFiles: [],
    metadata: {
      contentType: "deadline",
      vibeTags: ["实用", "及时"],
      sceneTags: ["报名", "截止", "提醒"],
      locationId: "",
      locationArea: "",
      qualityScore: 0.74,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0.2,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
      timeLabel: "今天 22:00 前",
      expiresAt: "2026-04-30T22:00:00+08:00",
    },
  },
  {
    key: "text-boundary-volunteer-recruit",
    title: "[推荐测试] 周末志愿者招募，想攒实践经历的可以看",
    body: "这条用于测试无图志愿者招募信息。\n内容不一定需要图片，但对想补实践经历、认识新同学的人有用。\n如果你周末有空，可以关注报名名额和集合时间。",
    tags: ["推荐测试", "志愿者招募", "报名机会", "校园活动", "无图实用信息"],
    imageFiles: [],
    metadata: {
      contentType: "signup",
      vibeTags: ["实用", "在地"],
      sceneTags: ["志愿者", "周末", "报名"],
      locationId: "",
      locationArea: "试验区",
      qualityScore: 0.7,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0.15,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
      timeLabel: "本周末",
      expiresAt: "2026-05-03T23:59:59+08:00",
    },
  },
  {
    key: "text-boundary-p-friendly-pop-up",
    title: "[推荐测试] P 人友好：今晚可能临时有个小活动",
    body: "不用提前准备，也不用写很正式的报名理由。\n如果你晚上刚好路过，可以顺手去看一眼；不想社交也可以只围观十分钟。\n这条用于测试更轻、更像学生随手发的临时活动。",
    tags: ["推荐测试", "临时活动", "P人友好", "校园随手拍", "有网感"],
    imageFiles: [],
    metadata: {
      contentType: "campus_moment",
      vibeTags: ["真实", "有网感", "轻量", "在地"],
      sceneTags: ["临时活动", "晚上", "路过"],
      locationId: "",
      locationArea: "公共教学楼附近",
      qualityScore: 0.78,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
      timeLabel: "今晚",
      expiresAt: "2026-04-30T23:59:59+08:00",
    },
  },
  {
    key: "text-boundary-high-risk-filter",
    title: "[推荐测试] 高风险过滤样本：这条不应该自然进首页",
    body: "这是一条纯系统测试内容，不指向任何真实事件，也不涉及真实争议。\n它只用于验证 riskScore 达到高值时，推荐流第一阶段是否能把它从自然分发里过滤出去。",
    tags: ["推荐测试", "系统测试", "高风险过滤"],
    imageFiles: [],
    metadata: {
      contentType: "general",
      vibeTags: ["测试"],
      sceneTags: ["风险过滤"],
      locationId: "",
      locationArea: "",
      qualityScore: 0.1,
      imageImpactScore: 0,
      riskScore: 0.95,
      officialScore: 0,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
    },
  },
  {
    key: "text-boundary-detail-only",
    title: "[推荐测试] detailOnly 样本：只允许详情直达",
    body: "这条用于测试 distribution=[\"detailOnly\"]。\n它不是权限测试，而是分发范围测试：不应该进入首页、搜索、地图、热榜等自然列表，只能通过详情直达、后台或测试入口查看。",
    tags: ["推荐测试", "系统测试", "detailOnly"],
    imageFiles: [],
    metadata: {
      contentType: "general",
      vibeTags: ["测试"],
      sceneTags: ["分发范围"],
      locationId: "",
      locationArea: "",
      qualityScore: 0.2,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0,
      visibility: "public",
      distribution: ["detailOnly"],
      keepAfterExpired: false,
    },
  },
  {
    key: "text-boundary-expired-activity-keep-home",
    title: "[推荐测试] 过期活动资料：虽然过期但仍可保留",
    body: "这是一条 keepAfterExpired=true 的过期活动资料样本。\n活动本身已经结束，但内容可能仍然有资料价值，比如规则、路线、经验、复盘。\n它用于测试：过期以后，如果明确保留，仍然可以进入允许的分发范围。",
    tags: ["推荐测试", "过期资料", "校园活动", "资料库"],
    imageFiles: [],
    metadata: {
      contentType: "activity_archive",
      vibeTags: ["资料", "实用"],
      sceneTags: ["活动", "复盘", "过期保留"],
      locationId: "",
      locationArea: "试验区",
      qualityScore: 0.68,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0.2,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: true,
      timeLabel: "已结束，保留资料",
      startsAt: "2026-04-01T00:00:00+08:00",
      endsAt: "2026-04-02T23:59:59+08:00",
      expiresAt: "2026-04-02T23:59:59+08:00",
    },
  },
  {
    key: "text-boundary-expired-club-keep-no-home",
    title: "[推荐测试] 过期社团资料：保留但不进首页",
    body: "这是一条过期社团资料样本。\n内容可以保留在搜索和详情里，但不应该自然进入首页。\n用于测试 keepAfterExpired=true 与 distribution 不含 home 同时存在时，首页是否仍然尊重 distribution。",
    tags: ["推荐测试", "过期资料", "社团内容", "资料库"],
    imageFiles: [],
    metadata: {
      contentType: "club_archive",
      vibeTags: ["资料", "在地"],
      sceneTags: ["社团", "过期保留", "搜索"],
      locationId: "",
      locationArea: "试验区",
      qualityScore: 0.64,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 0.1,
      visibility: "public",
      distribution: ["search", "detail"],
      keepAfterExpired: true,
      timeLabel: "已结束，资料保留",
      startsAt: "2026-03-01T00:00:00+08:00",
      endsAt: "2026-03-10T23:59:59+08:00",
      expiresAt: "2026-03-10T23:59:59+08:00",
    },
  },
  {
    key: "text-boundary-official-score-review",
    title: "[推荐测试] 正式讲座回顾：这类内容应被适度降权",
    body: "这是一条 officialScore=1 的正式讲座回顾样本。\n它不应该消失，搜索、分类和详情仍然应该能看到；但在首页补位池里，它应该比真实动态、在地生活、强图片内容稍微靠后。",
    tags: ["推荐测试", "官方资讯", "讲座回顾", "系统测试"],
    imageFiles: [],
    metadata: {
      contentType: "official_recap",
      vibeTags: ["正式", "资料"],
      sceneTags: ["讲座", "回顾", "官方"],
      locationId: "",
      locationArea: "试验区",
      qualityScore: 0.56,
      imageImpactScore: 0,
      riskScore: 0,
      officialScore: 1,
      visibility: "public",
      distribution: ["home", "search", "detail"],
      keepAfterExpired: false,
      timeLabel: "讲座回顾",
    },
  },
];

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const text = await fs.readFile(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key]) {
      continue;
    }
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function getFallbackCloudinaryUrl() {
  const fallbackPath = path.resolve(rootDir, "..", "NodeBB-frontend", ".env.local");
  if (!fsSync.existsSync(fallbackPath)) {
    return "";
  }
  const text = await fs.readFile(fallbackPath, "utf8");
  const match = text.match(/^CLOUDINARY_URL=(.+)$/m);
  return match ? match[1].trim() : "";
}

async function buildConfig() {
  await loadEnvFile(path.join(rootDir, ".env"));
  const cloudinaryUrl = process.env.CLOUDINARY_URL || (await getFallbackCloudinaryUrl());

  return {
    nodebbBaseUrl: stripTrailingSlash(
      process.env.NODEBB_BASE_URL || "http://149.104.21.74:4567",
    ),
    nodebbToken: process.env.NODEBB_API_TOKEN || "",
    nodebbUid: Number(process.env.NODEBB_UID || 2),
    nodebbCid: Number(process.env.NODEBB_CID || 2),
    cloudinaryUrl,
  };
}

function requireConfig(config) {
  const missing = [];
  if (!config.nodebbBaseUrl) missing.push("NODEBB_BASE_URL");
  if (!config.nodebbToken) missing.push("NODEBB_API_TOKEN");
  if (!Number.isFinite(config.nodebbUid) || config.nodebbUid <= 0) missing.push("NODEBB_UID");
  if (!Number.isFinite(config.nodebbCid) || config.nodebbCid <= 0) missing.push("NODEBB_CID");
  if (missing.length) {
    throw new Error(`Missing required config: ${missing.join(", ")}`);
  }
}

async function nodebbFetch(config, apiPath, options = {}) {
  const url = new URL(
    apiPath.startsWith("/") ? `${config.nodebbBaseUrl}${apiPath}` : `${config.nodebbBaseUrl}/${apiPath}`,
  );
  if (!url.searchParams.has("_uid")) {
    url.searchParams.set("_uid", String(config.nodebbUid));
  }

  const headers = new Headers(options.headers || {});
  if (config.nodebbToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${config.nodebbToken}`);
  }
  headers.set("accept", "application/json");

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(`NodeBB ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
  }
  return data;
}

async function fetchRecentTopics(config, maxPages = 20) {
  const topics = [];
  for (let page = 1; page <= maxPages; page += 1) {
    let data;
    try {
      data = await nodebbFetch(config, `/api/recent?page=${page}`);
    } catch (error) {
      if (page === 1) {
        throw error;
      }
      break;
    }
    const pageTopics = data?.topics || data?.response?.topics || [];
    if (!pageTopics.length) {
      break;
    }
    topics.push(...pageTopics);
  }
  return topics;
}

function titleKey(title) {
  return String(title || "")
    .replace(/^\[推荐测试\]\s*/u, "")
    .trim();
}

async function readMetadata() {
  const text = await fs.readFile(metadataPath, "utf8");
  return JSON.parse(text);
}

function metadataSeedIndex(metadata) {
  const index = new Map();
  const items = metadata.items || {};
  for (const [tid, item] of Object.entries(items)) {
    if (item?.seedKey) {
      index.set(item.seedKey, Number(tid));
    }
  }
  return index;
}

function recentTitleIndex(topics) {
  const index = new Map();
  for (const topic of topics) {
    const tid = Number(topic.tid);
    if (!tid || !topic.title) {
      continue;
    }
    index.set(String(topic.title).trim(), tid);
    index.set(titleKey(topic.title), tid);
  }
  return index;
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function parseCloudinaryUrl(cloudinaryUrl) {
  const match = cloudinaryUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    throw new Error("CLOUDINARY_URL must be cloudinary://api_key:api_secret@cloud_name");
  }
  return {
    apiKey: match[1],
    apiSecret: match[2],
    cloudName: match[3],
  };
}

async function uploadImageToCloudinary(config, filePath, publicIdHint) {
  if (!config.cloudinaryUrl) {
    throw new Error("CLOUDINARY_URL is required for image upload.");
  }
  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(config.cloudinaryUrl);
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "nodebb-frontend/feed-test-seed";
  const publicId = publicIdHint.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");
  const bytes = await fs.readFile(filePath);
  const blob = new Blob([bytes], { type: mimeFromPath(filePath) });

  const form = new FormData();
  form.append("file", blob, path.basename(filePath));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(`Cloudinary upload failed: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.secure_url;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTopicHtml(post, imageUrls, missingImages) {
  const blocks = [`<!-- lian-seed-photo-post key="${escapeHtml(post.key)}" -->`];
  for (const url of imageUrls) {
    blocks.push(`<p><img src="${escapeHtml(url)}" alt="${escapeHtml(post.title)}" loading="lazy"></p>`);
  }
  for (const paragraph of post.body.split(/\n+/).map((line) => line.trim()).filter(Boolean)) {
    blocks.push(`<p>${escapeHtml(paragraph)}</p>`);
  }
  blocks.push(`<p>${post.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}</p>`);
  if (missingImages.length) {
    blocks.push(`<!-- missing images: ${escapeHtml(missingImages.map((filePath) => path.basename(filePath)).join(", "))} -->`);
  }
  return blocks.join("\n");
}

async function createTopic(config, post, imageUrls, missingImages) {
  const content = buildTopicHtml(post, imageUrls, missingImages);
  const data = await nodebbFetch(config, "/api/v3/topics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.nodebbToken}`,
    },
    body: JSON.stringify({
      cid: config.nodebbCid,
      title: post.title,
      content,
      tags: post.tags,
    }),
  });
  const tid = Number(data?.response?.tid || data?.tid || data?.response?.topic?.tid);
  if (!tid) {
    throw new Error(`NodeBB topic created but tid was not found: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return tid;
}

async function updatePostImages(config, tid, title, imageUrls) {
  const data = await nodebbFetch(config, `/api/topic/${tid}`);
  const firstPost = data?.posts?.[0];
  const pid = Number(firstPost?.pid || data?.mainPid);
  const oldContent = String(firstPost?.content || "");
  if (!pid) {
    throw new Error(`Cannot find main post pid for tid ${tid}.`);
  }

  const imageBlock = imageUrls
    .map((url) => `<p><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="lazy"></p>`)
    .join("\n");
  const nextContent = oldContent.match(/^\s*(?:<p><img\b[^>]*><\/p>\s*)+/i)
    ? oldContent.replace(/^\s*(?:<p><img\b[^>]*><\/p>\s*)+/i, `${imageBlock}\n`)
    : `${imageBlock}\n${oldContent}`;

  await nodebbFetch(config, `/api/v3/posts/${pid}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.nodebbToken}`,
    },
    body: JSON.stringify({ content: nextContent }),
  });
  return pid;
}

async function fetchTopicImageUrls(config, tid) {
  try {
    const data = await nodebbFetch(config, `/api/topic/${tid}`);
    const contents = (data?.posts || [])
      .map((post) => String(post?.content || ""))
      .join("\n");
    const urls = [];
    const seen = new Set();
    for (const match of contents.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const url = match[1];
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function completeMetadata(post, imageUrls, missingImages) {
  return {
    contentType: "general",
    vibeTags: [],
    sceneTags: [],
    locationId: "",
    locationArea: "",
    qualityScore: 0,
    imageImpactScore: 0,
    riskScore: 0,
    officialScore: 0,
    visibility: "public",
    distribution: ["home", "search", "detail"],
    keepAfterExpired: false,
    ...post.metadata,
    seedKey: post.key,
    seedTitle: post.title,
    seedSource: "photo-post-candidates",
    seededAt: new Date().toISOString(),
    imageUrls,
    sourceImageFiles: post.imageFiles.map((filePath) => path.basename(filePath)),
    missingImages: missingImages.map((filePath) => path.basename(filePath)),
    tags: post.tags,
  };
}

async function writeMetadataWithBackup(metadata) {
  const stamp = timestampForFile();
  const backupPath = `${metadataPath}.bak-${stamp}`;
  const tempPath = `${metadataPath}.tmp-${stamp}`;
  const original = await fs.readFile(metadataPath, "utf8");
  await fs.writeFile(backupPath, original, "utf8");
  await fs.writeFile(tempPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, metadataPath);
  return backupPath;
}

async function writeResult(result) {
  await fs.mkdir(outputsDir, { recursive: true });
  const resultPath = path.join(outputsDir, `feed-test-seed-result-${todayStamp()}.json`);
  result.resultPath = resultPath;
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return resultPath;
}

async function collectImageStatus(post) {
  const found = [];
  const missing = [];
  for (const filePath of post.imageFiles) {
    if (fsSync.existsSync(filePath)) {
      found.push(filePath);
    } else {
      missing.push(filePath);
    }
  }
  return { found, missing };
}

async function main() {
  const config = await buildConfig();
  requireConfig(config);

  const metadata = await readMetadata();
  metadata.items ||= {};

  const existingBySeedKey = metadataSeedIndex(metadata);
  const recentTopics = await fetchRecentTopics(config);
  const existingByTitle = recentTitleIndex(recentTopics);

  const result = {
    mode: isDryRun ? "dry-run" : "execute",
    generatedAt: new Date().toISOString(),
    seedCount: seedPosts.length,
    nodebbBaseUrl: config.nodebbBaseUrl,
    nodebbCid: config.nodebbCid,
    nodebbUid: config.nodebbUid,
    resultPath: null,
    metadataBackupPath: null,
    posts: [],
  };

  let metadataChanged = false;

  for (const post of seedPosts) {
    const imageStatus = await collectImageStatus(post);
    const existingTid =
      existingBySeedKey.get(post.key) ||
      existingByTitle.get(post.title) ||
      existingByTitle.get(titleKey(post.title));

    if (isDryRun) {
      result.posts.push({
        key: post.key,
        title: post.title,
        action: existingTid ? "reuse-existing" : "would-create",
        tid: existingTid || null,
        imageFiles: post.imageFiles,
        missingImage: imageStatus.missing.map((filePath) => path.basename(filePath)),
      });
      continue;
    }

    try {
      let tid = existingTid || null;
      let action = existingTid ? "reuse-existing" : "created";
      const imageUrls = [];

      if (!tid || repairExisting) {
        for (const filePath of imageStatus.found) {
          const publicId = `${post.key}-${crypto
            .createHash("sha1")
            .update(filePath)
            .digest("hex")
            .slice(0, 8)}`;
          const url = await uploadImageToCloudinary(config, filePath, publicId);
          imageUrls.push(url);
        }
      }

      let repairedPid = null;
      if (tid && repairExisting && imageUrls.length) {
        repairedPid = await updatePostImages(config, tid, post.title, imageUrls);
        action = "repaired-existing";
      }

      if (!tid) {
        tid = await createTopic(config, post, imageUrls, imageStatus.missing);
      } else {
        const existingMeta = metadata.items[String(tid)] || {};
        if (!imageUrls.length) {
          imageUrls.push(...(Array.isArray(existingMeta.imageUrls) ? existingMeta.imageUrls : []));
        }
        if (!imageUrls.length) {
          imageUrls.push(...(await fetchTopicImageUrls(config, tid)));
        }
      }

      metadata.items[String(tid)] = {
        ...(metadata.items[String(tid)] || {}),
        ...completeMetadata(post, imageUrls, imageStatus.missing),
      };
      metadataChanged = true;
      result.posts.push({
        key: post.key,
        title: post.title,
        action,
        tid,
        repairedPid,
        imageUrls,
        missingImage: imageStatus.missing.map((filePath) => path.basename(filePath)),
      });
    } catch (error) {
      result.posts.push({
        key: post.key,
        title: post.title,
        action: "failed",
        error: error instanceof Error ? error.message : String(error),
        missingImage: imageStatus.missing.map((filePath) => path.basename(filePath)),
      });
    }
  }

  if (isExecute && metadataChanged) {
    metadata.generatedAt = new Date().toISOString();
    result.metadataBackupPath = await writeMetadataWithBackup(metadata);
  }

  result.resultPath = await writeResult(result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const failure = {
    mode: isDryRun ? "dry-run" : "execute",
    generatedAt: new Date().toISOString(),
    seedCount: seedPosts.length,
    fatal: error instanceof Error ? error.message : String(error),
  };
  try {
    const resultPath = await writeResult(failure);
    failure.resultPath = resultPath;
  } catch {
    // Keep the original fatal error visible.
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
