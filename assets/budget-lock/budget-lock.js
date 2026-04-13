/**
 * 예산안 확정 및 락(Lock) 관리
 * - moneyCalendar.budgetSetup.v1.{월} 과 동기화
 * - moneyCalendar.budgetLockHistory.v1.{월} 변경 타임라인
 * - moneyCalendar.budgetLockArchive.v1 확정 스냅샷 목록
 */

const BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";
const HISTORY_PREFIX = "moneyCalendar.budgetLockHistory.v1";
const ARCHIVE_KEY = "moneyCalendar.budgetLockArchive.v1";
const MAX_ARCHIVE = 120;

/** @typedef {{ real: number, scheduled: number, other: number, hope: number, living: number, activity: number, essential: number, locked: boolean, lockedAt: string | null }} BudgetState */

/** @typedef {{ id: string, at: string, kind: 'lock' | 'unlock' | 'relock', deltas?: { key: string, label: string, before: number, after: number }[] }} HistoryEntry */

/** @typedef {{ id: string, monthKey: string, lockedAt: string, snapshot: Omit<BudgetState, 'locked'|'lockedAt'> }} ArchiveEntry */

const FIELD_LABELS = {
  real: "실제소득",
  scheduled: "예정소득",
  other: "기타소득",
  hope: "희망소득",
  living: "생활비",
  activity: "활동비",
  essential: "필수비용",
};

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function storageKeyBudget(monthKey) {
  return `${BUDGET_PREFIX}.${monthKey}`;
}

function storageKeyHistory(monthKey) {
  return `${HISTORY_PREFIX}.${monthKey}`;
}

