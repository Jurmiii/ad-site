/* global XLSX */
/**
 * Money Calendar - Excel Manager (common)
 * - Drag & Drop 업로드 + 엄격 검증
 * - 덮어쓰기/이어쓰기(스마트 병합) 모달
 * - 성공 메시지(체크 애니메이션)
 */

(function () {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function yyyymmdd() {
    return todayKey().replace(/-/g, "");
  }

  function colLetter(i0) {
    var n = i0 + 1;
    var s = "";
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function toIntNonNeg(v) {
    var n = Number(String(v).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.trunc(n);
  }

  function normalizeHeaderCell(v) {
    return String(v == null ? "" : v).trim();
  }

  function ensureXlsx() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.read || !XLSX.writeFile) {
      throw new Error("엑셀 라이브러리를 불러오지 못했습니다. 네트워크를 확인해 주세요.");
    }
  }

  function makeFilename(kind) {
    return "MoneyCalendar_" + kind + "_" + yyyymmdd() + ".xlsx";
  }

  function jsonToWb(sheets) {
    // sheets: [{ name, rows: array<object> } | { name, aoa: any[][] }]
    ensureXlsx();
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (s) {
      var ws;
      if (s.aoa) ws = XLSX.utils.aoa_to_sheet(s.aoa);
      else ws = XLSX.utils.json_to_sheet(s.rows || []);
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });
    return wb;
  }

  /**
   * @param {ArrayBuffer} buf
   * @returns {{ wb:any, sheetNames:string[] }}
   */
  function readWb(buf) {
    ensureXlsx();
    var wb = XLSX.read(buf, { type: "array" });
    return { wb: wb, sheetNames: wb.SheetNames || [] };
  }

  function sheetToAoa(wb, sheetName) {
    var ws = wb.Sheets[sheetName];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  }

  function pickSheet(wb, preferredName) {
    var names = wb.SheetNames || [];
    if (preferredName && names.indexOf(preferredName) >= 0) return preferredName;
    return names[0] || null;
  }

  /**
   * schema:
   * {
   *   key: 'BudgetSetup',
   *   sheets: [{ name, columns:[{key,label,type,required}], sampleRow?:object, rowMode:'single'|'multi' }]
   * }
   */
  var Schemas = {
    BudgetSetup: {
      key: "BudgetSetup",
      label: "예산설계",
      sheets: [
        {
          name: "BudgetSetup",
          rowMode: "single",
          columns: [
            { key: "monthKey", label: "monthKey", type: "month", required: true },
            { key: "real", label: "real", type: "int", required: true },
            { key: "scheduled", label: "scheduled", type: "int", required: true },
            { key: "other", label: "other", type: "int", required: true },
            { key: "hope", label: "hope", type: "int", required: true },
            { key: "living", label: "living", type: "int", required: true },
            { key: "activity", label: "activity", type: "int", required: true },
            { key: "essential", label: "essential", type: "int", required: true },
            { key: "locked", label: "locked", type: "bool", required: false },
            { key: "lockedAt", label: "lockedAt", type: "text", required: false },
          ],
          sampleRow: {
            monthKey: "2026-04",
            real: 2500000,
            scheduled: 0,
            other: 120000,
            hope: 300000,
            living: 1200000,
            activity: 450000,
            essential: 300000,
            locked: false,
            lockedAt: "",
          },
        },
      ],
    },
    BudgetSimulator: {
      key: "BudgetSimulator",
      label: "예산시뮬",
      sheets: [
        {
          name: "BudgetSimulator",
          rowMode: "single",
          columns: [
            { key: "monthKey", label: "monthKey", type: "month", required: true },
            { key: "income", label: "income", type: "int", required: false, optional: true },
            { key: "fixed", label: "fixed", type: "int", required: false, optional: true },
            { key: "total", label: "total", type: "int", required: true },
            { key: "living", label: "living", type: "int", required: true },
            { key: "activity", label: "activity", type: "int", required: true },
            { key: "essential", label: "essential", type: "int", required: true },
            { key: "confirmed", label: "confirmed", type: "bool", required: false },
            { key: "confirmedAt", label: "confirmedAt", type: "text", required: false },
          ],
          sampleRow: {
            monthKey: "2026-04",
            income: 2500000,
            fixed: 550000,
            total: 1950000,
            living: 975000,
            activity: 585000,
            essential: 390000,
            confirmed: false,
            confirmedAt: "",
          },
        },
      ],
    },
    IncomeDesign: {
      key: "IncomeDesign",
      label: "수입설계",
      sheets: [
        {
          name: "IncomeDesign",
          rowMode: "single",
          columns: [
            { key: "real", label: "real", type: "int", required: true },
            { key: "scheduled", label: "scheduled", type: "int", required: true },
            { key: "other", label: "other", type: "int", required: true },
            { key: "hope", label: "hope", type: "int", required: true },
          ],
          sampleRow: { real: 2500000, scheduled: 0, other: 120000, hope: 300000 },
        },
      ],
    },
    VisionBudget: {
      key: "VisionBudget",
      label: "비전예산",
      sheets: [
        {
          name: "Summary",
          rowMode: "single",
          columns: [
            { key: "totalIncome", label: "totalIncome", type: "int", required: true },
            { key: "fixedExpense", label: "fixedExpense", type: "int", required: false, optional: true },
          ],
          sampleRow: { totalIncome: 2620000, fixedExpense: 1200000 },
        },
        {
          name: "Visions",
          rowMode: "multi",
          columns: [
            { key: "order", label: "order", type: "int", required: true },
            { key: "horizon", label: "horizon", type: "enum", required: true, enum: ["short", "long"] },
            { key: "title", label: "title", type: "text", required: true },
            { key: "targetAmount", label: "targetAmount", type: "int", required: true },
            { key: "currentProgress", label: "currentProgress", type: "int", required: true },
            { key: "monthlyAllocation", label: "monthlyAllocation", type: "int", required: true },
          ],
          sampleRow: {
            order: 1,
            horizon: "short",
            title: "비상금",
            targetAmount: 10000000,
            currentProgress: 1500000,
            monthlyAllocation: 250000,
          },
        },
      ],
    },
    DailyLedger: {
      key: "DailyLedger",
      label: "일일기록",
      sheets: [
        {
          name: "Header",
          rowMode: "single",
          columns: [
            { key: "date", label: "date", type: "text", required: true }, // YYYY-MM-DD
            { key: "startBalance", label: "startBalance", type: "int", required: true },
            { key: "endBalance", label: "endBalance", type: "int", required: false },
            {
              key: "dayRating",
              label: "dayRating",
              type: "enum",
              required: false,
              optional: true,
              enum: ["", "good", "normal", "bad"],
            },
            { key: "dayNote", label: "dayNote", type: "text", required: false, optional: true },
          ],
          sampleRow: {
            date: "2026-04-14",
            startBalance: 150000,
            endBalance: 120000,
            dayRating: "normal",
            dayNote: "커피 줄였음",
          },
        },
        {
          name: "Transactions",
          rowMode: "multi",
          columns: [
            { key: "date", label: "date", type: "text", required: true }, // YYYY-MM-DD
            { key: "type", label: "type", type: "enum", required: true, enum: ["expense", "income"] },
            { key: "category", label: "category", type: "text", required: true },
            { key: "amount", label: "amount", type: "int", required: true },
            { key: "memo", label: "memo", type: "text", required: false },
            { key: "endBalance", label: "endBalance", type: "int", required: false },
          ],
          sampleRow: {
            date: "2026-04-14",
            type: "expense",
            category: "식비",
            amount: 12000,
            memo: "점심",
            endBalance: 138000,
          },
        },
      ],
    },
    /** 9~15 등 공통 셸: 가져오기는 비워 두고 통합 추출만 사용 가능 */
    ShellTooling: {
      key: "ShellTooling",
      label: "공통 도구",
      sheets: [
        {
          name: "Readme",
          rowMode: "single",
          columns: [{ key: "note", label: "note", type: "text", required: false }],
          sampleRow: { note: "이 시트는 안내용입니다." },
        },
      ],
    },
  };

  function masterSafeSheetName(name) {
    var n = String(name || "Sheet").replace(/[[\]*?:/\\]/g, "_");
    if (n.length > 31) n = n.slice(0, 31);
    return n;
  }

  function masterAppendRows(wb, name, rows) {
    var ws = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{ _note: "(데이터 없음)" }]);
    XLSX.utils.book_append_sheet(wb, ws, masterSafeSheetName(name));
  }

  function masterLoadJson(key, fallback) {
    try {
      var r = localStorage.getItem(key);
      if (!r) return fallback;
      return JSON.parse(r);
    } catch (e) {
      return fallback;
    }
  }

  function masterMonthNow() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function masterSumDayExpenses(day) {
    if (!day || !Array.isArray(day.txs)) return 0;
    var s = 0;
    for (var i = 0; i < day.txs.length; i++) {
      var t = day.txs[i];
      if (t && t.type === "expense") s += Math.max(0, Math.trunc(Number(t.amount) || 0));
    }
    return s;
  }

  function masterMonthCap(mk) {
    try {
      var r = localStorage.getItem("moneyCalendar.budgetSetup.v1." + mk);
      if (r) {
        var o = JSON.parse(r);
        var a =
          Math.max(0, Math.trunc(Number(o.living) || 0)) +
          Math.max(0, Math.trunc(Number(o.activity) || 0)) +
          Math.max(0, Math.trunc(Number(o.essential) || 0));
        if (a > 0) return a;
      }
      var r2 = localStorage.getItem("moneyCalendar.budgetSimulator.v1." + mk);
      if (r2) {
        var o2 = JSON.parse(r2);
        return Math.max(0, Math.trunc(Number(o2.total) || 0));
      }
    } catch (e) {
      /* ignore */
    }
    return 0;
  }

  function masterIsoWeekKey(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    d.setHours(0, 0, 0, 0);
    var dayNr = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNr + 3);
    var jan4 = new Date(d.getFullYear(), 0, 4);
    var week =
      1 +
      Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + "-W" + String(week).padStart(2, "0");
  }

  function masterBucket(cat) {
    var c = String(cat || "").toLowerCase();
    if (/식|카페|마트|배달|주거|관리|통신|보험|의료|세금|공과/.test(c)) return "living";
    if (/문화|여가|취미|교육|구독|쇼핑|의류/.test(c)) return "activity";
    if (/대출|이자|저축|비상|고정/.test(c)) return "essential";
    return "activity";
  }

  function masterSpendByBucket(mk, dailyMap) {
    var out = { living: 0, activity: 0, essential: 0 };
    Object.keys(dailyMap).forEach(function (ds) {
      if (ds.slice(0, 7) !== mk) return;
      var day = dailyMap[ds];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (t) {
        if (!t || t.type !== "expense") return;
        var amt = Math.max(0, Math.trunc(Number(t.amount) || 0));
        out[masterBucket(t.category)] += amt;
      });
    });
    return out;
  }

  function masterAiMessages(mk) {
    var b = masterLoadJson("moneyCalendar.budgetSetup.v1." + mk, {});
    var living = Math.max(0, Math.trunc(Number(b.living) || 0));
    var activity = Math.max(0, Math.trunc(Number(b.activity) || 0));
    var essential = Math.max(0, Math.trunc(Number(b.essential) || 0));
    var alloc = living + activity + essential;
    var sim = masterLoadJson("moneyCalendar.budgetSimulator.v1." + mk, {});
    var cap = alloc > 0 ? alloc : Math.max(0, Math.trunc(Number(sim.total) || 0));
    var dailyMap = masterLoadJson("moneyCalendar.dailyLedger.v1", {});
    var spent = 0;
    Object.keys(dailyMap).forEach(function (ds) {
      if (ds.slice(0, 7) !== mk) return;
      var day = dailyMap[ds];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (x) {
        if (x && x.type === "expense") spent += Math.max(0, Math.trunc(Number(x.amount) || 0));
      });
    });
    var msgs = [];
    if (cap > 0 && spent > cap * 1.05) {
      msgs.push({
        type: "warn",
        tag: "지출",
        text: "이번 달 데일리 지출 합이 기준(배분 또는 시뮬 총예산)보다 5%를 넘었습니다.",
      });
    }
    if (living > 0 && activity > living * 0.45) {
      msgs.push({
        type: "warn",
        tag: "비율",
        text: "선택적 지출(Wants) 배분이 필수 지출(Needs)의 45%를 넘습니다. 유흥·구독 항목을 점검해 보세요.",
      });
    }
    if (cap > 0 && spent < cap * 0.7) {
      msgs.push({
        type: "ok",
        tag: "여유",
        text: "지출 속도가 기준 대비 여유롭습니다. 비전 저축으로 이월할 금액을 검토해 보세요.",
      });
    }
    if (!msgs.length) {
      msgs.push({
        type: "ok",
        tag: "관측",
        text: "데이터가 부족하거나 규칙에 해당하는 이상 징후가 없습니다.",
      });
    }
    return msgs.map(function (m, idx) {
      return { order: idx + 1, type: m.type, tag: m.tag, message: m.text };
    });
  }

  /**
   * 1~15 전 기능: 통합 워크북 (기능 번호별 시트)
   * @returns {void}
   */
  function runMasterExportWorkbook() {
    ensureXlsx();
    var wb = XLSX.utils.book_new();
    var mk = masterMonthNow();

    function setCols(ws, widths) {
      ws["!cols"] = (widths || []).map(function (wch) {
        return { wch: wch };
      });
    }

    function styleHeaderRow(ws, colCount) {
      // SheetJS community에서도 일부 뷰어에서 스타일이 보이도록 's'를 넣어 둔다(지원 환경 한정)
      for (var c = 0; c < colCount; c++) {
        var addr = colLetter(c) + "1";
        if (!ws[addr]) continue;
        ws[addr].s = {
          fill: { patternType: "solid", fgColor: { rgb: "0B1F3A" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
          },
        };
      }
    }

    function numFmt(ws, colLetter0, startRow, endRow) {
      for (var r = startRow; r <= endRow; r++) {
        var a = colLetter0 + String(r);
        if (!ws[a]) continue;
        ws[a].z = "#,##0";
      }
    }

    // ---- 템플릿(제출용) 시트 3종: 종합 보고서 / 예산 설계 / 일일 기록 ----
    var bs = masterLoadJson("moneyCalendar.budgetSetup.v1." + mk, null);
    var ti = bs
      ? Math.max(0, Math.trunc(Number(bs.real) || 0)) +
        Math.max(0, Math.trunc(Number(bs.scheduled) || 0)) +
        Math.max(0, Math.trunc(Number(bs.other) || 0)) +
        Math.max(0, Math.trunc(Number(bs.hope) || 0))
      : 0;
    var alloc = bs
      ? Math.max(0, Math.trunc(Number(bs.living) || 0)) +
        Math.max(0, Math.trunc(Number(bs.activity) || 0)) +
        Math.max(0, Math.trunc(Number(bs.essential) || 0))
      : 0;

    var dailyMap0 = masterLoadJson("moneyCalendar.dailyLedger.v1", {});
    var dailyRows = [];
    Object.keys(dailyMap0).forEach(function (date) {
      if (date.slice(0, 7) !== mk) return;
      var day = dailyMap0[date];
      if (!day || !Array.isArray(day.txs)) return;
      day.txs.forEach(function (t) {
        dailyRows.push([date, t.type, t.category, t.memo, Math.max(0, Math.trunc(Number(t.amount) || 0))]);
      });
    });

    var dailyAoa = [["날짜", "구분", "카테고리", "메모", "금액"]];
    for (var dr = 0; dr < dailyRows.length; dr++) dailyAoa.push(dailyRows[dr]);
    var wsDaily = XLSX.utils.aoa_to_sheet(dailyAoa);
    setCols(wsDaily, [12, 10, 16, 28, 14]);
    styleHeaderRow(wsDaily, 5);
    if (dailyAoa.length >= 2) numFmt(wsDaily, "E", 2, dailyAoa.length);
    XLSX.utils.book_append_sheet(wb, wsDaily, "일일_기록");

    var budgetAoa = [
      ["항목", "값(원)", "비고"],
      ["기준월", mk, ""],
      ["총 수입", ti, ""],
      ["배분 합계", alloc, ""],
      ["잔여(저축/여유)", { f: "B3-B4" }, "총수입-배분합"],
      ["필수 지출 (Needs)", bs ? Math.max(0, Math.trunc(Number(bs.living) || 0)) : 0, ""],
      ["선택적 지출 (Wants)", bs ? Math.max(0, Math.trunc(Number(bs.activity) || 0)) : 0, ""],
      ["저축 및 투자 (Savings)", bs ? Math.max(0, Math.trunc(Number(bs.essential) || 0)) : 0, ""],
    ];
    var wsBudget = XLSX.utils.aoa_to_sheet(budgetAoa);
    setCols(wsBudget, [18, 16, 28]);
    styleHeaderRow(wsBudget, 3);
    numFmt(wsBudget, "B", 3, 9);
    XLSX.utils.book_append_sheet(wb, wsBudget, "예산_설계");

    // 종합 보고서: 일일 기록의 지출/수입 합계, 잔여 자동 계산(SUMIF)
    var wsReport = XLSX.utils.aoa_to_sheet([
      ["종합 보고서", "", ""],
      ["기준월", mk, ""],
      ["총 수입(예산 설계)", { f: "예산_설계!B3" }, ""],
      ["총 지출(일일 기록)", { f: 'SUMIF(일일_기록!B:B,"expense",일일_기록!E:E)' }, ""],
      ["총 수입(일일 기록)", { f: 'SUMIF(일일_기록!B:B,"income",일일_기록!E:E)' }, ""],
      ["순지출(지출-수입)", { f: "B4-B5" }, ""],
      ["예산 잔여(예산 기준)", { f: "예산_설계!B5" }, ""],
    ]);
    setCols(wsReport, [20, 18, 18]);
    // 헤더(1행)는 타이틀이므로 1행 스타일 대신 1행 병합 느낌만
    wsReport["A1"].s = { font: { bold: true } };
    styleHeaderRow(wsReport, 3); // 1행도 헤더처럼 보이게
    numFmt(wsReport, "B", 3, 7);
    XLSX.utils.book_append_sheet(wb, wsReport, "종합_보고서");

    var inc = masterLoadJson("moneyCalendar.incomeDesign.v1", null);
    masterAppendRows(wb, "01_계층형수입설계", inc && typeof inc === "object" ? [inc] : []);

    var vis = masterLoadJson("moneyCalendar.visionBudget.v1", null);
    if (vis && typeof vis === "object") {
      var fi = Math.max(0, Math.trunc(Number(vis.totalIncome) || 0));
      var fx = Math.max(0, Math.trunc(Number(vis.fixedExpense) || 0));
      var vs = 0;
      if (Array.isArray(vis.visions)) {
        vis.visions.forEach(function (v) {
          vs += Math.max(0, Math.trunc(Number(v && v.monthlyAllocation) || 0));
        });
      }
      var visRows = [];
      visRows.push({
        kind: "summary",
        totalIncome: fi,
        fixedExpense: fx,
        visionAllocationSum: vs,
        disposableAfterFixedAndVision: fi - fx - vs,
        json: truncateCell(JSON.stringify(vis), 30000),
      });
      masterAppendRows(wb, "02_비전기반예산", visRows);
    } else {
      masterAppendRows(wb, "02_비전기반예산", []);
    }

    var lockRows = [];
    var arch = masterLoadJson("moneyCalendar.budgetLockArchive.v1", null);
    if (arch) lockRows.push({ kind: "archive", payload: truncateCell(JSON.stringify(arch), 30000) });
    for (var li = 0; li < localStorage.length; li++) {
      var lk = localStorage.key(li);
      if (lk && lk.indexOf("moneyCalendar.budgetLockHistory.v1.") === 0) {
        lockRows.push({
          kind: "history",
          monthKey: lk.split(".").pop(),
          payload: truncateCell(localStorage.getItem(lk) || "", 30000),
        });
      }
    }
    masterAppendRows(wb, "03_예산안확정락", lockRows);

    var simRows = [];
    for (var si = 0; si < localStorage.length; si++) {
      var sk = localStorage.key(si);
      if (sk && sk.indexOf("moneyCalendar.budgetSimulator.v1.") === 0) {
        var sm = sk.slice("moneyCalendar.budgetSimulator.v1.".length);
        var so = masterLoadJson(sk, {});
        simRows.push({
          monthKey: sm,
          total: so.total,
          living: so.living,
          activity: so.activity,
          essential: so.essential,
          confirmed: so.confirmed,
          confirmedAt: so.confirmedAt,
        });
      }
    }
    masterAppendRows(wb, "04_예산분배시뮬", simRows);

    var dailyMap = masterLoadJson("moneyCalendar.dailyLedger.v1", {});
    var rows05 = [];
    var rows06 = [];
    var rows07 = [];
    var rows08 = [];
    Object.keys(dailyMap).forEach(function (date) {
      var day = dailyMap[date];
      if (!day || !Array.isArray(day.txs)) return;
      var dayExp = masterSumDayExpenses(day);
      day.txs.forEach(function (t) {
        rows05.push({
          date: date,
          type: t.type,
          category: t.category,
          memo: t.memo,
          amount: t.amount,
          dayRating: day.dayRating || "",
          dayNote: day.dayNote || "",
        });
      });
      rows06.push({
        date: date,
        dayRating: day.dayRating || "",
        dayNote: day.dayNote || "",
        dayExpenseTotal: dayExp,
      });
      var capD = masterMonthCap(date.slice(0, 7));
      rows07.push({
        date: date,
        monthKey: date.slice(0, 7),
        dayExpenseTotal: dayExp,
        monthBudgetCap: capD,
        pctOfMonthCap: capD > 0 ? Math.round((dayExp / capD) * 10000) / 100 : "",
      });
      rows08.push({
        date: date,
        dayExpenseTotal: dayExp,
        noSpendDay: dayExp === 0 ? 1 : 0,
      });
    });
    masterAppendRows(wb, "05_퀵인풋_거래", rows05);
    masterAppendRows(wb, "06_한줄평_요약", rows06);
    masterAppendRows(wb, "07_체감지수_일별", rows07);
    masterAppendRows(wb, "08_무지출챌린지", rows08);

    var weeks = {};
    Object.keys(dailyMap).forEach(function (ds) {
      if (ds.slice(0, 7) !== mk) return;
      var wk = masterIsoWeekKey(ds);
      weeks[wk] = (weeks[wk] || 0) + masterSumDayExpenses(dailyMap[ds]);
    });
    var wkRows = [];
    var capM = masterMonthCap(mk);
    Object.keys(weeks)
      .sort()
      .forEach(function (k) {
        var sp = weeks[k];
        wkRows.push({
          monthKey: mk,
          isoWeek: k,
          weekSpend: sp,
          monthCap: capM,
          weekPctOfMonthCap: capM > 0 ? Math.round((sp / capM) * 10000) / 100 : "",
        });
      });
    masterAppendRows(wb, "09_주간실천리포트", wkRows);

    var bud = masterLoadJson("moneyCalendar.budgetSetup.v1." + mk, {
      living: 0,
      activity: 0,
      essential: 0,
    });
    var spb = masterSpendByBucket(mk, dailyMap);
    var mrRows = [];
    mrRows.push({ section: "복기대상월", monthKey: mk, label: "", budget: "", spendApprox: "", diff: "" });
    mrRows.push({
      section: "항목별비교",
      monthKey: mk,
      label: "필수 지출 (Needs)",
      budget: Math.max(0, Math.trunc(Number(bud.living) || 0)),
      spendApprox: spb.living,
      diff: Math.max(0, Math.trunc(Number(bud.living) || 0)) - spb.living,
    });
    mrRows.push({
      section: "항목별비교",
      monthKey: mk,
      label: "선택적 지출 (Wants)",
      budget: Math.max(0, Math.trunc(Number(bud.activity) || 0)),
      spendApprox: spb.activity,
      diff: Math.max(0, Math.trunc(Number(bud.activity) || 0)) - spb.activity,
    });
    mrRows.push({
      section: "항목별비교",
      monthKey: mk,
      label: "저축 및 투자 (Savings)",
      budget: Math.max(0, Math.trunc(Number(bud.essential) || 0)),
      spendApprox: spb.essential,
      diff: Math.max(0, Math.trunc(Number(bud.essential) || 0)) - spb.essential,
    });
    for (var bi = 0; bi < localStorage.length; bi++) {
      var bk = localStorage.key(bi);
      if (!bk || bk.indexOf("moneyCalendar.budgetSetup.v1.") !== 0) continue;
      var bmon = bk.slice("moneyCalendar.budgetSetup.v1.".length);
      var bo = masterLoadJson(bk, {});
      mrRows.push({
        section: "예산안배분원본",
        monthKey: bmon,
        income_real: bo.real,
        income_scheduled: bo.scheduled,
        income_other: bo.other,
        income_hope: bo.hope,
        alloc_living: Math.max(0, Math.trunc(Number(bo.living) || 0)),
        alloc_activity: Math.max(0, Math.trunc(Number(bo.activity) || 0)),
        alloc_essential: Math.max(0, Math.trunc(Number(bo.essential) || 0)),
        locked: bo.locked,
        lockedAt: bo.lockedAt,
      });
    }
    masterAppendRows(wb, "10_월간예산복기", mrRows);

    var tlKeys = [];
    var d0 = new Date();
    for (var ti = 11; ti >= 0; ti--) {
      var u = new Date(d0.getFullYear(), d0.getMonth() - ti, 1);
      tlKeys.push(u.getFullYear() + "-" + String(u.getMonth() + 1).padStart(2, "0"));
    }
    var tlRows = tlKeys.map(function (k) {
      var t = 0;
      Object.keys(dailyMap).forEach(function (ds) {
        if (ds.slice(0, 7) !== k) return;
        t += masterSumDayExpenses(dailyMap[ds]);
      });
      return { monthKey: k, expenseTotal: t };
    });
    masterAppendRows(wb, "11_과거타임라인", tlRows);

    masterAppendRows(wb, "12_AI재정피드백", masterAiMessages(mk));

    masterAppendRows(wb, "13_전기능익스포트", [
      {
        note:
          "이 워크북은 상단 통합 추출로 생성되었습니다. 각 시트는 기획서 기능 1~15번과 대응합니다.",
        generatedMonth: mk,
      },
    ]);

    var lsRows = [];
    for (var ri = 0; ri < localStorage.length; ri++) {
      var rk = localStorage.key(ri);
      if (!rk || rk.indexOf("moneyCalendar.") !== 0) continue;
      var raw = localStorage.getItem(rk) || "";
      lsRows.push({ storageKey: rk, value: truncateCell(raw, 12000) });
    }
    masterAppendRows(wb, "14_암호화백업용원본", lsRows);

    var posts = masterLoadJson("moneyCalendar.publicBoard.v1", []);
    var pr = Array.isArray(posts)
      ? posts.map(function (p, i) {
          return {
            idx: i + 1,
            at: p.at,
            nick: p.nick,
            body: p.body,
          };
        })
      : [];
    masterAppendRows(wb, "15_공개형공유", pr);

    XLSX.writeFile(wb, makeFilename("재정관리템플릿"));
  }

  function truncateCell(s, max) {
    s = String(s || "");
    if (s.length > max) return s.slice(0, max) + "…(truncated)";
    return s;
  }

  function validateAndParseAoa(aoa, sheetSchema) {
    if (!aoa || !aoa.length) {
      throw new Error("엑셀 시트가 비어 있습니다. 웹에서 저장한 파일이거나 유효한 데이터 행이 있는지 확인해 주세요.");
    }

    var expected = sheetSchema.columns.map(function (c) {
      return c.label;
    });
    var header = (aoa[0] || []).map(normalizeHeaderCell);
    var expectedNorm = expected.map(normalizeHeaderCell);

    for (var i = 0; i < expectedNorm.length; i++) {
      var hCell = normalizeHeaderCell(header[i] != null ? header[i] : "");
      var exp = expectedNorm[i];
      var colDef0 = sheetSchema.columns[i];
      if (hCell === exp) continue;
      if (colDef0 && colDef0.optional && hCell === "") continue;
      var col = colLetter(i);
      throw new Error(
        "컬럼명이 일치하지 않습니다. " +
          col +
          "열은 '" +
          exp +
          "' 이어야 합니다. (현재: '" +
          hCell +
          "')"
      );
    }

    function parseCell(type, raw, colIdx, rowIdx) {
      var col = colLetter(colIdx);
      if (type === "text") return String(raw == null ? "" : raw).trim();
      if (type === "bool") {
        var s = String(raw == null ? "" : raw).trim().toLowerCase();
        if (s === "" || s === "0" || s === "false" || s === "n" || s === "no") return false;
        if (s === "1" || s === "true" || s === "y" || s === "yes") return true;
        throw new Error("엑셀의 " + col + "열(값) 형식이 올바르지 않습니다. true/false로 입력해 주세요.");
      }
      if (type === "month") {
        var m = String(raw == null ? "" : raw).trim();
        if (!/^\d{4}-\d{2}$/.test(m)) {
          throw new Error("엑셀의 " + col + "열(월) 형식이 올바르지 않습니다. 예: 2026-04");
        }
        return m;
      }
      if (type === "int") {
        var colDefI = sheetSchema.columns[colIdx];
        var rawInt = String(raw == null ? "" : raw).trim();
        if (rawInt === "" && colDefI && colDefI.required === false) return null;
        var n = toIntNonNeg(raw);
        if (n == null) {
          throw new Error("엑셀의 " + col + "열(금액) 형식이 올바르지 않습니다. 숫자만 입력해 주세요.");
        }
        return n;
      }
      if (type === "enum") {
        var v = String(raw == null ? "" : raw).trim();
        var colDefE = sheetSchema.columns[colIdx];
        if (colDefE && colDefE.enum) {
          var allowed = colDefE.enum;
          if (v === "" && colDefE.required === false) return "";
          if (allowed.indexOf(v) >= 0) return v;
          throw new Error(
            "엑셀의 " + col + "열 값이 올바르지 않습니다. 허용: " + allowed.filter(Boolean).join(", ")
          );
        }
        return v;
      }
      return raw;
    }

    var rows = [];
    for (var r = 1; r < aoa.length; r++) {
      var line = aoa[r];
      if (!line || !line.length) continue;
      // empty row guard
      var any = false;
      for (var c0 = 0; c0 < expectedNorm.length; c0++) {
        if (String(line[c0] == null ? "" : line[c0]).trim() !== "") {
          any = true;
          break;
        }
      }
      if (!any) continue;

      var obj = {};
      for (var c = 0; c < sheetSchema.columns.length; c++) {
        var colDef = sheetSchema.columns[c];
        var raw = line[c];
        var parsed = parseCell(colDef.type, raw, c, r + 1);
        if (colDef.required && (parsed === "" || parsed == null)) {
          var colL = colLetter(c);
          throw new Error("엑셀의 " + colL + "열(" + colDef.label + ") 값이 비어 있습니다.");
        }
        obj[colDef.key] = parsed;
      }
      rows.push(obj);
    }

    if (sheetSchema.rowMode === "single") {
      if (!rows.length) throw new Error("엑셀에 데이터 행이 없습니다. 2행부터 값을 입력해 주세요.");
      return rows[0];
    }
    return rows;
  }

  function parseWorkbook(buf, schema) {
    var r = readWb(buf);
    if (!r.sheetNames.length) throw new Error("엑셀 파일에 시트가 없습니다.");
    var out = {};
    schema.sheets.forEach(function (s) {
      var name = pickSheet(r.wb, s.name);
      if (!name) throw new Error("필수 시트를 찾을 수 없습니다: " + s.name);
      var aoa = sheetToAoa(r.wb, name);
      out[s.name] = validateAndParseAoa(aoa, s);
    });
    return out;
  }

  function renderTools(container, opts) {
    // opts: { schema, applyData(mode, parsed), onExportCurrent?: () => void }
    container.textContent = "";

    var root = document.createElement("div");
    root.className = "excel-control-box excel-control-center";

    var head = document.createElement("div");
    head.className = "excel-control-box__head";
    var headLabel = document.createElement("span");
    headLabel.className = "excel-control-box__label";
    headLabel.textContent = "Excel Control Center";
    var headSub = document.createElement("span");
    headSub.className = "excel-control-box__schema";
    headSub.textContent = opts.schema.label || opts.schema.key;
    head.appendChild(headLabel);
    head.appendChild(headSub);

    var slogan = document.createElement("p");
    slogan.className = "mc-excel-slogan";
    slogan.textContent = "기록은 웹으로 간편하게, 보관은 문서로 든든하게! 똑똑한 재정 습관의 시작.";

    var note = document.createElement("p");
    note.className = "mc-excel-note";
    note.textContent =
      "※ 본 문서는 혹시 모를 데이터 유실에 대비한 안전한 보관용입니다. 편집은 머니 캘린더 웹을 통해 진행하는 것이 가장 편리하고 정확합니다.";

    var zones = document.createElement("div");
    zones.className = "excel-control-box__zones";

    var zoneIn = document.createElement("div");
    zoneIn.className = "excel-zone excel-zone--import";
    var zinTitle = document.createElement("div");
    zinTitle.className = "excel-zone__title";
    zinTitle.textContent = "가져오기 · Import";
    var zinLead = document.createElement("p");
    zinLead.className = "excel-zone__lead text-sm";
    zinLead.textContent = "이전에 저장한 엑셀 파일을 선택해 검증 후 화면에 반영합니다.";
    zoneIn.appendChild(zinTitle);
    zoneIn.appendChild(zinLead);

    var zoneOut = document.createElement("div");
    zoneOut.className = "excel-zone excel-zone--export";
    var zoutTitle = document.createElement("div");
    zoutTitle.className = "excel-zone__title";
    zoutTitle.textContent = "보내기 · Export";
    var zoutLead = document.createElement("p");
    zoutLead.className = "excel-zone__lead text-sm";
    zoutLead.textContent = "지금 화면의 값을 엑셀로 저장해 백업하거나 다른 도구로 옮깁니다.";
    zoneOut.appendChild(zoutTitle);
    zoneOut.appendChild(zoutLead);

    var actionsIn = document.createElement("div");
    actionsIn.className = "excel-control-box__actions excel-control-box__actions--import";

    var btnUpload = document.createElement("button");
    btnUpload.type = "button";
    btnUpload.className = "excel-control-box__btn excel-control-box__btn--ghost";
    btnUpload.textContent = "파일에서 불러오기";

    var file = document.createElement("input");
    file.type = "file";
    file.accept = ".xlsx";
    file.hidden = true;

    actionsIn.appendChild(btnUpload);
    actionsIn.appendChild(file);

    var importRow = document.createElement("div");
    importRow.className = "excel-control-box__import-row";

    var dz = document.createElement("div");
    dz.className = "dropzone excel-control-box__dropzone excel-dropzone--inline";
    dz.tabIndex = 0;
    dz.setAttribute("role", "button");
    dz.setAttribute("aria-label", "엑셀 파일을 여기에 끌어다 놓거나 클릭하여 불러오기");
    dz.innerHTML =
      '<div class="excel-dropzone-inline__main">파일을 이곳에 끌어다 놓으세요</div>' +
      '<div class="excel-dropzone-inline__sub">.xlsx · 「파일에서 불러오기」와 동일하게 검증 후 적용</div>';

    importRow.appendChild(actionsIn);
    importRow.appendChild(dz);
    zoneIn.appendChild(importRow);

    var actionsOut = document.createElement("div");
    actionsOut.className = "excel-control-box__actions excel-control-box__actions--export";

    var btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "excel-control-box__btn excel-control-box__btn--primary";
    btnSave.textContent = "현재 화면 엑셀 저장";

    var hasExport = typeof opts.onExportCurrent === "function";
    if (!hasExport) {
      btnSave.disabled = true;
      btnSave.setAttribute("aria-disabled", "true");
      btnSave.title = "이 기능의 엑셀 보내기는 아직 연결되지 않았습니다.";
    }

    actionsOut.appendChild(btnSave);
    zoneOut.appendChild(actionsOut);

    zones.appendChild(zoneIn);
    zones.appendChild(zoneOut);

    var featureId = 0;
    try {
      featureId = parseInt((document.body && document.body.dataset && document.body.dataset.mcFeatureId) || "0", 10) || 0;
    } catch (eFeat) {
      featureId = 0;
    }

    var masterRow = null;
    var btnMaster = null;
    if (featureId === 13) {
      masterRow = document.createElement("div");
      masterRow.className = "excel-control-box__master";
      btnMaster = document.createElement("button");
      btnMaster.type = "button";
      btnMaster.className = "excel-control-box__btn excel-control-box__btn--master";
      btnMaster.textContent = "1~15 전 기능 통합 엑셀 추출";
      masterRow.appendChild(btnMaster);
    }

    var hint = document.createElement("p");
    hint.className = "excel-control-box__hint text-sm";
    hint.textContent =
      "웹에서 입력한 값을 엑셀로 내려받아 보관하거나, 반대로 파일을 불러와 동기화할 수 있습니다.";

    var status = document.createElement("div");
    status.className = "excel-status excel-control-box__status is-hidden";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    var modal = document.createElement("div");
    modal.className = "excel-modal";
    modal.hidden = true;
    modal.innerHTML =
      "<div class=\"excel-modal__backdrop\" data-close></div>" +
      "<div class=\"excel-modal__panel\" role=\"dialog\" aria-modal=\"true\" aria-label=\"업로드 데이터 처리\">" +
      "  <div class=\"excel-modal__head\">" +
      "    <div>" +
      "      <div class=\"excel-modal__title\">업로드 데이터를 어떻게 적용할까요?</div>" +
      "      <div class=\"excel-modal__desc\">기존 입력값과 업로드 데이터를 어떤 방식으로 합칠지 선택할 수 있습니다.</div>" +
      "    </div>" +
      "    <button class=\"excel-modal__close\" type=\"button\" data-close>닫기</button>" +
      "  </div>" +
      "  <div class=\"excel-modal__actions\">" +
      "    <button class=\"excel-btn excel-modal__primary\" type=\"button\" data-mode=\"overwrite\">덮어쓰기</button>" +
      "    <button class=\"excel-btn\" type=\"button\" data-mode=\"merge\">이어서 작성</button>" +
      "  </div>" +
      "</div>";

    root.appendChild(head);
    root.appendChild(slogan);
    root.appendChild(note);
    root.appendChild(zones);
    if (masterRow) root.appendChild(masterRow);
    root.appendChild(hint);
    root.appendChild(status);
    root.appendChild(modal);
    container.appendChild(root);

    function setStatus(kind, title, msg) {
      status.classList.remove("is-hidden", "excel-status--ok", "excel-status--err");
      status.classList.add(kind === "ok" ? "excel-status--ok" : "excel-status--err");
      if (kind === "ok") {
        status.innerHTML =
          "<div class=\"excel-status__title\">" +
          "<svg class=\"excel-check\" viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\">" +
          "<path d=\"M20 6L9 17l-5-5\" stroke=\"#16a34a\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />" +
          "</svg>" +
          title +
          "</div>" +
          "<div class=\"text-sm\" style=\"margin-top:6px;color:#475569;line-height:1.55;\">" +
          msg +
          "</div>";
      } else {
        status.innerHTML =
          "<div class=\"excel-status__title\">" +
          "<span aria-hidden=\"true\" style=\"font-weight:900;color:#ef4444;\">!</span>" +
          title +
          "</div>" +
          "<div class=\"text-sm\" style=\"margin-top:6px;color:#475569;line-height:1.55;\">" +
          msg +
          "</div>";
      }
    }

    function openModal(parsed) {
      modal.hidden = false;
      modal._parsed = parsed;
      var btn = modal.querySelector("[data-mode=\"overwrite\"]");
      if (btn) btn.focus();
    }

    function closeModal() {
      modal.hidden = true;
      modal._parsed = null;
    }

    function handleFile(f) {
      if (!f) return;
      if (!/\.xlsx$/i.test(f.name)) {
        setStatus("err", "업로드 실패", "xlsx 파일만 업로드할 수 있습니다.");
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        setStatus("err", "업로드 실패", "파일을 읽을 수 없습니다. 다시 시도해 주세요.");
      };
      reader.onload = function () {
        try {
          var buf = reader.result;
          var parsed = parseWorkbook(buf, opts.schema);
          openModal(parsed);
        } catch (e) {
          setStatus("err", "업로드 검증 실패", String(e && e.message ? e.message : e));
        }
      };
      reader.readAsArrayBuffer(f);
    }

    btnUpload.addEventListener("click", function () {
      file.click();
    });
    btnSave.addEventListener("click", function () {
      if (!hasExport) return;
      try {
        opts.onExportCurrent();
        setStatus("ok", "저장 파일을 만들었습니다.", "다운로드 폴더에서 엑셀 파일을 확인해 주세요.");
      } catch (e) {
        setStatus("err", "저장 실패", String(e && e.message ? e.message : e));
      }
    });
    if (btnMaster) {
      btnMaster.addEventListener("click", function () {
        try {
          runMasterExportWorkbook();
          setStatus("ok", "통합 워크북을 만들었습니다.", "기능 1~15에 대응하는 15개 시트로 저장됩니다.");
        } catch (e) {
          setStatus("err", "통합 추출 실패", String(e && e.message ? e.message : e));
        }
      });
    }
    file.addEventListener("change", function () {
      handleFile(file.files && file.files[0]);
      file.value = "";
    });

    function prevent(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        prevent(e);
        dz.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        prevent(e);
        dz.classList.remove("is-dragover");
      });
    });
    dz.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      handleFile(dt.files[0]);
    });
    dz.addEventListener("click", function () {
      file.click();
    });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") file.click();
    });

    modal.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.getAttribute && t.getAttribute("data-close") != null) closeModal();
      if (t.closest && t.closest("[data-close]")) closeModal();
      var btn = t.closest ? t.closest("[data-mode]") : null;
      if (btn) {
        var mode = btn.getAttribute("data-mode");
        var payload = modal._parsed;
        closeModal();
        try {
          opts.applyData(mode, payload);
          setStatus(
            "ok",
            "데이터 동기화 완료!",
            "오늘의 재정 생활을 시작하세요."
          );
        } catch (err) {
          setStatus("err", "적용 실패", String(err && err.message ? err.message : err));
        }
      }
    });

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  function mount(containerId, schemaName, third) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var schema = Schemas[schemaName];
    if (!schema) throw new Error("알 수 없는 스키마: " + schemaName);
    var applyData;
    var onExportCurrent = null;
    if (typeof third === "function") {
      applyData = third;
    } else if (third && typeof third === "object") {
      applyData = typeof third.applyData === "function" ? third.applyData : function () {};
      onExportCurrent =
        typeof third.onExportCurrent === "function" ? third.onExportCurrent : null;
    } else {
      applyData = function () {};
    }
    renderTools(el, { schema: schema, applyData: applyData, onExportCurrent: onExportCurrent });
  }

  window.ExcelManager = {
    Schemas: Schemas,
    makeFilename: makeFilename,
    mount: mount,
    runMasterExportWorkbook: runMasterExportWorkbook,
    utils: {
      makeFilename: makeFilename,
      yyyymmdd: yyyymmdd,
      todayKey: todayKey,
      toIntNonNeg: toIntNonNeg,
      isFiniteNumber: isFiniteNumber,
    },
  };
})();

