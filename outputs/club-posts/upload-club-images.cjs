const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

function getCloudinaryUrl() {
  if (process.env.CLOUDINARY_URL) return process.env.CLOUDINARY_URL;
  const envFile = "F:\\26.3.13\\NodeBB-frontend\\.env.local";
  const line = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((item) => item.startsWith("CLOUDINARY_URL="));
  if (!line) throw new Error("CLOUDINARY_URL not found");
  return line.slice("CLOUDINARY_URL=".length).trim();
}

function parseCloudinaryUrl(value) {
  const url = new URL(value);
  const [apiKey, apiSecret] = decodeURIComponent(url.username + ":" + url.password).split(":");
  return { cloudName: url.hostname, apiKey, apiSecret };
}

function uploadImage(file, config) {
  return new Promise((resolve, reject) => {
    const folder = "nodebb-frontend/club-posts";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${config.apiSecret}`)
      .digest("hex");
    const boundary = `----club-posts-${crypto.randomBytes(8).toString("hex")}`;
    const chunks = [];
    function field(name, value) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    field("api_key", config.apiKey);
    field("timestamp", timestamp);
    field("signature", signature);
    field("folder", folder);
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(file)}"\r\nContent-Type: image/jpeg\r\n\r\n`));
    chunks.push(fs.readFileSync(file));
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    const req = https.request(
      {
        hostname: "api.cloudinary.com",
        path: `/v1_1/${config.cloudName}/image/upload`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
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
            reject(new Error(`Cloudinary HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const json = JSON.parse(data);
          resolve(json.secure_url);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const config = parseCloudinaryUrl(getCloudinaryUrl());
  const imageDir = "F:\\26.3.13\\lian-mobile-web\\outputs\\club-posts\\images";
  const files = {
    clubListA: path.join(imageDir, "clubs-04.jpg"),
    clubListB: path.join(imageDir, "clubs-05.jpg"),
    sailingCover: path.join(imageDir, "sailing-05.png"),
    sailingSea: path.join(imageDir, "sailing-10.png"),
  };
  const urls = {};
  for (const [key, file] of Object.entries(files)) {
    urls[key] = await uploadImage(file, config);
  }
  fs.writeFileSync(path.join(imageDir, "cloudinary-urls.json"), JSON.stringify(urls, null, 2), "utf8");
  console.log(JSON.stringify(urls, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
