/**
 * 비전 기반 예산 할당
 * - 비전 목록(단기/장기, 최종 목표, 누적 진행, 이번 달 할당)
 * - 우선순위 순으로 수입에서 차감 → 잔여 가용 예산
 * - 진행률 프로그레스 바, localStorage, xlsx
 */

const STORAGE_KEY = "moneyCalendar.visionBudget.v1";
const INCOME_DESIGN_KEY = "moneyCalendar.incomeDesign.v1";

/** @typedef {{ id: string, title: string, horizon: 'short' | 'long', targetAmount: number, currentProgress: number, monthlyAllocation: number, order: number }} Vision */

/** @type {number} */
let totalIncome = 0;

/** @type {Vision[]} */
let visions = [];

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function digitsOnly(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

function parseWon(raw) {
  const d = digitsOnly(raw);
  if (!d) return 0;
  const n = Number(d);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.trunc(n), 9_007_199_254_740_991);
}

function formatWon(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return new Intl.NumberFormat("ko-KR").format(v);
}

function formatWonAlways(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "0원";
  return `${new Intl.NumberFormat("ko-KR").format(Math.trunc(v))}원`;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortedVisions() {
  return [...visions].sort((a, b) => a.order - b.order);
}

function sumMonthly() {
  return visions.reduce((s, v) => s + v.monthlyAllocation, 0);
}

function remainderAfterVision() {
  return totalIncome - sumMonthly();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    totalIncome = Math.max(0, Math.trunc(Number(o.totalIncome) || 0));
    const arr = Array.isArray(o.visions) ? o.visions : [];
    visions = arr
      .map((v, i) => ({
        id: String(v.id || createId()),
        title: String(v.title || "").slice(0, 80),
        horizon: v.horizon === "long" ? "long" : "short",
        targetAmount: Math.max(0, Math.trunc(Number(v.targetAmount) || 0)),
        currentProgress: Math.max(0, Math.trunc(Number(v.currentProgress) || 0)),
        monthlyAllocation: Math.max(0, Math.trunc(Number(v.monthlyAllocation) || 0)),
        order: Number.isFinite(Number(v.order)) ? Number(v.order) : i,
      }))
      .filter((v) => v.title);
    normalizeOrders();
  } catch {
    /* ignore */
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      totalIncome,
      visions,
    })
  );
}

function wireMoneyField(inputEl, onChange) {
  const apply = () => {
    const n = parseWon(inputEl.value);
    const next = n === 0 && digitsOnly(inputEl.value) === "" ? "" : formatWon(n);
    if (inputEl.value !== next) inputEl.value = next;
    onChange(n);
  };
  inputEl.addEventListener("input", apply);
  inputEl.addEventListener("blur", apply);
}

function syncFromIncomeDesign() {
  try {
    const raw = localStorage.getItem(INCOME_DESIGN_KEY);
    if (!raw) {
      alert("수입 설계에 저장된 데이터가 없습니다. 먼저 계층형 수입 설계 페이지에서 입력해 주세요.");
      return;
    }
    const o = JSON.parse(raw);
    const sum =
      Math.max(0, Math.trunc(Number(o.real) || 0)) +
      Math.max(0, Math.trunc(Number(o.scheduled) || 0)) +
      Math.max(0, Math.trunc(Number(o.other) || 0)) +
      Math.max(0, Math.trunc(Number(o.hope) || 0));
    totalIncome = sum;
    const el = /** @type {HTMLInputElement} */ ($("total-income"));
    el.value = sum ? formatWon(sum) : "";
    save();
    render();
  } catch {
    alert("불러오기에 실패했습니다.");
  }
}

