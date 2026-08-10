import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runner = path.join(repoRoot, "scripts", "run-smoke-with-server.js");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "0.0.0.0", port: 0, exclusive: true }, () => resolve());
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function runRunner(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, "--port", String(port)], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, output }));
  });
}

test("smoke runner fails before building when its requested port is occupied", async () => {
  const listener = createServer();
  await listen(listener);
  const address = listener.address();
  assert.ok(address && typeof address !== "string");

  try {
    const result = await runRunner(address.port);
    assert.equal(result.signal, null);
    assert.equal(result.code, 1);
    assert.match(result.output, new RegExp(`port ${address.port} is already in use`, "i"));
    assert.doesNotMatch(result.output, /building Vue frontend/);
  } finally {
    await close(listener);
  }
});
