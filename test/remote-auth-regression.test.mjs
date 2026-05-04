import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../src/server/config.js";
import {
  getConfiguredRemoteAuthBaseUrl,
  isRemoteAuthPointingToSelf,
  remoteAuthLogin
} from "../src/server/auth-routes.js";

function withEnv(name, value, fn) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function withRemoteAuthBaseUrl(value, fn) {
  const previousConfigValue = config.remoteAuthBaseUrl;
  config.remoteAuthBaseUrl = String(value || "").replace(/\/$/, "");
  return withEnv("REMOTE_AUTH_BASE_URL", value, () => {
    try {
      return fn();
    } finally {
      config.remoteAuthBaseUrl = previousConfigValue;
    }
  });
}

test("remote auth fallback is disabled unless REMOTE_AUTH_BASE_URL is explicitly set", async () => {
  await withRemoteAuthBaseUrl(undefined, async () => {
    assert.equal(getConfiguredRemoteAuthBaseUrl(), "");
    assert.equal(await remoteAuthLogin({ login: "missing", password: "wrong" }), null);
  });
});

test("remote auth self-call guard detects the current public origin", () => {
  withRemoteAuthBaseUrl("http://149.104.21.74:4100", () => {
    const req = {
      headers: {
        host: "149.104.21.74:4100",
        "x-forwarded-proto": "http"
      }
    };
    assert.equal(getConfiguredRemoteAuthBaseUrl(), "http://149.104.21.74:4100");
    assert.equal(isRemoteAuthPointingToSelf(req), true);
  });
});

test("remote auth self-call guard detects local loopback on the app port", () => {
  withRemoteAuthBaseUrl("http://127.0.0.1:4100", () => {
    assert.equal(isRemoteAuthPointingToSelf({ headers: { host: "example.com" } }), true);
  });
});

test("remote auth self-call guard allows a distinct auth service", () => {
  withRemoteAuthBaseUrl("https://auth.example.com", () => {
    const req = {
      headers: {
        host: "lian.example.com",
        "x-forwarded-proto": "https"
      }
    };
    assert.equal(getConfiguredRemoteAuthBaseUrl(), "https://auth.example.com");
    assert.equal(isRemoteAuthPointingToSelf(req), false);
  });
});

test("remote auth login refuses self-call fallback before making a fetch", async () => {
  await withRemoteAuthBaseUrl("http://149.104.21.74:4100", async () => {
    const req = {
      headers: {
        host: "149.104.21.74:4100",
        "x-forwarded-proto": "http"
      }
    };
    await assert.rejects(
      () => remoteAuthLogin({ login: "missing", password: "wrong" }, req),
      (error) => {
        assert.equal(error.status, 503);
        assert.match(error.message, /current service/);
        return true;
      }
    );
  });
});
