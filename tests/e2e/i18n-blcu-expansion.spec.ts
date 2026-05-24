/**
 * E2E tests for BLCU international student language expansion.
 *
 * TDD-driven tests for expanding i18n support to languages commonly spoken by
 * Beijing Language and Culture University (BLCU) international students.
 *
 * Target languages (in addition to existing zh-CN, zh-TW, en, ja):
 *   - ko (Korean) - largest international student group
 *   - ru (Russian) - significant CIS student population
 *   - th (Thai) - Southeast Asian hub
 *   - vi (Vietnamese) - neighboring country, growing enrollment
 *   - id (Indonesian) - Southeast Asian representation
 *   - es (Spanish) - Latin American students
 *   - fr (French) - Francophone African students
 *   - ar (Arabic) - Middle East and North Africa students
 *
 * These tests will initially FAIL (red) until the locale files are implemented.
 * Run with: npx playwright test i18n-blcu-expansion --project=chromium
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";
const LOCALE_STORAGE_KEY = "lian.language";

/**
 * New locales to be added for BLCU international students.
 * Each entry includes the locale code, native name, and sample UI strings
 * that should appear when the locale is active.
 */
const BLCU_LOCALES = [
  {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    sampleStrings: {
      home: "홈",
      loading: "로딩 중",
      campus: "캠퍼스",
      profile: "프로필",
      publish: "게시",
    },
  },
  {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    sampleStrings: {
      home: "Главная",
      loading: "Загрузка",
      campus: "Кампус",
      profile: "Профиль",
      publish: "Опубликовать",
    },
  },
  {
    code: "th",
    name: "Thai",
    nativeName: "ไทย",
    sampleStrings: {
      home: "หน้าแรก",
      loading: "กำลังโหลด",
      campus: "แคมปัส",
      profile: "โปรไฟล์",
      publish: "โพสต์",
    },
  },
  {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    sampleStrings: {
      home: "Trang chủ",
      loading: "Đang tải",
      campus: "Khuôn viên",
      profile: "Hồ sơ",
      publish: "Đăng",
    },
  },
  {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    sampleStrings: {
      home: "Beranda",
      loading: "Memuat",
      campus: "Kampus",
      profile: "Profil",
      publish: "Posting",
    },
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    sampleStrings: {
      home: "Inicio",
      loading: "Cargando",
      campus: "Campus",
      profile: "Perfil",
      publish: "Publicar",
    },
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    sampleStrings: {
      home: "Accueil",
      loading: "Chargement",
      campus: "Campus",
      profile: "Profil",
      publish: "Publier",
    },
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    sampleStrings: {
      home: "الرئيسية",
      loading: "جاري التحميل",
      campus: "الحرم الجامعي",
      profile: "الملف الشخصي",
      publish: "نشر",
    },
    rtl: true,
  },
] as const;

async function setStoredLocale(page: Page, locale: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: LOCALE_STORAGE_KEY, value: locale },
  );
}

async function createContextWithLocale(
  browser: import("@playwright/test").Browser,
  locale: string,
): Promise<BrowserContext> {
  return browser.newContext({ locale });
}

