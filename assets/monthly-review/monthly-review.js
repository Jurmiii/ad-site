/**
 * Money Calendar 기능 10 — 월간 예산 복기 시스템
 * 예산안(배분) vs 데일리 지출 근사 분류 비교
 */
(function () {
  "use strict";

  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";
  var BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";

  function $(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error("#" + id);
    return el;
  }

  function monthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function loadBudget(mk) {
    try {
      var r = localStorage.getItem(BUDGET_PREFIX + "." + mk);
      if (!r) return { living: 0, activity: 0, essential: 0 };
      var o = JSON.parse(r);
      return {
        living: Math.max(0, Math.trunc(Number(o.living) || 0)),
        activity: Math.max(0, Math.trunc(Number(o.activity) || 0)),
        essential: Math.max(0, Math.trunc(Number(o.essential) || 0)),
      };
    } catch {
      return { living: 0, activity: 0, essential: 0 };
    }
  }

  function loadDailyMap() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function bucket(cat) {
    var c = String(cat || "").toLowerCase();
    if (/식|카페|마트|배달|주거|관리|통신|보험|의료|세금|공과/.test(c)) return "living";
    if (/문화|여가|취미|교육|구독|쇼핑|의류/.test(c)) return "activity";
    if (/대출|이자|저축|비상|고정/.test(c)) return "essential";
    return "activity";
  }

  function spendByBucket(mk) {
    var map = loadDailyMap();
    var out = { living: 0, activity: 0, essential: 0 };
    Object.keys(map).forEach(function (ds) {
      if (ds.slice(0, 7) !== mk) return;
      var day = map[ds];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (t) {
        if (!t || t.type !== "expense") return;
        var amt = Math.max(0, Math.trunc(Number(t.amount) || 0));
        out[bucket(t.category)] += amt;
      });
    });
    return out;
  }

  function render() {
    var mk = /** @type {HTMLInputElement} */ ($("mr-month")).value || monthNow();
    var b = loadBudget(mk);
    var s = spendByBucket(mk);
    var rows = [
      { k: "생활비", b: b.living, x: s.living },
      { k: "활동비", b: b.activity, x: s.activity },
      { k: "필수비용", b: b.essential, x: s.essential },
    ];
    var tw = $("mr-table-wrap");
    tw.innerHTML =
      "<table class=\"data-table\"><thead><tr><th>항목</th><th class=\"num\">배분 예산</th><th class=\"num\">데일리 지출(추정)</th><th class=\"num\">차이</th></tr></thead><tbody>" +
      rows
        .map(function (r) {
          var d = r.b - r.x;
          return (
            "<tr><td>" +
            r.k +
            "</td><td class=\"num\">" +
            r.b.toLocaleString() +
            "</td><td class=\"num\">" +
            r.x.toLocaleString() +
            "</td><td class=\"num\">" +
            d.toLocaleString() +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    var ch = $("mr-chart");
    ch.textContent = "";
    rows.forEach(function (r) {
      var pct = r.b > 0 ? Math.min(150, (r.x / r.b) * 100) : r.x > 0 ? 100 : 0;
      var row = document.createElement("div");
      row.className = "mr-chart-row";
      row.innerHTML =
        "<span class=\"text-sm\">" +
        r.k +
        "</span><div class=\"mr-bar\"><span style=\"width:" +
        Math.min(100, pct) +
        "%\"></span></div><span class=\"text-sm\">" +
        (r.b > 0 ? pct.toFixed(0) + "% 집행" : "—") +
        "</span>";
      ch.appendChild(row);
    });

    var vh = $("mr-vision-hint");
    if (vh) {
      if (typeof window.MoneyCalendarVisionBudget === "undefined") {
        vh.hidden = true;
        vh.textContent = "";
      } else {
        var snap = window.MoneyCalendarVisionBudget.read();
        if (snap && snap.totalIncome > 0) {
          vh.hidden = false;
          vh.textContent =
            "2번 비전 예산 스냅샷 — 수입 " +
            snap.totalIncome.toLocaleString("ko-KR") +
            "원 − 고정 " +
            snap.fixedExpense.toLocaleString("ko-KR") +
            "원 − 비전 " +
            snap.visionSum.toLocaleString("ko-KR") +
            "원 → 잔여 가용 " +
            snap.disposable.toLocaleString("ko-KR") +
            "원 (월간 복기 표의 배분 예산과는 별개의 참고용입니다).";
        } else {
          vh.hidden = true;
          vh.textContent = "";
        }
      }
    }
  }

  function exportXlsx() {
    var mk = /** @type {HTMLInputElement} */ ($("mr-month")).value || monthNow();
    var b = loadBudget(mk);
    var s = spendByBucket(mk);
    var rows = [
      { month: mk, line: "생활비", budget: b.living, spent: s.living },
      { month: mk, line: "활동비", budget: b.activity, spent: s.activity },
      { month: mk, line: "필수비용", budget: b.essential, spent: s.essential },
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "MonthlyReview");
    XLSX.writeFile(wb, ExcelManager.makeFilename("MonthlyReview_" + mk.replace("-", "")));
  }

  function init() {
    /** @type {HTMLInputElement} */ ($("mr-month")).value = monthNow();
    $("mr-month").addEventListener("change", render);
    render();
    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: exportXlsx,
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
