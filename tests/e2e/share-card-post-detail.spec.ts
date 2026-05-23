/**
 * V1 share-card preview sheet on the post detail surface (ps#484, mw PR #787).
 *
 * Browser-side coverage of the user-visible flow:
 *
 *   PostDetailTopbar `分享` →
 *     usePostShare.handleShare → useShareCardPreview.start →
 *       GET /api/posts/:tid/share-card →
 *         ShareCardSheet renders { title, summary, thumbnail, audience } →
 *           confirm → usePostShare.handleShareConfirm → sharePost() →
 *             clipboard fallback → SHARE_LINK_COPIED toast.
 *
 * 5 cases land in this spec:
 *
 *   a. tapping share opens the sheet (dialog/aria-modal, ready state arrives
 *      once the share-card stub fulfils);
 *   b. ready-state sheet pulls title / summary / thumbnail / audience from
 *      the stubbed `GET /api/posts/:tid/share-card` envelope. The endpoint is
 *      `/api/posts/:tid/share-card` (V1 envelope), NOT `/api/share-card/post/:tid`;
 *   c. wechat channel switch — `test.fixme` placeholder. ShareCardSheet today
 *      has no channel-selector UI: `grep -n channel src/features/detail/ShareCardSheet.vue`
 *      hits only BEM class names (`share-card-sheet__*`); the backend already
 *      ships `card.channel.wechat` in the envelope (see `ShareCardChannels`
 *      in `src/api/share-card.ts`) but the component does not consume it. Once
 *      a channel selector lands the fixme drops and the spec asserts wechat
 *      copy mirrors the stub's `channel.wechat.*` fields;
 *   d. confirm → `sharePost` clipboard fallback path. ShareCardSheet has no
 *      independent "copy link" affordance; "复制链接" is a runtime outcome of
 *      the confirm flow when the browser lacks `navigator.share`. We force the
 *      fallback (override `navigator.share` to a non-callable value) and grant
 *      clipboard permissions, then assert the canonical post URL landed in the
 *      system clipboard;
 *   e. share-card endpoint 500 → sheet enters its `error` state with the
 *      retry affordance visible (`SHARE_CARD_ERROR_NETWORK` localized copy
 *      lives inside `[data-testid="share-card-error"]`).
 *
 * Skip envelope: `loginAs("registered")` requires LIAN_E2E_REGISTERED_USERNAME
 * / _PASSWORD. Without them this spec skips cleanly — a missing seed is not a
 * test failure (see `[[project-e2e-secrets-state]]`).
 *
 * Hermetic via `page.route` against `/api/feed`, `/api/posts/:tid` and
 * `/api/posts/:tid/share-card`. The shipping data path runs end-to-end through
 * the real browser; only the data plane is mocked so the spec does not depend
 * on whether nat100 currently surfaces a public post matching the seed
 * preconditions. Same hermetic envelope `post-detail-cold-start.spec.ts`
 * already uses for the #636 cold-start contract.
 */

import { expect, test, type Page, type Route } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const STUB_TID = 999_010;
const STUB_TITLE = "分享卡片契约验证帖";
const STUB_BODY_PREVIEW = "page.route 注入的稳定数据，专门用于 share-card V1 envelope 消费路径。";

const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: STUB_TID,
      title: STUB_TITLE,
      bodyPreview: STUB_BODY_PREVIEW,
      cover: "",
      primaryTag: "",
      timeLabel: "刚刚",
      timestampISO: new Date().toISOString(),
      likeCount: 0,
      liked: false,
      locationArea: "校园",
      contentType: "text",
    },
  ],
  hasMore: false,
  nextPage: null,
};

const POST_STUB = {
  tid: STUB_TID,
  type: "text",
  title: STUB_TITLE,
  cover: "",
  primaryTag: "",
  timeLabel: "刚刚",
  timestampISO: new Date().toISOString(),
  contentHtml: `<p>${STUB_BODY_PREVIEW}</p>`,
  imageUrls: [],
  replies: [],
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "校园",
};

/**
 * V1 share-card envelope (ps#484). Mirrors `normalizeCard` in
 * `src/api/share-card.ts` — the frontend reads `card.title`, `card.summary`,
 * `card.thumbnailUrl`, `card.audienceLabel` directly. The `url` field rides
 * along for SSR / share targets but is NOT what `sharePost` writes to the
 * clipboard (see case d's comment).
 */
