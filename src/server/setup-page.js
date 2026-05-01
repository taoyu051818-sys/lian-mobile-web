export function setupPageHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>黎安信息流部署引导</title>
    <style>
      :root { color-scheme: light; --bg:#f7f7f4; --paper:#fff; --ink:#1d2320; --muted:#69706b; --line:#e7e3da; --green:#157f5b; --red:#d95745; }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
      main { width:min(100% - 28px, 640px); margin:0 auto; padding:34px 0 48px; }
      h1 { margin:0; font-size:28px; line-height:1.2; letter-spacing:0; }
      p { color:var(--muted); line-height:1.7; }
      form { margin-top:22px; padding:18px; border:1px solid var(--line); border-radius:8px; background:var(--paper); box-shadow:0 8px 24px rgba(29,35,32,.07); }
      label { display:grid; gap:7px; margin-bottom:14px; font-size:13px; font-weight:700; color:#424b46; }
      input, select { width:100%; border:1px solid var(--line); border-radius:8px; background:#fbfaf7; color:var(--ink); padding:11px 12px; outline:none; font:inherit; }
      button { width:100%; min-height:46px; border:0; border-radius:8px; background:var(--ink); color:#fff; font:inherit; font-weight:800; }
      code { padding:2px 5px; border-radius:5px; background:#eeeae1; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .hint { margin:8px 0 0; font-size:12px; color:var(--muted); }
      .status { min-height:22px; margin-top:12px; font-size:13px; color:var(--red); }
      .status.ok { color:var(--green); }
      @media (max-width:560px) { .grid { grid-template-columns:1fr; } main { padding-top:24px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>部署引导</h1>
      <p>这是第一次启动，服务还没有 LIAN API 连接配置。保存后会在服务器目录生成 <code>.env</code>，刷新页面即可进入信息流。</p>
      <form id="setupForm">
        <label>LIAN API 地址
          <input name="nodebbBaseUrl" required value="http://127.0.0.1:4567" placeholder="http://127.0.0.1:4567">
          <span class="hint">Linux Web 服务和 LIAN API 在同一台服务器时，建议用 127.0.0.1。</span>
        </label>
        <label>LIAN 公开访问地址
          <input name="nodebbPublicBaseUrl" required value="http://149.104.21.74:4567" placeholder="https://你的域名">
          <span class="hint">浏览器加载头像、正文图片和跳转链接时使用，不能填 127.0.0.1。</span>
        </label>
        <label>LIAN API Token
          <input name="nodebbToken" required autocomplete="off" placeholder="Bearer token 或 API token">
        </label>
        <div class="grid">
          <label>发帖用户 UID
            <input name="nodebbUid" type="number" min="1" value="2">
          </label>
          <label>默认分类 CID
            <input name="nodebbCid" type="number" min="1" value="2">
          </label>
        </div>
        <label>Web 端口
          <input name="port" type="number" min="1" max="65535" value="4100">
        </label>
        <label>Cloudinary URL
          <input name="cloudinaryUrl" autocomplete="off" placeholder="cloudinary://api_key:api_secret@cloud_name">
          <span class="hint">需要在网页里上传图片发帖时填写；只浏览可以先留空。</span>
        </label>
        <label>管理接口 Token
          <input name="adminToken" autocomplete="off" placeholder="留空会自动生成">
          <span class="hint">用于远程更新推荐规则和帖子时效信息，请不要公开。</span>
        </label>
        <button type="submit">保存配置并进入</button>
        <div class="status" id="status"></div>
      </form>
    </main>
    <script>
      const form = document.getElementById("setupForm");
      const status = document.getElementById("status");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.className = "status";
        status.textContent = "正在保存...";
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("/api/setup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          status.textContent = data.error || "保存失败";
          return;
        }
        status.className = "status ok";
        status.textContent = "已保存，正在进入...";
        setTimeout(() => location.replace("/"), 500);
      });
    </script>
  </body>
</html>`;
}
