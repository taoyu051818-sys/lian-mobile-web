import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";

const FRONTEND_PORT = 4311;
const BACKEND_PORT = 4312;
const IMAGE_PROXY_PORT = 4313;

let observedRequests = [];

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function waitForFrontend() {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${FRONTEND_PORT}/`);
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error("frontend rehearsal server did not start");
}

function stopChild(child) {
  if (!child || child.killed) return Promise.resolve();
  child.kill("SIGTERM");
  return Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
}

const backend = http.createServer((req, res) => {
  observedRequests.push({ url: req.url, headers: req.headers });
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true, source: `http://127.0.0.1:${BACKEND_PORT}` }));
});

const imageProxy = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true, imageProxy: true }));
});

let frontend;

try {
  await listen(backend, BACKEND_PORT);
  await listen(imageProxy, IMAGE_PROXY_PORT);

  frontend = spawn(process.execPath, ["scripts/serve-frontend-static-rehearsal.js"], {
    env: {
      ...process.env,
      FRONTEND_PORT: String(FRONTEND_PORT),
      LIAN_BACKEND_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      LIAN_IMAGE_PROXY_BASE_URL: `http://127.0.0.1:${IMAGE_PROXY_PORT}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  frontend.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  await waitForFrontend();

  const explicitResponse = await fetch(`http://127.0.0.1:${FRONTEND_PORT}/api/proxy-header-test`, {
    headers: {
      "x-forwarded-host": "lian.nat100.top",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "198.51.100.10"
    }
  });
  assert.equal(explicitResponse.status, 200);
  assert.equal(observedRequests.length, 1, "backend should receive proxied API request");
  assert.equal(observedRequests[0].headers["x-forwarded-host"], "lian.nat100.top");
  assert.equal(observedRequests[0].headers["x-forwarded-proto"], "https");
  assert.match(observedRequests[0].headers["x-forwarded-for"], /198\.51\.100\.10/);

  observedRequests = [];
  const inferredResponse = await fetch(`http://127.0.0.1:${FRONTEND_PORT}/api/proxy-header-test`, {
    headers: {
      "x-forwarded-host": "campus.example.edu"
    }
  });
  assert.equal(inferredResponse.status, 200);
  assert.equal(observedRequests.length, 1, "backend should receive proxied API request with inferred proto");
  assert.equal(observedRequests[0].headers["x-forwarded-host"], "campus.example.edu");
  assert.equal(observedRequests[0].headers["x-forwarded-proto"], "https");

  if (stderr.trim()) {
    console.warn(stderr.trim());
  }
  console.log("✓ static proxy forwards public origin headers");
} finally {
  await stopChild(frontend);
  await closeServer(backend).catch(() => {});
  await closeServer(imageProxy).catch(() => {});
}
