(function () {
  "use strict";

  var DEFAULT_STATUS_URL = "http://127.0.0.1:8787/_status";
  var DEFAULT_INTERVAL_MS = 5000;
  var HISTORY_WINDOW_MS = 30 * 60 * 1000;
  var MAX_EVENTS = 40;
  var KEY_COLORS = {
    "key-alpha": "#2563eb",
    "key-bravo": "#7c3aed",
    "key-charlie": "#0f766e"
  };

  var state = {
    timer: null,
    running: false,
    statusUrl: DEFAULT_STATUS_URL,
    intervalMs: DEFAULT_INTERVAL_MS,
    samples: [],
    seriesByKey: {},
    lastError: ""
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    els.statusUrlInput = document.getElementById("statusUrlInput");
    els.intervalSelect = document.getElementById("intervalSelect");
    els.startButton = document.getElementById("startButton");
    els.pauseButton = document.getElementById("pauseButton");
    els.clearButton = document.getElementById("clearButton");
    els.exportButton = document.getElementById("exportButton");
    els.metricGrid = document.getElementById("metricGrid");
    els.snapshotCards = document.getElementById("snapshotCards");
    els.warningsList = document.getElementById("warningsList");
    els.errorBlock = document.getElementById("errorBlock");
    els.connectionBadge = document.getElementById("connectionBadge");
    els.lastForwardValue = document.getElementById("lastForwardValue");
    els.lastSampleValue = document.getElementById("lastSampleValue");
    els.eventsBody = document.getElementById("eventsBody");
    els.pressureChart = document.getElementById("pressureChart");
    els.remainingChart = document.getElementById("remainingChart");
    els.parallelismChart = document.getElementById("parallelismChart");

    els.statusUrlInput.value = DEFAULT_STATUS_URL;
    els.intervalSelect.value = String(DEFAULT_INTERVAL_MS);

    els.startButton.addEventListener("click", startSampling);
    els.pauseButton.addEventListener("click", pauseSampling);
    els.clearButton.addEventListener("click", clearHistory);
    els.exportButton.addEventListener("click", exportJson);
    els.intervalSelect.addEventListener("change", function () {
      state.intervalMs = Number(els.intervalSelect.value) || DEFAULT_INTERVAL_MS;
      if (state.running) restartTimer();
    });
    els.statusUrlInput.addEventListener("change", function () {
      state.statusUrl = normalizeUrl(els.statusUrlInput.value) || DEFAULT_STATUS_URL;
      els.statusUrlInput.value = state.statusUrl;
      if (state.running) restartTimer();
    });

    renderAll();
  }

  function normalizeUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    try {
      return new URL(raw).toString();
    } catch (_) {
      return "";
    }
  }

  function startSampling() {
    state.statusUrl = normalizeUrl(els.statusUrlInput.value) || DEFAULT_STATUS_URL;
    els.statusUrlInput.value = state.statusUrl;
    state.intervalMs = Number(els.intervalSelect.value) || DEFAULT_INTERVAL_MS;
    state.running = true;
    updateConnectionBadge("sampling", "采样中");
    clearError();
    restartTimer();
    sampleNow();
  }

  function pauseSampling() {
    state.running = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    updateConnectionBadge("paused", state.samples.length ? "已暂停" : "未开始");
  }

  function restartTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(sampleNow, state.intervalMs);
  }

  function clearHistory() {
    state.samples = [];
    state.seriesByKey = {};
    state.lastError = "";
    clearError();
    renderAll();
  }

  function exportJson() {
    var blob = new Blob([
      JSON.stringify(
        {
          statusUrl: state.statusUrl,
          intervalMs: state.intervalMs,
          exportedAt: new Date().toISOString(),
          samples: state.samples
        },
        null,
        2
      )
    ], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "claude-balancer-monitor-history.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function sampleNow() {
    try {
      var response = await fetch(state.statusUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
      var payload = await response.json();
      ingestSample(payload);
      clearError();
      updateConnectionBadge(payload.trustedLoad ? "ok" : "warn", payload.trustedLoad ? "已连接" : "未可信");
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      showError(state.lastError);
      updateConnectionBadge("error", "采样失败");
    }
  }

  function ingestSample(payload) {
    var now = Date.now();
    var balancer = payload && payload.balancer ? payload.balancer : {};
    var sample = {
      timestamp: now,
      trustedLoad: Boolean(payload && payload.trustedLoad),
      queriedBalance: Boolean(payload && payload.queriedBalance),
      recommendedParallelism: payload && payload.recommendedParallelism != null ? Number(payload.recommendedParallelism) : null,
      chosenKey: payload && payload.chosenKey ? payload.chosenKey.label : "",
      lastForwardKey: payload && payload.lastForward ? payload.lastForward.label : "",
      lastForwardAt: payload && payload.lastForward ? Number(payload.lastForward.at || 0) : 0,
      warnings: Array.isArray(payload && payload.warnings) ? payload.warnings.slice() : [],
      balancingMode: String(balancer.mode || ""),
      pollTtlMs: balancer.pollTtlMs == null ? null : Number(balancer.pollTtlMs),
      healthyPrimaryKeys: balancer.healthyPrimaryKeys == null ? null : Number(balancer.healthyPrimaryKeys),
      pressureSpread: balancer.pressureSpread == null ? null : Number(balancer.pressureSpread),
      snapshots: Array.isArray(payload && payload.snapshots) ? payload.snapshots.map(copySnapshot) : []
    };

    state.samples.push(sample);
    pruneHistory(now);
    rebuildSeries();
    renderAll(payload, sample);
  }

  function copySnapshot(item) {
    return {
      label: String(item.label || ""),
      pressure: Number(item.pressure || 0),
      usedCalls: Number(item.usedCalls || 0),
      remainingCalls: Number(item.remainingCalls || 0),
      limit: Number(item.limit || 0),
      nearLimit: Boolean(item.nearLimit),
      hardLimit: Boolean(item.hardLimit),
      source: String(item.source || ""),
      localWindowUsedCalls: item.localWindowUsedCalls == null ? null : Number(item.localWindowUsedCalls || 0),
      remainingRatio: item.remainingRatio == null ? null : Number(item.remainingRatio || 0),
      snapshotAgeMs: item.snapshotAgeMs == null ? null : Number(item.snapshotAgeMs || 0),
      eligibility: String(item.eligibility || ""),
      recentForwardCount: item.recentForwardCount == null ? null : Number(item.recentForwardCount || 0)
    };
  }

  function pruneHistory(now) {
    var cutoff = now - HISTORY_WINDOW_MS;
    state.samples = state.samples.filter(function (item) {
      return item.timestamp >= cutoff;
    });
    if (state.samples.length > 720) {
      state.samples = state.samples.slice(state.samples.length - 720);
    }
  }

  function rebuildSeries() {
    state.seriesByKey = {};
    state.samples.forEach(function (sample) {
      sample.snapshots.forEach(function (snapshot) {
        if (!state.seriesByKey[snapshot.label]) state.seriesByKey[snapshot.label] = [];
        state.seriesByKey[snapshot.label].push({
          timestamp: sample.timestamp,
          pressure: snapshot.pressure,
          usedCalls: snapshot.usedCalls,
          remainingCalls: snapshot.remainingCalls,
          limit: snapshot.limit
        });
      });
    });
  }

  function renderAll(payload, latestSample) {
    renderMetrics(payload, latestSample);
    renderWarnings(payload, latestSample);
    renderSnapshots(payload, latestSample);
    renderEvents();
    renderCharts();
  }

  function renderMetrics(payload, latestSample) {
    var sample = latestSample || state.samples[state.samples.length - 1] || null;
    var snapshots = sample ? sample.snapshots : [];
    var maxPressure = snapshots.length ? Math.max.apply(null, snapshots.map(function (item) { return item.pressure; })) : 0;
    var minRemaining = snapshots.length ? Math.min.apply(null, snapshots.map(function (item) { return item.remainingCalls; })) : 0;

    var metrics = [
      {
        label: "推荐并发",
        value: sample && sample.recommendedParallelism != null ? String(sample.recommendedParallelism) : "—",
        hint: sample && sample.trustedLoad ? "trusted load" : "waiting"
      },
      {
        label: "调度模式",
        value: sample && sample.balancingMode ? sample.balancingMode : "—",
        hint: sample && sample.pollTtlMs != null ? ("TTL " + sample.pollTtlMs + "ms") : "—"
      },
      {
        label: "当前选中 key",
        value: sample && sample.chosenKey ? sample.chosenKey : "—",
        hint: payload && payload.chosenKey ? payload.chosenKey.maskedKey || "" : ""
      },
      {
        label: "健康主 key",
        value: sample && sample.healthyPrimaryKeys != null ? String(sample.healthyPrimaryKeys) : "—",
        hint: sample && sample.pressureSpread != null ? ("spread " + formatPercent(sample.pressureSpread)) : "—"
      },
      {
        label: "最高压力",
        value: formatPercent(maxPressure),
        hint: snapshots.length ? "max(snapshot.pressure)" : "—"
      },
      {
        label: "最少剩余额度",
        value: snapshots.length ? String(minRemaining) : "—",
        hint: snapshots.length ? "min(snapshot.remainingCalls)" : "—"
      },
      {
        label: "采样点",
        value: String(state.samples.length),
        hint: "最近 30 分钟"
      },
      {
        label: "负载可信",
        value: sample ? (sample.trustedLoad ? "是" : "否") : "—",
        hint: sample ? (sample.queriedBalance ? "queriedBalance=true" : "queriedBalance=false") : "—"
      }
    ];

    els.metricGrid.innerHTML = metrics.map(function (metric) {
      return "<div class=\"metric-card\">" +
        "<span class=\"metric-label\">" + escapeHtml(metric.label) + "</span>" +
        "<div class=\"metric-value\">" + escapeHtml(metric.value) + "</div>" +
        "<div class=\"metric-hint\">" + escapeHtml(metric.hint) + "</div>" +
      "</div>";
    }).join("");

    els.lastForwardValue.textContent = sample && sample.lastForwardKey
      ? sample.lastForwardKey + (sample.lastForwardAt ? " · " + formatTime(sample.lastForwardAt) : "")
      : "—";
    els.lastSampleValue.textContent = sample ? formatDateTime(sample.timestamp) : "—";
  }

  function renderWarnings(payload, latestSample) {
    var sample = latestSample || state.samples[state.samples.length - 1] || null;
    var warnings = sample ? sample.warnings : [];
    if (!warnings.length) {
      els.warningsList.innerHTML = "<li>暂无</li>";
      return;
    }
    els.warningsList.innerHTML = warnings.map(function (warning) {
      return "<li>" + escapeHtml(warning) + "</li>";
    }).join("");
  }

  function renderSnapshots(payload, latestSample) {
    var sample = latestSample || state.samples[state.samples.length - 1] || null;
    var snapshots = sample ? sample.snapshots : [];
    if (!snapshots.length) {
      els.snapshotCards.innerHTML = "<div class=\"snapshot-card\">暂无快照</div>";
      return;
    }

    els.snapshotCards.innerHTML = snapshots.map(function (snapshot) {
      var badgeClass = snapshot.hardLimit ? "badge-error" : snapshot.nearLimit ? "badge-warn" : snapshot.eligibility === "deprioritized" ? "badge-warn" : "badge-ok";
      var badgeLabel = snapshot.hardLimit ? "hard" : snapshot.eligibility ? snapshot.eligibility : (snapshot.source || "ok");
      return "<article class=\"snapshot-card\">" +
        "<header>" +
          "<div>" +
            "<div class=\"snapshot-title\">" + escapeHtml(snapshot.label) + "</div>" +
            "<div class=\"snapshot-subtitle\">source: " + escapeHtml(snapshot.source || "—") + "</div>" +
          "</div>" +
          "<span class=\"badge " + badgeClass + "\">" + escapeHtml(badgeLabel) + "</span>" +
        "</header>" +
        "<div class=\"snapshot-stats\">" +
          statCell("压力", formatPercent(snapshot.pressure)) +
          statCell("已用 / 总额", snapshot.usedCalls + " / " + snapshot.limit) +
          statCell("剩余", String(snapshot.remainingCalls)) +
          statCell("剩余比例", snapshot.remainingRatio == null ? "—" : formatPercent(snapshot.remainingRatio)) +
          statCell("本地窗口", snapshot.localWindowUsedCalls == null ? "—" : String(snapshot.localWindowUsedCalls)) +
          statCell("近60s本地转发", snapshot.recentForwardCount == null ? "—" : String(snapshot.recentForwardCount)) +
          statCell("快照年龄", snapshot.snapshotAgeMs == null ? "—" : String(Math.round(snapshot.snapshotAgeMs / 1000)) + "s") +
          statCell("资格", snapshot.eligibility || "—") +
        "</div>" +
      "</article>";
    }).join("");
  }

  function statCell(label, value) {
    return "<div class=\"snapshot-stat\"><span class=\"meta-label\">" + escapeHtml(label) + "</span><strong>" + escapeHtml(value) + "</strong></div>";
  }

  function renderEvents() {
    if (!state.samples.length) {
      els.eventsBody.innerHTML = "<tr><td colspan=\"7\" class=\"events-empty\">暂无采样记录</td></tr>";
      return;
    }

    var rows = state.samples.slice(-MAX_EVENTS).reverse().map(function (sample) {
      var maxPressure = sample.snapshots.length
        ? Math.max.apply(null, sample.snapshots.map(function (item) { return item.pressure; }))
        : 0;
      return "<tr>" +
        "<td>" + escapeHtml(formatDateTime(sample.timestamp)) + "</td>" +
        "<td>" + escapeHtml(sample.chosenKey || "—") + "</td>" +
        "<td>" + escapeHtml(sample.lastForwardKey || "—") + "</td>" +
        "<td>" + escapeHtml(sample.recommendedParallelism == null ? "—" : String(sample.recommendedParallelism)) + "</td>" +
        "<td>" + escapeHtml(sample.balancingMode || "—") + "</td>" +
        "<td>" + escapeHtml(sample.pollTtlMs == null ? "—" : (String(sample.pollTtlMs) + "ms")) + "</td>" +
        "<td>" + escapeHtml(formatPercent(maxPressure)) + "</td>" +
      "</tr>";
    });
    els.eventsBody.innerHTML = rows.join("");
  }

  function renderCharts() {
    renderMultiLineChart(els.pressureChart, {
      title: "pressure",
      series: buildSeries(function (point) { return point.pressure; }),
      yMin: 0,
      yMax: 1,
      valueFormatter: formatPercent
    });

    var maxRemaining = 0;
    Object.keys(state.seriesByKey).forEach(function (key) {
      state.seriesByKey[key].forEach(function (point) {
        if (point.remainingCalls > maxRemaining) maxRemaining = point.remainingCalls;
      });
    });

    renderMultiLineChart(els.remainingChart, {
      title: "remainingCalls",
      series: buildSeries(function (point) { return point.remainingCalls; }),
      yMin: 0,
      yMax: maxRemaining || 1,
      valueFormatter: function (value) { return Math.round(value).toString(); }
    });

    renderMultiLineChart(els.parallelismChart, {
      title: "recommendedParallelism",
      series: [
        {
          key: "parallelism",
          color: "#dc2626",
          points: state.samples
            .filter(function (sample) { return sample.recommendedParallelism != null; })
            .map(function (sample) {
              return { timestamp: sample.timestamp, value: sample.recommendedParallelism };
            })
        }
      ],
      yMin: 0,
      yMax: Math.max(4, maxRecommendedParallelism()),
      valueFormatter: function (value) { return String(Math.round(value)); }
    });
  }

  function buildSeries(selector) {
    return Object.keys(state.seriesByKey).sort().map(function (key) {
      return {
        key: key,
        color: KEY_COLORS[key] || randomColor(key),
        points: state.seriesByKey[key].map(function (point) {
          return { timestamp: point.timestamp, value: selector(point) };
        })
      };
    });
  }

  function maxRecommendedParallelism() {
    var max = 0;
    state.samples.forEach(function (sample) {
      if (sample.recommendedParallelism != null && sample.recommendedParallelism > max) {
        max = sample.recommendedParallelism;
      }
    });
    return max;
  }

  function renderMultiLineChart(svg, options) {
    var width = 960;
    var height = Number(svg.getAttribute("viewBox").split(" ")[3] || 260);
    var padding = { top: 20, right: 20, bottom: 28, left: 56 };
    var innerWidth = width - padding.left - padding.right;
    var innerHeight = height - padding.top - padding.bottom;
    var series = options.series || [];
    var points = [];

    series.forEach(function (item) {
      item.points.forEach(function (point) {
        points.push(point);
      });
    });

    if (!points.length) {
      svg.innerHTML = emptyChartMarkup(width, height, "暂无数据");
      return;
    }

    var xMin = points[0].timestamp;
    var xMax = points[points.length - 1].timestamp;
    if (xMin === xMax) xMax += 1;
    var yMin = options.yMin;
    var yMax = options.yMax <= options.yMin ? options.yMin + 1 : options.yMax;

    var parts = [
      "<rect x=\"0\" y=\"0\" width=\"" + width + "\" height=\"" + height + "\" fill=\"#ffffff\"></rect>",
      gridLines(width, height, padding, innerWidth, innerHeight, yMin, yMax, options.valueFormatter)
    ];

    series.forEach(function (item) {
      if (!item.points.length) return;
      parts.push("<path d=\"" + linePath(item.points, xMin, xMax, yMin, yMax, padding, innerWidth, innerHeight) + "\" fill=\"none\" stroke=\"" + item.color + "\" stroke-width=\"3\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>");
    });

    parts.push("<line x1=\"" + padding.left + "\" y1=\"" + (padding.top + innerHeight) + "\" x2=\"" + (padding.left + innerWidth) + "\" y2=\"" + (padding.top + innerHeight) + "\" stroke=\"#94a3b8\" stroke-width=\"1\"></line>");
    parts.push("<line x1=\"" + padding.left + "\" y1=\"" + padding.top + "\" x2=\"" + padding.left + "\" y2=\"" + (padding.top + innerHeight) + "\" stroke=\"#94a3b8\" stroke-width=\"1\"></line>");
    parts.push(timeLabels(xMin, xMax, padding, innerWidth, height));
    parts.push(legendMarkup(series, width, height));

    svg.innerHTML = parts.join("");
  }

  function gridLines(width, height, padding, innerWidth, innerHeight, yMin, yMax, formatter) {
    var lines = [];
    var ticks = 4;
    for (var index = 0; index <= ticks; index += 1) {
      var ratio = index / ticks;
      var y = padding.top + innerHeight - innerHeight * ratio;
      var value = yMin + (yMax - yMin) * ratio;
      lines.push("<line x1=\"" + padding.left + "\" y1=\"" + y + "\" x2=\"" + (padding.left + innerWidth) + "\" y2=\"" + y + "\" stroke=\"#e2e8f0\" stroke-width=\"1\"></line>");
      lines.push("<text x=\"" + (padding.left - 8) + "\" y=\"" + (y + 4) + "\" fill=\"#64748b\" font-size=\"11\" text-anchor=\"end\">" + escapeHtml(formatter(value)) + "</text>");
    }
    return lines.join("");
  }

  function linePath(points, xMin, xMax, yMin, yMax, padding, innerWidth, innerHeight) {
    return points.map(function (point, index) {
      var x = padding.left + innerWidth * ((point.timestamp - xMin) / (xMax - xMin));
      var y = padding.top + innerHeight - innerHeight * ((point.value - yMin) / (yMax - yMin || 1));
      return (index === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
    }).join(" ");
  }

  function timeLabels(xMin, xMax, padding, innerWidth, height) {
    var steps = 4;
    var nodes = [];
    for (var index = 0; index <= steps; index += 1) {
      var ratio = index / steps;
      var x = padding.left + innerWidth * ratio;
      var value = xMin + (xMax - xMin) * ratio;
      nodes.push("<text x=\"" + x + "\" y=\"" + (height - 8) + "\" fill=\"#64748b\" font-size=\"11\" text-anchor=\"middle\">" + escapeHtml(formatTime(value)) + "</text>");
    }
    return nodes.join("");
  }

  function legendMarkup(series, width) {
    var x = 18;
    return series.map(function (item) {
      var markup = "<g transform=\"translate(" + x + ", 8)\"><circle cx=\"0\" cy=\"0\" r=\"5\" fill=\"" + item.color + "\"></circle><text x=\"10\" y=\"4\" fill=\"#475569\" font-size=\"12\">" + escapeHtml(item.key) + "</text></g>";
      x += Math.min(180, item.key.length * 8 + 34);
      return markup;
    }).join("");
  }

  function emptyChartMarkup(width, height, label) {
    return "<rect x=\"0\" y=\"0\" width=\"" + width + "\" height=\"" + height + "\" fill=\"#ffffff\"></rect>" +
      "<text x=\"50%\" y=\"50%\" text-anchor=\"middle\" fill=\"#94a3b8\" font-size=\"14\">" + escapeHtml(label) + "</text>";
  }

  function updateConnectionBadge(mode, label) {
    var className = "badge badge-muted";
    if (mode === "ok") className = "badge badge-ok";
    else if (mode === "warn" || mode === "sampling" || mode === "paused") className = "badge badge-warn";
    else if (mode === "error") className = "badge badge-error";
    els.connectionBadge.className = className;
    els.connectionBadge.textContent = label;
  }

  function clearError() {
    state.lastError = "";
    els.errorBlock.hidden = true;
    els.errorBlock.textContent = "";
  }

  function showError(message) {
    els.errorBlock.hidden = false;
    els.errorBlock.textContent = message;
  }

  function formatPercent(value) {
    return (Number(value || 0) * 100).toFixed(1) + "%";
  }

  function formatTime(value) {
    var date = new Date(Number(value || 0));
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  }

  function formatDateTime(value) {
    var date = new Date(Number(value || 0));
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function randomColor(seed) {
    var hash = 0;
    String(seed || "").split("").forEach(function (char) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    });
    var hue = Math.abs(hash) % 360;
    return "hsl(" + hue + " 70% 45%)";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
