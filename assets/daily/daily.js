/* global XLSX, ExcelManager */
/**
 * Daily 기록 (연속성: 엑셀 업로드/다운로드)
 * - localStorage 저장
 * - 업로드 파일의 마지막 endBalance → 오늘 startBalance 자동 매핑(merge 시)
 */

(function () {
  "use strict";

  var STORAGE_KEY = "moneyCalendar.dailyLedger.v1";

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

  /** @typedef {{ id:string, type:'expense'|'income', category:string, memo:string, amount:number }} Tx */
  /** @typedef {{ date:string, startBalance:number, txs:Tx[] }} DayState */

  /** @type {DayState} */
  var state = { date: today(), startBalance: 0, txs: [] };

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

  function loadDay(date) {
    var all = loadAll();
    var d = all[date];
    if (!d) return { date: date, startBalance: 0, txs: [] };
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
    };
  }

  function persist() {
    var all = loadAll();
    all[state.date] = state;
    saveAll(all);
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

  function render() {
    $("daily-date").value = state.date;
    $("start-balance").value = state.startBalance ? formatWon(state.startBalance) : "";

    var balances = computeBalances();
    var now = balances.length ? balances[balances.length - 1] : state.startBalance;
    $("now-balance").textContent = formatKRW(now);

    var hint = $("balance-hint");
    if (state.txs.length === 0) hint.textContent = "아직 기록이 없습니다. 오늘의 첫 항목을 추가해 보세요.";
    else hint.textContent = "총 " + state.txs.length + "건 기록됨";

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

  function exportExcel() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
      alert("엑셀 라이브러리를 불러오지 못했습니다.");
      return;
    }

    var balances = computeBalances();
    var end = balances.length ? balances[balances.length - 1] : state.startBalance;

    var headerSheet = [
      {
        date: state.date,
        startBalance: state.startBalance,
        endBalance: end,
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
      ExcelManager.mount("excel-tools", "DailyLedger", function (mode, parsed) {
        var header = parsed && parsed.Header ? parsed.Header : null;
        var txs = parsed && parsed.Transactions ? parsed.Transactions : [];
        if (!header) throw new Error("Header 시트를 찾지 못했습니다.");

        var date = String(header.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error("엑셀의 date 형식이 올바르지 않습니다. 예: 2026-04-14");
        }

        var startBalance = Math.max(0, Math.trunc(Number(header.startBalance) || 0));

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
        // fallback: Header.endBalance
        if (lastEnd == null && Number.isFinite(Number(header.endBalance))) {
          var eb = Number(header.endBalance);
          if (Number.isFinite(eb) && eb >= 0) lastEnd = Math.trunc(eb);
        }

        if (mode === "overwrite") {
          state = { date: date, startBalance: startBalance, txs: incomingTxs.map(stripTmp) };
        } else {
          // merge: "어제의 최종 결산 잔액" → "오늘의 시작 잔액"
          // 사용자가 오늘 날짜를 보고 있다면, 업로드된 마지막 잔액을 startBalance로 자동 세팅
          var currentDate = state.date;
          if (currentDate && currentDate !== date && lastEnd != null) {
            // 이어쓰기: 업로드(date)의 마지막 잔액을 현재 날짜 시작 잔액으로
            state.startBalance = lastEnd;
          }
          // 그리고 거래는 append
          state.txs = state.txs.concat(incomingTxs.map(stripTmp));
        }

        persist();
        render();
      });
    } catch {
      /* ignore */
    }
  }

  function stripTmp(t) {
    return { id: t.id, type: t.type, category: t.category, memo: t.memo, amount: t.amount };
  }

  function init() {
    state = loadDay(today());
    persist();
    render();
    wireStartBalance();
    wireDate();
    $("btn-add").addEventListener("click", addTx);
    $("btn-export").addEventListener("click", exportExcel);
    $("tx-body").addEventListener("click", handleTableInput);
    $("tx-body").addEventListener("input", handleTableInput);
    $("tx-body").addEventListener("change", handleTableInput);
    mountExcel();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

