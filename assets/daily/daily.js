/* global XLSX, ExcelManager */
/**
 * Money Calendar 기능 5~8 (기획서 명칭)
 * 5. 반응형 퀵-인풋(Quick-Input)
 * 6. 데일리 소비 한 줄 평
 * 7. 1원 단위 체감 지수
 * 8. 무지출 챌린지 스티커
 * - localStorage: moneyCalendar.dailyLedger.v1
 * - 월 기준: moneyCalendar.budgetSetup.v1.{YYYY-MM}, moneyCalendar.budgetSimulator.v1.{YYYY-MM}
 */

(function () {
  "use strict";

  var STORAGE_KEY = "moneyCalendar.dailyLedger.v1";
  var BUDGET_PREFIX = "moneyCalendar.budgetSetup.v1";
  var SIM_PREFIX = "moneyCalendar.budgetSimulator.v1";

  function loadVisionDisposableCap() {
    if (typeof window.MoneyCalendarVisionBudget === "undefined") return 0;
    var snap = window.MoneyCalendarVisionBudget.read();
    if (!snap) return 0;
    return Math.max(0, snap.disposable);
  }

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
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.trunc(n), 9_007_199_254_740_991);
  }

  function formatWon(n) {
    var v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    return new Intl.NumberFormat("ko-KR").format(Math.trunc(v));
  }

  function formatKRW(n) {
    var v = Number(n);
    if (!Number.isFinite(v) || v < 0) return "0원";
    return new Intl.NumberFormat("ko-KR").format(Math.trunc(v)) + "원";
  }

  function today() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function monthKeyFromDate(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function loadBudgetAllocated(monthKey) {
    try {
      var raw = localStorage.getItem(BUDGET_PREFIX + "." + monthKey);
      if (!raw) return 0;
      var o = JSON.parse(raw);
      var living = Math.max(0, Math.trunc(Number(o.living) || 0));
      var activity = Math.max(0, Math.trunc(Number(o.activity) || 0));
      var essential = Math.max(0, Math.trunc(Number(o.essential) || 0));
      return living + activity + essential;
    } catch {
      return 0;
    }
  }

  function loadSimulatorTotal(monthKey) {
    try {
      var raw = localStorage.getItem(SIM_PREFIX + "." + monthKey);
      if (!raw) return 0;
      var o = JSON.parse(raw);
      return Math.max(0, Math.trunc(Number(o.total) || 0));
    } catch {
      return 0;
    }
  }

  /** @returns {{ cap: number, mode: 'alloc'|'sim'|'vision'|'none' }} */
  function getMonthlyBudgetCap(monthKey) {
    var alloc = loadBudgetAllocated(monthKey);
    if (alloc > 0) return { cap: alloc, mode: "alloc" };
    var sim = loadSimulatorTotal(monthKey);
    if (sim > 0) return { cap: sim, mode: "sim" };
    var vis = loadVisionDisposableCap();
    if (vis > 0) return { cap: vis, mode: "vision" };
    return { cap: 0, mode: "none" };
  }

  function formatPctRatio(numer, denom) {
    if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0 || numer <= 0) return "0";
    var p = (numer / denom) * 100;
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toFixed(2);
  }

  /** @typedef {{ id:string, type:'expense'|'income', category:string, memo:string, amount:number }} Tx */
  /** @typedef {{ date:string, startBalance:number, txs:Tx[], dayRating?:string, dayNote?:string }} DayState */

  /** @type {DayState} */
  var state = { date: today(), startBalance: 0, txs: [], dayRating: "", dayNote: "" };

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }

  function saveAll(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function normalizeRating(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "good" || s === "normal" || s === "bad") return s;
    return "";
  }

  function loadDay(date) {
    var all = loadAll();
    var d = all[date];
    if (!d) return { date: date, startBalance: 0, txs: [], dayRating: "", dayNote: "" };
    return {
      date: date,
      startBalance: Math.max(0, Math.trunc(Number(d.startBalance) || 0)),
      txs: Array.isArray(d.txs)
        ? d.txs.map(function (t) {
            return {
              id: String(t.id || ""),
              type: t.type === "income" ? "income" : "expense",
              category: String(t.category || "").slice(0, 40),
              memo: String(t.memo || "").slice(0, 80),
              amount: Math.max(0, Math.trunc(Number(t.amount) || 0)),
            };
          })
        : [],
      dayRating: normalizeRating(d.dayRating),
      dayNote: String(d.dayNote || "").slice(0, 120),
    };
  }

  function persist() {
    var all = loadAll();
    all[state.date] = state;
    saveAll(all);
  }

  function sumDayExpenses(dayState) {
    if (!dayState || !dayState.txs) return 0;
    var s = 0;
    for (var i = 0; i < dayState.txs.length; i++) {
      var t = dayState.txs[i];
      if (t.type === "expense") s += Math.max(0, Math.trunc(Number(t.amount) || 0));
    }
    return s;
  }

  /** 5~8번 daily 페이지 — body / __MC_DAILY_MODE */
  function getDailyFeatureMode() {
    var mode = 0;
    try {
      if (window.__MC_DAILY_MODE != null) mode = parseInt(String(window.__MC_DAILY_MODE), 10) || 0;
    } catch (e) {
      mode = 0;
    }
    if (!mode) {
      try {
        mode = parseInt((document.body && document.body.dataset && document.body.dataset.mcFeatureId) || "0", 10) || 0;
      } catch (e2) {
        mode = 0;
      }
    }
    return mode;
  }

  /**
   * 8. 무지출 챌린지: 달력 날짜 클릭 = 스티커 토글 + localStorage 동기화
   * - 스티커 있음(지출 합 0): 확인 후 해당 일자 키 삭제
   * - 지출 있음: 무지출로 바꿀지 확인 후 지출 분만 제거
   * - 기록 없음: 빈 일자 저장 → 스티커 부착
   */
  function handleNoSpendCalendarClick(dstr) {
    var all = loadAll();
    var st = all[dstr];
    var hasRecord = Boolean(st);
    var exp = st ? sumDayExpenses(st) : 0;

    if (hasRecord && exp === 0) {
      if (!confirm("해당 날짜의 무지출 기록을 삭제하시겠습니까?")) {
        state = loadDay(dstr);
        render();
        return;
      }
      var map = loadAll();
      delete map[dstr];
      saveAll(map);
      state = loadDay(dstr);
      render();
      return;
    }

    if (hasRecord && exp > 0) {
      if (!confirm("지출 내역이 존재합니다. 무지출로 변경하시겠습니까?")) {
        state = loadDay(dstr);
        render();
        return;
      }
      var map2 = loadAll();
      var d = map2[dstr];
      if (!d || !Array.isArray(d.txs)) {
        state = loadDay(dstr);
        render();
        return;
      }
      d.txs = d.txs.filter(function (t) {
        return t.type === "income";
      });
      map2[dstr] = d;
      saveAll(map2);
      state = loadDay(dstr);
      persist();
      render();
      return;
    }

    state = loadDay(dstr);
    persist();
    render();
  }

  /** 합계: 해당 월의 모든 일자 지출 합. excludeDate 가 있으면 그날은 제외(미리보기용). */
  function sumMonthExpenses(monthKey, excludeDate) {
    var all = loadAll();
    var tot = 0;
    Object.keys(all).forEach(function (k) {
      if (k.slice(0, 7) !== monthKey) return;
      if (excludeDate && k === excludeDate) return;
      tot += sumDayExpenses(all[k]);
    });
    return tot;
  }

  function createId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function computeBalances() {
    var bal = state.startBalance;
    var out = [];
    for (var i = 0; i < state.txs.length; i++) {
      var t = state.txs[i];
      var amt = Math.max(0, Math.trunc(Number(t.amount) || 0));
      if (t.type === "income") bal += amt;
      else bal -= amt;
      out.push(bal);
    }
    return out;
  }

  function updateQuickBudgetUI() {
    var mk = monthKeyFromDate(state.date);
    var ctx = getMonthlyBudgetCap(mk);
    var budget = ctx.cap;
    var draft = parseWon(/** @type {HTMLInputElement} */ ($("quick-amount")).value);
    var spentOther = sumMonthExpenses(mk, state.date);
    var todaySpent = sumDayExpenses(state);
    var line = $("quick-budget-line");
    var fill = $("quick-pct-fill");
    var pctLabel = $("quick-pct-label");

    if (budget <= 0) {
      line.textContent =
        "이번 달 비교 기준이 없습니다. 「Weekly 예산안」배분, 「예산 시뮬레이터」총예산, 또는 「비전 기반 예산」에서 수입·고정·비전을 입력하면 실시간 잔액이 표시됩니다.";
      fill.style.width = "0%";
      pctLabel.textContent = "";
      return;
    }

    var capLabel =
      ctx.mode === "sim"
        ? "시뮬레이터 총예산"
        : ctx.mode === "vision"
          ? "2번 잔여 가용(수입−고정−비전)"
          : "배분 예산(생활+활동+필수)";

    var projected = spentOther + todaySpent + draft;
    var left = budget - projected;
    var sign = left >= 0 ? "+" : "−";
    var absLeft = Math.abs(left);
    line.textContent =
      "이번 달 " +
      capLabel +
      " " +
      formatKRW(budget) +
      " · 누적 지출 " +
      formatKRW(spentOther + todaySpent) +
      (draft > 0 ? " · 입력 중 " + formatKRW(draft) : "") +
      " → 남은 여유 " +
      sign +
      " " +
      formatKRW(absLeft);

    if (draft <= 0) {
      fill.style.width = "0%";
      pctLabel.textContent =
        "금액을 입력하면 이 기준 대비 비중(%)이 소수점까지 표시됩니다. (작은 지출도 비율로 체감)";
    } else {
      var pctNum = (draft / budget) * 100;
      var w = Math.min(100, Math.max(pctNum, pctNum > 0 ? 0.55 : 0));
      fill.style.width = w + "%";
      pctLabel.textContent =
        "입력 중 " +
        formatKRW(draft) +
        " → 월 기준 " +
        formatPctRatio(draft, budget) +
        "% (전체 한 달 기준 비중)";
    }
  }

  function renderRatingButtons() {
    var r = state.dayRating || "";
    document.querySelectorAll(".daily-rate-btn").forEach(function (btn) {
      var v = btn.getAttribute("data-rate") || "";
      btn.classList.toggle("is-active", v === r);
    });
  }

  function renderMoneyCalendar() {
    var host = $("money-calendar");
    var modeFeat = getDailyFeatureMode();
    var mk = monthKeyFromDate(state.date);
    var parts = mk.split("-");
    $("cal-month-label").textContent =
      parts[0] + "년 " + String(parseInt(parts[1], 10)) + "월";
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var first = new Date(y, m, 1);
    var lastDay = new Date(y, m + 1, 0).getDate();
    var startWeekday = first.getDay();

    host.textContent = "";
    var head = document.createElement("div");
    head.className = "money-cal__dow";
    "일월화수목금토".split("").forEach(function (d) {
      var c = document.createElement("div");
      c.className = "money-cal__dow-cell";
      c.textContent = d;
      head.appendChild(c);
    });
    host.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "money-cal__grid";

    for (var i = 0; i < startWeekday; i++) {
      var pad = document.createElement("div");
      pad.className = "money-cal__cell money-cal__cell--pad";
      grid.appendChild(pad);
    }

    var all = loadAll();
    for (var day = 1; day <= lastDay; day++) {
      var ds =
        parts[0] +
        "-" +
        parts[1] +
        "-" +
        String(day).padStart(2, "0");
      var cell = document.createElement("div");
      cell.className = "money-cal__cell";
      if (ds === state.date) cell.classList.add("is-today");

      var num = document.createElement("span");
      num.className = "money-cal__num";
      num.textContent = String(day);
      cell.appendChild(num);

      var st = all[ds];
      var hasRecord = Boolean(st);
      var exp = hasRecord ? sumDayExpenses(st) : null;

      var amtEl = document.createElement("span");
      amtEl.className = "money-cal__amt";
      if (!hasRecord) {
        amtEl.textContent = "—";
        amtEl.classList.add("is-muted");
      } else {
        amtEl.textContent = formatKRW(exp);
      }
      cell.appendChild(amtEl);
      if (hasRecord && exp === 0) {
        var sticker = document.createElement("span");
        sticker.className = "money-cal__sticker";
        sticker.textContent = "무지출";
        sticker.title =
          modeFeat === 8
            ? "무지출 기록 — 클릭하면 해제할 수 있습니다"
            : "이 날 지출 합계 0원";
        cell.appendChild(sticker);
        cell.classList.add("has-nospend");
      }

      if (modeFeat === 8) {
        if (hasRecord && exp === 0) {
          cell.title = "무지출 기록 — 클릭하여 해제";
        } else if (hasRecord && exp > 0) {
          cell.title = "지출이 있는 날 — 클릭하면 무지출 처리 안내";
        } else {
          cell.title = "기록 없음 — 클릭하여 무지출 스티커 부착";
        }
      }

      cell.addEventListener("click", function (dstr) {
        return function () {
          if (getDailyFeatureMode() === 8) {
            handleNoSpendCalendarClick(dstr);
            return;
          }
          state = loadDay(dstr);
          persist();
          render();
        };
      }(ds));

      grid.appendChild(cell);
    }

    host.appendChild(grid);
  }

  function render() {
    $("daily-date").value = state.date;
    $("start-balance").value = state.startBalance ? formatWon(state.startBalance) : "";

    var balances = computeBalances();
    var now = balances.length ? balances[balances.length - 1] : state.startBalance;
    $("now-balance").textContent = formatKRW(now);

    var hint = $("balance-hint");
    if (state.txs.length === 0) hint.textContent = "아직 기록이 없습니다. 오늘의 첫 항목을 추가해 보세요.";
    else hint.textContent = "총 " + state.txs.length + "건 기록됨";

    /** @type {HTMLInputElement} */ ($("day-note")).value = state.dayNote || "";
    renderRatingButtons();
    renderMoneyCalendar();
    updateQuickBudgetUI();

    var body = $("tx-body");
    body.innerHTML = "";

    state.txs.forEach(function (t, idx) {
      var tr = document.createElement("tr");
      var bal = balances[idx];
      tr.innerHTML =
        "<td>" +
        "  <select class=\"tx-type\" data-k=\"type\" data-id=\"" +
        t.id +
        "\">" +
        "    <option value=\"expense\"" +
        (t.type === "expense" ? " selected" : "") +
        ">지출</option>" +
        "    <option value=\"income\"" +
        (t.type === "income" ? " selected" : "") +
        ">수입</option>" +
        "  </select>" +
        "</td>" +
        "<td><input class=\"tx-cat\" data-k=\"category\" data-id=\"" +
        t.id +
        "\" type=\"text\" value=\"" +
        escapeHtml(t.category) +
        "\" placeholder=\"예: 식비\" /></td>" +
        "<td><input class=\"tx-memo\" data-k=\"memo\" data-id=\"" +
        t.id +
        "\" type=\"text\" value=\"" +
        escapeHtml(t.memo) +
        "\" placeholder=\"메모\" /></td>" +
        "<td class=\"num\"><input class=\"tx-amt\" data-k=\"amount\" data-id=\"" +
        t.id +
        "\" type=\"text\" inputmode=\"numeric\" value=\"" +
        (t.amount ? formatWon(t.amount) : "") +
        "\" placeholder=\"0\" /></td>" +
        "<td class=\"num\">" +
        escapeHtml(formatKRW(bal)) +
        "</td>" +
        "<td class=\"num\"><button class=\"tx-del\" type=\"button\" data-del=\"" +
        t.id +
        "\" aria-label=\"삭제\">×</button></td>";
      body.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function addTx() {
    state.txs.push({ id: createId(), type: "expense", category: "", memo: "", amount: 0 });
    persist();
    render();
  }

  function deleteTx(id) {
    if (!window.MoneyCalendarDelete.confirm()) return;
    state.txs = state.txs.filter(function (t) {
      return t.id !== id;
    });
    persist();
    render();
  }

  function handleTableInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var del = t.getAttribute("data-del");
    if (del) {
      deleteTx(del);
      return;
    }

    var id = t.getAttribute("data-id");
    var k = t.getAttribute("data-k");
    if (!id || !k) return;

    var tx = state.txs.find(function (x) {
      return x.id === id;
    });
    if (!tx) return;

    if (k === "amount") {
      var n = parseWon(t.value);
      tx.amount = n;
      var next = n === 0 && digitsOnly(t.value) === "" ? "" : formatWon(n);
      if (t.value !== next) t.value = next;
    } else if (k === "type") {
      tx.type = t.value === "income" ? "income" : "expense";
    } else if (k === "category") {
      tx.category = String(t.value || "").slice(0, 40);
    } else if (k === "memo") {
      tx.memo = String(t.value || "").slice(0, 80);
    }

    persist();
    render();
  }

  function wireStartBalance() {
    var el = /** @type {HTMLInputElement} */ ($("start-balance"));
    var apply = function () {
      var n = parseWon(el.value);
      state.startBalance = n;
      var next = n === 0 && digitsOnly(el.value) === "" ? "" : formatWon(n);
      if (el.value !== next) el.value = next;
      persist();
      render();
    };
    el.addEventListener("input", apply);
    el.addEventListener("blur", apply);
  }

  function wireDate() {
    var el = /** @type {HTMLInputElement} */ ($("daily-date"));
    el.addEventListener("change", function () {
      var next = el.value || today();
      state = loadDay(next);
      persist();
      render();
    });
  }

  function quickAddExpense() {
    var amt = parseWon(/** @type {HTMLInputElement} */ ($("quick-amount")).value);
    var cat = String(/** @type {HTMLInputElement} */ ($("quick-cat")).value || "").trim().slice(0, 40);
    if (amt <= 0) return;
    state.txs.push({
      id: createId(),
      type: "expense",
      category: cat || "기타",
      memo: "퀵 입력",
      amount: amt,
    });
    /** @type {HTMLInputElement} */ ($("quick-amount")).value = "";
    /** @type {HTMLInputElement} */ ($("quick-cat")).value = "";
    persist();
    render();
  }

  function exportExcel() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
      throw new Error("엑셀 라이브러리를 불러오지 못했습니다.");
    }

    var balances = computeBalances();
    var end = balances.length ? balances[balances.length - 1] : state.startBalance;

    var headerSheet = [
      {
        date: state.date,
        startBalance: state.startBalance,
        endBalance: end,
        dayRating: state.dayRating || "",
        dayNote: state.dayNote || "",
      },
    ];

    var txRows = state.txs.map(function (t, i) {
      return {
        date: state.date,
        type: t.type,
        category: t.category,
        amount: t.amount,
        memo: t.memo,
        endBalance: balances[i] == null ? "" : balances[i],
      };
    });

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(headerSheet), "Header");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), "Transactions");

    var fname =
      typeof ExcelManager !== "undefined" && ExcelManager.makeFilename
        ? ExcelManager.makeFilename("DailyLedger_" + state.date.replace(/-/g, ""))
        : "MoneyCalendar_DailyLedger_" + state.date.replace(/-/g, "") + ".xlsx";
    XLSX.writeFile(wb, fname);
  }

  function mountExcel() {
    if (typeof ExcelManager === "undefined") return;
    try {
      ExcelManager.mount("excel-control-root", "DailyLedger", {
        applyData: function (mode, parsed) {
          var header = parsed && parsed.Header ? parsed.Header : null;
          var txs = parsed && parsed.Transactions ? parsed.Transactions : [];
          if (!header) throw new Error("Header 시트를 찾지 못했습니다.");

          var date = String(header.date || "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error("엑셀의 date 형식이 올바르지 않습니다. 예: 2026-04-14");
          }

          var startBalance = Math.max(0, Math.trunc(Number(header.startBalance) || 0));
          var importedRating = normalizeRating(header.dayRating);
          var importedNote = String(header.dayNote || "").slice(0, 120);

          var incomingTxs = Array.isArray(txs)
            ? txs
                .map(function (r) {
                  return {
                    id: createId(),
                    type: r.type === "income" ? "income" : "expense",
                    category: String(r.category || "").slice(0, 40),
                    memo: String(r.memo || "").slice(0, 80),
                    amount: Math.max(0, Math.trunc(Number(r.amount) || 0)),
                    _endBalance: Number(r.endBalance),
                  };
                })
                .filter(function (t) {
                  return t.category || t.memo || t.amount > 0;
                })
            : [];

          var lastEnd = null;
          if (incomingTxs.length) {
            var maybe = incomingTxs[incomingTxs.length - 1]._endBalance;
            if (Number.isFinite(maybe) && maybe >= 0) lastEnd = Math.trunc(maybe);
          }
          if (lastEnd == null && Number.isFinite(Number(header.endBalance))) {
            var eb = Number(header.endBalance);
            if (Number.isFinite(eb) && eb >= 0) lastEnd = Math.trunc(eb);
          }

          if (mode === "overwrite") {
            state = {
              date: date,
              startBalance: startBalance,
              txs: incomingTxs.map(stripTmp),
              dayRating: importedRating,
              dayNote: importedNote,
            };
          } else {
            var currentDate = state.date;
            if (currentDate && currentDate !== date && lastEnd != null) {
              state.startBalance = lastEnd;
            }
            state.txs = state.txs.concat(incomingTxs.map(stripTmp));
            if (date === state.date) {
              if (importedRating) state.dayRating = importedRating;
              if (importedNote) state.dayNote = importedNote;
            }
          }

          persist();
          render();
        },
        onExportCurrent: function () {
          exportExcel();
        },
      });
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[Daily] ExcelManager 연결 실패:", err);
      }
    }
  }

  function stripTmp(t) {
    return { id: t.id, type: t.type, category: t.category, memo: t.memo, amount: t.amount };
  }

  function init() {
    (function applyDailyMode() {
      var mode = 0;
      try {
        if (window.__MC_DAILY_MODE != null) mode = parseInt(String(window.__MC_DAILY_MODE), 10) || 0;
      } catch (eMode) {
        mode = 0;
      }
      if (!mode) {
        try {
          mode = parseInt((document.body && document.body.dataset && document.body.dataset.mcFeatureId) || "0", 10) || 0;
        } catch (eMode2) {
          mode = 0;
        }
      }
      if (!(mode >= 5 && mode <= 8)) return;

      function hideSectionByHeadId(headId) {
        var h = document.getElementById(headId);
        if (!h || !h.closest) return;
        var sec = h.closest("section");
        if (sec) sec.hidden = true;
      }

      // 기본: 모두 숨기고 필요한 것만 살린다.
      // 5/7: 퀵-인풋(체감 지수 포함) + 거래표(기록)
      // 6: 소비 한 줄 평
      // 8: 무지출 챌린지 스티커(머니 캘린더)
      if (mode === 6) {
        hideSectionByHeadId("quick-head");
        hideSectionByHeadId("cal-head");
        hideSectionByHeadId("daily-head");
      } else if (mode === 8) {
        hideSectionByHeadId("quick-head");
        hideSectionByHeadId("eval-head");
        hideSectionByHeadId("daily-head");
      } else {
        // 5,7
        hideSectionByHeadId("eval-head");
        hideSectionByHeadId("cal-head");
      }
    })();

    state = loadDay(today());
    /* 8번: 빈 오늘을 자동 저장하면 해제한 무지출 스티커가 새로고침 시 복구됨 */
    if (getDailyFeatureMode() !== 8) {
      persist();
    }
    render();
    wireStartBalance();
    wireDate();
    $("btn-add").addEventListener("click", addTx);
    $("tx-body").addEventListener("click", handleTableInput);
    $("tx-body").addEventListener("input", handleTableInput);
    $("tx-body").addEventListener("change", handleTableInput);

    $("quick-add").addEventListener("click", quickAddExpense);
    $("quick-amount").addEventListener("input", updateQuickBudgetUI);
    $("quick-amount").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        quickAddExpense();
      }
    });

    $("day-note").addEventListener("input", function () {
      state.dayNote = String(/** @type {HTMLInputElement} */ ($("day-note")).value || "").slice(0, 120);
      persist();
    });
    $("day-note").addEventListener("blur", function () {
      state.dayNote = String(/** @type {HTMLInputElement} */ ($("day-note")).value || "").slice(0, 120);
      persist();
    });

    document.querySelectorAll(".daily-rate-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = normalizeRating(btn.getAttribute("data-rate"));
        state.dayRating = state.dayRating === v ? "" : v;
        persist();
        render();
      });
    });

    mountExcel();

    (function legacyScrollToFeatureSection() {
      var loc = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
      if (loc.indexOf("/daily/index.html") < 0) return;
      var p = new URLSearchParams(window.location.search || "");
      var f = parseInt(p.get("f") || "5", 10);
      if (!(f >= 5 && f <= 8)) f = 5;
      var headId = f === 6 ? "eval-head" : f === 8 ? "cal-head" : "quick-head";
      var el = document.getElementById(headId);
      if (el) {
        requestAnimationFrame(function () {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    })();

    window.addEventListener("storage", function (e) {
      if (!e.key) return;
      if (e.key.indexOf(BUDGET_PREFIX) === 0 || e.key.indexOf(SIM_PREFIX) === 0) {
        updateQuickBudgetUI();
      }
      if (e.key === STORAGE_KEY) {
        state = loadDay(state.date);
        render();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
