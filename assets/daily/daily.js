/* global XLSX, ExcelManager */
/**
 * Money Calendar 기능 5~8 (기획서 명칭)
 * 5. 데일리 퀵 인풋
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

  function $maybe(id) {
    return document.getElementById(id);
  }

  /** @type {'expense'|'income'} */
  var quickMode = "expense";

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

  /** @typedef {{ id:string, type:'expense'|'income', category:string, memo:string, amount:number, surprise?: boolean }} Tx */
  /** @typedef {{ id?: string, text:string, at:string }} NoteEntry */
  /** @typedef {{ date:string, startBalance:number, txs:Tx[], dayRating?:string, dayNote?:string, notes?: NoteEntry[], budgetSticker?: boolean }} DayState */

  /** @type {DayState} */
  var state = { date: today(), startBalance: 0, txs: [], dayRating: "", dayNote: "", notes: [], budgetSticker: false };

  /** @type {string} */
  var nospendSelectedDate = "";
  /** @type {boolean} */
  var nospendArmed = false;
  /** 8번: 달력에 표시할 월(YYYY-MM) — 월 이동 버튼용 */
  var calendarViewMk = "";
  /** @type {{ date: string, kind: "note"|"legacy", id?: string } | null} */
  var editingDiary = null;

  function isFutureDate(dateStr) {
    var t = today();
    return String(dateStr || "") > t;
  }

  function monthNowKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function minViewMonthKey() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function monthAddKey(mk, delta) {
    var p = String(mk || "").split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthNowKey();
    var d = new Date(y, m + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function clampMonthKey(mk) {
    var lo = minViewMonthKey();
    var hi = monthNowKey();
    var s = String(mk || "");
    if (s < lo) return lo;
    if (s > hi) return hi;
    return s;
  }

  function minDateThreeYearsIso() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function normalizeNoteIds() {
    var all = loadAll();
    var changed = false;
    Object.keys(all).forEach(function (date) {
      var st = all[date];
      if (!st || !Array.isArray(st.notes)) return;
      st.notes.forEach(function (n) {
        if (n && !n.id) {
          n.id = createId();
          changed = true;
        }
      });
    });
    if (changed) saveAll(all);
  }

  function shiftCalendarMonth(delta) {
    var cur = calendarViewMk || monthKeyFromDate(state.date);
    calendarViewMk = clampMonthKey(monthAddKey(cur, delta));
    render();
  }

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
    if (!d) return { date: date, startBalance: 0, txs: [], dayRating: "", dayNote: "", notes: [], budgetSticker: false };
    return {
      date: date,
      startBalance: Math.max(0, Math.trunc(Number(d.startBalance) || 0)),
      txs: Array.isArray(d.txs)
        ? d.txs.map(function (t) {
            var tx = {
              id: String(t.id || ""),
              type: t.type === "income" ? "income" : "expense",
              category: String(t.category || "").slice(0, 40),
              memo: String(t.memo || "").slice(0, 80),
              amount: Math.max(0, Math.trunc(Number(t.amount) || 0)),
            };
            if (t.type === "expense" && t.surprise) tx.surprise = true;
            return tx;
          })
        : [],
      dayRating: normalizeRating(d.dayRating),
      dayNote: String(d.dayNote || "").slice(0, 120),
      notes: Array.isArray(d.notes)
        ? d.notes
            .map(function (x) {
              return {
                id: String(x.id || ""),
                text: String(x.text || "").slice(0, 120),
                at: String(x.at || ""),
              };
            })
            .filter(function (x) {
              return x.text && x.at;
            })
        : [],
      budgetSticker: Boolean(d.budgetSticker),
    };
  }

  function persist() {
    var all = loadAll();
    all[state.date] = state;
    saveAll(all);

    // 데모 데이터 분리: 현재 월에 첫 기록이 생기면 데모를 즉시 제거
    try {
      var demo = window.MoneyCalendarDemo;
      if (demo && demo.isActive && demo.isActive()) {
        if (monthKeyFromDate(state.date) === monthKeyFromDate(today())) {
          var hasReal = (state.txs && state.txs.length > 0) || (state.notes && state.notes.length > 0) || Boolean(state.dayNote);
          if (hasReal) demo.purge();
        }
      }
    } catch (e) {}
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

  /** localStorage 원본 DayState — 돌발 지출(surprise) 판별용 */
  function hasSurpriseExpenseRaw(st) {
    if (!st || !Array.isArray(st.txs)) return false;
    for (var i = 0; i < st.txs.length; i++) {
      var t = st.txs[i];
      if (t && t.type === "expense" && t.surprise) return true;
    }
    return false;
  }

  /** 스티커만 제거한 뒤 저장할 데이터가 없으면 true(키 삭제 후보) */
  function isDayKeyEmptyWithoutSticker(d) {
    if (!d) return true;
    if (Math.trunc(Number(d.startBalance) || 0) !== 0) return false;
    if (String(d.dayNote || "").trim()) return false;
    if (normalizeRating(d.dayRating)) return false;
    if (Array.isArray(d.notes) && d.notes.length > 0) return false;
    if (Array.isArray(d.txs) && d.txs.length > 0) return false;
    return true;
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
    var amtEl = /** @type {HTMLInputElement | null} */ ($maybe("quick-amount"));
    var lineEl = $maybe("quick-budget-line");
    var fillEl = $maybe("quick-pct-fill");
    var pctLabelEl = $maybe("quick-pct-label");
    if (!amtEl || !lineEl || !fillEl || !pctLabelEl) return;

    var mk = monthKeyFromDate(state.date);
    var ctx = getMonthlyBudgetCap(mk);
    var budget = ctx.cap;
    var draft = parseWon(amtEl.value);
    var spentOther = sumMonthExpenses(mk, state.date);
    var todaySpent = sumDayExpenses(state);
    var line = lineEl;
    var fill = fillEl;
    var pctLabel = pctLabelEl;

    if (quickMode === "income") {
      line.textContent =
        "수입은 저장 즉시 아래 「현재 잔액」에 반영됩니다. 월 예산 대비 비중·그래프는 「지출」 탭에서 확인할 수 있습니다.";
      fill.style.width = "0%";
      pctLabel.textContent =
        draft > 0
          ? "입력 중 " + formatKRW(draft) + " · 「기록에 추가」를 누르면 수입으로 저장됩니다."
          : "수입 금액을 입력한 뒤 기록에 추가하세요.";
      return;
    }

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
          : "배분 예산(필수+선택+저축)";

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

  function formatKoDateTime(iso) {
    try {
      var d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch (e) {
      return "";
    }
  }

  function deleteDiaryRow(dateStr, kind, noteId) {
    if (!confirm("해당 기록을 삭제하시겠습니까?")) return;
    var all = loadAll();
    var st = all[dateStr];
    if (!st) return;
    if (kind === "legacy") {
      st.dayNote = "";
    } else {
      if (!noteId) return;
      st.notes = (Array.isArray(st.notes) ? st.notes : []).filter(function (n) {
        return n && n.id !== noteId;
      });
    }
    saveAll(all);
    editingDiary = null;
    var nb = $maybe("day-note-add");
    if (nb) nb.textContent = "입력";
    if (state.date === dateStr) state = loadDay(dateStr);
    render();
  }

  function startEditDiaryRow(dateStr, kind, noteId, text) {
    if (isFutureDate(dateStr)) return;
    editingDiary = { date: dateStr, kind: kind, id: noteId };
    state = loadDay(dateStr);
    var noteEl = $maybe("day-note");
    if (noteEl) /** @type {HTMLInputElement} */ (noteEl).value = text;
    var dateEl = $maybe("daily-date");
    if (dateEl) /** @type {HTMLInputElement} */ (dateEl).value = dateStr;
    var btn = $maybe("day-note-add");
    if (btn) btn.textContent = "수정 저장";
    render();
  }

  function renderDiaryNotes() {
    if (getDailyFeatureMode() !== 6) return;
    var list = $maybe("day-note-list");
    if (!list) return;
    list.textContent = "";

    var all = loadAll();
    /** @type {{ text:string, at:string, date:string, kind:string, id?:string }[]} */
    var rows = [];
    Object.keys(all).forEach(function (k) {
      var st = all[k];
      if (!st) return;
      if (Array.isArray(st.notes)) {
        st.notes.forEach(function (n) {
          if (!n || !n.text || !n.at) return;
          rows.push({
            text: String(n.text).slice(0, 120),
            at: String(n.at),
            date: k,
            kind: "note",
            id: String(n.id || ""),
          });
        });
      }
      if (st.dayNote && typeof st.dayNote === "string") {
        var legacy = String(st.dayNote).trim();
        if (legacy) {
          var hasNoteDuplicate = Array.isArray(st.notes) && st.notes.some(function (n) {
            return n && String(n.text).trim() === legacy;
          });
          if (!hasNoteDuplicate) {
            rows.push({
              text: legacy.slice(0, 120),
              at: k + "T21:00:00",
              date: k,
              kind: "legacy",
            });
          }
        }
      }
    });
    rows.sort(function (a, b) {
      return String(b.at).localeCompare(String(a.at));
    });

    if (!rows.length) {
      var empty = document.createElement("li");
      empty.className = "diary-item diary-item--empty";
      empty.textContent = "아직 한 줄 평이 없습니다. 오늘의 문장 1개부터 시작해 보세요.";
      list.appendChild(empty);
      return;
    }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var it = document.createElement("li");
      it.className = "diary-item diary-item--row";
      var main = document.createElement("div");
      main.className = "diary-item__body";
      var text = r.text;
      var meta = formatKoDateTime(r.at) || r.at;
      var line = document.createElement("span");
      line.className = "diary-item__text";
      line.textContent = text;
      var sep = document.createElement("span");
      sep.className = "diary-item__sep";
      sep.textContent = " — ";
      var time = document.createElement("span");
      time.className = "diary-item__meta";
      time.textContent = meta;
      main.appendChild(line);
      main.appendChild(sep);
      main.appendChild(time);
      it.appendChild(main);

      var actions = document.createElement("div");
      actions.className = "diary-item__actions";
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "diary-item__icon-btn";
      editBtn.setAttribute("aria-label", "수정");
      editBtn.setAttribute("title", "수정");
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        startEditDiaryRow(r.date, r.kind === "legacy" ? "legacy" : "note", r.id || "", text);
      });

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "diary-item__icon-btn diary-item__icon-btn--danger";
      delBtn.setAttribute("aria-label", "삭제");
      delBtn.setAttribute("title", "삭제");
      delBtn.textContent = "\uD83D\uDDD1";
      delBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        deleteDiaryRow(r.date, r.kind === "legacy" ? "legacy" : "note", r.id || "");
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      it.appendChild(actions);
      list.appendChild(it);
    }
  }

  function renderMoneyCalendar() {
    var host = $("money-calendar");
    var modeFeat = getDailyFeatureMode();
    var mk =
      modeFeat === 8
        ? clampMonthKey(calendarViewMk || monthKeyFromDate(state.date))
        : monthKeyFromDate(state.date);
    if (modeFeat === 8) calendarViewMk = mk;
    var parts = mk.split("-");
    var monthTitleStr = parts[0] + "년 " + String(parseInt(parts[1], 10)) + "월";
    var calMonthHdr = $maybe("cal-month-label");
    if (calMonthHdr) calMonthHdr.textContent = monthTitleStr;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var first = new Date(y, m, 1);
    var lastDay = new Date(y, m + 1, 0).getDate();
    var startWeekday = first.getDay();

    host.textContent = "";
    if (modeFeat === 8) {
      var nav = document.createElement("div");
      nav.className = "money-cal__month-nav";
      var loMk = minViewMonthKey();
      var hiMk = monthNowKey();
      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "money-cal__month-btn";
      prev.setAttribute("aria-label", "이전 달");
      prev.textContent = "<";
      prev.disabled = mk <= loMk;
      prev.addEventListener("click", function () {
        shiftCalendarMonth(-1);
      });
      var titleWrap = document.createElement("div");
      titleWrap.className = "money-cal__month-picker-wrap";
      var title = document.createElement("button");
      title.type = "button";
      title.id = "money-cal-month-btn";
      title.className = "money-cal__month-nav-title";
      title.setAttribute("aria-expanded", "false");
      title.setAttribute("aria-haspopup", "dialog");
      title.textContent = monthTitleStr;
      var dropdown = document.createElement("div");
      dropdown.className = "money-cal__month-dropdown is-hidden";
      dropdown.setAttribute("role", "dialog");
      dropdown.setAttribute("aria-label", "연도·월 선택");
      var pickRow = document.createElement("div");
      pickRow.className = "money-cal__month-pick-row";
      var yrLab = document.createElement("label");
      yrLab.className = "money-cal__pick-field";
      yrLab.innerHTML = '<span class="money-cal__pick-k">연도</span>';
      var yrSel = document.createElement("select");
      yrSel.className = "money-cal__pick-select";
      var loY = parseInt(loMk.split("-")[0], 10);
      var hiY = parseInt(hiMk.split("-")[0], 10);
      for (var yy = loY; yy <= hiY; yy++) {
        var yOpt = document.createElement("option");
        yOpt.value = String(yy);
        yOpt.textContent = yy + "년";
        if (yy === y) yOpt.selected = true;
        yrSel.appendChild(yOpt);
      }
      var moLab = document.createElement("label");
      moLab.className = "money-cal__pick-field";
      moLab.innerHTML = '<span class="money-cal__pick-k">월</span>';
      var moSel = document.createElement("select");
      moSel.className = "money-cal__pick-select";
      for (var mm = 1; mm <= 12; mm++) {
        var mOpt = document.createElement("option");
        mOpt.value = String(mm);
        mOpt.textContent = mm + "월";
        if (mm === m + 1) mOpt.selected = true;
        moSel.appendChild(mOpt);
      }
      yrLab.appendChild(yrSel);
      moLab.appendChild(moSel);
      pickRow.appendChild(yrLab);
      pickRow.appendChild(moLab);
      var applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "btn btn-secondary money-cal__month-apply";
      applyBtn.textContent = "이동";
      function closeMonthDropdown() {
        dropdown.classList.add("is-hidden");
        title.setAttribute("aria-expanded", "false");
      }
      function applyMonthPick() {
        var ny = parseInt(yrSel.value, 10);
        var nm = parseInt(moSel.value, 10);
        var nextMk = ny + "-" + String(nm).padStart(2, "0");
        nextMk = clampMonthKey(nextMk);
        calendarViewMk = nextMk;
        if (state.date.slice(0, 7) !== nextMk) {
          state.date = nextMk + "-01";
        }
        closeMonthDropdown();
        render();
      }
      applyBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        applyMonthPick();
      });
      title.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (!dropdown.classList.contains("is-hidden")) {
          closeMonthDropdown();
          return;
        }
        yrSel.value = String(y);
        moSel.value = String(m + 1);
        dropdown.classList.remove("is-hidden");
        title.setAttribute("aria-expanded", "true");
        setTimeout(function () {
          function onDoc(ev2) {
            var el = /** @type {Node} */ (ev2.target);
            if (dropdown.contains(el) || title.contains(el)) return;
            closeMonthDropdown();
            document.removeEventListener("mousedown", onDoc, true);
          }
          document.addEventListener("mousedown", onDoc, true);
        }, 0);
      });
      dropdown.appendChild(pickRow);
      dropdown.appendChild(applyBtn);
      titleWrap.appendChild(title);
      titleWrap.appendChild(dropdown);
      var next = document.createElement("button");
      next.type = "button";
      next.className = "money-cal__month-btn";
      next.setAttribute("aria-label", "다음 달");
      next.textContent = ">";
      next.disabled = mk >= hiMk;
      next.addEventListener("click", function () {
        shiftCalendarMonth(1);
      });
      nav.appendChild(prev);
      nav.appendChild(titleWrap);
      nav.appendChild(next);
      host.appendChild(nav);
      var hdrPick = document.getElementById("cal-month-label");
      if (hdrPick && hdrPick.tagName === "BUTTON") {
        hdrPick.onclick = function (ev) {
          ev.preventDefault();
          title.click();
        };
      }
    }

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
      if (modeFeat === 8 && nospendSelectedDate === ds) cell.classList.add("is-selected");
      if (modeFeat === 8 && isFutureDate(ds)) cell.classList.add("is-future");

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
      var showNospendSticker =
        modeFeat === 8 ? Boolean(st && st.budgetSticker) : hasRecord && exp === 0;
      if (showNospendSticker) {
        var sticker = document.createElement("span");
        sticker.className = "money-cal__sticker";
        sticker.setAttribute("role", "img");
        sticker.setAttribute("aria-label", "예산 준수 — Budget Integrity");
        sticker.innerHTML =
          '<span class="money-cal__sticker-inner" aria-hidden="true">' +
          '<svg class="money-cal__sticker-check" viewBox="0 0 24 24" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>" +
          '<span class="money-cal__sticker-zero">BI</span>' +
          "</span>";
        sticker.title =
          modeFeat === 8
            ? "예산 준수 스티커 — 클릭 후 수정·삭제로 해제"
            : "이 날 돌발 지출 없음 · 지출 합계 0원";
        cell.appendChild(sticker);
        cell.classList.add("has-nospend");
      }

      if (modeFeat === 8 && nospendSelectedDate === ds && nospendArmed && !isFutureDate(ds)) {
        var actions = document.createElement("div");
        actions.className = "nospend-cell-actions";
        actions.innerHTML =
          '<button type="button" class="nospend-cell-actions__btn" data-ns-action="edit" aria-label="수정">✎</button>' +
          '<button type="button" class="nospend-cell-actions__btn nospend-cell-actions__btn--danger" data-ns-action="del" aria-label="삭제">🗑</button>';
        actions.addEventListener("click", function (e) {
          var t = /** @type {HTMLElement} */ (e.target);
          var b = t && t.closest ? t.closest("button[data-ns-action]") : null;
          if (!b) return;
          e.preventDefault();
          e.stopPropagation();
          var act = b.getAttribute("data-ns-action");
          if (act === "edit") applyNoSpendEdit();
          else if (act === "del") applyNoSpendDelete();
        });
        cell.appendChild(actions);
      }

      if (modeFeat === 8) {
        if (isFutureDate(ds)) {
          cell.title = "미래 날짜에는 예산 준수 스티커를 작성할 수 없습니다.";
        } else if (st && st.budgetSticker) {
          if (nospendSelectedDate === ds && nospendArmed) {
            cell.title = "선택됨 — 오른쪽 아래 버튼으로 수정/삭제";
          } else if (nospendSelectedDate === ds) {
            cell.title = "선택됨 — 한 번 더 클릭하면 수정/삭제 버튼 표시";
          } else {
            cell.title = "클릭: 날짜 선택 후 수정·삭제";
          }
        } else {
          cell.title = "클릭: 스티커 부착(확인) · 돌발 지출이 있으면 안내";
        }
      }

      cell.addEventListener("click", function (dstr) {
        return function () {
          if (getDailyFeatureMode() === 8) {
            if (isFutureDate(dstr)) return;
            var allMap = loadAll();
            var raw = allMap[dstr];
            state = loadDay(dstr);
            calendarViewMk = clampMonthKey(monthKeyFromDate(dstr));

            if (hasSurpriseExpenseRaw(raw)) {
              alert("오늘은 돌발 지출이 있어 스티커를 붙일 수 없습니다.");
              nospendSelectedDate = dstr;
              nospendArmed = false;
              render();
              return;
            }

            if (raw && raw.budgetSticker) {
              if (nospendSelectedDate !== dstr) {
                nospendSelectedDate = dstr;
                nospendArmed = false;
              } else {
                nospendArmed = !nospendArmed;
              }
              render();
              return;
            }

            if (!confirm("오늘의 예산 준수 스티커를 붙이시겠습니까?")) {
              nospendSelectedDate = dstr;
              nospendArmed = false;
              render();
              return;
            }

            var d2 = raw || { date: dstr, startBalance: 0, txs: [], dayRating: "", dayNote: "", notes: [] };
            d2.budgetSticker = true;
            allMap[dstr] = d2;
            saveAll(allMap);
            state = loadDay(dstr);
            nospendSelectedDate = dstr;
            nospendArmed = false;
            render();
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

  function applyNoSpendEdit() {
    if (getDailyFeatureMode() !== 8) return;
    if (!nospendSelectedDate || isFutureDate(nospendSelectedDate)) return;

    var all = loadAll();
    var st = all[nospendSelectedDate];
    var hasRecord = Boolean(st);
    var exp = st ? sumDayExpenses(st) : 0;

    if (hasRecord && exp === 0 && st.budgetSticker) {
      if (!confirm("해당 날짜의 예산 준수 스티커를 해제할까요?")) return;
      var map0 = loadAll();
      var d = map0[nospendSelectedDate];
      if (!d) return;
      delete d.budgetSticker;
      if (isDayKeyEmptyWithoutSticker(d)) {
        delete map0[nospendSelectedDate];
      } else {
        map0[nospendSelectedDate] = d;
      }
      saveAll(map0);
      state = loadDay(nospendSelectedDate);
      nospendArmed = false;
      render();
      return;
    }

    if (hasRecord && exp === 0) {
      if (!confirm("해당 날짜의 예산 준수 스티커를 해제할까요?")) return;
      var map0b = loadAll();
      delete map0b[nospendSelectedDate];
      saveAll(map0b);
      state = loadDay(nospendSelectedDate);
      nospendArmed = false;
      render();
      return;
    }

    if (hasRecord && exp > 0) {
      if (!confirm("지출 내역이 있습니다. 예산 안의 무지출 날로 바꾸려면 지출만 제거합니다. 진행할까요?")) return;
      var map1 = loadAll();
      var d = map1[nospendSelectedDate];
      if (!d || !Array.isArray(d.txs)) return;
      d.txs = d.txs.filter(function (t) {
        return t.type === "income";
      });
      map1[nospendSelectedDate] = d;
      saveAll(map1);
      state = loadDay(nospendSelectedDate);
      nospendArmed = false;
      render();
      return;
    }

    if (!confirm("오늘의 예산 준수 스티커를 붙이시겠습니까?")) return;
    var map2 = loadAll();
    var d2 = map2[nospendSelectedDate] || {
      date: nospendSelectedDate,
      startBalance: 0,
      txs: [],
      dayRating: "",
      dayNote: "",
      notes: [],
    };
    d2.budgetSticker = true;
    map2[nospendSelectedDate] = d2;
    saveAll(map2);
    state = loadDay(nospendSelectedDate);
    nospendArmed = false;
    render();
  }

  function applyNoSpendDelete() {
    if (getDailyFeatureMode() !== 8) return;
    if (!nospendSelectedDate || isFutureDate(nospendSelectedDate)) return;
    if (!confirm("선택한 날짜의 기록을 삭제할까요?")) return;
    var map = loadAll();
    delete map[nospendSelectedDate];
    saveAll(map);
    state = loadDay(nospendSelectedDate);
    nospendArmed = false;
    render();
  }

  function render() {
    var modeFeat = getDailyFeatureMode();
    var dateEl = /** @type {HTMLInputElement | null} */ ($maybe("daily-date"));
    if (dateEl) {
      dateEl.value = state.date;
      dateEl.max = today();
      if (modeFeat === 8) {
        dateEl.min = minDateThreeYearsIso();
      } else {
        dateEl.removeAttribute("min");
      }
    }

    var sbEl = /** @type {HTMLInputElement | null} */ ($maybe("start-balance"));
    if (sbEl) sbEl.value = state.startBalance ? formatWon(state.startBalance) : "";

    var balances = computeBalances();
    var now = balances.length ? balances[balances.length - 1] : state.startBalance;
    var nbEl = $maybe("now-balance");
    if (nbEl) nbEl.textContent = formatKRW(now);

    var hint = $maybe("balance-hint");
    if (hint) {
      if (state.txs.length === 0) hint.textContent = "아직 기록이 없습니다. 오늘의 첫 항목을 추가해 보세요.";
      else hint.textContent = "총 " + state.txs.length + "건 기록됨";
    }

    var dn = /** @type {HTMLInputElement | null} */ ($maybe("day-note"));
    if (dn) {
      if (modeFeat === 6 && editingDiary) {
        /* 편집 중: 입력창 값 유지 */
      } else {
        dn.value = state.dayNote || "";
      }
    }
    if (modeFeat === 6) {
      var btn = /** @type {HTMLButtonElement | null} */ ($maybe("day-note-add"));
      var future = isFutureDate(state.date);
      if (dn) dn.disabled = future;
      if (btn) {
        btn.disabled = future;
        btn.textContent = editingDiary ? "수정 저장" : "입력";
        if (future) btn.title = "미래 날짜에는 기록할 수 없습니다.";
        else btn.removeAttribute("title");
      }
    }
    renderRatingButtons();
    renderMoneyCalendar();
    updateQuickBudgetUI();
    updateQuickSurpriseVisibility();
    // no-op (8번은 셀 내부 버튼으로 처리)

    var body = $maybe("tx-body");
    if (body) body.innerHTML = "";

    renderDiaryNotes();

    if (!body) return;

    state.txs.forEach(function (t, idx) {
      var tr = document.createElement("tr");
      if (t.surprise && t.type === "expense") tr.classList.add("daily-tx-row--surprise");
      var bal = balances[idx];
      var typeCell = "";
      if (modeFeat === 5) {
        typeCell =
          "<div class=\"tx-type-tabs\" role=\"group\" aria-label=\"수입 또는 지출\">" +
          "<button type=\"button\" class=\"tx-type-tab" +
          (t.type === "expense" ? " is-active" : "") +
          "\" data-action=\"set-type\" data-type=\"expense\" data-id=\"" +
          t.id +
          "\">지출</button>" +
          "<button type=\"button\" class=\"tx-type-tab" +
          (t.type === "income" ? " is-active" : "") +
          "\" data-action=\"set-type\" data-type=\"income\" data-id=\"" +
          t.id +
          "\">수입</button>" +
          "</div>";
      } else {
        typeCell =
          "<select class=\"tx-type\" data-k=\"type\" data-id=\"" +
          t.id +
          "\">" +
          "<option value=\"expense\"" +
          (t.type === "expense" ? " selected" : "") +
          ">지출</option>" +
          "<option value=\"income\"" +
          (t.type === "income" ? " selected" : "") +
          ">수입</option>" +
          "</select>";
      }
      tr.innerHTML =
        "<td>" +
        typeCell +
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
    var act = t.getAttribute("data-action");
    if (act === "set-type") {
      var id2 = t.getAttribute("data-id");
      var typ = t.getAttribute("data-type");
      if (!id2 || (typ !== "expense" && typ !== "income")) return;
      var tx2 = state.txs.find(function (x) {
        return x.id === id2;
      });
      if (!tx2) return;
      tx2.type = typ === "income" ? "income" : "expense";
      if (tx2.type === "income") delete tx2.surprise;
      persist();
      render();
      return;
    }
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
      if (tx.type === "income") delete tx.surprise;
    } else if (k === "category") {
      tx.category = String(t.value || "").slice(0, 40);
    } else if (k === "memo") {
      tx.memo = String(t.value || "").slice(0, 80);
    }

    persist();
    render();
  }

  function wireStartBalance() {
    var el = /** @type {HTMLInputElement | null} */ ($maybe("start-balance"));
    if (!el) return;
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
    var el = /** @type {HTMLInputElement | null} */ ($maybe("daily-date"));
    if (!el) return;
    el.addEventListener("change", function () {
      var next = el.value || today();
      state = loadDay(next);
      if (getDailyFeatureMode() === 8) {
        calendarViewMk = clampMonthKey(monthKeyFromDate(next));
      }
      persist();
      render();
    });
  }

  function setQuickMode(mode) {
    quickMode = mode === "income" ? "income" : "expense";
    var exp = $maybe("quick-mode-expense");
    var inc = $maybe("quick-mode-income");
    var addBtn = $maybe("quick-add");
    if (exp && inc) {
      var isExp = quickMode === "expense";
      exp.classList.toggle("is-active", isExp);
      inc.classList.toggle("is-active", !isExp);
      exp.setAttribute("aria-selected", isExp ? "true" : "false");
      inc.setAttribute("aria-selected", !isExp ? "true" : "false");
    }
    if (addBtn)
      addBtn.textContent = quickMode === "expense" ? "지출로 기록에 추가" : "수입으로 기록에 추가";
    updateQuickBudgetUI();
    updateQuickSurpriseVisibility();
  }

  function updateQuickSurpriseVisibility() {
    var w = $maybe("quick-surprise-wrap");
    if (!w) return;
    var show = quickMode === "expense";
    w.hidden = !show;
    w.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function wireQuickAmountFormat() {
    var el = /** @type {HTMLInputElement | null} */ ($maybe("quick-amount"));
    if (!el) return;
    var apply = function () {
      var n = parseWon(el.value);
      var next = n === 0 && digitsOnly(el.value) === "" ? "" : formatWon(n);
      if (el.value !== next) el.value = next;
      updateQuickBudgetUI();
    };
    el.addEventListener("input", apply);
    el.addEventListener("blur", apply);
  }

  function quickAddTransaction() {
    var amt = parseWon(/** @type {HTMLInputElement} */ ($("quick-amount")).value);
    var cat = String(/** @type {HTMLInputElement} */ ($("quick-cat")).value || "").trim().slice(0, 40);
    if (amt <= 0) return;
    var surEl = /** @type {HTMLInputElement | null} */ ($maybe("quick-surprise"));
    var isSurprise = !!(surEl && surEl.checked && quickMode === "expense");
    /** @type {Tx} */
    var row = {
      id: createId(),
      type: quickMode === "income" ? "income" : "expense",
      category: cat || "기타",
      memo: isSurprise ? "퀵 입력 · 돌발(예산 외)" : "퀵 입력",
      amount: amt,
    };
    if (isSurprise) row.surprise = true;
    state.txs.push(row);
    /** @type {HTMLInputElement} */ ($("quick-amount")).value = "";
    /** @type {HTMLInputElement} */ ($("quick-cat")).value = "";
    if (surEl) surEl.checked = false;
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
      var row = {
        date: state.date,
        type: t.type,
        category: t.category,
        amount: t.amount,
        memo: t.memo,
        endBalance: balances[i] == null ? "" : balances[i],
      };
      if (t.surprise) row.surprise = true;
      return row;
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
                    surprise: !!(r.surprise === true || r.surprise === "true" || r.surprise === 1),
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
              notes: [],
              budgetSticker: false,
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
    var o = { id: t.id, type: t.type, category: t.category, memo: t.memo, amount: t.amount };
    if (t.surprise) o.surprise = true;
    return o;
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
      // 5/7: 데일리 퀵 인풋(체감 지수 포함) + 거래표(기록)
      // 6: 소비 한 줄 평
      // 8: 무지출 챌린지 스티커(머니 캘린더)
      if (mode === 6) {
        hideSectionByHeadId("quick-head");
        hideSectionByHeadId("cal-head");
        hideSectionByHeadId("daily-head");
        hideSectionByHeadId("tx-title");
      } else if (mode === 8) {
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
    } else {
      calendarViewMk = clampMonthKey(monthKeyFromDate(state.date));
      nospendSelectedDate = state.date;
      nospendArmed = false;
    }
    render();
    wireStartBalance();
    wireDate();
    $("btn-add").addEventListener("click", addTx);
    $("tx-body").addEventListener("click", handleTableInput);
    $("tx-body").addEventListener("input", handleTableInput);
    $("tx-body").addEventListener("change", handleTableInput);

    var qAdd = $maybe("quick-add");
    if (qAdd) qAdd.addEventListener("click", quickAddTransaction);
    wireQuickAmountFormat();
    var qAmt = $maybe("quick-amount");
    if (qAmt) {
      qAmt.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          quickAddTransaction();
        }
      });
    }

    var qExp = $maybe("quick-mode-expense");
    var qInc = $maybe("quick-mode-income");
    if (qExp && qInc) {
      qExp.addEventListener("click", function () {
        setQuickMode("expense");
      });
      qInc.addEventListener("click", function () {
        setQuickMode("income");
      });
      setQuickMode("expense");
    }

    var noteEl = $maybe("day-note");
    var noteBtn = $maybe("day-note-add");
    if (getDailyFeatureMode() === 6) {
      normalizeNoteIds();
      if (noteBtn && noteEl) {
        noteBtn.addEventListener("click", function () {
          if (isFutureDate(state.date)) return;
          var text = String(/** @type {HTMLInputElement} */ (noteEl).value || "").trim().slice(0, 120);
          if (!text) return;

          if (editingDiary) {
            var ed = editingDiary;
            var all = loadAll();
            var st0 = all[ed.date];
            if (!st0) {
              st0 = loadDay(ed.date);
              all[ed.date] = st0;
            }
            if (ed.kind === "legacy") {
              st0.dayNote = text;
            } else {
              var arr = Array.isArray(st0.notes) ? st0.notes : [];
              var found = arr.find(function (n) {
                return n && n.id === ed.id;
              });
              if (found) {
                found.text = text;
                var now = new Date();
                found.at =
                  ed.date +
                  "T" +
                  String(now.getHours()).padStart(2, "0") +
                  ":" +
                  String(now.getMinutes()).padStart(2, "0") +
                  ":00";
              }
            }
            saveAll(all);
            editingDiary = null;
            /** @type {HTMLInputElement} */ (noteEl).value = "";
            noteBtn.textContent = "입력";
            state = loadDay(state.date);
            render();
            return;
          }

          var now = new Date();
          var hh = String(now.getHours()).padStart(2, "0");
          var mm = String(now.getMinutes()).padStart(2, "0");
          var at = state.date + "T" + hh + ":" + mm + ":00";
          if (!state.notes) state.notes = [];
          state.notes.unshift({ id: createId(), text: text, at: at });
          /** @type {HTMLInputElement} */ (noteEl).value = "";
          persist();
          render();
        });
        noteEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            noteBtn.click();
          }
        });
      }
    } else if (noteEl) {
      noteEl.addEventListener("input", function () {
        state.dayNote = String(/** @type {HTMLInputElement} */ (noteEl).value || "").slice(0, 120);
        persist();
      });
      noteEl.addEventListener("blur", function () {
        state.dayNote = String(/** @type {HTMLInputElement} */ (noteEl).value || "").slice(0, 120);
        persist();
      });
    }

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