function renderWaterfall() {
  const box = $("waterfall");
  box.innerHTML = "";

  const head = document.createElement("div");
  head.className = "wf-row wf-row--head";
  head.innerHTML = `<div class="wf-label">흐름</div><div class="wf-amt">금액</div>`;
  box.appendChild(head);

  const row0 = document.createElement("div");
  row0.className = "wf-row";
  row0.innerHTML = `<div class="wf-label">① 월 가용 수입</div><div class="wf-amt">${formatWonAlways(totalIncome)}</div>`;
  box.appendChild(row0);

  let running = totalIncome;
  const ordered = sortedVisions();

  ordered.forEach((v, idx) => {
    running -= v.monthlyAllocation;
    const row = document.createElement("div");
    row.className = `wf-row wf-row--vision ${v.horizon === "long" ? "wf-row--long" : "wf-row--short"}`;
    const horizonLabel = v.horizon === "long" ? "장기" : "단기";
    row.innerHTML = `
      <div class="wf-label">
        비전 차감 ${idx + 1} · ${escapeHtml(v.title)}
        <span class="wf-meta">${horizonLabel} · 이번 달 비전 할당</span>
      </div>
      <div class="wf-amt">− ${formatWonAlways(v.monthlyAllocation)}</div>
    `;
    box.appendChild(row);

    const rowR = document.createElement("div");
    rowR.className = "wf-row";
    const neg = running < 0;
    rowR.innerHTML = `
      <div class="wf-label">잔여 가용 예산 <span class="wf-meta">비전 ${idx + 1} 반영 후</span></div>
      <div class="wf-amt ${neg ? "wf-amt--neg" : "wf-amt--remain"}">${formatWonAlways(running)}</div>
    `;
    box.appendChild(rowR);
  });

  if (ordered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "wf-row";
    empty.innerHTML = `
      <div class="wf-label">비전이 없습니다. 위 폼에서 목표를 추가하면 여기에 차감 흐름이 나타납니다.</div>
      <div class="wf-amt wf-amt--remain">${formatWonAlways(totalIncome)}</div>
    `;
    box.appendChild(empty);
  }

  const total = document.createElement("div");
  total.className = "wf-row wf-row--total";
  const rem = remainderAfterVision();
  const over = rem < 0;
  total.innerHTML = `
    <div class="wf-label">최종 잔여 가용 예산 <span class="wf-meta">비전 할당 합 이후</span></div>
    <div class="wf-amt ${over ? "wf-amt--neg" : "wf-amt--remain"}">${formatWonAlways(rem)}</div>
  `;
  box.appendChild(total);

  $("over-alert").classList.toggle("is-hidden", !over);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function progressPct(v) {
  if (!v.targetAmount || v.targetAmount <= 0) return 0;
  return Math.min(100, (v.currentProgress / v.targetAmount) * 100);
}

function remainingToGoal(v) {
  return Math.max(0, v.targetAmount - v.currentProgress);
}

function renderVisionList() {
  const host = $("vision-list");
  host.innerHTML = "";

  const ordered = sortedVisions();
  if (ordered.length === 0) {
    const p = document.createElement("p");
    p.className = "text-sm";
    p.textContent = "등록된 비전이 없습니다.";
    host.appendChild(p);
    return;
  }

  ordered.forEach((v, idx) => {
    const article = document.createElement("article");
    article.className = `vision-item vision-item--${v.horizon}`;
    article.dataset.id = v.id;

    const pct = progressPct(v);
    const left = remainingToGoal(v);

    article.innerHTML = `
      <div class="vision-item__top">
        <h3 class="vision-item__title">${escapeHtml(v.title)}</h3>
        <div class="vision-item__badges">
          <span class="badge badge--prio">우선순위 ${idx + 1}</span>
          <span class="badge ${v.horizon === "long" ? "badge--long" : "badge--short"}">${
            v.horizon === "long" ? "장기" : "단기"
          }</span>
        </div>
      </div>
      <div class="vision-item__stats">
        <div class="stat">
          <div class="stat-k">최종 목표</div>
          <div class="stat-v">${formatWonAlways(v.targetAmount)}</div>
        </div>
        <div class="stat">
          <div class="stat-k">누적 진행</div>
          <div class="stat-v">${formatWonAlways(v.currentProgress)}</div>
        </div>
        <div class="stat">
          <div class="stat-k">이번 달 할당</div>
          <div class="stat-v">${formatWonAlways(v.monthlyAllocation)}</div>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label">
          <span>목표 대비 진행률</span>
          <span>${pct.toFixed(1)}% · 목표까지 ${formatWonAlways(left)}</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(
          pct
        )}">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="vision-item__actions">
        <button type="button" class="btn-ghost" data-action="up" data-id="${v.id}">순위 올리기</button>
        <button type="button" class="btn-ghost" data-action="down" data-id="${v.id}">순위 내리기</button>
        <button type="button" class="btn-ghost btn-danger-lite" data-action="del" data-id="${v.id}">삭제</button>
      </div>
    `;
    host.appendChild(article);
  });
}

function normalizeOrders() {
  sortedVisions().forEach((v, i) => {
    const item = visions.find((x) => x.id === v.id);
    if (item) item.order = i;
  });
}

function moveVision(id, dir) {
  const ordered = sortedVisions();
  const i = ordered.findIndex((v) => v.id === id);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ordered.length) return;
  const arr = [...ordered];
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
  arr.forEach((v, idx) => {
    const it = visions.find((x) => x.id === v.id);
    if (it) it.order = idx;
  });
  save();
  render();
}

