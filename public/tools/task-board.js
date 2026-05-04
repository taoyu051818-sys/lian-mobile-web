(function () {
  "use strict";

  var API = "/api/internal/task-board";

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

  var tasks = [];
  var filtered = [];
  var selected = null;
  var sortKey = "priority";
  var sortAsc = true;
  var filters = { status: [], priority: [], category: [], humanOnly: false, search: "" };

  // Parse markdown into task objects
  function parseTaskBoard(md) {
    var lines = md.split("\n");
    var result = [];
    var currentSection = "";
    var i = 0;

    // First pass: extract Pro Decision priority map
    var priorityMap = {};
    var inProDecision = false;
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].indexOf("### Pro Decision:") === 0) { inProDecision = true; continue; }
      if (inProDecision && lines[j].indexOf("### ") === 0) { inProDecision = false; }
      if (inProDecision) {
        var pm = lines[j].match(/^\d+\.\s+\*\*(P\d+)\*\*\s+(.+)$/);
        if (pm) {
          var prio = pm[1];
          var taskRef = pm[2];
          // Extract task doc path
          var tm = taskRef.match(/docs\/agent\/tasks\/([\w-]+)\.md/);
          if (tm) priorityMap[tm[1]] = prio;
          // Also try to match by keywords
          if (taskRef.indexOf("smoke-frontend") >= 0 || taskRef.indexOf("frontend smoke") >= 0) priorityMap["frontend-stability-smoke"] = prio;
          if (taskRef.indexOf("Publish V2 browser") >= 0) priorityMap["publish-v2-browser-acceptance"] = prio;
          if (taskRef.indexOf("Lane F") >= 0 || taskRef.indexOf("messages/notifications") >= 0) priorityMap["lane-f-messages-review-rerun"] = prio;
          if (taskRef.indexOf("NodeBB detail/profile") >= 0) priorityMap["nodebb-detail-actions-profile-history"] = prio;
          if (taskRef.indexOf("Doc cleanup") >= 0 || taskRef.indexOf("Clean docs") >= 0) priorityMap["project-file-index-and-doc-cleanup"] = prio;
          if (taskRef.indexOf("Audience write-side") >= 0) priorityMap["audience-write-side-minimum-audit"] = prio;
          if (taskRef.indexOf("backend repo bootstrap") >= 0 || taskRef.indexOf("Repo Split") >= 0) priorityMap["repo-split-frontend-backend"] = prio;
          if (taskRef.indexOf("manual-review regressions") >= 0 || taskRef.indexOf("regression") >= 0) priorityMap["p0-publish-profile-nodebb-regression-fix"] = prio;
        }
      }
    }

    // Second pass: extract tasks
    while (i < lines.length) {
      var line = lines[i];
      if (line.indexOf("## ") === 0 && line.indexOf("### ") !== 0) {
        currentSection = line.replace(/^##\s+/, "").trim();
        i++;
        continue;
      }
      if (line.indexOf("### ") === 0) {
        var title = line.replace(/^###\s+/, "").trim();
        // Skip non-task sections
        if (title === "Operating Rule: Codex Reviews, Claude Code Executes" ||
            title === "Operating Rule: Map Development Requires Human Assistance" ||
            title === "Pro Decision: Stabilize Before Expanding" ||
            title.indexOf("Review Fix Pass:") === 0 ||
            title.indexOf("Review Blockers:") === 0 ||
            title.indexOf("Reviewer Rerun:") === 0 ||
            title === "Map V2 Implementation (superseded)") {
          i++;
          continue;
        }

        var body = [];
        i++;
        while (i < lines.length && lines[i].indexOf("## ") !== 0) {
          if (lines[i].indexOf("### ") === 0) break;
          body.push(lines[i]);
          i++;
        }
        var bodyText = body.join("\n");

        // Extract status
        var status = "";
        var statusMatch = bodyText.match(/\*\*(Done|待审核|待复核|Blocked|Ready|Later|Human-assisted only|External)\*\*/);
        if (statusMatch) {
          status = statusMatch[1];
        } else {
          var phaseMatch = bodyText.match(/Status:\s*\*\*([^*]+)\*\*/);
          if (phaseMatch) status = phaseMatch[1].trim();
          else if (currentSection === "Done") status = "Done";
          else if (currentSection === "Ready") status = "Ready";
          else if (currentSection === "Blocked") status = "Blocked";
        }

        // Extract task doc and handoff
        var taskDoc = "";
        var handoff = "";
        var tdMatch = bodyText.match(/docs\/agent\/tasks\/([\w-]+)\.md/);
        if (tdMatch) taskDoc = "docs/agent/tasks/" + tdMatch[1] + ".md";
        var hoMatch = bodyText.match(/docs\/agent\/handoffs\/([\w-]+)\.md/);
        if (hoMatch) handoff = "docs/agent/handoffs/" + hoMatch[1] + ".md";

        // Derive task slug for priority lookup
        var slug = taskDoc ? taskDoc.match(/([\w-]+)\.md$/)?.[1] : "";
        var priority = slug && priorityMap[slug] ? priorityMap[slug] : "";

        // Check human-assisted
        var humanAssisted = /human.assisted/i.test(bodyText) || status === "Human-assisted only";

        // Check if map-related
        var isMap = /map.v2|map editor|map data|floor.plan|render workflow/i.test(title + bodyText);

        result.push({
          title: title,
          body: bodyText,
          section: currentSection,
          status: status,
          priority: priority,
          humanAssisted: humanAssisted || isMap,
          taskDoc: taskDoc,
          handoff: handoff,
          isMap: isMap
        });
      } else {
        i++;
      }
    }

    return result;
  }

  // Build sidebar filters
  function buildSidebar() {
    var sidebar = document.getElementById("sidebar");
    var html = '<input type="text" class="search-box" id="searchBox" placeholder="Search tasks...">';

    // Status filter
    var statuses = {};
    tasks.forEach(function (t) { if (t.status) statuses[t.status] = true; });
    html += '<h3>Status</h3>';
    Object.keys(STATUS_COLORS).forEach(function (s) {
      if (!statuses[s]) return;
      html += '<label><input type="checkbox" data-filter="status" value="' + s + '"> ' + s + '</label>';
    });

    // Priority filter
    html += '<h3>Priority</h3>';
    ["P0", "P1", "P2"].forEach(function (p) {
      var count = tasks.filter(function (t) { return t.priority === p; }).length;
      if (count === 0) return;
      html += '<label><input type="checkbox" data-filter="priority" value="' + p + '"> ' + p + ' (' + count + ')</label>';
    });
    html += '<label><input type="checkbox" data-filter="priority" value=""> Unassigned</label>';

    // Category filter
    html += '<h3>Category</h3>';
    CATEGORY_ORDER.forEach(function (c) {
      var count = tasks.filter(function (t) { return t.section === c; }).length;
      if (count === 0) return;
      html += '<label><input type="checkbox" data-filter="category" value="' + c + '"> ' + c + ' (' + count + ')</label>';
    });

    // Human-assisted toggle
    html += '<h3>Special</h3>';
    var humanCount = tasks.filter(function (t) { return t.humanAssisted; }).length;
    html += '<label><input type="checkbox" id="humanOnly"> Human-assisted only (' + humanCount + ')</label>';

    sidebar.innerHTML = html;

    // Event listeners
    document.getElementById("searchBox").addEventListener("input", function (e) {
      filters.search = e.target.value.toLowerCase();
      applyFilters();
    });
    document.getElementById("humanOnly").addEventListener("change", function (e) {
      filters.humanOnly = e.target.checked;
      applyFilters();
    });
    sidebar.querySelectorAll('input[data-filter]').forEach(function (el) {
      el.addEventListener("change", function () {
        var key = el.getAttribute("data-filter");
        if (el.checked) {
          filters[key].push(el.value);
        } else {
          filters[key] = filters[key].filter(function (v) { return v !== el.value; });
        }
        applyFilters();
      });
    });
  }

  // Apply filters
  function applyFilters() {
    filtered = tasks.filter(function (t) {
      if (filters.search && t.title.toLowerCase().indexOf(filters.search) < 0 && t.body.toLowerCase().indexOf(filters.search) < 0) return false;
      if (filters.status.length && filters.status.indexOf(t.status) < 0) return false;
      if (filters.priority.length && filters.priority.indexOf(t.priority) < 0) return false;
      if (filters.category.length && filters.category.indexOf(t.section) < 0) return false;
      if (filters.humanOnly && !t.humanAssisted) return false;
      return true;
    });
    sortTasks();
    renderTable();
    updateCounts();
  }

  // Sort
  function sortTasks() {
    filtered.sort(function (a, b) {
      var va = a[sortKey] || "";
      var vb = b[sortKey] || "";
      if (sortKey === "priority") {
        va = va || "Z";
        vb = vb || "Z";
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  // Render table
  function renderTable() {
    var tbody = document.getElementById("taskBody");
    var html = "";
    filtered.forEach(function (t, idx) {
      var selClass = selected === idx ? " selected" : "";
      html += '<tr data-idx="' + idx + '" class="' + selClass + '">';
      html += '<td>' + escHtml(t.title) + '</td>';
      html += '<td>' + statusBadge(t.status) + '</td>';
      html += '<td>' + (t.priority ? priorityBadge(t.priority) : '<span style="color:var(--muted)">—</span>') + '</td>';
      html += '<td style="font-size:12px;color:var(--muted)">' + escHtml(t.section) + '</td>';
      html += '<td>' + (t.humanAssisted ? '<span class="human-dot" title="Human-assisted only"></span>' : '') + '</td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        selected = parseInt(tr.getAttribute("data-idx"));
        renderTable();
        renderDetail();
      });
    });
  }

  // Render detail panel
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
    if (t.priority) html += priorityBadge(t.priority);
    if (t.humanAssisted) html += '<span class="badge badge-human">Human-assisted</span>';
    if (t.isMap) html += '<span class="badge badge-human">Map</span>';
    html += '</div>';

    if (t.taskDoc || t.handoff) {
      html += '<div class="detail-section"><h4>Links</h4><div class="detail-links">';
      if (t.taskDoc) html += '<a href="/' + t.taskDoc + '" target="_blank">Task: ' + escHtml(t.taskDoc) + '</a>';
      if (t.handoff) html += '<a href="/' + t.handoff + '" target="_blank">Handoff: ' + escHtml(t.handoff) + '</a>';
      html += '</div></div>';
    }

    html += '<div class="detail-section"><h4>Section</h4><div style="font-size:13px">' + escHtml(t.section) + '</div></div>';
    html += '<div class="detail-section"><h4>Content</h4><div class="detail-body">' + escHtml(t.body) + '</div></div>';

    panel.innerHTML = html;
  }

  // Update counts
  function updateCounts() {
    document.getElementById("countTotal").textContent = filtered.length + " / " + tasks.length;
    document.getElementById("countBlocked").textContent = tasks.filter(function (t) { return t.status === "Blocked"; }).length;
    document.getElementById("countHuman").textContent = tasks.filter(function (t) { return t.humanAssisted; }).length;

    var p0Items = tasks.filter(function (t) { return t.priority === "P0"; });
    var summary = p0Items.map(function (t) { return t.title; }).join(" → ");
    document.getElementById("queueSummary").textContent = "P0: " + (summary || "none");
  }

  // Helpers
  function statusBadge(s) {
    var cls = STATUS_COLORS[s] || "ready";
    return '<span class="badge badge-' + cls + '">' + escHtml(s || "—") + '</span>';
  }

  function priorityBadge(p) {
    return '<span class="badge badge-priority badge-' + p.toLowerCase() + '">' + escHtml(p) + '</span>';
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Sort column click
  document.querySelectorAll(".task-table th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.getAttribute("data-sort");
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      document.querySelectorAll(".task-table th").forEach(function (h) { h.classList.remove("sorted"); });
      th.classList.add("sorted");
      th.querySelector(".sort-arrow").innerHTML = sortAsc ? "&#x25B4;" : "&#x25BE;";
      sortTasks();
      renderTable();
    });
  });

  // Fetch and init
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
        '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--danger)">Failed to load task board: ' + escHtml(err.message) + '</td></tr>';
    });
})();
