/**
 * 계층형 수입 설계 엔진
 * - 4계층 입력 + 컬러 시스템
 * - 확정 자산(실제+예정) / 잠재 자산(기타+희망) / 총 소득
 * - 천단위 콤마 입력, 표 동기화, localStorage, xlsx보내기
 */

const STORAGE_KEY = "moneyCalendar.incomeDesign.v1";

const TIERS = [
  { key: "real", label: "실제소득", swatch: "real" },
  { key: "scheduled", label: "예정소득", swatch: "scheduled" },
  { key: "other", label: "기타소득", swatch: "other" },
  { key: "hope", label: "희망소득", swatch: "hope" },
];

/** @typedef {{ real: number, scheduled: number, other: number, hope: number }} IncomeState */

/** @type {IncomeState} */
const amounts = { real: 0, scheduled: 0, other: 0, hope: 0 };

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

function pct(part, total) {
  if (!total || !Number.isFinite(part)) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function confirmedTotal() {
  return amounts.real + amounts.scheduled;
}

function latentTotal() {
  return amounts.other + amounts.hope;
}

function grandTotal() {
  return amounts.real + amounts.scheduled + amounts.other + amounts.hope;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    amounts.real = Math.max(0, Math.trunc(Number(o.real) || 0));
    amounts.scheduled = Math.max(0, Math.trunc(Number(o.scheduled) || 0));
    amounts.other = Math.max(0, Math.trunc(Number(o.other) || 0));
    amounts.hope = Math.max(0, Math.trunc(Number(o.hope) || 0));
  } catch {
    /* ignore */
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(amounts));
}

function wireMoneyInput(id, key) {
  const el = /** @type {HTMLInputElement} */ ($(id));

  el.addEventListener("input", () => {
    const n = parseWon(el.value);
    amounts[key] = n;
    const next = n === 0 && digitsOnly(el.value) === "" ? "" : formatWon(n);
    if (el.value !== next) el.value = next;
    save();
    render();
  });

  el.addEventListener("blur", () => {
    const n = parseWon(el.value);
    amounts[key] = n;
    const next = n === 0 ? "" : formatWon(n);
    if (el.value !== next) el.value = next;
    save();
    render();
  });
}

function setBarWidths() {
  const t = grandTotal();
  const set = (id, v) => {
    const pctVal = t > 0 ? (v / t) * 100 : 0;
    $(id).style.width = `${pctVal}%`;
  };
  set("bar-real", amounts.real);
  set("bar-scheduled", amounts.scheduled);
  set("bar-other", amounts.other);
  set("bar-hope", amounts.hope);
}

function renderDashboard() {
  $("dash-confirmed").textContent = formatWonAlways(confirmedTotal());
  $("dash-latent").textContent = formatWonAlways(latentTotal());
  $("dash-total").textContent = formatWonAlways(grandTotal());
  setBarWidths();
}