const SHARE_CARD_STUB = {
  ok: true,
  card: {
    tid: STUB_TID,
    title: "stub 分享卡片标题",
    summary: "stub 分享卡片摘要 — 来自 page.route。",
    thumbnailUrl: "https://lian.nat100.top/uploads/share-card-fixture.png",
    url: `https://lian.nat100.top/#/post/${STUB_TID}`,
    kind: "post",
    authorName: "stub 作者",
    audienceLabel: "校园可见",
    channel: {
      wechat: {
        title: "wechat 标题（stub）",
        description: "wechat 描述（stub）",
        imageUrl: "https://lian.nat100.top/uploads/share-card-fixture-wechat.png",
      },
    },
  },
};

async function installBaseStubs(page: Page) {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  // Match the bare post detail route only — `(?:\\?|$)` excludes
  // `/api/posts/:tid/share-card` so the share-card stub installed below owns
  // that path exclusively.
  await page.route(new RegExp(`/api/posts/${STUB_TID}(\\?|$)`), async (route) => {
    await route.fulfill({ json: POST_STUB });
  });
}

async function installShareCardStub(
  page: Page,
  override?: (route: Route) => Promise<void>,
): Promise<void> {
  await page.route(`**/api/posts/${STUB_TID}/share-card`, async (route) => {
    if (override) {
      await override(route);
      return;
    }
    await route.fulfill({ json: SHARE_CARD_STUB });
  });
}

const SHARE_BUTTON = ".post-detail-topbar__share";
const SHARE_SHEET = '[data-testid="share-card-sheet"]';
const SHARE_PREVIEW = '[data-testid="share-card-preview"]';
const SHARE_CONFIRM = '[data-testid="share-card-confirm"]';
const SHARE_ERROR = '[data-testid="share-card-error"]';
const SHARE_RETRY = '[data-testid="share-card-retry"]';
const SHARE_AUDIENCE = '[data-testid="share-card-audience"]';

