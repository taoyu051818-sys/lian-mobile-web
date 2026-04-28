# 黎安移动端 WebUI

一个直接连接 NodeBB 原生 API 的移动端信息流。服务端负责保存 API token、整理推荐流、读取帖子详情、上传图片到 Cloudinary，并向前端提供 `/api/*`。

## 首次部署引导

如果项目目录没有 `.env`，并且启动环境里没有 `NODEBB_API_TOKEN`，第一次访问端口会进入部署引导页。

引导页会保存这些配置到服务器本地 `.env`：

- `NODEBB_BASE_URL`：NodeBB 地址。同一台 Linux 服务器建议填 `http://127.0.0.1:4567`
- `NODEBB_API_TOKEN`：NodeBB API token
- `NODEBB_UID`：默认操作用户
- `NODEBB_CID`：默认发帖分类
- `DATA_MODE`：建议先用 `snapshot`
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

## 数据模式

`live`：只读 NodeBB API，失败就直接报错。

`snapshot`：先尝试连接 NodeBB API，并重试几次；成功后对比并更新本地 `data/nodebb-snapshot.json` 和本地图片资源。API 不通时读取本地快照，接口会返回 `dataSource: "snapshot"` 和 `apiError`。

快照状态：

```text
GET /api/snapshot/status
```

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
