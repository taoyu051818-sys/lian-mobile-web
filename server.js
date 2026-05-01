import http from "node:http";

import { isSetupRequired, config } from "./src/server/config.js";
import { handleApi } from "./src/server/api-router.js";
import { sendText } from "./src/server/http-response.js";
import { setupPageHtml } from "./src/server/setup-page.js";
import { proxyLianAsset, serveStatic } from "./src/server/static-server.js";

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (reqUrl.pathname.startsWith("/api/")) {
    await handleApi(req, reqUrl, res);
    return;
  }
  if (reqUrl.pathname.startsWith("/lian-assets/")) {
    await proxyLianAsset(reqUrl, res);
    return;
  }
  if (isSetupRequired()) {
    sendText(res, 200, setupPageHtml(), "text/html; charset=utf-8");
    return;
  }
  await serveStatic(reqUrl, res);
});

server.listen(config.port, () => {
  console.log(`Lian mobile web running at http://localhost:${config.port}`);
});
