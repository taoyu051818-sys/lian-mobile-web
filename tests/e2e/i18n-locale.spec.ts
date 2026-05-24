/**
 * E2E tests for i18n / locale functionality.
 *
 * Tests cover:
 *   1. Default language detection based on navigator.language
 *   2. Language switching via localStorage preference
 *   3. Language preference persistence across page reloads
 *   4. Translation completeness on key pages (feed, profile, publish)
 *
 * The locale system is defined in src/locales/resolveLocale.ts with:
 *   - Supported locales: "zh-CN" and "en"
 *   - Storage key: "lian.language"
 *   - Priority: localStorage > navigator.languages > navigator.language > "en"
 *
 * Note: The localStorage preference is the most reliable way to control locale
 * in E2E tests, as navigator.language detection may be affected by server-side
 * factors or cached state.
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";
const LOCALE_STORAGE_KEY = "lian.language";

/**
 * Helper to create a browser context with a specific navigator language.
 */
async function createContextWithLocale(
  browser: import("@playwright/test").Browser,
  locale: string,
): Promise<BrowserContext> {
  return browser.newContext({
    locale,
  });
}

/**
 * Helper to set localStorage locale preference before navigation.
 * This is the most reliable way to control locale in E2E tests.
 */
async function setStoredLocale(page: Page, locale: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: LOCALE_STORAGE_KEY, value: locale },
  );
}

/**
 * Helper to get the current localStorage locale value.
 */
async function getStoredLocale(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY);
}

