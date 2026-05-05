#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;
const viteBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");

const children = new Map();
let shuttingDown = false;

function startProcess(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.set(name, child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    children.delete(name);
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[${name}] exited with ${reason}`);

    if (!shuttingDown && name === "legacy") {
      console.error("[runtime] legacy frontend exited; stopping supervisor so systemd can restart the service");
      shutdown(1);
      return;
    }

    if (!shuttingDown && name === "vue-canary") {
      console.error("[runtime] Vue canary exited; legacy frontend remains available on its port");
    }
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const [name, child] of children.entries()) {
    console.log(`[runtime] stopping ${name}`);
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 1200).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[runtime] starting LIAN frontend runtimes");
console.log("[runtime] legacy frontend -> port 4300");
console.log("[runtime] Vue canary -> port 4301");

startProcess("legacy", nodeBin, ["scripts/serve-frontend-static-rehearsal.js"], {
  FRONTEND_PORT: process.env.FRONTEND_PORT || "4300"
});

startProcess("vue-canary", viteBin, ["--host", "0.0.0.0", "--port", "4301", "--strictPort"], {
  LIAN_VUE_CANARY: "1"
});
