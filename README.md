# 黎安移动端 WebUI

一个直接连接 NodeBB 原生 API 的移动端信息流。服务端负责保存 API token、整理推荐流、读取帖子详情、上传图片到 Cloudinary，并向前端提供 `/api/*`。

内容编辑、图文帖子和推荐流维护原则见 [`EDITORIAL_PRINCIPLES.md`](./EDITORIAL_PRINCIPLES.md)。所有面向学生的信息整理、NodeBB 图文帖和每日推荐批次都按这份原则执行。

## 首次部署引导

如果项目目录没有 `.env`，并且启动环境里没有 `NODEBB_API_TOKEN`，第一次访问端口会进入部署引导页。

引导页会保存这些配置到服务器本地 `.env`：

- `NODEBB_BASE_URL`：NodeBB 地址。同一台 Linux 服务器建议填 `http://127.0.0.1:4567`
- `NODEBB_PUBLIC_BASE_URL`：浏览器可访问的公开地址，用于头像、正文图片和跳转链接，不能填 `127.0.0.1`
- `NODEBB_API_TOKEN`：NodeBB API token
- `NODEBB_UID`：默认操作用户
- `NODEBB_CID`：默认发帖分类
- `CLOUDINARY_URL`：需要网页上传图片发帖时填写

端口 `PORT` 也会写入 `.env`，但服务已经监听后不会自动换端口。修改端口后执行：

```bash
pm2 reload lian-mobile-web --update-env
```

## 本地启动

```powershell
cd F:\26.3.13\lian-mobile-web
.\scripts\start-local.ps1
```

访问：

```text
http://localhost:4100
```

## Linux 部署

先安装运行环境：

```bash
sudo bash scripts/install-linux-env.sh
```

部署到 `/opt/lian-mobile-web` 并用 PM2 启动：

```bash
bash scripts/deploy.sh
```

第一次打开：

```text
http://服务器IP:4100
```

填完引导后，后续就是正式信息流。

## 数据来源

服务端直接读取 LIAN API。接口连接失败时会把错误返回给前端，避免本地缓存掩盖真实问题。

## 主要接口

- `GET /api/feed?tab=推荐&page=1&limit=12`
- `GET /api/posts/:tid`
- `POST /api/posts`
- `POST /api/upload/image`
- `GET /api/map/items`
- `GET /api/messages`
- `GET /api/me`

## 推荐流维护

推荐流规则在 `data/feed-rules.json`。

帖子的时效信息不使用 NodeBB 编辑时间，单独维护在 `data/post-metadata.json`：

- `timeLabel`：卡片上展示的时间
- `startsAt`：活动或报名开始时间
- `endsAt`：活动或报名结束时间
- `expiresAt`：信息失效时间
- `priority`：人工推荐加权

首页推荐流优先使用 `feedEditions.pages`。每一个 page 是一版已经设计好的帖子队列，例如每版 10 条。用户加载时按版请求，服务端只在这一版内部做轻微个性化调整：已读内容放到本版后面，未读内容靠前。这样每次懒加载出现的仍然是一版人工/AI 排过的内容。

示例：

```json
{
  "feedEditions": {
    "pageSize": 10,
    "generatedAt": "2026-04-28T09:00:00+08:00",
    "strategy": "daily-curated-batches",
    "notes": ["第一版：今天最该看的信息", "第二版：活动和可收藏信息"],
    "pages": [
      [92, 91, 90, 89, 88, 87, 86, 85, 84, 83],
      [82, 81, 80, 79, 78, 77, 76, 75, 74, 73]
    ]
  }
}
```

## 隐藏管理接口

管理接口需要 `ADMIN_TOKEN`，可以在首次部署引导里填写；留空时会自动生成并写入 `.env`。

读取推荐规则：

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:4100/api/admin/feed-rules
```

覆盖推荐规则：

```bash
curl -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data @data/feed-rules.json \
  http://127.0.0.1:4100/api/admin/feed-rules
```

只更新每日推荐版面：

```bash
curl -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pageSize":10,"notes":["第一版：今天最该看的信息"],"pages":[[92,91,90,89,88,87,86,85,84,83]]}' \
  http://127.0.0.1:4100/api/admin/feed-edition
```

读取帖子时效信息：

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:4100/api/admin/post-metadata
```

更新单条帖子的时效信息：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timeLabel":"今天 19:30","startsAt":"2026-04-28T19:30:00+08:00","expiresAt":"2026-04-29T00:00:00+08:00","priority":20}' \
  http://127.0.0.1:4100/api/admin/post-metadata/123
```

清缓存：

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:4100/api/admin/reload
```
