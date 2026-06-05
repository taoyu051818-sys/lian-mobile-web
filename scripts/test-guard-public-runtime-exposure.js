#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceGuardPath = path.join(rootDir, "scripts/guard-public-runtime-exposure.js");
const sourceGuard = await fs.readFile(sourceGuardPath, "utf8");

async function writeFixtureFile(repoDir, relativePath, content) {
  const filePath = path.join(repoDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function createFixtureRepo(files) {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "lian-runtime-guard-"));
  await writeFixtureFile(repoDir, "scripts/guard-public-runtime-exposure.js", sourceGuard);
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(repoDir, relativePath, content);
  }
  return repoDir;
}

async function runGuardFixture(name, files, expectedStatus, expectedNeedle, targets = []) {
  const repoDir = await createFixtureRepo(files);
  try {
    const result = await execFileAsync(
      process.execPath,
      ["scripts/guard-public-runtime-exposure.js", ...targets],
      {
        cwd: repoDir,
      },
    ).then(
      ({ stdout, stderr }) => ({ status: "pass", stdout, stderr }),
      (error) => ({
        status: "fail",
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        code: error.code,
      }),
    );

    assert.equal(
      result.status,
      expectedStatus,
      `${name} expected ${expectedStatus} but saw ${result.status}`,
    );
    const combinedOutput = `${result.stdout}${result.stderr}`;
    assert.match(combinedOutput, expectedNeedle, `${name} output should mention ${expectedNeedle}`);
    console.log(`PASS ${name}`);
  } finally {
    await fs.rm(repoDir, { recursive: true, force: true });
  }
}

await runGuardFixture(
  "clean production fixture",
  {
    "index.html":
      '<!doctype html><html><body><div id="vue-root"></div><script type="module" src="/src/main.ts"></script></body></html>',
    "src/main.ts": "console.log('ok');",
  },
  "pass",
  /Result: \d+ passed, 0 failed/,
);

await runGuardFixture(
  "rehearsal marker fixture",
  {
    "index.html": "<!doctype html><html><body>LIAN_STATIC_REHEARSAL</body></html>",
  },
  "fail",
  /rehearsal marker/,
);

await runGuardFixture(
  "internal tool path fixture",
  {
    "index.html": '<!doctype html><html><body><a href="/tools/debug">debug</a></body></html>',
  },
  "fail",
  /internal\/debug path/,
);

await runGuardFixture(
  "broad API runtime cache fixture",
  {
    "vite.config.ts": `export default {
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https?:\\/\\/[^/]+\\/api\\//,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache" },
          },
        ],
      },
    };`,
  },
  "fail",
  /broad API runtime cache|API runtime cache name/,
);

await runGuardFixture(
  "secret-like runtime token fixture",
  {
    "src/main.ts": `window.__LIAN_CONFIG__ = {
      NODEBB_API_TOKEN: "nodebb-live-token-value",
      publicLabel: "ok",
    };`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "provider secret identifier fixture",
  {
    "src/App.vue": `<script setup>
const runtimeConfig = {
  CLOUDINARY_URL: "cloudinary-public-url-value",
  ADMIN_TOKEN: "admin-public-token-value",
  SERVERCHAN: "serverchan-public-value",
  sendKey: "serverchan-send-key-value",
};
</script>`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "generic secret assignment fixture",
  {
    "public/config.js": `window.publicConfig = {
      apiKey: "public-api-key-value",
      password: "public-password-value",
    };`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "public env secret identifier fixture",
  {
    "src/main.ts": `const tokenSource = import.meta.env.VITE_MIMO_API_KEY;
window.__LIAN_CONFIG__ = { tokenSource };`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "documentation placeholder fixture",
  {
    "docs/runtime-config.md": `Use placeholders such as NODEBB_API_TOKEN="replace-me" and apiKey="example" in local notes.`,
  },
  "pass",
  /Result: \d+ passed, 0 failed/,
  ["docs"],
);

await runGuardFixture(
  "documentation real-looking secret fixture",
  {
    "docs/runtime-config.md": `Do not publish NODEBB_API_TOKEN="nodebb-live-token-value" in documentation.`,
  },
  "fail",
  /secret-like runtime exposure/,
  ["docs"],
);

await runGuardFixture(
  "built asset secret fixture",
  {
    "dist/assets/index.js": `const config = { MIMO_API_KEY: "mimo-public-key-value" };`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "built asset sourcemap secret fixture",
  {
    "dist/assets/index.js.map": JSON.stringify({
      version: 3,
      sourcesContent: ['const config = { NODEBB_API_TOKEN: "nodebb-public-token-value" };'],
    }),
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "built asset private key block fixture",
  {
    "dist/assets/index.js": `const privateKey = "-----BEGIN PRIVATE KEY-----\\npublic-private-key-value\\n-----END PRIVATE KEY-----";`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "built asset client secret fixture",
  {
    "dist/assets/app.css": `:root { --CLIENT_SECRET: "client-public-secret-value"; }`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "ignored public tools secret fixture",
  {
    "index.html": '<!doctype html><html><body><div id="vue-root"></div></body></html>',
    "src/main.ts": "console.log('ok');",
    "public/tools/admin.js": `const ADMIN_TOKEN = "debug-tool-token-value";`,
  },
  "pass",
  /Result: \d+ passed, 0 failed/,
);

await runGuardFixture(
  "vite config secret fixture",
  {
    "index.html": '<!doctype html><html><body><div id="vue-root"></div></body></html>',
    "src/main.ts": "console.log('ok');",
    "vite.config.ts": `export default { define: { ADMIN_TOKEN: "vite-public-token-value" } };`,
  },
  "fail",
  /secret-like runtime exposure/,
);

await runGuardFixture(
  "public subdirectory target secret fixture",
  {
    "public/subdir/config.js": `window.runtimeConfig = { apiKey: "subdir-public-key-value" };`,
  },
  "fail",
  /secret-like runtime exposure/,
  ["public/subdir"],
);

await runGuardFixture(
  "bearer token assignment fixture",
  {
    "src/main.ts": `const BEARER_TOKEN = "bearer-public-token-value";`,
  },
  "fail",
  /secret-like runtime exposure/,
);
