/**
 * Money Calendar 기능 9 — 주간 단위 실천 리포트
 * 데일리 지출 기반 주차 합산, 월 예산 대비 달성률, 차주 제언(규칙 기반)
 */
(function () {
  "use strict";

  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";
  var BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";
  var SIM_PREFIX = "moneyCalendar.budgetSimulator.v1";

  function $(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error("#" + id);
    return el;
  }

  function monthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function today() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function monthKeyFromDate(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function parseDate(dateStr) {
    var p = String(dateStr || "").split("-");
    if (p.length < 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    if (!Number.isFinite(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatISODate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function startOfWeekMon(d) {
    var x = new Date(d.getTime());
    var dayNr = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dayNr);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function loadDailyMap() {
    try {
      var raw = localStorage.getItem(DAILY_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }

  function sumDayExpenses(day) {
    if (!day || !Array.isArray(day.txs)) return 0;
    var s = 0;
    for (var i = 0; i < day.txs.length; i++) {
      var t = day.txs[i];
      if (t && t.type === "expense") s += Math.max(0, Math.trunc(Number(t.amount) || 0));
    }
    return s;
  }

  function monthCap(mk) {
    try {
      var r = localStorage.getItem(BUDGET_PREFIX + "." + mk);
      if (r) {
        var o = JSON.parse(r);
        var a =
          Math.max(0, Math.trunc(Number(o.living) || 0)) +
          Math.max(0, Math.trunc(Number(o.activity) || 0)) +
          Math.max(0, Math.trunc(Number(o.essential) || 0));
        if (a > 0) return a;
      }
      var r2 = localStorage.getItem(SIM_PREFIX + "." + mk);
      if (r2) {
        var o2 = JSON.parse(r2);
        return Math.max(0, Math.trunc(Number(o2.total) || 0));
      }
    } catch {
      /* ignore */
    }
    return 0;
  }

  function isoWeekKey(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    d.setHours(0, 0, 0, 0);
    var dayNr = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNr + 3);
    var jan4 = new Date(d.getFullYear(), 0, 4);
    var week =
      1 +
      Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + "-W" + String(week).padStart(2, "0");
  }

  function render() {
    var base = /** @type {HTMLInputElement} */ ($("wk-date")).value || today();
    var baseD = parseDate(base);
    if (!baseD) baseD = parseDate(today());
    var mk = monthKeyFromDate(base);
    var weekKey = isoWeekKey(formatISODate(baseD));
    var start = startOfWeekMon(baseD);
    var end = new Date(start.getTime());
    end.setDate(start.getDate() + 6);

    var map = loadDailyMap();
    var host = $("wk-bars");
    host.textContent = "";
    var totalSpent = 0;
    var rows = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(start.getTime());
      d.setDate(start.getDate() + i);
      var ds = formatISODate(d);
      var day = map[ds];
      var exp = sumDayExpenses(day);
      totalSpent += exp;
      rows.push({ ds: ds, exp: exp });
    }

    var cap = monthCap(mk);
    var head = document.createElement("div");
    head.className = "wk-row";
    head.innerHTML =
      "<span class=\"text-sm\">" +
      weekKey +
      " (" +
      formatISODate(start) +
      " ~ " +
      formatISODate(end) +
      ")" +
      "</span>" +
      "<div class=\"wk-bar\"><span style=\"width:" +
      (cap > 0 ? Math.min(100, (totalSpent / cap) * 100) : 0) +
      "%\"></span></div>" +
      "<span class=\"text-sm num\">" +
      new Intl.NumberFormat("ko-KR").format(totalSpent) +
      "원</span>";
    host.appendChild(head);

    rows.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "wk-row";
      var pct = cap > 0 ? Math.min(100, (r.exp / cap) * 100) : 0;
      row.innerHTML =
        "<span class=\"text-sm\">" +
        r.ds +
        "</span>" +
        "<div class=\"wk-bar\"><span style=\"width:" +
        pct +
        "%\"></span></div>" +
        "<span class=\"text-sm num\">" +
        new Intl.NumberFormat("ko-KR").format(r.exp) +
        "원</span>";
      host.appendChild(row);
    });

    var cap2 = cap;
    var rateEl = $("wk-rate");
    if (cap2 <= 0) {
      rateEl.textContent = "이번 달 비교 기준(배분 예산 또는 시뮬레이터 총예산)이 없습니다.";
    } else {
      var rate = Math.min(100, (totalSpent / cap2) * 100);
      rateEl.textContent =
        "선택 주간 지출 " +
        new Intl.NumberFormat("ko-KR").format(totalSpent) +
        "원 · 기준 " +
        new Intl.NumberFormat("ko-KR").format(cap2) +
        "원 대비 " +
        rate.toFixed(1) +
        "%";
    }

    var tip = $("wk-tip");
    var lines = [];
    if (cap2 > 0 && totalSpent / cap2 > 0.95) {
      lines.push("이번 달 지출이 기준에 거의 도달했습니다. 다음 주는 카드·간편결제 알림을 켜 두고 소액 지출을 줄여 보세요.");
    } else if (cap2 > 0 && totalSpent / cap2 < 0.5) {
      lines.push("여유가 큽니다. 다음 주는 비전 저축이나 비상금으로 이월하는 방안을 검토해 보세요.");
    } else {
      lines.push("주간 식비·교통 항목을 데일리에서 태그로 묶어 보면 패턴이 드러납니다. 한 항목만 10% 줄이는 실험을 권합니다.");
    }
    tip.textContent = lines.join(" ");
  }

  function exportSnapshot() {
    if (typeof XLSX === "undefined") throw new Error("엑셀 라이브러리가 없습니다.");
    var base = /** @type {HTMLInputElement} */ ($("wk-date")).value || today();
    var mk = monthKeyFromDate(base);
    var map = loadDailyMap();
    var rows = [];
    Object.keys(map).forEach(function (ds) {
      if (isoWeekKey(ds) !== isoWeekKey(base)) return;
      rows.push({ date: ds, week: isoWeekKey(ds), expense: sumDayExpenses(map[ds]) });
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Weekly");
    XLSX.writeFile(wb, ExcelManager.makeFilename("WeeklyReport_" + mk.replace("-", "")));
  }

  function init() {
    /** @type {HTMLInputElement} */ ($("wk-date")).value = today();
    $("wk-date").max = today();
    $("wk-date").addEventListener("change", render);
    render();

    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: function () {
          exportSnapshot();
        },
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
