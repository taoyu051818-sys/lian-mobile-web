import fs from "node:fs/promises";

import { taskBoardPath } from "./paths.js";

async function handleTaskBoard(req, res) {
  const md = await fs.readFile(taskBoardPath, "utf8");
  res.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-cache",
    "access-control-allow-origin": "*"
  });
  res.end(md);
}

export { handleTaskBoard };
