#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".yml",
  ".yaml",
]);
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "tmp",
  "temp",
  ".cache",
  "dist",
  "build",
  "coverage",
]);

// ── Latin-1 / Windows-1252 mojibake detection ──
// Catches UTF-8 lead bytes misread as ISO-8859-1 / Windows-1252.
const textDecoderPattern = String.raw`\b(?:iconv|iconv-lite|TextDecoder)\s*\([^)]*["'](?:gbk|gb2312|gb18030|latin1|binary)["']`;
const mojibakeTokens = [
  0x00c3,
  0x00c2,
  [0x00e2, 0x20ac],
  [0x00e2, 0x20ac, 0x2122],
  [0x00e2, 0x20ac, 0x0153],
  0x00e5,
  [0x00e4, 0x00b8],
  0x00e6,
  0x00e7,
].map((item) =>
  Array.isArray(item)
    ? item.map((code) => String.fromCharCode(code)).join("")
    : String.fromCharCode(item),
);

// ── GBK-as-UTF-8 mojibake detection ──
// When UTF-8 Chinese text is mistakenly decoded as GBK/GB2312, the resulting
// characters are valid Unicode CJK ideographs.  Individual characters can
// overlap with legitimate Chinese, but *pairs* of characters from the
// following curated set of archaic/rare CJK code points are an extremely
// strong mojibake signal — they never co-occur in natural simplified Chinese.
//
// These specific code points are produced by GBK mojibake of the most common
// Chinese characters (设置配置应用后续处理媒体文件数据…) but are not used
// in modern simplified Chinese writing.
const MOJIBAKE_RARE_CJK =
  "勭" + // 勭
  "囦" + // 囦
  "嶇" + // 嶇
  "庣" + // 庣
  "悊" + // 悊
  "掍" + // 掍
  "敤" + // 敤
  "旂" + // 旂
  "璁" + // 璁
  "綋" + // 綋
  "鍙" + // 鍙
  "鍚" + // 鍚
  "鏁" + // 鏁
  "鏂" + // 鏂
  "閰"; // 閰
const gbkMojibakePattern = new RegExp(`[${MOJIBAKE_RARE_CJK}]{2,}`);

// Well-known GBK mojibake trigrams produced by the most common Chinese words.
// Verified programmatically: each UTF-8 encoded Chinese word, when its raw
// bytes are decoded as GBK, produces these exact 3-char sequences.
// These sequences are essentially impossible in real text.
const KNOWN_MOJIBAKE_TRIGRAMS = [
  "璁剧疆", // 璁剧疆  <- 设置
  "閰嶇疆", // 閰嶇疆  <- 配置
  "搴旂敤", // 搴旂敤  <- 应用
  "鍚庣画", // 鍚庣画  <- 后续
  "澶勭悊", // 澶勭悊  <- 处理
  "濯掍綋", // 濯掍綋  <- 媒体
  "鏂囦欢", // 鏂囦欢  <- 文件
  "鏁版嵁", // 鏁版据  <- 数据
  "鐪嬪埌", // 鐪嬪埌  <- 看到
  "杩樻槸", // 杩樻槸  <- 还是
  "鍥犱负", // 鍥犱负  <- 因为
  "浠栦滑", // 浠栦滑  <- 他们
  "鎴戜滑", // 鎴戜滑  <- 我们
  "浣犱滑", // 浣犱滑  <- 你们
  "宸茬粡", // 宸茬粡  <- 已经
  "涓嶄細", // 涓嶄細  <- 不会
];