test.describe("@registered share-card sheet on post detail (ps#484)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  // -------------------------------------------------------------------------
  // a. trigger — tapping the topbar `分享` button opens the sheet
  // -------------------------------------------------------------------------
  test("tapping the share button on post detail opens the V1 share-card sheet", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installBaseStubs(page);
      await installShareCardStub(page);

      await page.goto(`/#/post/${STUB_TID}`);

      // PostDetailTopbar is teleported into `#lian-shell-top-slot`; the share
      // button is the only entry into the share flow on the detail surface.
      const shareButton = page.locator(SHARE_BUTTON);
      await expect(shareButton).toBeVisible();
      await shareButton.click();

      const sheet = page.locator(SHARE_SHEET);
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("role", "dialog");
      await expect(sheet).toHaveAttribute("aria-modal", "true");

      // Sheet must reach `ready` once the share-card stub responds — the
      // preview block only mounts in that state (status === "ready" && card).
      await expect(page.locator(SHARE_PREVIEW)).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // b. ready-state field rendering from the stubbed envelope
  // -------------------------------------------------------------------------
  test("ready-state sheet renders title, summary, thumbnail and audience from the stub envelope", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installBaseStubs(page);
      await installShareCardStub(page);

      await page.goto(`/#/post/${STUB_TID}`);
      await page.locator(SHARE_BUTTON).click();
      await expect(page.locator(SHARE_PREVIEW)).toBeVisible();

      // Title + summary live on `h3.share-card-sheet__title` /
      // `p.share-card-sheet__summary`. Thumbnail is `img.share-card-sheet__thumb`
      // with `alt="分享缩略图"` (SHARE_CARD_THUMBNAIL_ALT). Audience pill is
      // exposed via `data-testid="share-card-audience"`.
      await expect(page.locator("h3.share-card-sheet__title")).toHaveText(
        SHARE_CARD_STUB.card.title,
      );
      await expect(page.locator("p.share-card-sheet__summary")).toHaveText(
        SHARE_CARD_STUB.card.summary,
      );

      const thumb = page.locator("img.share-card-sheet__thumb");
      await expect(thumb).toHaveAttribute("src", SHARE_CARD_STUB.card.thumbnailUrl);
      await expect(thumb).toHaveAttribute("alt", "分享缩略图");

      await expect(page.locator(SHARE_AUDIENCE)).toHaveText(SHARE_CARD_STUB.card.audienceLabel);
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // c. wechat channel switch — fixme placeholder
  //
  // ShareCardSheet 现状没有 channel selector：组件 props 只接受
  // `{ open, status, card, errorMessage, canRetry }`，模板里也没有任何
  // wechat / weixin 切换控件。后端 envelope 里已经塞了
  // `card.channel.wechat`（见 `src/api/share-card.ts` ShareCardChannels），
  // 但前端没接进来。等到 channel selector 落地后放开此 fixme，断言
  // wechat 标题 / 描述 / image 与 stub 的 channel.wechat.* 字段一致。
  // -------------------------------------------------------------------------
  test.fixme("switching to wechat channel surfaces wechat-specific copy (待 channel selector 落地)", async () => {
    // Implementation parked until ShareCardSheet exposes a channel selector
    // (PRD writeup in PR description).
  });

  // -------------------------------------------------------------------------
  // d. confirm → sharePost clipboard fallback path
  //
  // ShareCardSheet has no independent "复制链接" button — the only primary
  // affordance in the ready state is `[data-testid="share-card-confirm"]`
  // ("确认分享"). Confirm runs `usePostShare.handleShareConfirm` → `sharePost`,
  // which falls through to `nav.clipboard.writeText(buildCanonicalPostUrl(tid))`
  // when the browser does not advertise `navigator.share`. We force that
  // branch with addInitScript and assert the canonical URL landed in the
  // clipboard plus the SHARE_LINK_COPIED toast surfaces.
  //
  // Note on URL identity: `sharePost` writes `buildCanonicalPostUrl(tid)`
  // (origin + pathname + `#/post/${tid}`), NOT `card.url` from the share-card
  // envelope. The two strings happen to coincide in this stub because we
  // pinned `card.url` to the same canonical form, but the contract under
  // test is the canonical builder — that's why the regex assertion below
  // matches by suffix instead of comparing against `SHARE_CARD_STUB.card.url`.
  // -------------------------------------------------------------------------
  test("confirm → sharePost clipboard fallback copies the canonical post URL", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({
      storageState: await api.storageState(),
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    try {
      // Force the clipboard fallback path inside `sharePost`. The runtime
      // gate is `"share" in nav && typeof nav.share === "function"`; setting
      // `navigator.share` to a non-callable value flips the typeof check to
      // false, taking the clipboard branch. addInitScript runs before any
      // app code reads the property on every navigation.
      await page.addInitScript(() => {
        try {
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: undefined,
          });
        } catch {
          // If the property is non-configurable we still take the clipboard
          // branch (typeof undefined !== "function"). Headless Chromium
          // typically does not ship navigator.share to begin with, so this
          // is defence-in-depth, not a hard requirement.
        }
      });

      await installBaseStubs(page);
      await installShareCardStub(page);

      await page.goto(`/#/post/${STUB_TID}`);
      await page.locator(SHARE_BUTTON).click();
      await expect(page.locator(SHARE_PREVIEW)).toBeVisible();

      const confirm = page.locator(SHARE_CONFIRM);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      // SHARE_LINK_COPIED brand string. Asserted against the literal so the
      // spec stays self-contained (no shared brand import — sibling-agent
      // contract).
      await expect(page.getByText("链接已复制")).toBeVisible();

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText, `clipboard text: ${clipboardText}`).toMatch(
        new RegExp(`#/post/${STUB_TID}$`),
      );
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // e. share-card endpoint 500 → sheet enters error state with retry
  // -------------------------------------------------------------------------
  test("share-card endpoint 500 surfaces the error state with retry affordance", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      await installBaseStubs(page);
      // Override the share-card stub with a 500. The frontend mapping is
      // `LianApiError.status === 500` → `ShareCardError("network", 500)` →
      // `errorReason = "network"` → `canRetry = true` (see useShareCardPreview).
      await installShareCardStub(page, async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "internal" }),
        });
      });

      await page.goto(`/#/post/${STUB_TID}`);
      await page.locator(SHARE_BUTTON).click();

      // Sheet still opens — the error state lives inside the sheet, not
      // outside it. The `share-card-error` block carries the localized
      // network-failure copy and the retry button is rendered when
      // `canRetry === true` (network branch only; not-found hides retry).
      await expect(page.locator(SHARE_SHEET)).toBeVisible();
      await expect(page.locator(SHARE_ERROR)).toBeVisible();
      await expect(page.locator(SHARE_ERROR)).toContainText("分享卡片暂时取不到");
      await expect(page.locator(SHARE_RETRY)).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
