#!/usr/bin/env node

/**
 * Self-contained smoke test runner with server lifecycle management.
 *
 * Starts the static rehearsal server, waits for it to be reachable,
 * runs the smoke test suite, then stops the server regardless of
 * test outcome.
 *
 * Usage: node scripts/run-smoke-with-server.js [--port PORT]
 */

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : 4300;
const baseUrl = `http://127.0.0.1:${port}`;

const STARTUP_TIMEOUT_MS = 15_000;
const STARTUP_POLL_INTERVAL_MS = 200;

function waitForServer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function poll() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });

      req.on("error", () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Server at ${url} did not become reachable within ${timeoutMs}ms`));
        } else {
          setTimeout(poll, STARTUP_POLL_INTERVAL_MS);
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Server at ${url} did not become reachable within ${timeoutMs}ms`));
        } else {
          setTimeout(poll, STARTUP_POLL_INTERVAL_MS);
        }
      });
    }

    poll();
  });
}

function startServer(port) {
  const server = spawn(process.execPath, ["scripts/serve-frontend-static-rehearsal.js"], {
    cwd: rootDir,
    env: { ...process.env, FRONTEND_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  return server;
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (server.exitCode !== null) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 5000);

    server.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    server.kill("SIGTERM");
  });
}

function runSmoke(baseUrl) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/smoke-frontend.js", baseUrl], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("exit", (code) => resolve(code));
  });
}

// --- Main ---

console.log(`\n[run-smoke] Starting static rehearsal server on port ${port}`);

const server = startServer(port);
let exitCode = 0;

try {
  await waitForServer(baseUrl, STARTUP_TIMEOUT_MS);
  console.log(`[run-smoke] Server ready at ${baseUrl}\n`);

  exitCode = await runSmoke(baseUrl);
} catch (error) {
  console.error(`\n[run-smoke] ${error.message}`);
  exitCode = 1;
} finally {
  console.log("\n[run-smoke] Stopping server");
  await stopServer(server);
}

process.exit(exitCode);
