/* global XLSX, ExcelManager */
/**
 * 1. 부채 리스트 — localStorage + Excel Control Center
 */
(function () {
  "use strict";

  var STORAGE_KEY = "moneyCalendar.debtList.v1";
  var KIND_LABEL = { urgent: "긴급", normal: "일반", memo: "협의" };
  var KIND_ORDER = { urgent: 0, normal: 1, memo: 2 };

  /** @type {{ id:string, name:string, balance:number, kind:string, memo:string }[]} */
  var items = [];
  /** @type {string|null} */
  var editingId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function createId() {
    return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatWon(n) {
    var v = Math.max(0, Math.trunc(Number(n) || 0));
    return v.toLocaleString("ko-KR");
  }

  function parseWon(raw) {
    var n = Number(String(raw == null ? "" : raw).replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.trunc(n);
  }

  function normalizeKind(k) {
    var s = String(k || "").trim();
    if (s === "urgent" || s === "normal" || s === "memo") return s;
    return "normal";
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      items = arr
        .map(function (d) {
          return {
            id: d && d.id ? String(d.id) : createId(),
            name: d && d.name != null ? String(d.name).slice(0, 80) : "",
            balance: Math.max(0, Math.trunc(Number(d && d.balance) || 0)),
            kind: normalizeKind(d && d.kind),
            memo: d && d.memo != null ? String(d.memo).slice(0, 200) : "",
          };
        })
        .filter(function (d) {
          return d.name || d.balance > 0 || d.memo;
        });
    } catch (e) {
      items = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function sortedItems() {
    return items.slice().sort(function (a, b) {
      var ka = KIND_ORDER[a.kind] != null ? KIND_ORDER[a.kind] : 9;
      var kb = KIND_ORDER[b.kind] != null ? KIND_ORDER[b.kind] : 9;
      if (ka !== kb) return ka - kb;
      return b.balance - a.balance;
    });
  }

  function setHint(msg) {
    var el = $("debt-form-hint");
    if (el) el.textContent = msg || "";
  }

  function resetForm() {
    editingId = null;
    var form = $("debt-form");
    if (form) form.reset();
    var kind = $("debt-kind");
    if (kind) kind.value = "normal";
    var bal = $("debt-balance");
    if (bal) bal.value = "";
    var submit = $("debt-submit");
    if (submit) submit.textContent = "추가하기";
    var resetBtn = $("debt-reset");
    if (resetBtn) resetBtn.hidden = true;
    setHint("");
  }

  function fillForm(item) {
    editingId = item.id;
    $("debt-name").value = item.name;
    $("debt-balance").value = item.balance ? formatWon(item.balance) : "";
    $("debt-kind").value = item.kind;
    $("debt-memo").value = item.memo || "";
    $("debt-submit").textContent = "수정 저장";
    $("debt-reset").hidden = false;
    setHint("선택한 항목을 수정 중입니다.");
    $("debt-name").focus();
  }

  function renderDash() {
    var sums = { urgent: 0, normal: 0, memo: 0 };
    for (var i = 0; i < items.length; i++) {
      var k = normalizeKind(items[i].kind);
      sums[k] += items[i].balance;
    }
    var total = sums.urgent + sums.normal + sums.memo;
    $("dash-urgent").textContent = formatWon(sums.urgent) + "원";
    $("dash-normal").textContent = formatWon(sums.normal) + "원";
    $("dash-memo").textContent = formatWon(sums.memo) + "원";
    $("dash-total").textContent = formatWon(total) + "원";
  }

  function renderList() {
    var tbody = $("debt-tbody");
    var count = $("list-count");
    if (!tbody) return;
    tbody.textContent = "";
    var list = sortedItems();
    if (count) count.textContent = list.length + "건";

    if (!list.length) {
      var empty = document.createElement("tr");
      empty.className = "debt-empty-row";
      var td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "아직 등록된 부채가 없습니다. 위에서 첫 항목을 추가해 보세요.";
      empty.appendChild(td);
      tbody.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      var tr = document.createElement("tr");
      tr.dataset.id = item.id;

      var tdKind = document.createElement("td");
      var badge = document.createElement("span");
      badge.className = "debt-kind debt-kind--" + item.kind;
      badge.textContent = KIND_LABEL[item.kind] || item.kind;
      tdKind.appendChild(badge);

      var tdName = document.createElement("td");
      tdName.textContent = item.name || "—";

      var tdBal = document.createElement("td");
      tdBal.className = "debt-balance";
      tdBal.textContent = formatWon(item.balance) + "원";

      var tdMemo = document.createElement("td");
      tdMemo.className = "debt-memo";
      tdMemo.textContent = item.memo || "—";

      var tdAct = document.createElement("td");
      var actions = document.createElement("div");
      actions.className = "debt-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost btn--sm";
      editBtn.textContent = "수정";
      editBtn.addEventListener("click", function () {
        fillForm(item);
      });

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn--ghost btn--sm";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", function () {
        if (!window.confirm("「" + (item.name || "항목") + "」을(를) 삭제할까요?")) return;
        items = items.filter(function (x) {
          return x.id !== item.id;
        });
        if (editingId === item.id) resetForm();
        save();
        render();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      tdAct.appendChild(actions);

      tr.appendChild(tdKind);
      tr.appendChild(tdName);
      tr.appendChild(tdBal);
      tr.appendChild(tdMemo);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }

  function render() {
    renderDash();
    renderList();
  }

  function wireMoneyInput() {
    var el = $("debt-balance");
    if (!el) return;
    el.addEventListener("input", function () {
      var n = parseWon(el.value);
      var caretEnd = el.selectionStart === el.value.length;
      el.value = n ? formatWon(n) : "";
      if (caretEnd) {
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch (e) {}
      }
    });
  }

  function exportExcel() {
    ensureXlsx();
    var rows = sortedItems().map(function (d) {
      return {
        name: d.name,
        balance: d.balance,
        kind: d.kind,
        memo: d.memo || "",
      };
    });
    if (!rows.length) rows = [{ name: "", balance: 0, kind: "normal", memo: "" }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Debts");
    var filename =
      typeof ExcelManager !== "undefined" && ExcelManager.makeFilename
        ? ExcelManager.makeFilename("DebtList")
        : "MoneyCalendar_DebtList.xlsx";
    XLSX.writeFile(wb, filename);
  }

  function ensureXlsx() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
      throw new Error("엑셀 라이브러리를 불러오지 못했습니다. 네트워크를 확인해 주세요.");
    }
  }

  function mountExcel() {
    if (typeof ExcelManager === "undefined") return;
    try {
      ExcelManager.mount("excel-control-root", "DebtList", {
        applyData: function (mode, parsed) {
          var rows = parsed && parsed.Debts ? parsed.Debts : [];
          if (!Array.isArray(rows)) throw new Error("Debts 시트를 찾지 못했습니다.");

          var incoming = rows
            .map(function (r) {
              return {
                id: createId(),
                name: String((r && r.name) || "").slice(0, 80),
                balance: Math.max(0, Math.trunc(Number(r && r.balance) || 0)),
                kind: normalizeKind(r && r.kind),
                memo: String((r && r.memo) || "").slice(0, 200),
              };
            })
            .filter(function (d) {
              return d.name || d.balance > 0 || d.memo;
            });

          if (mode === "overwrite") {
            items = incoming;
          } else {
            items = items.concat(incoming);
          }
          resetForm();
          save();
          render();
        },
        onExportCurrent: function () {
          exportExcel();
        },
      });
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[DebtList] ExcelManager 연결 실패:", err);
      }
    }
  }

  function wireForm() {
    var form = $("debt-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = String($("debt-name").value || "").trim().slice(0, 80);
      var balance = parseWon($("debt-balance").value);
      var kind = normalizeKind($("debt-kind").value);
      var memo = String($("debt-memo").value || "").trim().slice(0, 200);

      if (!name) {
        setHint("부채명을 입력해 주세요.");
        $("debt-name").focus();
        return;
      }

      if (editingId) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === editingId) {
            items[i].name = name;
            items[i].balance = balance;
            items[i].kind = kind;
            items[i].memo = memo;
            break;
          }
        }
        setHint("수정이 저장되었습니다.");
      } else {
        items.push({
          id: createId(),
          name: name,
          balance: balance,
          kind: kind,
          memo: memo,
        });
        setHint("항목이 추가되었습니다.");
      }

      save();
      render();
      resetForm();
    });

    $("debt-reset").addEventListener("click", function () {
      resetForm();
    });
  }

  function init() {
    load();
    wireMoneyInput();
    wireForm();
    mountExcel();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
