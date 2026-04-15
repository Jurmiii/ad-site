/**
 * Money Calendar 기능 12 — AI 재정 피드백 (로컬 규칙 엔진)
 */
(function () {
  "use strict";

  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";
  var BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";
  var SIM_PREFIX = "moneyCalendar.budgetSimulator.v1";

  function monthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function loadJson(key, fallback) {
    try {
      var r = localStorage.getItem(key);
      if (!r) return fallback;
      return JSON.parse(r);
    } catch {
      return fallback;
    }
  }

  function monthSpend(mk) {
    var map = loadJson(DAILY_KEY, {});
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

  function runRules() {
    var mk = monthNow();
    var b = loadJson(BUDGET_PREFIX + "." + mk, {});
    var living = Math.max(0, Math.trunc(Number(b.living) || 0));
    var activity = Math.max(0, Math.trunc(Number(b.activity) || 0));
    var essential = Math.max(0, Math.trunc(Number(b.essential) || 0));
    var alloc = living + activity + essential;
    var sim = loadJson(SIM_PREFIX + "." + mk, {});
    var cap = alloc > 0 ? alloc : Math.max(0, Math.trunc(Number(sim.total) || 0));
    var spent = monthSpend(mk);
    var msgs = [];

    if (cap > 0 && spent > cap * 1.05) {
      msgs.push({
        type: "warn",
        tag: "지출",
        text: "이번 달 데일리 지출 합이 기준(배분 또는 시뮬 총예산)보다 5%를 넘었습니다. 다음 주 지출 상한을 재설정하세요.",
      });
    }
    if (living > 0 && activity > living * 0.45) {
      msgs.push({
        type: "warn",
        tag: "비율",
        text: "활동비 배분(" + activity.toLocaleString() + "원)이 생활비(" + living.toLocaleString() + "원)의 45%를 넘습니다. 유흥·구독 항목을 점검해 보세요.",
      });
    }
    if (cap > 0 && spent < cap * 0.7) {
      msgs.push({
        type: "ok",
        tag: "여유",
        text: "지출 속도가 기준 대비 여유롭습니다. 비전 저축으로 이월할 금액을 검토해 보세요.",
      });
    }
    if (!msgs.length) {
      msgs.push({
        type: "ok",
        tag: "관측",
        text: "데이터가 부족하거나 규칙에 해당하는 이상 징후가 없습니다. 데일리 기록과 예산 배분을 채우면 분석이 강화됩니다.",
      });
    }
    return msgs;
  }

  function render() {
    var ul = document.getElementById("ai-list");
    ul.textContent = "";
    runRules().forEach(function (m) {
      var li = document.createElement("li");
      li.className = "ai-item" + (m.type === "warn" ? " ai-item--warn" : " ai-item--ok");
      li.innerHTML =
        "<p class=\"ai-item__tag\">" +
        m.tag +
        "</p><p class=\"mt-10 text-body\">" +
        m.text +
        "</p>";
      ul.appendChild(li);
    });
  }

  function exportMsgs() {
    var rows = runRules().map(function (m, i) {
      return { order: i + 1, tag: m.tag, message: m.text };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "AIFeedback");
    XLSX.writeFile(wb, ExcelManager.makeFilename("AIFeedback"));
  }

  function init() {
    render();
    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: exportMsgs,
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
