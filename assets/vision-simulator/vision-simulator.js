/**
 * 14. 비전 달성 시뮬레이터 — 2번 비전 할당을 월 저축으로 가정한 성장 곡선
 */
(function () {
  "use strict";

  var STORAGE_KEY = "moneyCalendar.visionSimulator.v1";

  /** @type {any} */
  var chart = null;

  function $(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error("#" + id + " not found");
    return el;
  }

  function digitsOnly(s) {
    return String(s || "").replace(/[^\d]/g, "");
  }

  function parseWon(raw) {
    var d = digitsOnly(raw);
    if (!d) return 0;
    var n = Number(d);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.trunc(n), 9007199254740991);
  }

  function formatWon(n) {
    var v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    return new Intl.NumberFormat("ko-KR").format(Math.trunc(v));
  }

  function formatWonAlways(n) {
    var v = Number(n);
    if (!Number.isFinite(v) || v < 0) return "0원";
    return new Intl.NumberFormat("ko-KR").format(Math.trunc(v)) + "원";
  }

  function readVisionMonthly() {
    var vb = window.MoneyCalendarVisionBudget && window.MoneyCalendarVisionBudget.read();
    if (!vb) return 0;
    return Math.max(0, Math.trunc(Number(vb.visionSum) || 0));
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { targetAmount: 0, annualReturnPct: 4, currentBalance: 0 };
      var o = JSON.parse(raw);
      return {
        targetAmount: Math.max(0, Math.trunc(Number(o.targetAmount) || 0)),
        annualReturnPct: Math.min(30, Math.max(0, Number(o.annualReturnPct) || 4)),
        currentBalance: Math.max(0, Math.trunc(Number(o.currentBalance) || 0)),
      };
    } catch (e) {
      return { targetAmount: 0, annualReturnPct: 4, currentBalance: 0 };
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function monthlyRate(annualPct) {
    var a = annualPct / 100;
    return Math.pow(1 + a, 1 / 12) - 1;
  }

  function fvBalance(B0, P, rm, months) {
    var fv0 = B0 * Math.pow(1 + rm, months);
    if (Math.abs(rm) < 1e-12) return fv0 + P * months;
    return fv0 + (P * (Math.pow(1 + rm, months) - 1)) / rm;
  }

  function chartColors() {
    var cs = getComputedStyle(document.documentElement);
    var primary = (cs.getPropertyValue("--color-primary").trim() || "#6366f1").replace(/\s/g, "");
    var muted = (cs.getPropertyValue("--color-text-muted").trim() || "#64748b").replace(/\s/g, "");
    return { primary: primary, muted: muted };
  }

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  function buildChart(state, monthlySave) {
    if (typeof Chart === "undefined") return;
    var rm = monthlyRate(state.annualReturnPct);
    var maxM = 120;
    var labels = [];
    var data = [];
    var i;
    for (i = 0; i <= maxM; i++) {
      if (i === 0) labels.push("지금");
      else if (i % 12 === 0) labels.push(i / 12 + "년");
      else labels.push("");
      data.push(Math.round(fvBalance(state.currentBalance, monthlySave, rm, i)));
    }

    var colors = chartColors();
    var ctx = /** @type {HTMLCanvasElement} */ ($("vs-line")).getContext("2d");
    if (!ctx) return;

    destroyChart();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "예상 자산",
            data: data,
            borderColor: colors.primary,
            backgroundColor: colors.primary + "2a",
            fill: true,
            tension: 0.22,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 12,
              color: colors.muted,
              font: { size: 10, weight: "600" },
            },
          },
          y: {
            ticks: {
              color: colors.muted,
              callback: function (val) {
                var n = Number(val);
                if (!Number.isFinite(n)) return "";
                if (n >= 100000000) return (n / 100000000).toFixed(1) + "억";
                if (n >= 10000) return Math.round(n / 10000) + "만";
                return n;
              },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return "예상: " + formatWonAlways(Number(ctx.raw));
              },
            },
          },
        },
      },
    });
  }

  function bindMoney(id, key) {
    var el = /** @type {HTMLInputElement} */ (document.getElementById(id));
    if (!el) return;
    el.addEventListener("focus", function () {
      el.value = digitsOnly(el.value);
    });
    el.addEventListener("input", function () {
      el.value = formatWon(parseWon(el.value));
    });
    el.addEventListener("blur", function () {
      var s = loadState();
      s[key] = parseWon(el.value);
      saveState(s);
      render();
    });
  }

  function render() {
    var state = loadState();
    var M = readVisionMonthly();

    $("vs-monthly-display").textContent = formatWonAlways(M);

    var gap = state.targetAmount - state.currentBalance;
    var dMain = $("vs-dday-text");
    var dSub = $("vs-dday-sub");
    dSub.textContent = "";

    if (M <= 0) {
      dMain.textContent = "월 비전 저축이 0원입니다. 2번에서 비전에 월 할당을 먼저 넣어 주세요.";
    } else if (state.targetAmount <= 0) {
      dMain.textContent = "목표 자산액을 입력하면 달성에 걸리는 기간을 단순 추정합니다.";
    } else if (gap <= 0) {
      dMain.textContent = "목표 금액에 이미 도달한 시나리오로 볼 수 있습니다.";
    } else {
      var monthsNeeded = Math.ceil(gap / M);
      var d = new Date();
      d.setMonth(d.getMonth() + monthsNeeded);
      var y = d.getFullYear();
      var mo = d.getMonth() + 1;
      dMain.textContent =
        "현재 저축 속도(월 " +
        formatWonAlways(M) +
        ")로 약 " +
        monthsNeeded +
        "개월 뒤 목표에 근접한다는 단순 추정입니다.";
      dSub.textContent = "참고 달력 시점: 약 " + y + "년 " + mo + "월 (지출·수익 변동은 반영하지 않습니다).";
      var daysApprox = Math.round(monthsNeeded * 30.4);
      dSub.textContent += " D-Day 약 " + daysApprox + "일 후(일 단위 환산).";
    }

    buildChart(state, M);

    var rm = monthlyRate(state.annualReturnPct);
    var oneWon10y = Math.pow(1 + rm, 120);
    $("vs-motivate").textContent =
      "오늘 아낀 1원의 10년 뒤 가치는 약 " +
      formatWonAlways(Math.round(oneWon10y)) +
      "입니다(연 " +
      state.annualReturnPct +
      "% 복리 가정). 비전 할당으로 매달 이어지는 저축이 이 곡선을 밀어 올립니다.";

    /** @type {HTMLInputElement} */ ($("vs-rate")).value = String(state.annualReturnPct);
  }

  function commitRate() {
    var s = loadState();
    var r = Math.min(30, Math.max(0, Number(/** @type {HTMLInputElement} */ ($("vs-rate")).value) || 0));
    s.annualReturnPct = r;
    saveState(s);
    render();
  }

  function exportXlsx() {
    var s = loadState();
    var M = readVisionMonthly();
    var rows = [
      {
        note:
          "비전 달성 시뮬레이터 스냅샷. 2번 비전 월 할당 합계: " +
          M +
          "원. 목표: " +
          s.targetAmount +
          ", 현재: " +
          s.currentBalance +
          ", 연수익률가정: " +
          s.annualReturnPct +
          "%",
      },
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "VisionSimulator");
    XLSX.writeFile(wb, ExcelManager.makeFilename("VisionSimulator_Readme"));
  }

  function init() {
    var st0 = loadState();
    /** @type {HTMLInputElement} */ ($("vs-target")).value = formatWon(st0.targetAmount);
    /** @type {HTMLInputElement} */ ($("vs-balance")).value = formatWon(st0.currentBalance);

    bindMoney("vs-target", "targetAmount");
    bindMoney("vs-balance", "currentBalance");

    $("vs-rate").addEventListener("change", commitRate);
    $("vs-rate").addEventListener("blur", commitRate);

    window.addEventListener("storage", function (e) {
      if (e.key === "moneyCalendar.visionBudget.v1") render();
    });
    window.addEventListener("mc-theme-change", function () {
      render();
    });

    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: exportXlsx,
      });
    }

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