function renderTable() {
  const tbody = $("table-body");
  tbody.innerHTML = "";
  const t = grandTotal();

  for (const row of TIERS) {
    const v = amounts[row.key];
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;

    const tdSw = document.createElement("td");
    const sw = document.createElement("span");
    sw.className = "swatch";
    const dot = document.createElement("span");
    dot.className = `swatch-dot swatch-dot--${row.swatch}`;
    dot.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent =
      row.swatch === "real"
        ? "Deep Blue"
        : row.swatch === "scheduled"
          ? "Light Blue"
          : row.swatch === "other"
            ? "Green"
            : "Purple";
    sw.appendChild(dot);
    sw.appendChild(name);
    tdSw.appendChild(sw);

    const tdAmt = document.createElement("td");
    tdAmt.className = "col-num";
    tdAmt.textContent = formatWonAlways(v);

    const tdPct = document.createElement("td");
    tdPct.className = "col-num";
    tdPct.textContent = pct(v, t);

    tr.appendChild(tdLabel);
    tr.appendChild(tdSw);
    tr.appendChild(tdAmt);
    tr.appendChild(tdPct);
    tbody.appendChild(tr);
  }

  const summaryRows = [
    { label: "확정 자산 (실제+예정)", value: confirmedTotal() },
    { label: "잠재 자산 (기타+희망)", value: latentTotal() },
    { label: "총 소득", value: t },
  ];

  for (const s of summaryRows) {
    const tr = document.createElement("tr");
    tr.className = "row-strong";
    tr.innerHTML = `
      <td colspan="2">${s.label}</td>
      <td class="col-num">${formatWonAlways(s.value)}</td>
      <td class="col-num">${pct(s.value, t)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function exportExcel() {
  if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 네트워크를 확인해 주세요.");
    return;
  }

  const t = grandTotal();
  const rows = [
    { 구분: "실제소득", 금액: amounts.real, 색상코드: "Deep Blue (#1e3a8a)" },
    { 구분: "예정소득", 금액: amounts.scheduled, 색상코드: "Light Blue (#38bdf8)" },
    { 구분: "기타소득", 금액: amounts.other, 색상코드: "Green (#059669)" },
    { 구분: "희망소득", 금액: amounts.hope, 색상코드: "Purple (#7c3aed)" },
    { 구분: "확정 자산 (실제+예정)", 금액: confirmedTotal(), 색상코드: "-" },
    { 구분: "잠재 자산 (기타+희망)", 금액: latentTotal(), 색상코드: "-" },
    { 구분: "총 소득", 금액: t, 색상코드: "-" },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "수입계층");

  const meta = [
    { 항목: "확정 자산 정의", 내용: "실제소득 + 예정소득" },
    { 항목: "잠재 자산 정의", 내용: "기타소득 + 희망소득" },
    { 항목: "생성일시", 내용: new Date().toISOString() },
  ];
  const ws2 = XLSX.utils.json_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, ws2, "메타");

  const fname =
    typeof ExcelManager !== "undefined" && ExcelManager.makeFilename
      ? ExcelManager.makeFilename("IncomeDesign_" + new Date().toISOString().slice(0, 10).replace(/-/g, ""))
      : `MoneyCalendar_IncomeDesign_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function render() {
  renderDashboard();
  renderTable();
}

function hydrateInputs() {
  const map = [
    ["amt-real", "real"],
    ["amt-scheduled", "scheduled"],
    ["amt-other", "other"],
    ["amt-hope", "hope"],
  ];
  for (const [id, key] of map) {
    const el = /** @type {HTMLInputElement} */ ($(id));
    el.value = amounts[key] ? formatWon(amounts[key]) : "";
  }
}

function init() {
  load();
  hydrateInputs();

  // Excel Manager (import / export)
  if (typeof ExcelManager !== "undefined") {
    try {
      ExcelManager.mount("excel-control-root", "IncomeDesign", {
        applyData(mode, parsed) {
          const row = parsed && parsed.IncomeDesign ? parsed.IncomeDesign : null;
          if (!row) throw new Error("IncomeDesign 시트를 찾지 못했습니다.");
          const incoming = {
            real: Math.max(0, Math.trunc(Number(row.real) || 0)),
            scheduled: Math.max(0, Math.trunc(Number(row.scheduled) || 0)),
            other: Math.max(0, Math.trunc(Number(row.other) || 0)),
            hope: Math.max(0, Math.trunc(Number(row.hope) || 0)),
          };

          if (mode === "overwrite") {
            amounts.real = incoming.real;
            amounts.scheduled = incoming.scheduled;
            amounts.other = incoming.other;
            amounts.hope = incoming.hope;
          } else {
            if (amounts.real === 0 && incoming.real > 0) amounts.real = incoming.real;
            if (amounts.scheduled === 0 && incoming.scheduled > 0) amounts.scheduled = incoming.scheduled;
            if (amounts.other === 0 && incoming.other > 0) amounts.other = incoming.other;
            if (amounts.hope === 0 && incoming.hope > 0) amounts.hope = incoming.hope;
          }
          save();
          hydrateInputs();
          render();
        },
        onExportCurrent() {
          exportExcel();
        },
      });
    } catch {
      /* ignore */
    }
  }

  wireMoneyInput("amt-real", "real");
  wireMoneyInput("amt-scheduled", "scheduled");
  wireMoneyInput("amt-other", "other");
  wireMoneyInput("amt-hope", "hope");
  render();
}

document.addEventListener("DOMContentLoaded", init);
