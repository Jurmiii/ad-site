/**
 * 카테고리별 예산 분배 시뮬레이터
 * - 슬라이더/입력 동기화
 * - 한 항목 변경 시 나머지 항목 자동 재분배(합계 고정)
 * - Chart.js 도넛 차트 실시간 반영
 * - 권장 비율(50/30/20) 비교 피드백
 * - xlsx 엑셀 다운로드
 * - 월별 localStorage 저장 + 확정 시 read-only
 */

const STORAGE_PREFIX = "moneyCalendar.budgetSimulator.v1";
const BUDGET_SETUP_PREFIX = "moneyCalendar.budgetSetup.v1";

const GUIDE = {
  living: 0.5,
  activity: 0.3,
  essential: 0.2,
};

/** UI·엑셀·피드백 공통 (키 living/activity/essential 유지) */
const SIM_LABELS = {
  living: "필수 지출 (Needs)",
  activity: "선택적 지출 (Wants)",
  essential: "저축 및 투자 (Savings)",
};

const SIM_CHART_LABELS = ["필수(Needs)", "선택(Wants)", "저축(Savings)"];

/** @typedef {{ monthKey: string, income: number, fixed: number, total: number, living: number, activity: number, essential: number, confirmed: boolean, confirmedAt: string | null }} SimState */

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function storageKey(monthKey) {
  return `${STORAGE_PREFIX}.${monthKey}`;
}

function digitsOnly(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

function parseWon(raw) {
  const d = digitsOnly(raw);
  if (!d) return 0;
  const n = Number(d);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.trunc(n), 9_007_199_254_740_991);
}

function formatWon(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return new Intl.NumberFormat("ko-KR").format(Math.trunc(v));
}