function deleteVision(id) {
  if (!confirm("이 비전을 삭제할까요?")) return;
  visions = visions.filter((v) => v.id !== id);
  normalizeOrders();
  save();
  render();
}

function render() {
  renderWaterfall();
  renderVisionList();
}

function onVisionListClick(e) {
  const t = /** @type {HTMLElement} */ (e.target);
  const btn = t.closest("button[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (!id || !action) return;
  if (action === "up") moveVision(id, "up");
  else if (action === "down") moveVision(id, "down");
  else if (action === "del") deleteVision(id);
}

function exportExcel() {
  if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }

  const ordered = sortedVisions();
  const rows = ordered.map((v, idx) => ({
    우선순위: idx + 1,
    구분: v.horizon === "long" ? "장기" : "단기",
    목표명: v.title,
    최종목표금액: v.targetAmount,
    누적진행금액: v.currentProgress,
    이번달비전할당: v.monthlyAllocation,
    진행률: `${progressPct(v).toFixed(1)}%`,
    목표까지남은금액: remainingToGoal(v),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "비전목록");

  const summary = [
    { 항목: "월가용수입", 금액: totalIncome },
    { 항목: "비전할당합", 금액: sumMonthly() },
    { 항목: "잔여가용예산", 금액: remainderAfterVision() },
    { 항목: "생성일시", 금액: new Date().toISOString() },
  ];
  const ws2 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws2, "요약");

  XLSX.writeFile(wb, `money-calendar-vision-budget_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function initForm() {
  $("vision-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("vf-title").value.trim();
    if (!title) {
      alert("목표 이름을 입력해 주세요.");
      return;
    }
    const targetAmount = parseWon($("vf-target").value);
    const currentProgress = parseWon($("vf-progress").value);
    const monthlyAllocation = parseWon($("vf-monthly").value);
    if (targetAmount <= 0) {
      alert("최종 목표 금액은 1원 이상이어야 합니다.");
      return;
    }
    if (monthlyAllocation < 0) {
      alert("이번 달 비전 할당액은 0원 이상이어야 합니다.");
      return;
    }
    const horizon = /** @type {'short'|'long'} */ ($("vf-horizon").value === "long" ? "long" : "short");
    const maxOrder = visions.reduce((m, v) => Math.max(m, v.order), -1);
    visions.push({
      id: createId(),
      title,
      horizon,
      targetAmount,
      currentProgress,
      monthlyAllocation,
      order: maxOrder + 1,
    });
    /** @type {HTMLFormElement} */ (e.target).reset();
    save();
    render();
  });
}

function init() {
  load();
  const ti = /** @type {HTMLInputElement} */ ($("total-income"));
  ti.value = totalIncome ? formatWon(totalIncome) : "";
  wireMoneyField(ti, (n) => {
    totalIncome = n;
    save();
    render();
  });

  $("btn-sync-income").addEventListener("click", syncFromIncomeDesign);
  $("vision-list").addEventListener("click", onVisionListClick);
  $("btn-excel").addEventListener("click", exportExcel);
  initForm();
  render();
}

document.addEventListener("DOMContentLoaded", init);
