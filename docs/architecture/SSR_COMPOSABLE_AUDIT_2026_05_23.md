# SSR Composable 审计 (2026-05-23)

Phase 1 SSR 范围（RFC §3）：`/post/:tid` + `/`。本审计列出 `lian-mobile-web` 所有触碰浏览器
API 的 composable，标识 phase 1 SSR 路径是否会触达 + 修复策略，给 phase 1.5b（profile SSR）
和 phase 2+（publish / messages / map / errand SSR）做依据。

来源：`docs/architecture/SSR_PWA_RFC_2026_05_23.md` §6 + §9.1.5。本 PR (RFC phase 1.5)
只硬化 `useReducedMotion`，其余条目仅审计、不动代码。

## 守护策略词典

- **A. typeof window 守卫 + onMounted 后接管** —— 浏览器 API 在 factory 内用
  `typeof window === "undefined"` 短路，listener / 读值挪进 `onMounted`。SSR 默认值要和客户
  端首屏一致以避免 hydration mismatch。`useReducedMotion` 是模板。
- **B. SSR 默认空值 + onMounted 异步加载** —— `localStorage` / `sessionStorage` 类持久态
  在 SSR 返回空骨架，挂载后再读真实值。注意客户端首屏要用骨架渲染，`onMounted` 之后再
  补真值（必要时用 Suspense / v-if）。
- **C. `<ClientOnly>` wrapper** —— 大块只在浏览器有意义的子树（leaflet 地图、第三方 SDK），
  整个组件外面套 `<ClientOnly>` 替代手动守卫。LIAN 没引入 Nuxt，phase 2 落地时手写一个
  最小 `<ClientOnly>` 等价物。
- **D. 纯客户端逻辑保留** —— 事件 listener / DOM 写入只在 `onMounted` 内执行；SSR 路径
  上 factory 不产生副作用即可（多数 LIAN composable 已经是这个形态）。

## Phase 1 必修（已修）

- **`src/composables/useReducedMotion.ts`** —— `window.matchMedia`。已挪进 `onMounted`，
  SSR 默认 `reduced.value = false`（动画不在服务端预 strip）。**策略 A**。本 PR 修复。

## Phase 1.5b 必修（profile SSR `/u/:username` 上线前）

- **`src/features/profile/useServerChanBinding.ts:64-70`** —— `window.open` + `window.location.hash`
  读取。`window.open` 已在 onMounted 之外的事件回调中调用，无 SSR 影响；但
  `getCurrentHashFragment()` 这类导出函数若在 setup() 同步执行会爆。**策略 D**：保持事件
  内调用，profile setup 流程审一遍即可。
- **`src/features/profile/useProfileTabs.ts:63`** —— `localStorage` 直接读取
  (`getRecentReadHistoryIds(localStorage, 50)`)。SSR setup 路径会触发；profile SSR 必须改为
  **策略 B**：默认 `[]`，`onMounted` 后再注水。
- **`src/features/profile/useAvatarCropper.ts:123`** —— `document.createElement("canvas")`。仅
  在事件处理函数中调用，SSR 不触发。**策略 D**，profile SSR 不需要变。
- **`src/composables/useEscapeListener.ts:11-16`** —— `document.addEventListener` 在
  `watch(active)` 回调中触发，`onBeforeUnmount` 也碰 `document`。SSR 阶段 `active` 初值为
  `false`，`watch` 不立即触发，所以**当前**安全；但 `onBeforeUnmount` 在 SSR 不会跑，
  也无副作用。**策略 D 自然成立**，profile / detail 复用前确认 `active` 初值仍是 false。
- **`src/composables/useFocusRestore.ts:5`** —— `document.activeElement` 仅在 `save()` /
  `restore()` 调用时碰，SSR 不会主动调。**策略 D**，无需改。
- **`src/composables/useBodyScrollLock.ts:9-19`** —— `document.body.style` 在 `lock()` /
  `unlock()` 中碰，由 `watch(active)` 触发。setup 阶段 `active` 通常默认 false，watch 不立即
  跑——和 `useEscapeListener` 同款。**策略 D**，profile / detail 模态框 SSR 上线前再看一遍
  active 初值。
- **`src/composables/useAutoLoadSentinel.ts:39-53`** —— `IntersectionObserver` 已在
  `onMounted` 内创建，SSR 不触发。**策略 D**，已合规。
- **`src/composables/useVisualViewport.ts`** —— `window.visualViewport` + `requestAnimationFrame`。
  factory 内已有 `typeof window === "undefined"` 守卫并 early return。**策略 A**，已合规。
- **`src/composables/useAudienceOptions.ts`** —— 无浏览器 API，只在 `onMounted` 内 fetch。
  **策略 D**，无需改。
- **`src/features/feed/useCardPointerInteraction.ts:23-31`** —— `window.setTimeout` /
  `clearTimeout`，已带 `typeof window === "undefined"` 守卫。**策略 A**，已合规（feed 卡片
  SSR 渲染时 timer 不会启动）。
- **`src/features/feed/useFeedData.ts`** —— phase 1 `/` 渲染会触发；本审计后续巡检（首屏
  feed 列表 SSR 行为待 phase 1.2 实际渲染落地后再细审）。**预留 phase 1.5b**。

## Phase 2+ 必修（publish / messages / map 等 SSR 上线前）

只列接触浏览器 API 的项；纯业务逻辑 composable 不在此列。

