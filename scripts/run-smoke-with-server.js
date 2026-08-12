#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : 4301;
const separatorIndex = process.argv.indexOf("--");
const smokeCommand =
  separatorIndex !== -1 ? process.argv.slice(separatorIndex + 1) : ["npm", "run", "test:vue"];
const baseUrl = `http://127.0.0.1:${port}`;
const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[smoke] invalid port: ${process.argv[portArgIndex + 1] ?? ""}`);
  process.exit(1);
}

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
  let executable = command;
  let resolvedArgs = args;
  let shell = false;

  if (command === "npm" && process.env.npm_execpath) {
    executable = process.execPath;
    resolvedArgs = [process.env.npm_execpath, ...args];
  } else if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    executable = `${command}.cmd`;
    shell = true;
  }

  return spawn(executable, resolvedArgs, {
    stdio: "inherit",
    shell,
    ...options,
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawnLogged(command, args, options);
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function assertPortAvailable(targetPort) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen({ host: "0.0.0.0", port: targetPort, exclusive: true }, () => {
      probe.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

function childOutcome(child) {
  return new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = childOutcome(child);
  child.kill("SIGTERM");
  await Promise.race([stopped, wait(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

try {
  await assertPortAvailable(port);
} catch (error) {
  const detail = error instanceof Error ? ` (${error.message})` : "";
  console.error(`[smoke] port ${port} is already in use${detail}`);
  process.exit(1);
}

console.log(`[smoke] building Vue frontend`);
const buildCode = await run("npm", ["run", "build"]);
if (buildCode !== 0) process.exit(buildCode);

console.log(`[smoke] starting Vite preview on ${baseUrl}`);
const server = spawn(
  process.execPath,
  [viteCli, "preview", "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
    },
  },
);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopServer(server);
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(130);
});
process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(143);
});

const startup = await Promise.race([
  waitForServer(baseUrl).then((ready) => ({ kind: "ready", ready })),
  childOutcome(server).then((outcome) => ({ kind: "exit", outcome })),
]);
if (startup.kind === "exit") {
  const detail = startup.outcome.error?.message || startup.outcome.signal || startup.outcome.code;
  console.error(`[smoke] preview exited before becoming ready: ${detail}`);
  process.exit(1);
}
if (!startup.ready || server.exitCode !== null || server.signalCode !== null) {
  console.error(`[smoke] server did not become ready: ${baseUrl}`);
  await stopServer(server);
  process.exit(1);
}

console.log(`[smoke] running ${smokeCommand.join(" ")}`);
const [command, ...args] = smokeCommand;
const smokeCode = await run(command, args, {
  env: {
    ...process.env,
    LIAN_SMOKE_BASE_URL: baseUrl,
  },
});

await stopServer(server);
process.exit(smokeCode);
