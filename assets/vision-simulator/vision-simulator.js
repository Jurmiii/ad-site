/**
 * 14. 비전 달성 시뮬레이터 — 비전 월 할당 성장 곡선과 완성도(99%↔100%) 상징 비교
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
      if (!raw) return { targetAmount: 0, annualReturnPct: 0, currentBalance: 0 };
      var o = JSON.parse(raw);
      return {
        targetAmount: Math.max(0, Math.trunc(Number(o.targetAmount) || 0)),
        annualReturnPct: Math.min(30, Math.max(0, Number(o.annualReturnPct) || 0)),
        currentBalance: Math.max(0, Math.trunc(Number(o.currentBalance) || 0)),
      };
    } catch (e) {
      return { targetAmount: 0, annualReturnPct: 0, currentBalance: 0 };
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

    var endSplitPlugin = {
      id: "mcVsEndSplit",
      afterDatasetsDraw: function (chartInstance) {
        var ds = chartInstance.getDatasetMeta(0);
        if (!ds.data.length) return;
        var last = ds.data[ds.data.length - 1];
        var x = last.x;
        var y = last.y;
        var c = chartInstance.ctx;
        var prim = colors.primary;
        var mut = colors.muted;
        c.save();
        c.strokeStyle = prim;
        c.lineWidth = 2;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x - 2, y);
        c.lineTo(x + 18, y - 14);
        c.moveTo(x - 2, y);
        c.lineTo(x + 18, y + 14);
        c.stroke();
        c.fillStyle = prim;
        c.globalAlpha = 0.95;
        c.beginPath();
        c.arc(x + 22, y - 14, 4.2, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.45;
        c.beginPath();
        c.arc(x + 22, y + 14, 4.2, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.fillStyle = mut;
        c.font = "600 10px system-ui, sans-serif";
        c.textAlign = "left";
        c.fillText("100%", x + 30, y - 10);
        c.fillText("99%", x + 30, y + 18);
        c.restore();
      },
    };

    destroyChart();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "예상 잔액",
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
                return "예상 잔액: " + formatWonAlways(Number(ctx.raw));
              },
            },
          },
        },
      },
      plugins: [endSplitPlugin],
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
      dMain.textContent = "월 비전 적립이 0원입니다. 2번에서 비전에 월 할당을 먼저 넣어 주세요.";
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
        "현재 비전 적립 속도(월 " +
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
    var fvEnd = Math.round(fvBalance(state.currentBalance, M, rm, 120));
    var incEl = document.getElementById("vs-split-incomplete");
    var compEl = document.getElementById("vs-split-complete");
    if (incEl && compEl) {
      if (fvEnd <= 0) {
        incEl.textContent = "—";
        compEl.textContent = "—";
      } else {
        /* 상징 비교: 동일 시점 잔액의 99% vs 100% (비율 비유, 원화 1단위 차등 아님) */
        var almost = Math.round(fvEnd * 0.99);
        incEl.textContent = formatWonAlways(Math.max(0, almost));
        compEl.textContent = formatWonAlways(fvEnd);
      }
    }

    var mot = $("vs-motivate");
    if (M <= 0 && state.currentBalance <= 0) {
      mot.textContent =
        "비전 월 할당과 누적을 채우면, 곡선 끝에서 거의 달성과 완성이 갈리는 비유 수치가 함께 살아납니다. 2번에서 가치 있는 배정을 먼저 두어 주세요.";
    } else {
      mot.textContent =
        "이 수치는 연 " +
        state.annualReturnPct +
        "% 복리 가정 하 10년(120개월) 시점의 예상 잔액입니다. 같은 잔액이라도 99%와 100%의 마음가짐 차이를 비율로 상징해 보여 줍니다.";
    }

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
          "비전 달성 시뮬레이터(완성도 99%↔100% 상징 비교). 2번 비전 월 할당 합계: " +
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
