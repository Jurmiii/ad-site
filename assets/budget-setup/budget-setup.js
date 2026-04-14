/**
 * Weekly 예산안 수립 엔진
 * - 월별 localStorage 저장
 * - 소득 4종 합산 + 시각적 비율
 * - 예산 3종 + 잔여 실시간
 * - 확정 시 입력 잠금
 * - SheetJS(xlsx) 엑셀보내기
 */

const STORAGE_PREFIX = "moneyCalendar.budgetSetup.v1";

/** @typedef {{ real: number, scheduled: number, other: number, hope: number, living: number, activity: number, essential: number, locked: boolean, lockedAt: string | null }} BudgetState */

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function currentMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseNonNeg(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function formatKRW(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return `${new Intl.NumberFormat("ko-KR").format(Math.trunc(v))}원`;
}

function storageKey(monthKey) {
  return `${STORAGE_PREFIX}.${monthKey}`;
}

/** @param {string} monthKey */
function loadState(monthKey) {
  try {
    const raw = localStorage.getItem(storageKey(monthKey));
    if (!raw) return null;
    const o = JSON.parse(raw);
    return {
      real: parseNonNeg(o.real),
      scheduled: parseNonNeg(o.scheduled),
      other: parseNonNeg(o.other),
      hope: parseNonNeg(o.hope),
      living: parseNonNeg(o.living),
      activity: parseNonNeg(o.activity),
      essential: parseNonNeg(o.essential),
      locked: Boolean(o.locked),
      lockedAt: typeof o.lockedAt === "string" ? o.lockedAt : null,
    };
  } catch {
    return null;
  }
}

/** @param {string} monthKey @param {BudgetState} state */
function saveState(monthKey, state) {
  localStorage.setItem(storageKey(monthKey), JSON.stringify(state));
}

/** @returns {BudgetState} */
function emptyState() {
  return {
    real: 0,
    scheduled: 0,
    other: 0,
    hope: 0,
    living: 0,
    activity: 0,
    essential: 0,
    locked: false,
    lockedAt: null,
  };
}

const els = {
  month: /** @type {HTMLInputElement} */ ($("plan-month")),
  real: /** @type {HTMLInputElement} */ ($("income-real")),
  scheduled: /** @type {HTMLInputElement} */ ($("income-scheduled")),
  other: /** @type {HTMLInputElement} */ ($("income-other")),
  hope: /** @type {HTMLInputElement} */ ($("income-hope")),
  living: /** @type {HTMLInputElement} */ ($("budget-living")),
  activity: /** @type {HTMLInputElement} */ ($("budget-activity")),
  essential: /** @type {HTMLInputElement} */ ($("budget-essential")),
  totalIncome: $("total-income"),
  incomeHint: $("income-hint"),
  incomeLegend: $("income-legend"),
  segReal: $("seg-real"),
  segScheduled: $("seg-scheduled"),
  segOther: $("seg-other"),
  segHope: $("seg-hope"),
  compareIncome: $("compare-income"),
  compareAllocated: $("compare-allocated"),
  compareRemainder: $("compare-remainder"),
  miniIncome: $("mini-income"),
  miniAlloc: $("mini-alloc"),
  miniLeft: $("mini-left"),
  remainder: $("remainder"),
  remainderHint: $("remainder-hint"),
  bLiving: $("b-living"),
  bActivity: $("b-activity"),
  bEssential: $("b-essential"),
  bLeft: $("b-left"),
  allocPct: $("alloc-pct"),
  btnLock: /** @type {HTMLButtonElement} */ ($("btn-lock")),
  btnExport: /** @type {HTMLButtonElement} */ ($("btn-export")),
  lockedBanner: $("locked-banner"),
};

/** @type {BudgetState} */
let state = emptyState();

/** @type {string} */
let lastMonthKey = currentMonthKey();

function readInputsIntoState() {
  state.real = parseNonNeg(els.real.value);
  state.scheduled = parseNonNeg(els.scheduled.value);
  state.other = parseNonNeg(els.other.value);
  state.hope = parseNonNeg(els.hope.value);
  state.living = parseNonNeg(els.living.value);
  state.activity = parseNonNeg(els.activity.value);
  state.essential = parseNonNeg(els.essential.value);
}

function writeInputsFromState() {
  els.real.value = state.real ? String(state.real) : "";
  els.scheduled.value = state.scheduled ? String(state.scheduled) : "";
  els.other.value = state.other ? String(state.other) : "";
  els.hope.value = state.hope ? String(state.hope) : "";
  els.living.value = state.living ? String(state.living) : "";
  els.activity.value = state.activity ? String(state.activity) : "";
  els.essential.value = state.essential ? String(state.essential) : "";
}

function getMonthKey() {
  return els.month.value || currentMonthKey();
}

function totalIncome() {
  return state.real + state.scheduled + state.other + state.hope;
}

function totalAllocated() {
  return state.living + state.activity + state.essential;
}

function remainder() {
  return totalIncome() - totalAllocated();
}

function setWidths(el, pct) {
  const p = Math.max(0, Math.min(100, pct));
  el.style.width = `${p}%`;
}

function render() {
  const ti = totalIncome();
  const ta = totalAllocated();
  const rem = remainder();

  els.totalIncome.textContent = formatKRW(ti);
  els.compareIncome.textContent = formatKRW(ti);
  els.compareAllocated.textContent = formatKRW(ta);
  els.compareRemainder.textContent =
    rem < 0
      ? `초과 ${formatKRW(Math.abs(rem))} (배분이 소득을 넘습니다)`
      : `잔여 ${formatKRW(rem)}`;

  const allocPct = ti > 0 ? Math.min(100, (ta / ti) * 100) : 0;
  els.allocPct.textContent = ti > 0 ? `배분 ${allocPct.toFixed(0)}%` : "배분 0%";

  // 소득 구성 막대
  if (ti <= 0) {
    setWidths(els.segReal, 0);
    setWidths(els.segScheduled, 0);
    setWidths(els.segOther, 0);
    setWidths(els.segHope, 0);
    els.incomeLegend.textContent = "";
    els.incomeHint.textContent = "금액을 입력하면 막대에 비율이 반영됩니다.";
  } else {
    setWidths(els.segReal, (state.real / ti) * 100);
    setWidths(els.segScheduled, (state.scheduled / ti) * 100);
    setWidths(els.segOther, (state.other / ti) * 100);
    setWidths(els.segHope, (state.hope / ti) * 100);
    els.incomeLegend.textContent = "실제·예정·기타·희망 순";
    els.incomeHint.textContent = "합계는 4항목의 단순 합산입니다.";
  }

  // 대조 미니바: 배분 vs 잔여
  if (ti <= 0) {
    setWidths(els.miniIncome, 100);
    setWidths(els.miniAlloc, 0);
    setWidths(els.miniLeft, 100);
  } else {
    setWidths(els.miniIncome, 100);
    const allocW = Math.min(100, (ta / ti) * 100);
    const leftW = Math.max(0, 100 - allocW);
    setWidths(els.miniAlloc, allocW);
    setWidths(els.miniLeft, leftW);
  }

  // 예산 막대 (생활/활동/필수/잔여) — 총소득 기준
  if (ti <= 0) {
    setWidths(els.bLiving, 0);
    setWidths(els.bActivity, 0);
    setWidths(els.bEssential, 0);
    setWidths(els.bLeft, 100);
  } else {
    setWidths(els.bLiving, (state.living / ti) * 100);
    setWidths(els.bActivity, (state.activity / ti) * 100);
    setWidths(els.bEssential, (state.essential / ti) * 100);
    const leftPct = (rem / ti) * 100;
    setWidths(els.bLeft, Math.max(0, leftPct));
  }

  els.remainder.textContent = formatKRW(rem);
  els.remainder.classList.remove("is-negative", "is-positive");
  if (rem < 0) {
    els.remainder.classList.add("is-negative");
    els.remainderHint.textContent = "배분 합이 총 소득을 초과했습니다. 1원 단위까지 다시 맞춰 주세요.";
  } else if (rem === 0 && ti > 0) {
    els.remainder.classList.add("is-positive");
    els.remainderHint.textContent = "소득이 예산에 정확히 맞춰졌습니다.";
  } else {
    els.remainderHint.textContent = rem > 0 ? "남는 금액은 저축·비상금·추가 목표에 쓸 수 있습니다." : "";
  }

  // 잠금 UI
  const locked = state.locked;
  els.lockedBanner.classList.toggle("is-hidden", !locked);
  els.btnLock.disabled = locked;
  els.btnLock.textContent = locked ? "확정됨" : "예산안 확정 (Lock)";

  const fields = [
    els.real,
    els.scheduled,
    els.other,
    els.hope,
    els.living,
    els.activity,
    els.essential,
  ];
  for (const f of fields) {
    f.disabled = locked;
  }
}

function persist() {
  saveState(getMonthKey(), state);
}

function loadMonth(monthKey) {
  const loaded = loadState(monthKey);
  state = loaded ? { ...emptyState(), ...loaded } : emptyState();
  writeInputsFromState();
  lastMonthKey = monthKey;
  render();
}

function lockPlan() {
  const ti = totalIncome();
  if (ti <= 0) {
    alert("총 소득이 0원입니다. 소득을 입력한 뒤 확정해 주세요.");
    return;
  }
  const rem = remainder();
  if (rem < 0) {
    alert("배분 합이 총 소득을 초과했습니다. 금액을 조정한 뒤 확정해 주세요.");
    return;
  }
  const ok = confirm("이번 달 예산안을 확정할까요? 확정 후에는 이 달의 입력을 수정할 수 없습니다.");
  if (!ok) return;
  state.locked = true;
  state.lockedAt = new Date().toISOString();
  persist();
  render();
}

function exportExcel() {
  if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 네트워크를 확인해 주세요.");
    return;
  }

  readInputsIntoState();
  const monthKey = getMonthKey();
  const ti = totalIncome();
  const ta = totalAllocated();
  const rem = remainder();

  const summary = [
    { 구분: "기준월", 값: monthKey },
    { 구분: "실제소득", 값: state.real },
    { 구분: "예정소득", 값: state.scheduled },
    { 구분: "기타소득", 값: state.other },
    { 구분: "희망소득", 값: state.hope },
    { 구분: "총소득", 값: ti },
    { 구분: "생활비", 값: state.living },
    { 구분: "활동비", 값: state.activity },
    { 구분: "필수비용", 값: state.essential },
    { 구분: "배분합", 값: ta },
    { 구분: "잔여소득", 값: rem },
    { 구분: "확정여부", 값: state.locked ? "확정" : "미확정" },
    { 구분: "확정일시", 값: state.lockedAt || "-" },
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws1, "요약");

  const detail = [
    { 섹션: "소득", 항목: "실제소득", 금액: state.real },
    { 섹션: "소득", 항목: "예정소득", 금액: state.scheduled },
    { 섹션: "소득", 항목: "기타소득", 금액: state.other },
    { 섹션: "소득", 항목: "희망소득", 금액: state.hope },
    { 섹션: "예산", 항목: "생활비", 금액: state.living },
    { 섹션: "예산", 항목: "활동비", 금액: state.activity },
    { 섹션: "예산", 항목: "필수비용", 금액: state.essential },
  ];
  const ws2 = XLSX.utils.json_to_sheet(detail);
  XLSX.utils.book_append_sheet(wb, ws2, "상세");

  const fname =
    typeof ExcelManager !== "undefined" && ExcelManager.makeFilename
      ? ExcelManager.makeFilename(`BudgetSetup_${monthKey.replace("-", "")}`)
      : `MoneyCalendar_BudgetSetup_${monthKey.replace("-", "")}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function onInput() {
  if (state.locked) return;
  readInputsIntoState();
  persist();
  render();
}

function init() {
  // Excel Manager (template download + import with merge modal)
  if (typeof ExcelManager !== "undefined") {
    try {
      ExcelManager.mount("excel-tools", "BudgetSetup", function (mode, parsed) {
        const row = parsed && parsed.BudgetSetup ? parsed.BudgetSetup : null;
        if (!row) throw new Error("BudgetSetup 시트를 찾지 못했습니다.");

        const incoming = {
          real: parseNonNeg(row.real),
          scheduled: parseNonNeg(row.scheduled),
          other: parseNonNeg(row.other),
          hope: parseNonNeg(row.hope),
          living: parseNonNeg(row.living),
          activity: parseNonNeg(row.activity),
          essential: parseNonNeg(row.essential),
          locked: Boolean(row.locked),
          lockedAt: typeof row.lockedAt === "string" ? row.lockedAt : null,
        };

        if (mode === "overwrite") {
          state = { ...emptyState(), ...incoming };
        } else {
          // merge: keep current values, fill zeros from import
          readInputsIntoState();
          const merged = { ...state };
          for (const k of ["real", "scheduled", "other", "hope", "living", "activity", "essential"]) {
            if (parseNonNeg(merged[k]) === 0 && parseNonNeg(incoming[k]) > 0) merged[k] = incoming[k];
          }
          merged.locked = Boolean(state.locked || incoming.locked);
          merged.lockedAt = state.lockedAt || incoming.lockedAt || null;
          state = merged;
        }

        persist();
        writeInputsFromState();
        render();
      });
    } catch {
      /* ignore */
    }
  }

  els.month.value = currentMonthKey();
  lastMonthKey = els.month.value;
  loadMonth(els.month.value);

  [
    els.real,
    els.scheduled,
    els.other,
    els.hope,
    els.living,
    els.activity,
    els.essential,
  ].forEach((el) => el.addEventListener("input", onInput));

  els.month.addEventListener("change", () => {
    const nextKey = els.month.value || currentMonthKey();
    readInputsIntoState();
    saveState(lastMonthKey, state);
    loadMonth(nextKey);
  });

  els.btnLock.addEventListener("click", () => {
    readInputsIntoState();
    if (!state.locked) lockPlan();
  });

  els.btnExport.addEventListener("click", () => {
    readInputsIntoState();
    exportExcel();
  });
}

document.addEventListener("DOMContentLoaded", init);