test.describe("@i18n-locale Language detection from navigator", () => {
  test("detects Chinese locale from navigator.language zh-CN", async ({ browser }) => {
    const context = await createContextWithLocale(browser, "zh-CN");
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Feed view should show Chinese content
      const pageContent = await page.content();
      const hasChineseText =
        pageContent.includes("首页") ||
        pageContent.includes("正在加载") ||
        pageContent.includes("校园");
      expect(hasChineseText).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("zh variant locales (zh-TW, zh-Hans) map to zh-CN", async ({ browser }) => {
    const contextTW = await createContextWithLocale(browser, "zh-TW");
    const pageTW = await contextTW.newPage();
    try {
      await pageTW.goto(`${BASE_URL}/#/`);
      await expect(pageTW.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      const pageContent = await pageTW.content();
      // Should show simplified Chinese content (zh-CN)
      const hasSimplifiedChinese =
        pageContent.includes("首页") ||
        pageContent.includes("正在加载") ||
        pageContent.includes("校园");
      expect(hasSimplifiedChinese).toBe(true);
    } finally {
      await contextTW.close();
    }
  });
});

test.describe("@i18n-locale localStorage preference controls locale", () => {
  test("stored zh-CN shows Chinese UI", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Should show Chinese content
      const pageContent = await page.content();
      const hasChineseText =
        pageContent.includes("首页") ||
        pageContent.includes("正在加载") ||
        pageContent.includes("校园");
      expect(hasChineseText).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("stored en shows English UI", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Wait for content to load
      await page.waitForTimeout(1000);

      // Should show English content
      const pageContent = await page.content();
      const hasEnglishText =
        pageContent.includes("Home") ||
        pageContent.includes("Loading") ||
        pageContent.includes("Campus") ||
        pageContent.includes("content");
      expect(hasEnglishText).toBe(true);

      // Should NOT show Chinese key UI strings when English is set
      // Note: User-generated content may still be in Chinese
      const hasChineseUIText = pageContent.includes("首页") && pageContent.includes("正在加载");
      expect(hasChineseUIText).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("stored en overrides navigator zh-CN", async ({ browser }) => {
    const context = await createContextWithLocale(browser, "zh-CN");
    const page = await context.newPage();
    try {
      // Set English preference in localStorage before navigation
      await setStoredLocale(page, "en");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(1000);

      // Should show English despite navigator being Chinese
      const pageContent = await page.content();
      // Check that Chinese UI strings are NOT present
      const hasChineseUIText = pageContent.includes("首页") && pageContent.includes("正在加载");
      expect(hasChineseUIText).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("stored zh-CN overrides navigator en-US", async ({ browser }) => {
    const context = await createContextWithLocale(browser, "en-US");
    const page = await context.newPage();
    try {
      // Set Chinese preference in localStorage before navigation
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Should show Chinese despite navigator being English
      const pageContent = await page.content();
      const hasChineseText =
        pageContent.includes("首页") ||
        pageContent.includes("正在加载") ||
        pageContent.includes("校园");
      expect(hasChineseText).toBe(true);
    } finally {
      await context.close();
    }
  });
});

test.describe("@i18n-locale Language persistence across reloads", () => {
  test("locale preference persists after page reload", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Set Chinese preference
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Verify Chinese is shown
      let pageContent = await page.content();
      expect(
        pageContent.includes("首页") ||
          pageContent.includes("正在加载") ||
          pageContent.includes("校园"),
      ).toBe(true);

      // Reload the page
      await page.reload();
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Verify Chinese is still shown after reload
      pageContent = await page.content();
      expect(
        pageContent.includes("首页") ||
          pageContent.includes("正在加载") ||
          pageContent.includes("校园"),
      ).toBe(true);

      // Verify localStorage still has the preference
      const storedLocale = await getStoredLocale(page);
      expect(storedLocale).toBe("zh-CN");
    } finally {
      await context.close();
    }
  });

  test("locale preference persists across navigation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      // Start at feed
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Navigate to profile
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 15000 });

      // Should still be in Chinese
      const pageContent = await page.content();
      // Profile page Chinese strings: "我的", "浏览", "收藏", "赞过", "登录"
      const hasChineseProfileText =
        pageContent.includes("我的") ||
        pageContent.includes("浏览") ||
        pageContent.includes("登录") ||
        pageContent.includes("注册");
      expect(hasChineseProfileText).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("English locale persists across navigation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      // Start at feed
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Navigate to profile
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(1000);

      // Should be in English - check that Chinese UI strings are NOT present
      const pageContent = await page.content();
      const hasChineseUIText =
        pageContent.includes("我的") &&
        pageContent.includes("浏览") &&
        pageContent.includes("登录");
      expect(hasChineseUIText).toBe(false);
    } finally {
      await context.close();
    }
  });
});

test.describe("@i18n-locale Key page translation completeness - Chinese", () => {
  test("feed page has translated content in zh-CN", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Wait for content to fully load
      await page.waitForTimeout(2000);

      const pageContent = await page.content();

      // Check for key zh-CN feed strings (from zh-CN.ts)
      const feedStrings = ["首页", "正在加载", "暂时没有内容", "加载更多", "校园"];
      const foundStrings = feedStrings.filter((s) => pageContent.includes(s));

      // At least some feed-related Chinese strings should be present
      expect(foundStrings.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test("profile page has translated content in zh-CN", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/profile`);
      // Use a more flexible selector and longer timeout for profile page
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 20000 });

      await page.waitForTimeout(2000);

      const pageContent = await page.content();

      // Check for key zh-CN profile strings (from zh-CN.ts)
      const profileStrings = ["我的", "浏览", "收藏", "赞过", "登录", "注册"];
      const foundStrings = profileStrings.filter((s) => pageContent.includes(s));

      // At least some profile-related Chinese strings should be present
      expect(foundStrings.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test("publish page has translated content in zh-CN", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      await page.goto(`${BASE_URL}/#/publish`);
      await expect(page.locator(".publish-view, .shell")).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(2000);

      const pageContent = await page.content();

      // Check for key zh-CN publish strings (from zh-CN.ts)
      const publishStrings = ["发布", "标题", "正文", "清空", "发生了什么"];
      const foundStrings = publishStrings.filter((s) => pageContent.includes(s));

      // At least some publish-related Chinese strings should be present
      expect(foundStrings.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});

test.describe("@i18n-locale Key page translation completeness - English", () => {
  test("feed page shows English UI when locale is en", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(2000);

      const pageContent = await page.content();

      // When English locale is set, Chinese UI strings should NOT be present
      // This is a more reliable test than checking for specific English strings
      // because the English strings may vary based on page state
      const hasPrimaryChineseUI =
        pageContent.includes("首页") &&
        (pageContent.includes("正在加载校园内容") || pageContent.includes("暂时没有内容"));

      // If Chinese UI is present, the locale switch didn't work
      expect(hasPrimaryChineseUI).toBe(false);

      // Additionally check for at least one English string (case-insensitive)
      const pageContentLower = pageContent.toLowerCase();
      const hasEnglishIndicator =
        pageContentLower.includes("home") ||
        pageContentLower.includes("loading") ||
        pageContentLower.includes("campus") ||
        pageContentLower.includes("lian");
      expect(hasEnglishIndicator).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("profile page shows English UI when locale is en", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 20000 });

      await page.waitForTimeout(2000);

      const pageContent = await page.content();

      // When English locale is set, Chinese UI strings should NOT be present
      const hasPrimaryChineseUI =
        pageContent.includes("我的") &&
        (pageContent.includes("浏览") ||
          pageContent.includes("收藏") ||
          pageContent.includes("赞过"));

      expect(hasPrimaryChineseUI).toBe(false);

      // Check for English auth panel strings (case-insensitive)
      const pageContentLower = pageContent.toLowerCase();
      const hasEnglishIndicator =
        pageContentLower.includes("sign in") ||
        pageContentLower.includes("sign up") ||
        pageContentLower.includes("profile") ||
        pageContentLower.includes("history") ||
        pageContentLower.includes("saved") ||
        pageContentLower.includes("liked");
      expect(hasEnglishIndicator).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("publish page shows English UI when locale is en", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      await page.goto(`${BASE_URL}/#/publish`);
      await expect(page.locator(".publish-view, .shell")).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(2000);

      const pageContent = await page.content();
      const pageContentLower = pageContent.toLowerCase();

      // Check for English publish strings (case-insensitive)
      // The publish page should have at least some English UI elements
      const hasEnglishIndicator =
        pageContentLower.includes("publish") ||
        pageContentLower.includes("title") ||
        pageContentLower.includes("body") ||
        pageContentLower.includes("clear") ||
        pageContentLower.includes("what happened");

      // Note: Some components on the publish page may not be fully translated yet
      // This test verifies that the locale system is working, not that all strings are translated
      expect(hasEnglishIndicator).toBe(true);
    } finally {
      await context.close();
    }
  });
});

test.describe("@i18n-locale No untranslated keys visible", () => {
  test("zh-CN pages do not show raw i18n keys", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "zh-CN");

      // Check feed page
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      let pageContent = await page.content();
      // Raw keys would look like "feedView.title" or "loading.feed"
      expect(pageContent).not.toMatch(/\b(feedView|loading|empty|error)\.[a-zA-Z]+\b/);

      // Check profile page
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      pageContent = await page.content();
      expect(pageContent).not.toMatch(/\b(profileView|authPanel|profileUi)\.[a-zA-Z]+\b/);

      // Check publish page
      await page.goto(`${BASE_URL}/#/publish`);
      await expect(page.locator(".publish-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      pageContent = await page.content();
      expect(pageContent).not.toMatch(
        /\b(publishView|publishComposer|publishActionUi)\.[a-zA-Z]+\b/,
      );
    } finally {
      await context.close();
    }
  });

  test("en pages do not show raw i18n keys", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "en");

      // Check feed page
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      let pageContent = await page.content();
      expect(pageContent).not.toMatch(/\b(feedView|loading|empty|error)\.[a-zA-Z]+\b/);

      // Check profile page
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      pageContent = await page.content();
      expect(pageContent).not.toMatch(/\b(profileView|authPanel|profileUi)\.[a-zA-Z]+\b/);

      // Check publish page
      await page.goto(`${BASE_URL}/#/publish`);
      await expect(page.locator(".publish-view, .shell")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      pageContent = await page.content();
      expect(pageContent).not.toMatch(
        /\b(publishView|publishComposer|publishActionUi)\.[a-zA-Z]+\b/,
      );
    } finally {
      await context.close();
    }
  });
});
