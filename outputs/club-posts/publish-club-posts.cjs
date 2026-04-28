const fs = require("fs");
const http = require("http");
const path = require("path");

const root = "F:\\26.3.13";
const apiScript = path.join(root, "NodeBB", "nodebb-api.ps1");
const tokenMatch = fs.readFileSync(apiScript, "utf8").match(/\[string\]\$Token = "([^"]+)"/);
if (!tokenMatch) {
  throw new Error("NodeBB token not found");
}

const token = tokenMatch[1];
const posts = [
  ["试验区社团怎么选：先看这张社团地图", "01-overview.md"],
  ["想动起来的同学，试验区这些社团可以先看", "02-sports.md"],
  ["舞蹈、音乐、戏剧和表达：试验区文艺类社团速览", "03-arts.md"],
  ["想做点项目和实践：模联、辩论、科创、图书馆义工", "04-practice.md"],
  ["北体海南的帆船帆板课，为什么值得单独看一眼", "05-sailing.md"],
];

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const results = [];
  for (const [title, file] of posts) {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    const body = JSON.stringify({
      cid: 2,
      title,
      content,
      tags: ["试验区社团"],
    });
    const result = await requestJson(
      {
        hostname: "149.104.21.74",
        port: 4567,
        path: "/api/v3/topics?_uid=2",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      body
    );
    const response = result.response || result;
    results.push({
      title,
      tid: response.tid,
      slug: response.slug,
    });
  }
  fs.writeFileSync(path.join(__dirname, "publish-results.json"), JSON.stringify(results, null, 2), "utf8");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
