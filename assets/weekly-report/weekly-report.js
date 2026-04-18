/**
 * Money Calendar 기능 9 — 주간 단위 실천 리포트
 * 달력 월 기준으로 7일 단위(월 내 N주차) 합산, 일별 아코디언, 월 예산 대비 요약
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

  function minMonthThreeYears() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function monthKeyFromDate(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function parseMonthKey(mk) {
    var p = String(mk || "").split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return null;
    return { y: y, m0: m };
  }

  function daysInMonth(y, m0) {
    return new Date(y, m0 + 1, 0).getDate();
  }

  /** 달 내 7일 단위 주차 분할 (1주차=1~7일, 말일까지) */
  function monthWeekBuckets(lastDay) {
    var buckets = [];
    var start = 1;
    var weekNum = 0;
    while (start <= lastDay) {
      weekNum++;
      var end = Math.min(start + 6, lastDay);
      buckets.push({ weekNum: weekNum, start: start, end: end });
      start = end + 1;
    }
    return buckets;
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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function render() {
    var mk = /** @type {HTMLInputElement} */ ($("wk-month")).value || monthNow();
    var pm = parseMonthKey(mk);
    if (!pm) return;

    var y = pm.y;
    var m0 = pm.m0;
    var last = daysInMonth(y, m0);
    var map = loadDailyMap();
    var cap = monthCap(mk);
    var buckets = monthWeekBuckets(last);

    var monthTotal = 0;
    for (var di = 1; di <= last; di++) {
      var dstr = y + "-" + pad2(m0 + 1) + "-" + pad2(di);
      monthTotal += sumDayExpenses(map[dstr]);
    }

    var host = $("wk-bars");
    host.textContent = "";

    buckets.forEach(function (b) {
      var dayRows = [];
      var total = 0;
      for (var d = b.start; d <= b.end; d++) {
        var ds = y + "-" + pad2(m0 + 1) + "-" + pad2(d);
        var exp = sumDayExpenses(map[ds]);
        total += exp;
        dayRows.push({ ds: ds, exp: exp });
      }

      var det = document.createElement("details");
      det.className = "wk-week";

      var sum = document.createElement("summary");
      sum.className = "wk-week-sum";
      var barPct = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
      sum.innerHTML =
        "<span class=\"wk-week-sum__label\">[" +
        (m0 + 1) +
        "월 " +
        b.weekNum +
        "주차(" +
        b.start +
        "일~" +
        b.end +
        "일)]</span>" +
        "<span class=\"wk-week-sum__bar\" role=\"presentation\"><span style=\"width:" +
        barPct +
        "%\"></span></span>" +
        "<span class=\"wk-week-sum__amt num\">" +
        new Intl.NumberFormat("ko-KR").format(total) +
        "원</span>" +
        "<span class=\"wk-week-sum__chev\" aria-hidden=\"true\">▾</span>";

      var body = document.createElement("div");
      body.className = "wk-week-body";
      dayRows.forEach(function (r) {
        var row = document.createElement("div");
        row.className = "wk-day-row";
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
        body.appendChild(row);
      });

      det.appendChild(sum);
      det.appendChild(body);
      host.appendChild(det);
    });

    var cap2 = cap;
    var rateEl = $("wk-rate");
    if (cap2 <= 0) {
      rateEl.textContent =
        "선택한 달의 비교 기준(배분 예산 또는 시뮬레이터 총예산)이 없습니다. 월 누적 지출 " +
        new Intl.NumberFormat("ko-KR").format(monthTotal) +
        "원입니다.";
    } else {
      var rate = Math.min(100, (monthTotal / cap2) * 100);
      rateEl.textContent =
        "이번 달(" +
        (m0 + 1) +
        "월) 누적 지출 " +
        new Intl.NumberFormat("ko-KR").format(monthTotal) +
        "원 · 기준 " +
        new Intl.NumberFormat("ko-KR").format(cap2) +
        "원 대비 " +
        rate.toFixed(1) +
        "%";
    }

    var tip = $("wk-tip");
    var lines = [];
    if (cap2 > 0 && monthTotal / cap2 > 0.95) {
      lines.push("이번 달 지출이 기준에 거의 도달했습니다. 다음 주는 카드·간편결제 알림을 켜 두고 소액 지출을 줄여 보세요.");
    } else if (cap2 > 0 && monthTotal / cap2 < 0.5) {
      lines.push("여유가 큽니다. 다음 주는 비전 저축이나 비상금으로 이월하는 방안을 검토해 보세요.");
    } else {
      lines.push("주간 식비·교통 항목을 데일리에서 태그로 묶어 보면 패턴이 드러납니다. 한 항목만 10% 줄이는 실험을 권합니다.");
    }
    tip.textContent = lines.join(" ");
  }

  function exportSnapshot() {
    if (typeof XLSX === "undefined") throw new Error("엑셀 라이브러리가 없습니다.");
    var mk = /** @type {HTMLInputElement} */ ($("wk-month")).value || monthNow();
    var pm = parseMonthKey(mk);
    if (!pm) return;
    var y = pm.y;
    var m0 = pm.m0;
    var last = daysInMonth(y, m0);
    var map = loadDailyMap();
    var buckets = monthWeekBuckets(last);
    var rows = [];
    buckets.forEach(function (b) {
      for (var d = b.start; d <= b.end; d++) {
        var ds = y + "-" + pad2(m0 + 1) + "-" + pad2(d);
        rows.push({
          month: mk,
          weekInMonth: b.weekNum,
          weekRange: b.start + "일~" + b.end + "일",
          date: ds,
          expense: sumDayExpenses(map[ds]),
        });
      }
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Weekly");
    XLSX.writeFile(wb, ExcelManager.makeFilename("WeeklyReport_" + mk.replace("-", "")));
  }

  function init() {
    /** @type {HTMLInputElement} */ ($("wk-month")).value = monthNow();
    $("wk-month").max = monthNow();
    $("wk-month").min = minMonthThreeYears();
    $("wk-month").addEventListener("change", render);
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