function formatWonAlways(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "0원";
  return `${new Intl.NumberFormat("ko-KR").format(Math.trunc(v))}원`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function roundInt(n) {
  return Math.trunc(Number.isFinite(n) ? n : 0);
}

/** 비전 예산: 수입−고정−비전 합이 양수이고 시뮬 풀이 비어 있으면 시드 */
function trySeedFromVisionRemainder() {
  if (state.confirmed) return false;
  if (state.total > 0 || state.income > 0) return false;
  if (typeof window.MoneyCalendarVisionBudget === "undefined") return false;
  var snap = window.MoneyCalendarVisionBudget.read();
  if (!snap || snap.disposable <= 0) return false;
  var t = snap.disposable;
  var fix = Math.max(0, roundInt(state.fixed));
  state.income = t + fix;
  state.fixed = fix;
  state.total = t;
  state.living = roundInt(t * GUIDE.living);
  state.activity = roundInt(t * GUIDE.activity);
  state.essential = t - state.living - state.activity;
  normalizeToTotal(state);
  return true;
}

/** @returns {SimState} */
function emptyState(monthKey) {
  return {
    monthKey,
    income: 0,
    fixed: 0,
    total: 0,
    living: 0,
    activity: 0,
    essential: 0,
    confirmed: false,
    confirmedAt: null,
  };
}

/** @param {string} monthKey */
function loadState(monthKey) {
  try {
    const raw = localStorage.getItem(storageKey(monthKey));
    if (!raw) return emptyState(monthKey);
    const o = JSON.parse(raw);
    const hasIncomeFixed = Object.prototype.hasOwnProperty.call(o, "income") || Object.prototype.hasOwnProperty.call(o, "fixed");
    let income = Math.max(0, roundInt(o.income));
    let fixed = Math.max(0, roundInt(o.fixed));
    let total = Math.max(0, roundInt(o.total));
    if (!hasIncomeFixed && (total > 0 || roundInt(o.living) > 0 || roundInt(o.activity) > 0 || roundInt(o.essential) > 0)) {
      income = total;
      fixed = 0;
    }
    if (hasIncomeFixed && income === 0 && fixed === 0 && total > 0) {
      income = total;
    }
    const pool = Math.max(0, income - fixed);
    return {
      monthKey,
      income,
      fixed,
      total: pool,
      living: Math.max(0, roundInt(o.living)),
      activity: Math.max(0, roundInt(o.activity)),
      essential: Math.max(0, roundInt(o.essential)),
      confirmed: Boolean(o.confirmed),
      confirmedAt: typeof o.confirmedAt === "string" ? o.confirmedAt : null,
    };
  } catch {
    return emptyState(monthKey);
  }
}

/** @param {SimState} s */
function saveState(s) {
  localStorage.setItem(storageKey(s.monthKey), JSON.stringify(s));
}

function sumCats(s) {
  return s.living + s.activity + s.essential;
}

function leftAmount(s) {
  return s.total - sumCats(s);
}

function pct(val, total) {
  if (!total) return 0;
  return (val / total) * 100;
}

function pctText(val, total) {
  return `${pct(val, total).toFixed(1)}%`;
}

function distributeRemaining(remaining, weights) {
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (remaining <= 0) return [0, 0];
  if (wSum <= 0) {
    const a = Math.floor(remaining / 2);
    const b = remaining - a;
    return [a, b];
  }
  const a = Math.floor((remaining * weights[0]) / wSum);
  const b = remaining - a;
  return [a, b];
}

/**
 * 한 항목을 고정하고 나머지 2개를 비율 유지로 재분배
 * @param {SimState} s
 * @param {'living'|'activity'|'essential'} fixedKey
 * @param {number} nextVal
 */
function applyChangeWithAutoRebalance(s, fixedKey, nextVal) {
  const total = Math.max(0, roundInt(s.total));
  if (total === 0) {
    s.living = 0;
    s.activity = 0;
    s.essential = 0;
    return;
  }

  const fixed = clamp(roundInt(nextVal), 0, total);
  const remaining = total - fixed;

  if (fixedKey === "living") {
    const [a, b] = distributeRemaining(remaining, [s.activity, s.essential]);
    s.living = fixed;
    s.activity = a;
    s.essential = b;
  } else if (fixedKey === "activity") {
    const [a, b] = distributeRemaining(remaining, [s.living, s.essential]);
    s.activity = fixed;
    s.living = a;
    s.essential = b;
  } else {
    const [a, b] = distributeRemaining(remaining, [s.living, s.activity]);
    s.essential = fixed;
    s.living = a;
    s.activity = b;
  }
}

function normalizeToTotal(s) {
  const total = Math.max(0, roundInt(s.total));
  s.total = total;
  s.living = clamp(roundInt(s.living), 0, total);
  s.activity = clamp(roundInt(s.activity), 0, total);
  s.essential = clamp(roundInt(s.essential), 0, total);

  const diff = total - sumCats(s);
  if (diff === 0) return;

  // diff를 essential에 우선 반영해 합계를 맞춤(0~total 범위 유지)
  s.essential = clamp(s.essential + diff, 0, total);
  const diff2 = total - sumCats(s);
  if (diff2 !== 0) {
    s.activity = clamp(s.activity + diff2, 0, total);
  }
}

/** 수입·고정 지출 변경 시 풀(= 분배 상한) 동기화 */
function syncPoolFromIncomeFixed() {
  const inc = Math.max(0, roundInt(state.income));
  const fix = Math.max(0, roundInt(state.fixed));
  state.income = inc;
  state.fixed = fix;
  state.total = Math.max(0, inc - fix);
  normalizeToTotal(state);
}

let monthKey = currentMonthKey();
/** @type {SimState} */
let state = emptyState(monthKey);

const els = {
  month: /** @type {HTMLInputElement} */ ($("plan-date")),
  income: /** @type {HTMLInputElement} */ ($("sim-income")),
  fixed: /** @type {HTMLInputElement} */ ($("sim-fixed")),
  poolDisplay: $("sim-pool-display"),
  loadBudgetSetup: /** @type {HTMLButtonElement} */ ($("btn-load-budget-setup")),
  apply532: /** @type {HTMLButtonElement} */ ($("btn-apply-532")),
  lockPill: $("lock-pill"),
  deltaPill: $("delta-pill"),

  amt: {
    living: /** @type {HTMLInputElement} */ ($("amt-living")),
    activity: /** @type {HTMLInputElement} */ ($("amt-activity")),
    essential: /** @type {HTMLInputElement} */ ($("amt-essential")),
  },
  rng: {
    living: /** @type {HTMLInputElement} */ ($("rng-living")),
    activity: /** @type {HTMLInputElement} */ ($("rng-activity")),
    essential: /** @type {HTMLInputElement} */ ($("rng-essential")),
  },
  pct: {
    living: $("pct-living"),
    activity: $("pct-activity"),
    essential: $("pct-essential"),
  },
  sumTotal: $("sum-total"),
  sumLeft: $("sum-left"),
  sumStatus: $("sum-status"),
  guideText: $("guide-text"),
  diffBody: $("diff-body"),
  btnConfirm: /** @type {HTMLButtonElement} */ ($("btn-confirm")),
  btnUnconfirm: /** @type {HTMLButtonElement} */ ($("btn-unconfirm")),
};

function currentDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKeyFromDateInputValue(v) {
  const s = String(v || "");
  if (s.length >= 7) return s.slice(0, 7);
  return currentMonthKey();
}

/** @type {import('chart.js').Chart | null} */
let chart = null;

function setEditable(isEditable) {
  const disabled = !isEditable;
  els.income.disabled = disabled;
  els.fixed.disabled = disabled;
  els.loadBudgetSetup.disabled = disabled;
  els.apply532.disabled = disabled;
  for (const k of ["living", "activity", "essential"]) {
    els.amt[k].disabled = disabled;
    els.rng[k].disabled = disabled;
  }
  els.btnConfirm.classList.toggle("is-hidden", !isEditable);
  els.btnUnconfirm.classList.toggle("is-hidden", isEditable);
  els.lockPill.textContent = isEditable ? "편집 가능" : "확정됨 · Read-only";
  els.lockPill.className = `pill ${isEditable ? "pill-muted" : "pill-ok"}`;
}

function applyMoneyField(inputEl, onChange) {
  const apply = () => {
    const n = parseWon(inputEl.value);
    const next = n === 0 && digitsOnly(inputEl.value) === "" ? "" : formatWon(n);
    if (inputEl.value !== next) inputEl.value = next;
    onChange(n);
  };
  inputEl.addEventListener("input", apply);
  inputEl.addEventListener("blur", apply);
}

function updateRangesMax() {
  const max = String(Math.max(0, roundInt(state.total)));
  els.rng.living.max = max;
  els.rng.activity.max = max;
  els.rng.essential.max = max;
}

function renderDiffTable() {
  const total = state.total;
  const rows = [
    { key: "living", label: SIM_LABELS.living, current: state.living, guide: GUIDE.living },
    { key: "activity", label: SIM_LABELS.activity, current: state.activity, guide: GUIDE.activity },
    { key: "essential", label: SIM_LABELS.essential, current: state.essential, guide: GUIDE.essential },
  ];

  els.diffBody.innerHTML = "";
  for (const r of rows) {
    const curPct = total > 0 ? r.current / total : 0;
    const delta = (curPct - r.guide) * 100;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.label}</td>
      <td class="num">${pctText(r.current, total)}</td>
      <td class="num">${(r.guide * 100).toFixed(1)}%</td>
      <td class="num">${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%</td>
    `;
    els.diffBody.appendChild(tr);
  }
}

function renderGuideText() {
  const total = state.total;
  if (total <= 0) {
    els.guideText.textContent =
      "수입과 고정 지출을 입력하면 분배 가능 금액이 정해지고, 50/30/20 권장 비율(필수·선택·저축)과의 차이를 분석해 드립니다.";
    els.deltaPill.textContent = "권장 대비 분석";
    els.deltaPill.className = "pill pill-muted";
    return;
  }

  const cur = {
    living: state.living / total,
    activity: state.activity / total,
    essential: state.essential / total,
  };

  const deltas = {
    living: (cur.living - GUIDE.living) * 100,
    activity: (cur.activity - GUIDE.activity) * 100,
    essential: (cur.essential - GUIDE.essential) * 100,
  };

  const absMax = Math.max(Math.abs(deltas.living), Math.abs(deltas.activity), Math.abs(deltas.essential));
  const within = absMax <= 5;
  const warn = absMax <= 10;

  if (within) {
    els.deltaPill.textContent = "권장 비율 근접";
    els.deltaPill.className = "pill pill-ok";
    els.guideText.textContent =
      "현재 분배는 50/30/20 권장 비율(필수·선택·저축)과 큰 차이가 없습니다. 다음 단계로는 항목별 세부 지출을 점검해 보세요.";
    return;
  }

  const up = [];
  const down = [];
  for (const [k, v] of Object.entries(deltas)) {
    if (v > 5) up.push(k);
    if (v < -5) down.push(k);
  }

  const label = (k) => SIM_LABELS[k] || k;
  const msg = [];
  if (up.length) msg.push(`${up.map(label).join(", ")} 비중이 권장보다 높습니다.`);
  if (down.length) msg.push(`${down.map(label).join(", ")} 비중이 권장보다 낮습니다.`);

  els.deltaPill.textContent = warn ? "조정 권장" : "주의 필요";
  els.deltaPill.className = warn ? "pill pill-warn" : "pill pill-bad";
  els.guideText.textContent =
    msg.join(" ") +
    " 한 항목을 조금 줄이면 나머지가 자동으로 재분배되니, 과도한 쏠림이 없도록 범위를 찾아보세요.";
}

function renderSummary() {
  els.sumTotal.textContent = formatWonAlways(sumCats(state));
  const left = leftAmount(state);
  els.sumLeft.textContent = formatWonAlways(left);
  if (state.total === 0) {
    els.sumStatus.textContent = "대기";
  } else if (left === 0) {
    els.sumStatus.textContent = "정상";
  } else {
    els.sumStatus.textContent = left > 0 ? "미분배" : "초과";
  }
}

function hydrateInputs() {
  els.income.value = state.income ? formatWon(state.income) : "";
  els.fixed.value = state.fixed ? formatWon(state.fixed) : "";
  els.poolDisplay.textContent = formatWonAlways(state.total);
  for (const k of ["living", "activity", "essential"]) {
    els.amt[k].value = state[k] ? formatWon(state[k]) : "";
    els.rng[k].value = String(state[k] || 0);
    els.pct[k].textContent = pctText(state[k], state.total);
  }
}

function renderChart() {
  if (typeof Chart === "undefined") return;
  const data = [state.living, state.activity, state.essential];
  const labels = [...SIM_CHART_LABELS];
  const colors = ["#22c55e", "#3b82f6", "#f59e0b"];

  const ctx = /** @type {HTMLCanvasElement} */ ($("donut")).getContext("2d");
  if (!ctx) return;

  if (!chart) {
    chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle" },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.raw || 0);
                const p = pctText(v, state.total);
                return `${ctx.label}: ${formatWonAlways(v)} (${p})`;
              },
            },
          },
        },
      },
    });
    return;
  }

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

function renderAll() {
  updateRangesMax();
  normalizeToTotal(state);
  hydrateInputs();
  renderSummary();
  renderDiffTable();
  renderGuideText();
  renderChart();
  setEditable(!state.confirmed);
}

function persist() {
  saveState(state);
}

function loadFromBudgetSetup() {
  try {
    const mk = els.month.value || currentMonthKey();
    const raw = localStorage.getItem(`${BUDGET_SETUP_PREFIX}.${mk}`);
    if (!raw) {
      alert("예산 수립 데이터가 없습니다. 먼저 예산 수립 화면에서 입력해 주세요.");
      return;
    }
    const o = JSON.parse(raw);
    const living = Math.max(0, roundInt(o.living));
    const activity = Math.max(0, roundInt(o.activity));
    const essential = Math.max(0, roundInt(o.essential));
    const total = living + activity + essential;
    state.living = living;
    state.activity = activity;
    state.essential = essential;
    state.total = total;
    state.income = total + state.fixed;
    normalizeToTotal(state);
    state.confirmed = false;
    state.confirmedAt = null;
    persist();
    renderAll();
  } catch {
    alert("불러오기에 실패했습니다.");
  }
}

function apply532() {
  const total = Math.max(0, roundInt(state.total));
  if (total <= 0) {
    alert("수입과 고정 지출을 입력해 분배 가능 금액을 먼저 정해 주세요.");
    return;
  }
  const living = Math.floor(total * GUIDE.living);
  const activity = Math.floor(total * GUIDE.activity);
  const essential = total - living - activity;
  state.living = living;
  state.activity = activity;
  state.essential = essential;
  persist();
  renderAll();
}

function confirmSim() {
  if (state.total <= 0) {
    alert("분배 가능 금액이 0원입니다. 수입·고정 지출을 입력한 뒤 확정해 주세요.");
    return;
  }
  if (!window.confirm("현재 시뮬레이션 결과를 확정하고 입력을 잠글까요?")) return;
  state.confirmed = true;
  state.confirmedAt = new Date().toISOString();
  persist();
  renderAll();
}

function unconfirmSim() {
  if (!window.confirm("확정을 해제하고 다시 편집할까요?")) return;
  state.confirmed = false;
  state.confirmedAt = null;
  persist();
  renderAll();
}

function exportExcel() {
  if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }

  const total = state.total;
  const rows = [
    { 항목: "기준월", 값: state.monthKey },
    { 항목: "전체 수입(가용)", 값: state.income },
    { 항목: "고정 지출(필수 생활비)", 값: state.fixed },
    { 항목: "분배 가능 금액(슬라이더 기준)", 값: total },
    { 항목: SIM_LABELS.living, 값: state.living, 비중: pctText(state.living, total), 권장: "50%", 차이: `${(pct(state.living, total) - 50).toFixed(1)}%` },
    { 항목: SIM_LABELS.activity, 값: state.activity, 비중: pctText(state.activity, total), 권장: "30%", 차이: `${(pct(state.activity, total) - 30).toFixed(1)}%` },
    { 항목: SIM_LABELS.essential, 값: state.essential, 비중: pctText(state.essential, total), 권장: "20%", 차이: `${(pct(state.essential, total) - 20).toFixed(1)}%` },
    { 항목: "합계", 값: sumCats(state) },
    { 항목: "남는 금액", 값: leftAmount(state) },
    { 항목: "확정 여부", 값: state.confirmed ? "확정" : "미확정" },
    { 항목: "확정 시각", 값: state.confirmedAt || "-" },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "시뮬레이션");

  const detail = [
    {
      구분: "권장 비율",
      [SIM_LABELS.living]: "50%",
      [SIM_LABELS.activity]: "30%",
      [SIM_LABELS.essential]: "20%",
    },
    {
      구분: "현재 비율",
      [SIM_LABELS.living]: pctText(state.living, total),
      [SIM_LABELS.activity]: pctText(state.activity, total),
      [SIM_LABELS.essential]: pctText(state.essential, total),
    },
  ];
  const ws2 = XLSX.utils.json_to_sheet(detail);
  XLSX.utils.book_append_sheet(wb, ws2, "비율");

  const fname =
    typeof ExcelManager !== "undefined" && ExcelManager.makeFilename
      ? ExcelManager.makeFilename(`BudgetSimulator_${String(state.monthKey || "").replace("-", "")}`)
      : `MoneyCalendar_BudgetSimulator_${String(state.monthKey || "").replace("-", "")}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function bindCategory(key) {
  // range
  els.rng[key].addEventListener("input", () => {
    if (state.confirmed) return;
    const v = Number(els.rng[key].value);
    applyChangeWithAutoRebalance(state, key, v);
    persist();
    renderAll();
  });

  // money input
  applyMoneyField(els.amt[key], (n) => {
    if (state.confirmed) return;
    applyChangeWithAutoRebalance(state, key, n);
    persist();
    renderAll();
  });
}

function init() {
  // Excel Manager (import / export)
  if (typeof ExcelManager !== "undefined") {
    try {
      ExcelManager.mount("excel-control-root", "BudgetSimulator", {
        applyData(mode, parsed) {
          const row = parsed && parsed.BudgetSimulator ? parsed.BudgetSimulator : null;
          if (!row) throw new Error("BudgetSimulator 시트를 찾지 못했습니다.");
          const mk =
            typeof row.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)
              ? row.monthKey
              : currentMonthKey();

          function numField(r, key) {
            if (!r || r[key] === undefined || r[key] === null || r[key] === "") return 0;
            const n = Number(r[key]);
            return Number.isFinite(n) ? Math.trunc(n) : 0;
          }

          let income = Math.max(0, numField(row, "income"));
          let fixed = Math.max(0, numField(row, "fixed"));
          let total = Math.max(0, numField(row, "total"));
          if (income === 0 && fixed === 0 && total > 0) {
            income = total;
          }
          const pool = Math.max(0, income - fixed);

          const incoming = {
            monthKey: mk,
            income: Math.max(0, income),
            fixed: Math.max(0, fixed),
            total: pool,
            living: Math.max(0, numField(row, "living")),
            activity: Math.max(0, numField(row, "activity")),
            essential: Math.max(0, numField(row, "essential")),
            confirmed: Boolean(row.confirmed),
            confirmedAt: typeof row.confirmedAt === "string" ? row.confirmedAt : null,
          };
          normalizeToTotal(incoming);

          if (mode === "overwrite") {
            state = { ...incoming };
          } else {
            if ((Number(state.total) || 0) === 0 && incoming.total > 0) {
              state.income = incoming.income;
              state.fixed = incoming.fixed;
              state.total = incoming.total;
            }
            if ((Number(state.living) || 0) === 0 && incoming.living > 0) state.living = incoming.living;
            if ((Number(state.activity) || 0) === 0 && incoming.activity > 0) state.activity = incoming.activity;
            if ((Number(state.essential) || 0) === 0 && incoming.essential > 0) state.essential = incoming.essential;
            state.confirmed = Boolean(state.confirmed || incoming.confirmed);
            state.confirmedAt = state.confirmedAt || incoming.confirmedAt || null;
            state.monthKey = mk;
            normalizeToTotal(state);
          }

          monthKey = mk;
          els.month.value = mk.length === 7 ? `${mk}-01` : mk;
          persist();
          renderAll();
        },
        onExportCurrent() {
          exportExcel();
        },
      });
    } catch {
      /* ignore */
    }
  }

  els.month.value = currentDateKey();
  els.month.max = currentDateKey();
  monthKey = monthKeyFromDateInputValue(els.month.value);
  state = loadState(monthKey);
  state.monthKey = monthKey;
  if (trySeedFromVisionRemainder()) persist();

  els.month.addEventListener("change", () => {
    const next = monthKeyFromDateInputValue(els.month.value || currentDateKey());
    // 현재 저장
    persist();
    // 다음 로드
    monthKey = next;
    state = loadState(monthKey);
    state.monthKey = monthKey;
    if (trySeedFromVisionRemainder()) persist();
    renderAll();
  });

  applyMoneyField(els.income, (n) => {
    if (state.confirmed) return;
    state.income = n;
    syncPoolFromIncomeFixed();
    persist();
    renderAll();
  });
  applyMoneyField(els.fixed, (n) => {
    if (state.confirmed) return;
    state.fixed = n;
    syncPoolFromIncomeFixed();
    persist();
    renderAll();
  });

  els.loadBudgetSetup.addEventListener("click", () => {
    if (state.confirmed) return;
    loadFromBudgetSetup();
  });
  els.apply532.addEventListener("click", () => {
    if (state.confirmed) return;
    apply532();
  });

  bindCategory("living");
  bindCategory("activity");
  bindCategory("essential");

  els.btnConfirm.addEventListener("click", confirmSim);
  els.btnUnconfirm.addEventListener("click", unconfirmSim);

  // 차트 컨테이너 높이 확보
  const canvas = /** @type {HTMLCanvasElement} */ ($("donut"));
  canvas.parentElement.style.height = "360px";

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
