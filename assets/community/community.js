/**
 * Money Calendar 기능 15 — 종합 재정 성취 리포트 및 자산 현황판
 */
(function () {
  "use strict";

  var BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";
  var SIM_PREFIX = "moneyCalendar.budgetSimulator.v1";
  var INCOME_KEY = "moneyCalendar.incomeDesign.v1";
  var DAILY_KEY = "moneyCalendar.dailyLedger.v1";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function monthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }

  function fmtKRW(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) v = 0;
    return new Intl.NumberFormat("ko-KR").format(Math.trunc(v)) + "원";
  }

  function safeJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function toInt0(v) {
    var n = Math.trunc(Number(v) || 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function loadIncomeTotal(mk) {
    // 우선순위: Weekly 예산안(월별) → 수입 설계(전체)
    var o = safeJson(BUDGET_PREFIX + "." + mk, null);
    if (o) return toInt0(o.real) + toInt0(o.scheduled) + toInt0(o.other) + toInt0(o.hope);
    var inc = safeJson(INCOME_KEY, null);
    if (inc) return toInt0(inc.real) + toInt0(inc.scheduled) + toInt0(inc.other) + toInt0(inc.hope);
    return 0;
  }

  function loadBudgetCap(mk) {
    // 배분 예산(생활+활동+필수) 우선, 없으면 시뮬레이터 총예산
    var o = safeJson(BUDGET_PREFIX + "." + mk, null);
    if (o) {
      var a = toInt0(o.living) + toInt0(o.activity) + toInt0(o.essential);
      if (a > 0) return a;
    }
    var sim = safeJson(SIM_PREFIX + "." + mk, null);
    if (sim) return toInt0(sim.total);
    return 0;
  }

  function loadDailyMap() {
    var o = safeJson(DAILY_KEY, {});
    return o && typeof o === "object" ? o : {};
  }

  function sumMonth(map, mk) {
    var totalExpense = 0;
    var cat = {};
    Object.keys(map).forEach(function (date) {
      if (String(date).slice(0, 7) !== mk) return;
      var day = map[date];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (t) {
        if (!t) return;
        if (t.type !== "expense") return;
        var amt = toInt0(t.amount);
        totalExpense += amt;
        var c = String(t.category || "기타").trim() || "기타";
        cat[c] = (cat[c] || 0) + amt;
      });
    });
    return { totalExpense: totalExpense, cat: cat };
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function setWidth(id, pct) {
    var el = document.getElementById(id);
    if (!el) return;
    var p = Math.max(0, Math.min(100, pct));
    el.style.width = p.toFixed(2) + "%";
  }

  function pct(n, d) {
    if (!d || d <= 0) return 0;
    return (n / d) * 100;
  }

  function pickPalette(n) {
    // paper-tone friendly but colorful
    var base = [
      "#22c55e",
      "#0ea5e9",
      "#a78bfa",
      "#f59e0b",
      "#fb7185",
      "#14b8a6",
      "#60a5fa",
      "#f472b6",
      "#84cc16",
      "#f97316",
    ];
    var out = [];
    for (var i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  function renderLegend(items, total) {
    var host = document.getElementById("donut-legend");
    if (!host) return;
    host.textContent = "";
    items.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "legend-row";
      var sw = document.createElement("span");
      sw.className = "legend-swatch";
      sw.style.background = it.color;
      var t = document.createElement("span");
      t.className = "legend-title";
      t.textContent = it.label;
      var p = document.createElement("span");
      p.className = "legend-pct";
      p.textContent = total > 0 ? pct(it.value, total).toFixed(1) + "%" : "0%";
      row.appendChild(sw);
      row.appendChild(t);
      row.appendChild(p);
      host.appendChild(row);
    });
  }

  function renderDonut(items, total) {
    var c = document.getElementById("donut");
    if (!c || !c.getContext) return;
    var ctx = c.getContext("2d");
    if (!ctx) return;

    // handle responsive css sizing
    var rect = c.getBoundingClientRect();
    var size = Math.max(260, Math.min(420, Math.round(Math.min(rect.width || 320, rect.height || 320))));
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cx = size / 2;
    var cy = size / 2;
    var rOuter = size * 0.38;
    var rInner = size * 0.22;

    ctx.clearRect(0, 0, size, size);

    // subtle plate
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter + 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15,23,42,0.04)";
    ctx.fill();

    var start = -Math.PI / 2;
    if (!total || total <= 0 || !items.length) {
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,116,139,0.25)";
      ctx.lineWidth = 18;
      ctx.stroke();
    } else {
      items.forEach(function (it) {
        var ang = (it.value / total) * Math.PI * 2;
        var end = start + ang;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, start, end);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.stroke();
        start = end;
      });
    }

    // center cut
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();

    // center text
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 " + Math.round(size * 0.06) + "px Pretendard, system-ui, sans-serif";
    ctx.fillText("지출", cx, cy - size * 0.03);
    ctx.font = "900 " + Math.round(size * 0.06) + "px Pretendard, system-ui, sans-serif";
    ctx.fillText(fmtKRW(total), cx, cy + size * 0.05);
  }

  function init() {
    var mk = monthNow();
    setText("finale-month-label", mk);

    var income = loadIncomeTotal(mk);
    var budget = loadBudgetCap(mk);
    var daily = loadDailyMap();
    var s = sumMonth(daily, mk);
    var expense = s.totalExpense;

    setText("kpi-income", fmtKRW(income));
    setText("kpi-expense", fmtKRW(expense));
    setText("kpi-budget", budget > 0 ? fmtKRW(budget) : "—");

    var saved = budget > 0 ? budget - expense : 0;
    if (budget > 0) {
      var savedPct = pct(Math.abs(saved), budget);
      setText("kpi-saved", saved >= 0 ? "+" + fmtKRW(saved) : "-" + fmtKRW(Math.abs(saved)));
      if (saved >= 0) {
        setText("finale-message", "이번 달 당신은 예산보다 " + savedPct.toFixed(1) + "% 더 절약하셨습니다!");
      } else {
        setText("finale-message", "이번 달은 예산 대비 " + savedPct.toFixed(1) + "% 초과했어요. 다음 달은 더 가볍게!");
      }
      setText("compare-hint", "예산 기준: " + fmtKRW(budget));
    } else {
      setText("kpi-saved", "—");
      setText("finale-message", "데이터가 쌓일수록 리포트가 선명해집니다. 2~4번에서 이번 달 예산을 먼저 잡아 보세요.");
      setText("compare-hint", "예산이 설정되면 절약률이 계산됩니다.");
    }

    // compare bars: scale to max(income, expense)
    var max = Math.max(income, expense, 1);
    setText("val-income", fmtKRW(income));
    setText("val-expense", fmtKRW(expense));
    setWidth("bar-income", pct(income, max));
    setWidth("bar-expense", pct(expense, max));

    // donut items: top categories + 기타
    var entries = Object.keys(s.cat).map(function (k) {
      return { label: k, value: s.cat[k] };
    });
    entries.sort(function (a, b) {
      return b.value - a.value;
    });
    var top = entries.slice(0, 6);
    var rest = entries.slice(6).reduce(function (acc, it) {
      return acc + it.value;
    }, 0);
    if (rest > 0) top.push({ label: "기타", value: rest });
    var colors = pickPalette(top.length);
    var items = top.map(function (it, i) {
      return { label: it.label, value: it.value, color: colors[i] };
    });

    setText("donut-hint", expense > 0 ? "카테고리별 지출 비중" : "이번 달 지출 기록이 아직 없습니다.");
    renderLegend(items, expense);
    renderDonut(items, expense);

    window.addEventListener("resize", function () {
      renderDonut(items, expense);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
