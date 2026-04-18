/**
 * Money Calendar 기능 11 — 과거 데이터 타임라인
 * 선택한 달의 일별 지출·수입 흐름(선 그래프)
 */
(function () {
  "use strict";

  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";

  /** @type {string} */
  var selectedMonth = "";

  function loadMap() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function sumDayExpense(day) {
    if (!day || !Array.isArray(day.txs)) return 0;
    var s = 0;
    for (var i = 0; i < day.txs.length; i++) {
      var x = day.txs[i];
      if (x && x.type === "expense") s += Math.max(0, Math.trunc(Number(x.amount) || 0));
    }
    return s;
  }

  function sumDayIncome(day) {
    if (!day || !Array.isArray(day.txs)) return 0;
    var s = 0;
    for (var i = 0; i < day.txs.length; i++) {
      var x = day.txs[i];
      if (x && x.type === "income") s += Math.max(0, Math.trunc(Number(x.amount) || 0));
    }
    return s;
  }

  function monthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function shiftMonth(mk, delta) {
    var p = String(mk || "").split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthNow();
    var d = new Date(y, m + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function daysInMonthKey(mk) {
    var p = String(mk || "").split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
    return new Date(y, m + 1, 0).getDate();
  }

  function formatMonthTitle(mk) {
    var p = String(mk || "").split("-");
    if (p.length < 2) return mk;
    return p[0] + "년 " + parseInt(p[1], 10) + "월";
  }

  function minViewMonthKey() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function clampMonthRange(mk) {
    var lo = minViewMonthKey();
    var hi = monthNow();
    var s = String(mk || "");
    if (s < lo) return lo;
    if (s > hi) return hi;
    return s;
  }

  function draw() {
    var map = loadMap();
    if (!selectedMonth) selectedMonth = monthNow();
    selectedMonth = clampMonthRange(selectedMonth);
    var dim = daysInMonthKey(selectedMonth);

    var expenses = [];
    var incomes = [];
    for (var day = 1; day <= dim; day++) {
      var ds = selectedMonth + "-" + String(day).padStart(2, "0");
      var dayObj = map[ds];
      expenses.push(sumDayExpense(dayObj));
      incomes.push(sumDayIncome(dayObj));
    }

    var maxV = Math.max(1, Math.max.apply(null, expenses.concat(incomes)));

    var c = /** @type {HTMLCanvasElement} */ (document.getElementById("tl-canvas"));
    var ctx = c.getContext("2d");
    if (!ctx) return;
    var wrap = c.parentElement;
    var cw = wrap ? wrap.clientWidth : 900;
    var w = (c.width = Math.min(900, Math.max(280, cw - 32)));
    var h = (c.height = 340);
    ctx.clearRect(0, 0, w, h);

    var padL = 52;
    var padR = 14;
    var padT = 24;
    var padB = 40;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;

    var border =
      getComputedStyle(document.documentElement).getPropertyValue("--border-default").trim() || "#e2e8f0";
    var colExp =
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#22c55e";
    var colInc =
      getComputedStyle(document.documentElement).getPropertyValue("--color-income").trim() || "#3b82f6";
    var muted =
      getComputedStyle(document.documentElement).getPropertyValue("--color-text-muted").trim() || "#64748b";

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.stroke();

    ctx.fillStyle = muted;
    ctx.font = "10px sans-serif";
    for (var g = 0; g <= 4; g++) {
      var gv = (maxV * g) / 4;
      var gy = h - padB - (innerH * g) / 4;
      ctx.fillText(Math.round(gv).toLocaleString("ko-KR"), 4, gy + 4);
    }

    function xAt(i) {
      if (dim <= 1) return padL + innerW / 2;
      return padL + (innerW * i) / (dim - 1);
    }

    function yAt(v) {
      return h - padB - (innerH * v) / maxV;
    }

    function drawSeries(vals, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      for (var i = 0; i < vals.length; i++) {
        var x = xAt(i);
        var y = yAt(vals[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = colorWithAlpha(border, 0.45);
    for (var gg = 1; gg <= 3; gg++) {
      var gyy = h - padB - (innerH * gg) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, gyy);
      ctx.lineTo(w - padR, gyy);
      ctx.stroke();
    }

    drawSeries(expenses, colExp);
    drawSeries(incomes, colInc);

    ctx.fillStyle = muted;
    for (var lx = 0; lx < dim; lx++) {
      var dayNum = lx + 1;
      if (dayNum !== 1 && dayNum !== dim && dayNum % 5 !== 0) continue;
      var xxx = xAt(lx);
      ctx.fillText(String(dayNum), xxx - (dayNum >= 10 ? 6 : 3), h - 18);
    }

    var leg = document.getElementById("tl-legend");
    if (leg) {
      leg.innerHTML =
        "<span style=\"color:" +
        colExp +
        ";font-weight:800\">● 지출</span> 일별 합계 · " +
        "<span style=\"color:" +
        colInc +
        ";font-weight:800\">● 수입</span> 일별 합계 · Y최댓값 " +
        maxV.toLocaleString() +
        "원";
    }

    var label = document.getElementById("tl-month");
    if (label) label.textContent = formatMonthTitle(selectedMonth);

    var yrSync = document.getElementById("tl-pick-year");
    var moSync = document.getElementById("tl-pick-month");
    if (yrSync && moSync) {
      var pp = selectedMonth.split("-");
      yrSync.value = pp[0];
      moSync.value = String(parseInt(pp[1], 10));
    }

    var prevBtn = document.getElementById("tl-prev");
    if (prevBtn) prevBtn.disabled = selectedMonth <= minViewMonthKey();
    var nextBtn = document.getElementById("tl-next");
    if (nextBtn) nextBtn.disabled = selectedMonth >= monthNow();
  }

  function colorWithAlpha(hexOrCss, a) {
    var s = String(hexOrCss || "").trim();
    if (s.indexOf("#") === 0 && s.length === 7) {
      var r = parseInt(s.slice(1, 3), 16);
      var g = parseInt(s.slice(3, 5), 16);
      var b = parseInt(s.slice(5, 7), 16);
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }
    if (s.indexOf("rgb(") === 0 && s.indexOf("rgba(") !== 0) {
      return s.replace("rgb(", "rgba(").replace(")", ", " + a + ")");
    }
    return s;
  }

  function exportXlsx() {
    var map = loadMap();
    var mk = selectedMonth || monthNow();
    var dim = daysInMonthKey(mk);
    var rows = [];
    for (var d = 1; d <= dim; d++) {
      var ds = mk + "-" + String(d).padStart(2, "0");
      var day = map[ds];
      rows.push({
        date: ds,
        expense: sumDayExpense(day),
        income: sumDayIncome(day),
      });
    }
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Daily");
    XLSX.writeFile(wb, ExcelManager.makeFilename("Timeline_" + mk.replace("-", "")));
  }

  function init() {
    selectedMonth = monthNow();
    var loMk = minViewMonthKey();
    var hiMk = monthNow();
    var yrSel = document.getElementById("tl-pick-year");
    var moSel = document.getElementById("tl-pick-month");
    if (yrSel && moSel) {
      var loY = parseInt(loMk.split("-")[0], 10);
      var hiY = parseInt(hiMk.split("-")[0], 10);
      yrSel.innerHTML = "";
      for (var yy = loY; yy <= hiY; yy++) {
        var yOpt = document.createElement("option");
        yOpt.value = String(yy);
        yOpt.textContent = yy + "년";
        yrSel.appendChild(yOpt);
      }
      moSel.innerHTML = "";
      for (var mm = 1; mm <= 12; mm++) {
        var mOpt = document.createElement("option");
        mOpt.value = String(mm);
        mOpt.textContent = mm + "월";
        moSel.appendChild(mOpt);
      }
    }

    var monthBtn = document.getElementById("tl-month");
    var dropdown = document.getElementById("tl-month-dropdown");
    var applyBtn = document.getElementById("tl-month-apply");
    function closeTlDropdown() {
      if (dropdown) dropdown.classList.add("is-hidden");
      if (monthBtn) monthBtn.setAttribute("aria-expanded", "false");
    }
    if (monthBtn && dropdown) {
      monthBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (!dropdown.classList.contains("is-hidden")) {
          closeTlDropdown();
          return;
        }
        dropdown.classList.remove("is-hidden");
        monthBtn.setAttribute("aria-expanded", "true");
        setTimeout(function () {
          function onDoc(ev2) {
            var t = /** @type {Node} */ (ev2.target);
            if (dropdown.contains(t) || monthBtn.contains(t)) return;
            closeTlDropdown();
            document.removeEventListener("mousedown", onDoc, true);
          }
          document.addEventListener("mousedown", onDoc, true);
        }, 0);
      });
    }
    if (applyBtn && yrSel && moSel) {
      applyBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var ny = parseInt(yrSel.value, 10);
        var nm = parseInt(moSel.value, 10);
        selectedMonth = clampMonthRange(ny + "-" + String(nm).padStart(2, "0"));
        closeTlDropdown();
        draw();
      });
    }

    var prev = document.getElementById("tl-prev");
    var next = document.getElementById("tl-next");
    if (prev) {
      prev.addEventListener("click", function () {
        selectedMonth = clampMonthRange(shiftMonth(selectedMonth, -1));
        draw();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        selectedMonth = clampMonthRange(shiftMonth(selectedMonth, +1));
        draw();
      });
    }
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