test.describe("@i18n-blcu BLCU locale support - locale detection", () => {
  for (const locale of BLCU_LOCALES) {
    test(`detects ${locale.name} (${locale.code}) from navigator.language`, async ({ browser }) => {
      const context = await createContextWithLocale(browser, locale.code);
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/`);
        await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

        const pageContent = await page.content();
        const samples = Object.values(locale.sampleStrings);
        const foundAny = samples.some((s) => pageContent.includes(s));

        expect(foundAny).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - localStorage preference", () => {
  for (const locale of BLCU_LOCALES) {
    test(`stored ${locale.code} shows ${locale.name} UI`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

        await page.goto(`${BASE_URL}/#/`);
        await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

        const pageContent = await page.content();
        const samples = Object.values(locale.sampleStrings);
        const foundAny = samples.some((s) => pageContent.includes(s));

        expect(foundAny).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - feed page translations", () => {
  for (const locale of BLCU_LOCALES) {
    test(`feed page has ${locale.name} content when locale is ${locale.code}`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

        await page.goto(`${BASE_URL}/#/`);
        await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);

        const pageContent = await page.content();

        // Should NOT show Chinese UI strings when non-Chinese locale is set
        const hasChineseUI =
          pageContent.includes("首页") &&
          (pageContent.includes("正在加载校园内容") || pageContent.includes("暂时没有内容"));
        expect(hasChineseUI).toBe(false);

        // Should show at least one locale-specific string
        const samples = Object.values(locale.sampleStrings);
        const foundAny = samples.some((s) => pageContent.includes(s));
        expect(foundAny).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - profile page translations", () => {
  for (const locale of BLCU_LOCALES) {
    test(`profile page has ${locale.name} content when locale is ${locale.code}`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

        await page.goto(`${BASE_URL}/#/profile`);
        await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 20000 });
        await page.waitForTimeout(2000);

        const pageContent = await page.content();

        // Should NOT show Chinese UI strings
        const hasChineseUI =
          pageContent.includes("我的") &&
          (pageContent.includes("浏览") ||
            pageContent.includes("收藏") ||
            pageContent.includes("赞过"));
        expect(hasChineseUI).toBe(false);

        // Should show profile-related string in target locale
        expect(pageContent.includes(locale.sampleStrings.profile)).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - publish page translations", () => {
  for (const locale of BLCU_LOCALES) {
    test(`publish page has ${locale.name} content when locale is ${locale.code}`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

        await page.goto(`${BASE_URL}/#/publish`);
        await expect(page.locator(".publish-view, .shell")).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);

        const pageContent = await page.content();

        // Should show publish-related string in target locale
        expect(pageContent.includes(locale.sampleStrings.publish)).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - no raw i18n keys", () => {
  for (const locale of BLCU_LOCALES) {
    test(`${locale.code} pages do not show raw i18n keys`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

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
  }
});

test.describe("@i18n-blcu BLCU locale support - persistence", () => {
  for (const locale of BLCU_LOCALES) {
    test(`${locale.code} locale persists across navigation`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await setStoredLocale(page, locale.code);

        // Start at feed
        await page.goto(`${BASE_URL}/#/`);
        await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

        // Navigate to profile
        await page.goto(`${BASE_URL}/#/profile`);
        await expect(page.locator(".profile-view, .shell")).toBeVisible({ timeout: 15000 });

        // Should still be in target locale
        const pageContent = await page.content();
        expect(pageContent.includes(locale.sampleStrings.profile)).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - RTL for Arabic", () => {
  test("Arabic locale applies RTL direction", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await setStoredLocale(page, "ar");

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      // Check that RTL direction is applied
      const htmlDir = await page.evaluate(() => document.documentElement.dir);
      expect(htmlDir).toBe("rtl");
    } finally {
      await context.close();
    }
  });
});

test.describe("@i18n-blcu BLCU locale support - variant mapping", () => {
  const variantMappings = [
    { variant: "ko-KR", expected: "ko", name: "Korean (South Korea)" },
    { variant: "ru-RU", expected: "ru", name: "Russian (Russia)" },
    { variant: "th-TH", expected: "th", name: "Thai (Thailand)" },
    { variant: "vi-VN", expected: "vi", name: "Vietnamese (Vietnam)" },
    { variant: "id-ID", expected: "id", name: "Indonesian (Indonesia)" },
    { variant: "es-ES", expected: "es", name: "Spanish (Spain)" },
    { variant: "es-MX", expected: "es", name: "Spanish (Mexico)" },
    { variant: "es-AR", expected: "es", name: "Spanish (Argentina)" },
    { variant: "fr-FR", expected: "fr", name: "French (France)" },
    { variant: "fr-CA", expected: "fr", name: "French (Canada)" },
    { variant: "ar-SA", expected: "ar", name: "Arabic (Saudi Arabia)" },
    { variant: "ar-EG", expected: "ar", name: "Arabic (Egypt)" },
  ];

  for (const { variant, expected, name } of variantMappings) {
    test(`${name} (${variant}) maps to ${expected}`, async ({ browser }) => {
      const context = await createContextWithLocale(browser, variant);
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/`);
        await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

        const pageContent = await page.content();
        const targetLocale = BLCU_LOCALES.find((l) => l.code === expected);
        if (targetLocale) {
          const samples = Object.values(targetLocale.sampleStrings);
          const foundAny = samples.some((s) => pageContent.includes(s));
          expect(foundAny).toBe(true);
        }
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("@i18n-blcu BLCU locale support - fallback behavior", () => {
  test("unsupported locale falls back to English", async ({ browser }) => {
    const context = await createContextWithLocale(browser, "sw"); // Swahili - not supported
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view, .shell")).toBeVisible({ timeout: 15000 });

      const pageContent = await page.content();
      const pageContentLower = pageContent.toLowerCase();

      // Should fall back to English
      const hasEnglishIndicator =
        pageContentLower.includes("home") ||
        pageContentLower.includes("loading") ||
        pageContentLower.includes("campus");
      expect(hasEnglishIndicator).toBe(true);
    } finally {
      await context.close();
    }
  });
});