function parseNonNeg(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function formatKRW(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0원";
  return `${new Intl.NumberFormat("ko-KR").format(Math.trunc(v))}원`;
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

/** @param {string} monthKey */
function loadBudget(monthKey) {
  try {
    const raw = localStorage.getItem(storageKeyBudget(monthKey));
    if (!raw) return emptyState();
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
    return emptyState();
  }
}

/** @param {string} monthKey @param {BudgetState} s */
function saveBudget(monthKey, s) {
  localStorage.setItem(storageKeyBudget(monthKey), JSON.stringify(s));
}

/** @param {string} monthKey */
function loadHistory(monthKey) {
  try {
    const raw = localStorage.getItem(storageKeyHistory(monthKey));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** @param {string} monthKey @param {HistoryEntry[]} h */
function saveHistory(monthKey, h) {
  localStorage.setItem(storageKeyHistory(monthKey), JSON.stringify(h));
}

function loadArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** @param {ArchiveEntry[]} a */
function saveArchive(a) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a.slice(0, MAX_ARCHIVE)));
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function snapshotNums(s) {
  return {
    real: s.real,
    scheduled: s.scheduled,
    other: s.other,
    hope: s.hope,
    living: s.living,
    activity: s.activity,
    essential: s.essential,
  };
}

function totalIncome(s) {
  return s.real + s.scheduled + s.other + s.hope;
}

function allocated(s) {
  return s.living + s.activity + s.essential;
}

function remainder(s) {
  return totalIncome(s) - allocated(s);
}

/** @type {string} */
let monthKey = currentMonthKey();

/** @type {BudgetState} */
let state = emptyState();

/** 락 해제 직전 스냅샷 — 재확정 시 차이 계산용 */
/** @type {ReturnType<snapshotNums> | null} */
let unlockBaseline = null;

const els = {
  month: /** @type {HTMLInputElement} */ ($("plan-month")),
  fields: {
    real: /** @type {HTMLInputElement} */ ($("f-real")),
    scheduled: /** @type {HTMLInputElement} */ ($("f-scheduled")),
    other: /** @type {HTMLInputElement} */ ($("f-other")),
    hope: /** @type {HTMLInputElement} */ ($("f-hope")),
    living: /** @type {HTMLInputElement} */ ($("f-living")),
    activity: /** @type {HTMLInputElement} */ ($("f-activity")),
    essential: /** @type {HTMLInputElement} */ ($("f-essential")),
  },
  fieldsetIncome: /** @type {HTMLFieldSetElement} */ ($("fieldset-income")),
  fieldsetBudget: /** @type {HTMLFieldSetElement} */ ($("fieldset-budget")),
  summaryLine: $("summary-line"),
  statusStrip: $("status-strip"),
  lockBadge: $("lock-badge"),
  btnLock: /** @type {HTMLButtonElement} */ ($("btn-lock")),
  btnUnlock: /** @type {HTMLButtonElement} */ ($("btn-unlock")),
  btnRelock: /** @type {HTMLButtonElement} */ ($("btn-relock")),
  unlockNote: $("unlock-note"),
  historyTimeline: $("history-timeline"),
  historyEmpty: $("history-empty"),
  archiveBody: $("archive-body"),
  archiveEmpty: $("archive-empty"),
  calendarHint: $("calendar-hint"),
};

function readFormIntoState() {
  state.real = parseNonNeg(els.fields.real.value);
  state.scheduled = parseNonNeg(els.fields.scheduled.value);
  state.other = parseNonNeg(els.fields.other.value);
  state.hope = parseNonNeg(els.fields.hope.value);
  state.living = parseNonNeg(els.fields.living.value);
  state.activity = parseNonNeg(els.fields.activity.value);
  state.essential = parseNonNeg(els.fields.essential.value);
}

function writeStateToForm() {
  for (const k of /** @type {(keyof typeof els.fields)[]} */ ([
    "real",
    "scheduled",
    "other",
    "hope",
    "living",
    "activity",
    "essential",
  ])) {
    els.fields[k].value = String(state[k] ?? 0);
  }
}

function appendHistory(entry) {
  const h = loadHistory(monthKey);
  h.unshift(entry);
  saveHistory(monthKey, h);
}

function appendArchive() {
  const snap = snapshotNums(state);
  const entry = {
    id: createId(),
    monthKey,
    lockedAt: state.lockedAt || new Date().toISOString(),
    snapshot: snap,
  };
  const all = loadArchive();
  all.unshift(entry);
  saveArchive(all);
}

function computeDeltas(before, after) {
  /** @type {HistoryEntry['deltas']} */
  const deltas = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const k = /** @type {keyof typeof FIELD_LABELS} */ (key);
    if (before[k] !== after[k]) {
      deltas.push({
        key,
        label: FIELD_LABELS[k],
        before: before[k],
        after: after[k],
      });
    }
  }
  return deltas;
}

function validateForLock() {
  const ti = totalIncome(state);
  if (ti <= 0) {
    alert("총 소득이 0원입니다. 소득을 입력한 뒤 확정해 주세요.");
    return false;
  }
  if (remainder(state) < 0) {
    alert("배분 합이 총 소득을 초과했습니다. 금액을 조정한 뒤 확정해 주세요.");
    return false;
  }
  return true;
}

function applyLockUI() {
  const locked = state.locked;
  els.fieldsetIncome.disabled = locked;
  els.fieldsetBudget.disabled = locked;

  els.btnLock.classList.toggle("is-hidden", locked);
  els.btnUnlock.classList.toggle("is-hidden", !locked);
  els.btnRelock.classList.toggle("is-hidden", locked || unlockBaseline === null);
  els.unlockNote.classList.toggle("is-hidden", locked || unlockBaseline === null);

  els.lockBadge.textContent = locked ? "🔒" : "🔓";

  const ti = totalIncome(state);
  const rem = remainder(state);
  els.statusStrip.innerHTML = `
    <span class="status-pill ${locked ? "status-pill--locked" : "status-pill--open"}">
      <span class="lock-icon" aria-hidden="true">${locked ? "🔒" : "🔓"}</span>
      ${locked ? "Lock · 읽기 전용" : "편집 가능 · 미확정"}
    </span>
    <span class="status-pill">총 소득 ${formatKRW(ti)}</span>
    <span class="status-pill">잔여 ${formatKRW(rem)}</span>
    ${state.lockedAt ? `<span class="status-pill">확정 시각 ${escapeHtml(formatLocal(state.lockedAt))}</span>` : ""}
  `;

  els.summaryLine.textContent = `배분 합 ${formatKRW(allocated(state))} · 잔여 ${formatKRW(rem)} · 총 소득 대비 배분 ${ti > 0 ? ((allocated(state) / ti) * 100).toFixed(1) : "0"}%`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLocal(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function isLastWeekOfCalendarMonth(d = new Date()) {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() > lastDay - 7;
}

function renderCalendarHint() {
  const hint = els.calendarHint;
  const now = new Date();
  const cm = currentMonthKey();
  const selected = els.month.value || cm;
  const show =
    isLastWeekOfCalendarMonth(now) && selected === cm && !state.locked;

  if (!show) {
    hint.classList.add("is-hidden");
    return;
  }
  hint.classList.remove("is-hidden");
  hint.innerHTML = `
    <strong>이번 달 마지막 주입니다.</strong>
    다음 달로 넘어가기 전에 예산안을 확정·락해 두면 계획이 흐트러지지 않습니다. 현재 월(${escapeHtml(
      cm
    )}) 기준으로 작성 상태: <strong>${state.locked ? "이미 확정됨" : "미확정 — 확정을 권장합니다."}</strong>
  `;
}

function renderHistory() {
  const list = loadHistory(monthKey);
  const host = els.historyTimeline;
  host.innerHTML = "";

  if (list.length === 0) {
    els.historyEmpty.classList.remove("is-hidden");
    return;
  }
  els.historyEmpty.classList.add("is-hidden");

  for (const e of list) {
    const li = document.createElement("li");
    li.className = `kind-${e.kind}`;
    const title =
      e.kind === "lock"
        ? "예산안 확정 (Lock)"
        : e.kind === "unlock"
          ? "락 해제 — 수정 허용"
          : "재확정 (변경 반영 후 Lock)";

    let body = `<p class="tl-time">${escapeHtml(formatLocal(e.at))}</p><p class="tl-title">${escapeHtml(title)}</p>`;
    if (e.kind === "relock" && e.deltas && e.deltas.length) {
      body += `<div class="tl-deltas"><ul>${e.deltas
        .map(
          (d) =>
            `<li>${escapeHtml(d.label)}: ${formatKRW(d.before)} → ${formatKRW(d.after)} (차이 ${formatKRW(
              d.after - d.before
            )})</li>`
        )
        .join("")}</ul></div>`;
    }
    li.innerHTML = body;
    host.appendChild(li);
  }
}

function exportSnapshotExcel(snap, labelMonth, lockedAt) {
  if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }
  const rows = [
    { 구분: "기준월", 값: labelMonth },
    { 구분: "확정일시", 값: lockedAt },
    { 구분: "실제소득", 값: snap.real },
    { 구분: "예정소득", 값: snap.scheduled },
    { 구분: "기타소득", 값: snap.other },
    { 구분: "희망소득", 값: snap.hope },
    { 구분: "생활비", 값: snap.living },
    { 구분: "활동비", 값: snap.activity },
    { 구분: "필수비용", 값: snap.essential },
    {
      구분: "총소득",
      값: snap.real + snap.scheduled + snap.other + snap.hope,
    },
    {
      구분: "배분합",
      값: snap.living + snap.activity + snap.essential,
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "예산스냅샷");
  const safe = labelMonth.replace(/[^\d-]/g, "");
  XLSX.writeFile(wb, `money-calendar-budget-lock_${safe}_${lockedAt.slice(0, 10)}.xlsx`);
}

function renderArchive() {
  const all = loadArchive();
  const body = els.archiveBody;
  body.innerHTML = "";

  if (all.length === 0) {
    els.archiveEmpty.classList.remove("is-hidden");
    return;
  }
  els.archiveEmpty.classList.add("is-hidden");

  for (const row of all) {
    const s = row.snapshot;
    const ti = s.real + s.scheduled + s.other + s.hope;
    const al = s.living + s.activity + s.essential;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.monthKey)}</td>
      <td>${escapeHtml(formatLocal(row.lockedAt))}</td>
      <td class="num">${escapeHtml(formatKRW(ti))}</td>
      <td class="num">${escapeHtml(formatKRW(al))}</td>
      <td class="num">${escapeHtml(formatKRW(ti - al))}</td>
      <td><button type="button" class="btn-secondary btn-sm" data-archive-id="${escapeHtml(row.id)}">엑셀</button></td>
    `;
    body.appendChild(tr);
  }
}

function onArchiveClick(e) {
  const t = /** @type {HTMLElement} */ (e.target);
  const btn = t.closest("button[data-archive-id]");
  if (!btn) return;
  const id = btn.getAttribute("data-archive-id");
  const all = loadArchive();
  const row = all.find((x) => x.id === id);
  if (!row) return;
  exportSnapshotExcel(row.snapshot, row.monthKey, row.lockedAt);
}

function onLock() {
  readFormIntoState();
  if (!validateForLock()) return;
  if (!confirm("이번 달 예산안을 확정하고 읽기 전용으로 잠글까요?")) return;

  state.locked = true;
  state.lockedAt = new Date().toISOString();
  unlockBaseline = null;
  saveBudget(monthKey, state);
  appendHistory({ id: createId(), at: state.lockedAt, kind: "lock" });
  appendArchive();
  render();
}

function onUnlock() {
  if (!state.locked) return;
  if (!confirm("락을 해제하면 예산안을 수정할 수 있습니다. 변경은 이력에 남습니다. 계속할까요?")) return;
  readFormIntoState();
  unlockBaseline = snapshotNums(state);
  state.locked = false;
  state.lockedAt = null;
  saveBudget(monthKey, state);
  appendHistory({ id: createId(), at: new Date().toISOString(), kind: "unlock" });
  render();
}

function onRelock() {
  readFormIntoState();
  if (!validateForLock()) return;
  if (!unlockBaseline) {
    alert("락 해제 기준이 없습니다. 먼저 락 해제를 수행해 주세요.");
    return;
  }
  if (!confirm("변경 내용을 반영하고 다시 확정(Lock)할까요?")) return;

  const before = unlockBaseline;
  const after = snapshotNums(state);
  const deltas = computeDeltas(before, after);

  state.locked = true;
  state.lockedAt = new Date().toISOString();
  unlockBaseline = null;
  saveBudget(monthKey, state);
  appendHistory({
    id: createId(),
    at: state.lockedAt,
    kind: "relock",
    deltas: deltas.length ? deltas : undefined,
  });
  appendArchive();
  render();
}

function wireFieldInputs() {
  for (const el of Object.values(els.fields)) {
    el.addEventListener("input", () => {
      if (state.locked) return;
      readFormIntoState();
      saveBudget(monthKey, state);
      applyLockUI();
      els.summaryLine.textContent = `배분 합 ${formatKRW(allocated(state))} · 잔여 ${formatKRW(
        remainder(state)
      )} · 총 소득 대비 배분 ${
        totalIncome(state) > 0 ? ((allocated(state) / totalIncome(state)) * 100).toFixed(1) : "0"
      }%`;
      renderCalendarHint();
    });
  }
}

function render() {
  applyLockUI();
  renderHistory();
  renderArchive();
  renderCalendarHint();
}

function init() {
  els.month.value = currentMonthKey();
  monthKey = els.month.value;
  state = loadBudget(monthKey);
  writeStateToForm();

  els.month.addEventListener("change", () => {
    const next = els.month.value || currentMonthKey();
    readFormIntoState();
    saveBudget(monthKey, state);
    monthKey = next;
    state = loadBudget(monthKey);
    unlockBaseline = null;
    writeStateToForm();
    render();
  });

  els.btnLock.addEventListener("click", onLock);
  els.btnUnlock.addEventListener("click", onUnlock);
  els.btnRelock.addEventListener("click", onRelock);
  els.archiveBody.addEventListener("click", onArchiveClick);

  wireFieldInputs();
  render();
}

document.addEventListener("DOMContentLoaded", init);
