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
  [93, "01-overview.md"],
  [94, "02-sports.md"],
  [95, "03-arts.md"],
  [96, "04-practice.md"],
  [97, "05-sailing.md"],
];

function requestJson(method, urlPath, bodyObject) {
  const body = JSON.stringify(bodyObject);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "149.104.21.74",
        port: 4567,
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
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
            resolve({ raw: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const results = [];
  for (const [pid, file] of posts) {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    const result = await requestJson("PUT", `/api/v3/posts/${pid}?_uid=2`, { content });
    results.push({ pid, ok: true, response: result.response ? Object.keys(result.response) : Object.keys(result) });
  }
  fs.writeFileSync(path.join(__dirname, "update-results.json"), JSON.stringify(results, null, 2), "utf8");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
