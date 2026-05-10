#!/usr/bin/env node

import { spawn } from "node:child_process";

const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : 4301;
const separatorIndex = process.argv.indexOf("--");
const smokeCommand = separatorIndex !== -1 ? process.argv.slice(separatorIndex + 1) : ["npm", "run", "test:vue"];
const baseUrl = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await fetchOk(url)) return true;
    await wait(500);
  }
  return false;
}

function spawnLogged(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawnLogged(command, args, options);
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

console.log(`[smoke] building Vue frontend`);
const buildCode = await run("npm", ["run", "build"]);
if (buildCode !== 0) process.exit(buildCode);

console.log(`[smoke] starting Vite preview on ${baseUrl}`);
const server = spawn("npm", ["run", "preview", "--", "--host", "0.0.0.0", "--port", String(port), "--strictPort"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    LIAN_VUE_RUNTIME: "1"
  }
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill("SIGTERM");
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

const ready = await waitForServer(baseUrl);
if (!ready) {
  console.error(`[smoke] server did not become ready: ${baseUrl}`);
  shutdown();
  process.exit(1);
}

console.log(`[smoke] running ${smokeCommand.join(" ")}`);
const [command, ...args] = smokeCommand;
const smokeCode = await run(command, args, {
  env: {
    ...process.env,
    LIAN_SMOKE_BASE_URL: baseUrl
  }
});

shutdown();
process.exit(smokeCode);
