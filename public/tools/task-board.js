(function () {
  "use strict";

  var API = "/api/internal/task-board";
  var RECENT_DAYS = 14;

  var STATUS_COLORS = {
    "Done": "done",
    "待审核": "待审核",
    "待复核": "待复核",
    "Blocked": "blocked",
    "Ready": "ready",
    "Later": "later",
    "Human-assisted only": "human",
    "Human-assisted": "human",
    "External": "external"
  };

  var CATEGORY_ORDER = ["Done", "Ready", "Blocked", "Audit Log"];

  var WORKSTREAMS = [
    { id: "publish", name: "发布 / NodeBB", keywords: [/publish|posting|nodebb|topic|reply|post detail|profile|history/i] },
    { id: "auth", name: "账号 / 权限", keywords: [/auth|login|register|alias|invite|permission|audience|visibility/i] },
    { id: "feed", name: "内容流 / 推荐", keywords: [/feed|recommend|discover|content|tag|search/i] },
    { id: "map", name: "地图 / 位置", keywords: [/map|location|floor|geo|campus|venue/i] },
    { id: "message", name: "消息 / 通知", keywords: [/message|notification|channel|inbox|chat/i] },
    { id: "ops", name: "运维 / 部署", keywords: [/ops|deploy|pm2|server|runtime|health|monitor/i] },
    { id: "quality", name: "质量 / 守卫", keywords: [/test|check|guard|smoke|review|regression|code smell|lint|verify/i] },
    { id: "docs", name: "文档 / 自动化", keywords: [/doc|docs|handoff|automation|index|manifest|strategy|task board/i] },
    { id: "frontend", name: "前端 / 体验", keywords: [/frontend|mobile|ui|vue|css|browser|page|style/i] },
    { id: "data", name: "数据 / 迁移", keywords: [/data|redis|migration|metadata|json|object-native/i] }
  ];

  var PHASES = {
    done: { label: "已完成", weight: 1 },
    review: { label: "复核中", weight: 0.75 },
    ready: { label: "等待开发", weight: 0.25 },
    planned: { label: "已排期", weight: 0.1 },
    blocked: { label: "阻塞/等待", weight: 0 },
    external: { label: "外部依赖", weight: 0 },
    unknown: { label: "未归类", weight: 0 }
  };

  var tasks = [];
  var filtered = [];
  var selected = null;
  var sortKey = "priority";
  var sortAsc = true;
  var filters = { status: [], priority: [], category: [], workstream: [], humanOnly: false, search: "" };

  function parseTaskBoard(md) {
    var lines = md.split("\n");
    var result = [];
    var currentSection = "";
    var i = 0;
    var priorityMap = parsePriorityMap(lines);

    while (i < lines.length) {
      var line = lines[i];
      if (line.indexOf("## ") === 0 && line.indexOf("### ") !== 0) {
        currentSection = line.replace(/^##\s+/, "").trim();
        i += 1;
        continue;
      }
      if (line.indexOf("### ") === 0) {
        var title = line.replace(/^###\s+/, "").trim();
        if (isNonTaskSection(title)) {
          i += 1;
          continue;
        }

        var body = [];
        i += 1;
        while (i < lines.length && lines[i].indexOf("## ") !== 0) {
          if (lines[i].indexOf("### ") === 0) break;
          body.push(lines[i]);
          i += 1;
        }

        var bodyText = body.join("\n");
        var taskDoc = extractPath(bodyText, /docs\/agent\/tasks\/([\w-]+)\.md/);
        var handoff = extractPath(bodyText, /docs\/agent\/handoffs\/([\w-]+)\.md/);
        var slug = taskDoc ? taskDoc.match(/([\w-]+)\.md$/)[1] : slugify(title);
        var status = extractStatus(bodyText, currentSection);
        var phase = derivePhase(status, currentSection, bodyText);
        var latestDate = extractLatestDate(title + "\n" + bodyText);
        var workstream = deriveWorkstream(title, bodyText, taskDoc);
        var humanAssisted = /human.assisted/i.test(bodyText) || status === "Human-assisted only" || workstream.id === "map";
        var progress = Math.round(PHASES[phase].weight * 100);

        result.push({
          title: title,
          body: bodyText,
          section: currentSection,
          status: status,
          phase: phase,
          phaseLabel: PHASES[phase].label,
          priority: slug && priorityMap[slug] ? priorityMap[slug] : "",
          humanAssisted: humanAssisted,
          taskDoc: taskDoc,
          handoff: handoff,
          isMap: workstream.id === "map",
          slug: slug,
          latestDate: latestDate,
          workstream: workstream.id,
          workstreamName: workstream.name,
          progress: progress
        });
      } else {
        i += 1;
      }
    }

    return result;
  }

  function parsePriorityMap(lines) {
    var priorityMap = {};
    var inProDecision = false;
    for (var j = 0; j < lines.length; j += 1) {
      if (lines[j].indexOf("### Pro Decision:") === 0) { inProDecision = true; continue; }
      if (inProDecision && lines[j].indexOf("### ") === 0) { inProDecision = false; }
      if (!inProDecision) continue;
      var pm = lines[j].match(/^\d+\.\s+\*\*(P\d+)\*\*\s+(.+)$/);
      if (!pm) continue;
      var prio = pm[1];
      var taskRef = pm[2];
      var tm = taskRef.match(/docs\/agent\/tasks\/([\w-]+)\.md/);
      if (tm) priorityMap[tm[1]] = prio;
      if (taskRef.indexOf("smoke-frontend") >= 0 || taskRef.indexOf("frontend smoke") >= 0) priorityMap["frontend-stability-smoke"] = prio;
      if (taskRef.indexOf("Publish V2 browser") >= 0) priorityMap["publish-v2-browser-acceptance"] = prio;
      if (taskRef.indexOf("Lane F") >= 0 || taskRef.indexOf("messages/notifications") >= 0) priorityMap["lane-f-messages-review-rerun"] = prio;
      if (taskRef.indexOf("NodeBB detail/profile") >= 0) priorityMap["nodebb-detail-actions-profile-history"] = prio;
      if (taskRef.indexOf("Doc cleanup") >= 0 || taskRef.indexOf("Clean docs") >= 0) priorityMap["project-file-index-and-doc-cleanup"] = prio;
      if (taskRef.indexOf("Audience write-side") >= 0) priorityMap["audience-write-side-minimum-audit"] = prio;
      if (taskRef.indexOf("backend repo bootstrap") >= 0 || taskRef.indexOf("Repo Split") >= 0) priorityMap["repo-split-frontend-backend"] = prio;
      if (taskRef.indexOf("manual-review regressions") >= 0 || taskRef.indexOf("regression") >= 0) priorityMap["p0-publish-profile-nodebb-regression-fix"] = prio;
    }
    return priorityMap;
  }

  function isNonTaskSection(title) {
    return title === "Operating Rule: Codex Reviews, Claude Code Executes" ||
      title === "Operating Rule: Map Development Requires Human Assistance" ||
      title === "Pro Decision: Stabilize Before Expanding" ||
      title.indexOf("Review Fix Pass:") === 0 ||
      title.indexOf("Review Blockers:") === 0 ||
      title.indexOf("Reviewer Rerun:") === 0 ||
      title === "Map V2 Implementation (superseded)";
  }

  function extractPath(text, pattern) {
    var match = text.match(pattern);
    if (!match) return "";
    return pattern.source.indexOf("handoffs") >= 0 ? "docs/agent/handoffs/" + match[1] + ".md" : "docs/agent/tasks/" + match[1] + ".md";
  }

  function extractStatus(bodyText, currentSection) {
    var statusMatch = bodyText.match(/\*\*(Done|待审核|待复核|Blocked|Ready|Later|Human-assisted only|External)\*\*/);
    if (statusMatch) return statusMatch[1];
    var phaseMatch = bodyText.match(/Status:\s*\*\*([^*]+)\*\*/);
    if (phaseMatch) return phaseMatch[1].trim();
    if (currentSection === "Done") return "Done";
    if (currentSection === "Ready") return "Ready";
    if (currentSection === "Blocked") return "Blocked";
    return "";
  }

  function derivePhase(status, section, bodyText) {
    var text = (status + " " + section + " " + bodyText).toLowerCase();
    if (status === "Done" || section === "Done") return "done";
    if (status === "待审核" || status === "待复核" || /review|复核|审核/.test(text)) return "review";
    if (status === "Ready" || section === "Ready") return "ready";
    if (status === "Later" || /later|backlog|排期/.test(text)) return "planned";
    if (status === "Blocked" || status === "Human-assisted only" || /blocked|human-assisted|waiting|等待|阻塞/.test(text)) return "blocked";
    if (status === "External") return "external";
    return "unknown";
  }

  function extractLatestDate(text) {
    var matches = text.match(/20\d{2}-\d{2}-\d{2}/g) || [];
    if (!matches.length) return "";
    matches.sort();
    return matches[matches.length - 1];
  }

  function deriveWorkstream(title, body, taskDoc) {
    var text = [title, body, taskDoc].join("\n");
    for (var i = 0; i < WORKSTREAMS.length; i += 1) {
      var stream = WORKSTREAMS[i];
      for (var j = 0; j < stream.keywords.length; j += 1) {
        if (stream.keywords[j].test(text)) return stream;
      }
    }
    return { id: "other", name: "其他 / 未归类" };
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function buildSidebar() {
    var sidebar = document.getElementById("sidebar");
    var html = '<input type="text" class="search-box" id="searchBox" placeholder="Search tasks...">';

    html += '<h3>Status</h3>';
    var statuses = unique(tasks.map(function (t) { return t.status; }).filter(Boolean));
    Object.keys(STATUS_COLORS).forEach(function (s) {
      if (statuses.indexOf(s) < 0) return;
      html += '<label><input type="checkbox" data-filter="status" value="' + escAttr(s) + '"> ' + escHtml(s) + '</label>';
    });

    html += '<h3>Workstream</h3>';
    getWorkstreamStats(tasks).forEach(function (item) {
      html += '<label><input type="checkbox" data-filter="workstream" value="' + escAttr(item.id) + '"> ' + escHtml(item.name) + ' (' + item.total + ')</label>';
    });

    html += '<h3>Priority</h3>';
    ["P0", "P1", "P2"].forEach(function (p) {
      var count = tasks.filter(function (t) { return t.priority === p; }).length;
      if (count === 0) return;
      html += '<label><input type="checkbox" data-filter="priority" value="' + p + '"> ' + p + ' (' + count + ')</label>';
    });
    html += '<label><input type="checkbox" data-filter="priority" value=""> Unassigned</label>';

    html += '<h3>Category</h3>';
    CATEGORY_ORDER.forEach(function (c) {
      var count = tasks.filter(function (t) { return t.section === c; }).length;
      if (count === 0) return;
      html += '<label><input type="checkbox" data-filter="category" value="' + escAttr(c) + '"> ' + escHtml(c) + ' (' + count + ')</label>';
    });

    html += '<h3>Special</h3>';
    var humanCount = tasks.filter(function (t) { return t.humanAssisted; }).length;
    html += '<label><input type="checkbox" id="humanOnly"> Human-assisted only (' + humanCount + ')</label>';

    sidebar.innerHTML = html;

    document.getElementById("searchBox").addEventListener("input", function (e) {
      filters.search = e.target.value.toLowerCase();
      applyFilters();
    });
    document.getElementById("humanOnly").addEventListener("change", function (e) {
      filters.humanOnly = e.target.checked;
      applyFilters();
    });
    sidebar.querySelectorAll("input[data-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        var key = el.getAttribute("data-filter");
        if (el.checked) filters[key].push(el.value);
        else filters[key] = filters[key].filter(function (v) { return v !== el.value; });
        applyFilters();
      });
    });
  }

  function applyFilters() {
    filtered = tasks.filter(function (t) {
      var haystack = [t.title, t.body, t.taskDoc, t.handoff, t.workstreamName, t.phaseLabel].join(" ").toLowerCase();
      if (filters.search && haystack.indexOf(filters.search) < 0) return false;
      if (filters.status.length && filters.status.indexOf(t.status) < 0) return false;
      if (filters.priority.length && filters.priority.indexOf(t.priority) < 0) return false;
      if (filters.category.length && filters.category.indexOf(t.section) < 0) return false;
      if (filters.workstream.length && filters.workstream.indexOf(t.workstream) < 0) return false;
      if (filters.humanOnly && !t.humanAssisted) return false;
      return true;
    });
    sortTasks();
    renderDashboard();
    renderTable();
    updateCounts();
  }

  function sortTasks() {
    filtered.sort(function (a, b) {
      var va = a[sortKey] || "";
      var vb = b[sortKey] || "";
      if (sortKey === "priority") {
        va = va || "Z";
        vb = vb || "Z";
      }
      if (sortKey === "latestDate") {
        va = va || "0000-00-00";
        vb = vb || "0000-00-00";
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
  }

  function renderDashboard() {
    renderMetrics();
    renderWorkstreams();
    renderRecentList();
    renderLanes();
  }

  function renderMetrics() {
    var completed = tasks.filter(function (t) { return t.phase === "done"; }).length;
    var review = tasks.filter(function (t) { return t.phase === "review"; }).length;
    var ready = tasks.filter(function (t) { return t.phase === "ready"; }).length;
    var blocked = tasks.filter(function (t) { return t.phase === "blocked" || t.phase === "external"; }).length;
    var recentDone = getRecentTasks(tasks, RECENT_DAYS).filter(function (t) { return t.phase === "done" || t.phase === "review"; }).length;
    var dated = tasks.filter(function (t) { return t.latestDate; }).length;
    var progress = tasks.length ? Math.round(tasks.reduce(function (sum, t) { return sum + PHASES[t.phase].weight; }, 0) / tasks.length * 100) : 0;
    var speed = Math.round(recentDone / RECENT_DAYS * 7 * 10) / 10;

    var metrics = [
      { label: "整体进度", value: progress + "%", hint: completed + " done / " + review + " review" },
      { label: "最近 " + RECENT_DAYS + " 天产出", value: recentDone, hint: "约 " + speed + " 项/周" },
      { label: "等待开发", value: ready, hint: "Ready 队列" },
      { label: "阻塞/等待", value: blocked, hint: "需要人或外部条件" },
      { label: "有日期线索", value: dated, hint: "用于速度估算" }
    ];

    document.getElementById("metricGrid").innerHTML = metrics.map(function (item) {
      return '<div class="metric-card"><div class="metric-label">' + escHtml(item.label) + '</div><div class="metric-value">' + escHtml(item.value) + '</div><div class="metric-hint">' + escHtml(item.hint) + '</div></div>';
    }).join("");
  }

  function renderWorkstreams() {
    var stats = getWorkstreamStats(filtered.length ? filtered : tasks);
    var html = stats.map(function (item) {
      return '<div class="workstream-card">' +
        '<div class="workstream-title"><strong>' + escHtml(item.name) + '</strong><span>' + item.done + '/' + item.total + '</span></div>' +
        '<div class="progress-bar"><span style="width:' + item.progress + '%"></span></div>' +
        '<div class="workstream-meta">' + escHtml(item.phaseSummary) + '</div>' +
        '</div>';
    }).join("");
    document.getElementById("workstreamGrid").innerHTML = html || '<div class="empty-note">No tasks match current filters.</div>';
  }

  function renderRecentList() {
    var recent = getRecentTasks(tasks, RECENT_DAYS)
      .filter(function (t) { return t.phase === "done" || t.phase === "review"; })
      .slice(0, 8);
    document.getElementById("recentWindowLabel").textContent = "最近 " + RECENT_DAYS + " 天";
    if (!recent.length) {
      document.getElementById("recentList").innerHTML = '<div class="empty-note">没有可识别日期的近期完成/复核项。</div>';
      return;
    }
    document.getElementById("recentList").innerHTML = recent.map(function (t) {
      return '<div class="recent-item">' +
        '<div><strong>' + escHtml(t.title) + '</strong><div>' + escHtml(t.workstreamName) + '</div></div>' +
        '<span>' + escHtml(t.latestDate) + '</span>' +
        '</div>';
    }).join("");
  }

  function renderLanes() {
    var lanes = [
      { key: "review", title: "复核中", items: tasks.filter(function (t) { return t.phase === "review"; }) },
      { key: "ready", title: "等待开发", items: tasks.filter(function (t) { return t.phase === "ready"; }) },
      { key: "blocked", title: "阻塞/等待", items: tasks.filter(function (t) { return t.phase === "blocked" || t.phase === "external"; }) },
      { key: "planned", title: "排期 / Later", items: tasks.filter(function (t) { return t.phase === "planned"; }) }
    ];
    document.getElementById("laneBoard").innerHTML = lanes.map(function (lane) {
      var items = sortQueue(lane.items).slice(0, 6);
      return '<div class="lane lane-' + lane.key + '"><h3>' + escHtml(lane.title) + '<span>' + lane.items.length + '</span></h3>' +
        (items.length ? items.map(renderLaneItem).join("") : '<div class="empty-note">暂无</div>') +
        '</div>';
    }).join("");
  }

  function renderLaneItem(t) {
    return '<div class="lane-item">' +
      '<div class="lane-title">' + escHtml(t.title) + '</div>' +
      '<div class="lane-meta">' + (t.priority ? escHtml(t.priority) + ' · ' : '') + escHtml(t.workstreamName) + '</div>' +
      '</div>';
  }

  function getRecentTasks(items, days) {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return items.filter(function (t) {
      if (!t.latestDate) return false;
      return new Date(t.latestDate + "T00:00:00") >= cutoff;
    }).sort(function (a, b) {
      return (b.latestDate || "").localeCompare(a.latestDate || "");
    });
  }

  function getWorkstreamStats(items) {
    var byId = {};
    items.forEach(function (t) {
      if (!byId[t.workstream]) byId[t.workstream] = { id: t.workstream, name: t.workstreamName, total: 0, done: 0, review: 0, ready: 0, blocked: 0, score: 0 };
      var s = byId[t.workstream];
      s.total += 1;
      s.score += PHASES[t.phase].weight;
      if (t.phase === "done") s.done += 1;
      if (t.phase === "review") s.review += 1;
      if (t.phase === "ready") s.ready += 1;
      if (t.phase === "blocked" || t.phase === "external") s.blocked += 1;
    });
    return Object.keys(byId).map(function (id) {
      var s = byId[id];
      s.progress = s.total ? Math.round(s.score / s.total * 100) : 0;
      s.phaseSummary = "复核 " + s.review + " · 待开发 " + s.ready + " · 阻塞 " + s.blocked;
      return s;
    }).sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }

  function sortQueue(items) {
    var rank = { P0: 0, P1: 1, P2: 2, "": 9 };
    return items.slice().sort(function (a, b) {
      var pa = rank[a.priority] == null ? 9 : rank[a.priority];
      var pb = rank[b.priority] == null ? 9 : rank[b.priority];
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
  }

  function renderTable() {
    var tbody = document.getElementById("taskBody");
    var html = "";
    filtered.forEach(function (t, idx) {
      var selClass = selected === idx ? " selected" : "";
      html += '<tr data-idx="' + idx + '" class="' + selClass + '">';
      html += '<td><div class="task-title">' + escHtml(t.title) + '</div><div class="task-subtitle">' + escHtml(t.phaseLabel) + '</div></td>';
      html += '<td><span class="workstream-pill">' + escHtml(t.workstreamName) + '</span></td>';
      html += '<td>' + statusBadge(t.status) + '</td>';
      html += '<td>' + (t.priority ? priorityBadge(t.priority) : '<span style="color:var(--muted)">—</span>') + '</td>';
      html += '<td style="font-size:12px;color:var(--muted)">' + escHtml(t.latestDate || "—") + '</td>';
      html += '<td>' + (t.humanAssisted ? '<span class="human-dot" title="Human-assisted only"></span>' : '') + '</td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        selected = parseInt(tr.getAttribute("data-idx"), 10);
        renderTable();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    var panel = document.getElementById("detailPanel");
    if (selected === null || !filtered[selected]) {
      panel.innerHTML = '<div class="detail-empty">Select a task to view details</div>';
      return;
    }
    var t = filtered[selected];
    var html = '<h2>' + escHtml(t.title) + '</h2>';
    html += '<div class="detail-badges">';
    html += statusBadge(t.status);
    html += '<span class="badge badge-ready">' + escHtml(t.workstreamName) + '</span>';
    html += '<span class="badge badge-ready">' + escHtml(t.phaseLabel) + ' · ' + t.progress + '%</span>';
    if (t.priority) html += priorityBadge(t.priority);
    if (t.humanAssisted) html += '<span class="badge badge-human">Human-assisted</span>';
    if (t.isMap) html += '<span class="badge badge-human">Map</span>';
    html += '</div>';

    html += '<div class="detail-section"><h4>Progress</h4><div class="progress-bar detail-progress"><span style="width:' + t.progress + '%"></span></div></div>';

    if (t.taskDoc || t.handoff) {
      html += '<div class="detail-section"><h4>Links</h4><div class="detail-links">';
      if (t.taskDoc) html += '<a href="/' + t.taskDoc + '" target="_blank">Task: ' + escHtml(t.taskDoc) + '</a>';
      if (t.handoff) html += '<a href="/' + t.handoff + '" target="_blank">Handoff: ' + escHtml(t.handoff) + '</a>';
      html += '</div></div>';
    }

    html += '<div class="detail-section"><h4>Metadata</h4><div class="detail-meta">Section: ' + escHtml(t.section || "—") + '<br>Latest date: ' + escHtml(t.latestDate || "not detected") + '<br>Slug: ' + escHtml(t.slug || "—") + '</div></div>';
    html += '<div class="detail-section"><h4>Content</h4><div class="detail-body">' + escHtml(t.body) + '</div></div>';
    panel.innerHTML = html;
  }

  function updateCounts() {
    document.getElementById("countTotal").textContent = filtered.length + " / " + tasks.length;
    document.getElementById("countBlocked").textContent = tasks.filter(function (t) { return t.phase === "blocked" || t.phase === "external"; }).length;
    document.getElementById("countHuman").textContent = tasks.filter(function (t) { return t.humanAssisted; }).length;
    document.getElementById("countReady").textContent = tasks.filter(function (t) { return t.phase === "ready"; }).length;

    var p0Items = sortQueue(tasks.filter(function (t) { return t.priority === "P0" && t.phase !== "done"; }));
    var summary = p0Items.map(function (t) { return t.title; }).slice(0, 4).join(" → ");
    document.getElementById("queueSummary").textContent = "P0 active: " + (summary || "none");
  }

  function statusBadge(s) {
    var cls = STATUS_COLORS[s] || "ready";
    return '<span class="badge badge-' + cls + '">' + escHtml(s || "—") + '</span>';
  }

  function priorityBadge(p) {
    return '<span class="badge badge-priority badge-' + p.toLowerCase() + '">' + escHtml(p) + '</span>';
  }

  function unique(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  function escAttr(s) {
    return escHtml(s).replace(/'/g, "&#39;");
  }

  document.querySelectorAll(".task-table th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.getAttribute("data-sort");
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      document.querySelectorAll(".task-table th").forEach(function (h) { h.classList.remove("sorted"); });
      th.classList.add("sorted");
      th.querySelector(".sort-arrow").innerHTML = sortAsc ? "&#x25B4;" : "&#x25BE;";
      sortTasks();
      renderTable();
    });
  });

  fetch(API)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (md) {
      tasks = parseTaskBoard(md);
      buildSidebar();
      applyFilters();
    })
    .catch(function (err) {
      document.getElementById("taskBody").innerHTML =
        '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger)">Failed to load task board: ' + escHtml(err.message) + '</td></tr>';
    });
})();
