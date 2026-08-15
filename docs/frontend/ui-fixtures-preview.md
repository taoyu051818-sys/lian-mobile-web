# 离线 UI Fixture 预览

面向 UI 开发的离线预览机制：在不连接 GDPlatform、不写数据库、不访问外部网络的前提下，
把每个页面推入正常、加载、空、错误、超长文案等状态，用于检查布局和交互。

## 启用方式

必须同时满足两个条件，缺一不可：

```bash
# .env.development.local（不要提交）
VITE_UI_FIXTURES=true
```

```text
import.meta.env.DEV === true      # 仅开发构建
VITE_UI_FIXTURES === "true"       # 显式开关
```

生产构建里 `import.meta.env.DEV` 为 `false`，整段运行时会被 Rollup 当作死代码移除，
即使构建时错误地设置了 `VITE_UI_FIXTURES=true` 也不会打进产物。

启动后左下角出现 `FIXTURE` 控制台，可切换场景、身份、数据量、网络延迟，并查看请求日志。

## 三条硬保证

这三条由 `tests/platform/ui-fixtures-transport.test.ts` 和
`tests/structure/ui-fixtures-production-safety.test.ts` 强制约束。

### 1. 离线隔离

所有跨域请求一律被拦截并计入 `blocked`，不会真正发出。
判定基准是 `resolveBaseOrigin()`，在没有 `window` 的环境（测试、工具链）同样生效——
早期实现在 `window` 缺失时直接返回“同源”，等于在最不容易被发现的地方留了一个缺口。

### 2. 未覆盖即失败（fail-closed）

没有注册 fixture 的同源 `/api/*` 请求返回 **501**，而不是静默放行到真实后端，
也不是伪造一个空成功响应。响应体形状与真实 API 一致（扁平 `{ error, code }`），
`extractApiError()` 可以直接解析：

```json
{ "error": "...", "code": "UNMAPPED_FIXTURE_REQUEST" }
```

控制台把 `未覆盖` 和 `拦截` 标红，折叠状态下也会在手柄上显示数字徽标。
看到非零就说明该页面的覆盖或隔离出了问题，不要当作正常现象。

### 3. 生产构建不包含任何 fixture 代码

守卫测试会真实执行一次 `vite build --mode production`（并强制
`NODE_ENV=production`，否则 vitest 的 `NODE_ENV=test` 会漏进子进程、
构建出 DEV 产物，让断言测了个假目标），然后在产物里搜索 fixture 标记。

关键实现细节：`startOfflineFixtureRuntime()` 里的
`if (!import.meta.env.DEV) return false;` 必须保持字面量内联。
只靠 `isOfflineFixtureRuntimeEnabled()` 这样的函数调用，Rollup 无法证明分支为假，
整套运行时会被打进生产包——这正是该测试实际捕获到的问题。

## 覆盖范围

当前共 59 条路由，按 family 划分：

| Family     | 路由数 | 覆盖范围                     |
| ---------- | ------ | ---------------------------- |
| `content`  | 18     | 首页信息流、详情、评论、发布 |
| `identity` | 13     | 会话、登录态、认证、账号切换 |
| `profile`  | 12     | 个人主页、统计、设置         |
| `errands`  | 7      | 校园跑腿订单                 |
| `messages` | 5      | 校园频道、消息通知           |
| `commerce` | 4      | 商城店铺与商品               |

新增页面时若控制台出现 `未覆盖`，在对应 family 里补 `register()`，
不要为了让页面不报错去改 `src/api`。

## 可切换维度

**场景**：`normal` `empty` `partial-data` `long-copy` `many-items`
`loading` `error` `not-found` `forbidden` `unauthorized` `timeout` `rate-limited`

**身份**：`guest` `registered` `verified-student` `merchant-pending`
`merchant-approved` `runner` `organization-member` `admin` `disabled-user`

**数据量**：`sparse` `default` `dense`

切换场景、身份、数据量会触发一次整页刷新。这是刻意设计：feature composable 会缓存
首次读取结果，只改状态不刷新的话，已渲染的视图仍显示旧数据。仅影响后续请求的开关
（延迟）不触发刷新。

## 边界约束

- fixture 复用正式 TypeScript 类型，不为了方便修改正式 DTO；
- 不写真实数据库，不连 GDPlatform，不暴露任何凭据；
- 不使用外部图片；占位图为本地内联 SVG 与 CSS 渐变；
- 权威价格、库存、金额一律来自 fixture 数据，前端不自行计算；
- 商城订单与校园跑腿订单是两个模型，人民币支付与 LIAN 积分是两个模型，不合并。

## 相关测试

```bash
npx vitest run tests/platform/ui-fixtures-transport.test.ts
npx vitest run tests/structure/ui-fixtures-production-safety.test.ts
```

生产剥离守卫会真实跑一次 production 构建，比其他单测慢，属预期。