- **`src/features/publish/usePublishDraftSession.ts:182-192`** —— `window.addEventListener("beforeunload")`。
  已带 `typeof window` 守卫。**策略 A**，publish SSR 上线前确认 setup 阶段不在 SSR 路径触发。
- **`src/features/publish/publishDraftSession.ts:144-212`** —— 默认参数 `Storage = sessionStorage`。
  模块顶层引用 `sessionStorage`，**SSR 直接 import 会爆**。publish SSR 上线前必须改为
  **策略 B**：默认改成 `() => (typeof sessionStorage !== "undefined" ? sessionStorage : null)`，
  或者在调用方传入。
- **`src/features/admin/useAdminToken.ts:8-20`** —— `window.sessionStorage`。已带 `typeof window`
  守卫。**策略 A**，admin SSR 不在 phase 1，admin 暂不做 SSR。
- **`src/features/messages/useChannelMessages.ts:31-208`** —— `document.documentElement` /
  `window.scrollY` / `window.addEventListener("scroll")`。messages SSR 上线前需把 `mount`
  路径下沉到 `onMounted`（目前已经是 onMounted 内 add/remove，setup 阶段读 scrollY 那一段
  需要守卫）。**策略 A**。
- **`src/features/profile/useProfileSession.ts`** / **`useProfileChrome.ts`** / **`useProfileAliasPicker.ts`** ——
  待 profile SSR 启动时按需巡检（grep 未发现直接浏览器 API，但 setup 阶段同步 fetch 模式
  需要确认）。**预留 phase 1.5b**。
- **`src/features/detail/usePostDetailPresentation.ts:78,115,126`** —— `window.location.origin`
  和 `preloadImages` 中的 `new Image()`。`window.location.origin` 已带 `typeof window` 守卫
  并以 `https://lian.invalid` 做 SSR 兜底；`preloadImages` 已带 `typeof window === "undefined"`
  early return。**策略 A**，phase 1 detail SSR 已合规——这是 phase 1 关键路径，本审计确认
  通过。
- **`src/features/map/*`** —— Leaflet 初始化、map canvas DOM 操作。**phase 2 起**：整个
  map view 用 **策略 C**（`<ClientOnly>` wrapper）。phase 1 不 SSR 地图，无影响。
- **`src/features/errand/*`** —— `ErrandOrderTimelineView.vue:113` 注释提到避开
  `window.confirm`；composable 本身未发现浏览器 API。**phase 2 起**审。
- **`src/features/auth/*`** / **`src/features/runner/*`** / **`src/features/merchant/*`** /
  **`src/features/verification/*`** —— phase 1 不渲染。**phase 2 起**逐个 grep 一遍。

## 不需要修

- 纯 reactive / 纯计算逻辑 composable（无浏览器 API）：`useEventActions`, `useHelpVote`,
  `useHelpManage`, `useEventPublishDraft`, `usePostDetailExtensions`, `usePublishAiDraft`,
  `usePublishAi`, `usePublishDraft`（注：注释提到 localStorage 但未真用），
  `useTradePublishDraft`, `useMerchantPublishDraft`, `useEmailCodeCooldown`,
  `useAuthForm`, `useAuthSubmit`, `useAuthInterests`, `useDetailGallery`, `useShareCardPreview`,
  `usePostShare`, `usePostReport`, `usePostReplyComposer`, `usePostReactions`,
  `useErrandOrderDetail`, `useErrandOrderDraft`, `useErrandOrderRoute`, `useMyErrandOrders`,
  `useChannelMessages` 的 composable 部分（事件 listener 已在 onMounted），
  `useMessageComposer`, `useNotifications`, `useInviteCode`, `useProfileAliasSwitch`,
  `useServerChanOptIn`, `useServerChanPreferences`, `useIsMerchantVerified`,
  `useMerchantCenter`, `useRunnerCenter`, `useCampusEmailVerify`,
  `useAdminConsole`, `usePlaceSheetLoader`, `useMapDataCache`,
  `useMapChrome`, `useMapIconScale`, `useMapLayers`, `useMapRoads`, `useMapSelection`,
  `useProfileTabs` 的 tabs 部分, `useMerchantPublishDraft`, `usePublishLocationOptions`,
  `usePublishIdentity`, `usePublishSubmit`。

  注：以上 composable 即便后续 SSR 上线也无需改，前提是它们不在 setup 阶段同步 fetch /
  读浏览器 API。任何后续重构若引入新的浏览器 API，必须按词典 ABCD 之一守护。

## 审计统计

- 审计 composable 总数：**13**（src/composables）+ **49**（src/features/**/use\*.ts） = **62\*\* 个 composable
- 直接接触浏览器 API 的：**16** 个
- 进一步分类：
  - **Phase 1 必修：1**（useReducedMotion，本 PR 已修）
  - **Phase 1.5b（profile/feed SSR 上线前必修）：2 强制 + 8 巡检**
  - **Phase 2+（publish/messages/map SSR 上线前必修）：4 强制 + 其余按需**
  - **不需要修：46+**（纯业务逻辑或已合规）

## 下一步触发条件

- profile SSR (`/u/:username`) 启动 → 跑 phase 1.5b 强制清单（`useProfileTabs` + `usePublishDraftSession`
  这一类）
- publish SSR 启动 → 跑 phase 2 强制清单 + 把 `publishDraftSession.ts` 的默认参数改掉
- map SSR 启动 → 引入 `<ClientOnly>` 等价物