const PATTERNS = [
  { name: "unicode replacement character", regex: new RegExp(String.fromCharCode(0xfffd)) },
  { name: "common mojibake lead bytes", regex: new RegExp(`(?:${mojibakeTokens.join("|")})`) },
  {
    name: "legacy GBK/GB2312/GB18030 charset",
    regex: /charset\s*=\s*["']?(?:gbk|gb2312|gb18030)/i,
  },
  { name: "legacy non-UTF-8 decoder", regex: new RegExp(textDecoderPattern, "i") },
  { name: "binary string conversion", regex: /\.toString\(\s*["']binary["']\s*\)/i },
  { name: "GBK-as-UTF-8 mojibake (rare CJK sequence)", regex: gbkMojibakePattern },
  {
    name: "known GBK mojibake trigram",
    regex: new RegExp(`(?:${KNOWN_MOJIBAKE_TRIGRAMS.map(escapeRegExp).join("|")})`),
  },
];

// ── helpers ──

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SELF_FILE = import.meta.filename;

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.isFile() && isTextFile(fullPath) && fullPath !== SELF_FILE) files.push(fullPath);
  }
  return files;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

// ── self-test mode ──

if (process.argv.includes("--test")) {
  let passed = 0;
  let failed = 0;

  function assert(name, text, shouldMatch, patternName) {
    let matched = false;
    let matchedPattern = "";
    for (const p of PATTERNS) {
      if (patternName && p.name !== patternName) continue;
      if (p.regex.test(text)) {
        matched = true;
        matchedPattern = p.name;
        break;
      }
    }
    if (matched === shouldMatch) {
      passed++;
    } else {
      failed++;
      console.error(
        `FAIL: ${name} — expected ${shouldMatch ? "match" : "no match"}, got ${matched ? `match (${matchedPattern})` : "no match"}`,
      );
    }
  }

  // Positive cases: patterns that SHOULD trigger detection
  assert("U+FFFD replacement char", "hello�world", true, "unicode replacement character");
  assert("Latin-1 mojibake Ã", "configuraÃ§Ã£o", true, "common mojibake lead bytes");
  assert("Latin-1 mojibake â€™", "itâ€™s", true, "common mojibake lead bytes");
  assert("legacy charset gbk", '<meta charset="gbk">', true, "legacy GBK/GB2312/GB18030 charset");
  assert("legacy charset gb2312", "charset=gb2312", true, "legacy GBK/GB2312/GB18030 charset");
  assert("TextDecoder gbk", 'TextDecoder("gbk")', true, "legacy non-UTF-8 decoder");
  assert("binary toString", 'buf.toString("binary")', true, "binary string conversion");
  assert("rare CJK pair 鍚+庣", "鍚庣", true, "GBK-as-UTF-8 mojibake (rare CJK sequence)");
  assert("rare CJK pair 閰+嶇", "閰嶇", true, "GBK-as-UTF-8 mojibake (rare CJK sequence)");
  assert("rare CJK pair 璁+綋", "璁綋", true, "GBK-as-UTF-8 mojibake (rare CJK sequence)");
  assert("trigram 设置→璁剧疆", "璁剧疆", true, "known GBK mojibake trigram");
  assert("trigram 文件→鏂囦欢", "鏂囦欢", true, "known GBK mojibake trigram");
  assert("trigram 媒体→濯掍綋", "濯掍綋", true, "known GBK mojibake trigram");
  assert("trigram 配置→閰嶇疆", "閰嶇疆", true, "known GBK mojibake trigram");
  assert("trigram 应用→搴旂敤", "搴旂敤", true, "known GBK mojibake trigram");
  assert("trigram 后续→鍚庣画", "鍚庣画", true, "known GBK mojibake trigram");
  assert("trigram 处理→澶勭悊", "澶勭悊", true, "known GBK mojibake trigram");
  assert("trigram 数据→鏁版据", "鏁版嵁", true, "known GBK mojibake trigram");
  assert("trigram 看到→鐪嬪埌", "鐪嬪埌", true, "known GBK mojibake trigram");
  assert("trigram 还是→杩樻槸", "杩樻槸", true, "known GBK mojibake trigram");
  assert("trigram 因为→鍥犱负", "鍥犱负", true, "known GBK mojibake trigram");
  assert("trigram 他们→浠栦滑", "浠栦滑", true, "known GBK mojibake trigram");
  assert("trigram 我们→鎴戜滑", "鎴戜滑", true, "known GBK mojibake trigram");
  assert("trigram 你们→浣犱滑", "浣犱滑", true, "known GBK mojibake trigram");
  assert("trigram 已经→宸茬粡", "宸茬粡", true, "known GBK mojibake trigram");
  assert("trigram 不会→涓嶄細", "涓嶄細", true, "known GBK mojibake trigram");

  // Negative cases: patterns that SHOULD NOT trigger detection
  assert("normal Chinese simplified", "你好世界，这是一个测试。", false);
  assert("normal Chinese mixed", "欢迎使用我们的App", false);
  assert("normal English text", "Hello, this is a test message.", false);
  assert("normal emoji", "Hello 🎉 World", false);
  assert("valid Chinese 版本标记", "版本标记", false);
  assert("valid Chinese 撤销操作", "撤销操作", false);
  assert("valid Chinese 设置页面", "设置页面", false);
  assert("valid Chinese 配置文件", "配置文件", false);
  assert("valid Chinese 发送消息", "发送消息", false);
  assert("valid Chinese 处理完成", "处理完成", false);
  assert("valid Chinese 数据分析", "数据分析", false);
  assert("valid Chinese 应用场景", "应用场景", false);
  assert("valid Chinese longer", "当前版本的首页已经更新", false);
  assert("valid CJK 门间阳队", "门间阳队", false);
  assert("valid CJK 阀门开关", "阀门开关", false);
  assert("JSON with Chinese", '{"title":"设置","desc":"配置说明"}', false);
  assert("Vue template Chinese", "<p>{{ t('设置.title') }}</p>", false);
  assert("English with numbers", "version 1.2.3 build #456", false);
  assert("URL string", "https://example.com/path?foo=bar", false);
  assert("comment with CJK", "// 这是一个正常的中文注释", false);
  assert("CSS with Chinese font", 'font-family: "微软雅黑", sans-serif', false);

  console.log(`Self-test complete: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

// ── main scan ──

const files = walk(ROOT);
const findings = [];
for (const file of files) {
  const relative = path.relative(ROOT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    findings.push({
      file: relative,
      line: lineNumberAt(text, match.index),
      pattern: pattern.name,
      sample: match[0],
    });
  }
}

if (findings.length) {
  console.error("Potential encoding contamination found:");
  for (const item of findings) {
    console.error(`- ${item.file}:${item.line} ${item.pattern} (${JSON.stringify(item.sample)})`);
  }
  process.exit(1);
}

console.log(`Encoding contamination scan passed (${files.length} text files checked).`);
