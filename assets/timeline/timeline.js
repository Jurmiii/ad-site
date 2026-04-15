/**
 * Money Calendar 기능 11 — 과거 데이터 타임라인
 */
(function () {
  "use strict";

  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";

  function loadMap() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function sumMonth(map, mk) {
    var t = 0;
    Object.keys(map).forEach(function (ds) {
      if (ds.slice(0, 7) !== mk) return;
      var day = map[ds];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (x) {
        if (x && x.type === "expense") t += Math.max(0, Math.trunc(Number(x.amount) || 0));
      });
    });
    return t;
  }

  function monthKeysLast12() {
    var out = [];
    var d = new Date();
    for (var i = 11; i >= 0; i--) {
      var u = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(u.getFullYear() + "-" + String(u.getMonth() + 1).padStart(2, "0"));
    }
    return out;
  }

  function draw() {
    var map = loadMap();
    var keys = monthKeysLast12();
    var vals = keys.map(function (k) {
      return sumMonth(map, k);
    });
    var c = /** @type {HTMLCanvasElement} */ (document.getElementById("tl-canvas"));
    var ctx = c.getContext("2d");
    var wrap = c.parentElement;
    var cw = wrap ? wrap.clientWidth : 900;
    var w = (c.width = Math.min(900, Math.max(280, cw - 32)));
    var h = (c.height = 320);
    ctx.clearRect(0, 0, w, h);
    var maxV = Math.max(1, Math.max.apply(null, vals));
    var pad = 36;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border-default") || "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
    var col = getComputedStyle(document.documentElement).getPropertyValue("--color-primary") || "#22c55e";
    ctx.strokeStyle = col.trim() || "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    keys.forEach(function (_, i) {
      var x = pad + ((w - 2 * pad) * i) / (keys.length - 1 || 1);
      var y = h - pad - ((h - 2 * pad) * vals[i]) / maxV;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-text-muted") || "#64748b";
    keys.forEach(function (k, i) {
      if (i % 2 !== 0) return;
      var x = pad + ((w - 2 * pad) * i) / (keys.length - 1 || 1);
      ctx.font = "11px sans-serif";
      ctx.fillText(k.slice(2), x - 14, h - 12);
    });
    document.getElementById("tl-legend").textContent =
      "최댓값 " + maxV.toLocaleString() + "원 기준 스케일 · 단위: 월 합계 지출";
  }

  function exportXlsx() {
    var map = loadMap();
    var keys = monthKeysLast12();
    var rows = keys.map(function (k) {
      return { month: k, expenseTotal: sumMonth(map, k) };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Timeline");
    XLSX.writeFile(wb, ExcelManager.makeFilename("Timeline12m"));
  }

  function init() {
    draw();
    requestAnimationFrame(draw);
    window.addEventListener("resize", draw);
    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: exportXlsx,
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
