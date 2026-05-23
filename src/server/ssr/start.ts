/**
 * CLI bootstrap for the SSR Node http service.
 *
 * Kept as a separate file from `./index.ts` so that importing the
 * server factory in tests never side-effects a `listen()` call. The
 * `start:ssr` package script runs this file via `tsx`.
 *
 * Reads `LIAN_SSR_PORT` (default 5173). systemd / Caddy wiring is
 * phase 1.6 — out of scope here. journald captures stdout via the
 * eventual unit, so logging goes to plain `console.log`.
 */

/* eslint-disable no-console */
import process from "node:process";

import { createSsrServer, DEFAULT_SSR_PORT } from "./index";

const port = Number.parseInt(process.env.LIAN_SSR_PORT ?? "", 10) || DEFAULT_SSR_PORT;
const server = createSsrServer();

server.listen(port, () => {
  console.log(`[lian-ssr] listening on http://127.0.0.1:${port}`);
});

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`[lian-ssr] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
