/* global XLSX */
/**
 * Money Calendar - Excel Manager (common)
 * - 표준 템플릿 다운로드
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
            { key: "total", label: "total", type: "int", required: true },
            { key: "living", label: "living", type: "int", required: true },
            { key: "activity", label: "activity", type: "int", required: true },
            { key: "essential", label: "essential", type: "int", required: true },
            { key: "confirmed", label: "confirmed", type: "bool", required: false },
            { key: "confirmedAt", label: "confirmedAt", type: "text", required: false },
          ],
          sampleRow: {
            monthKey: "2026-04",
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
          columns: [{ key: "totalIncome", label: "totalIncome", type: "int", required: true }],
          sampleRow: { totalIncome: 2620000 },
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
          ],
          sampleRow: { date: "2026-04-14", startBalance: 150000, endBalance: 120000 },
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
  };

  function validateAndParseAoa(aoa, sheetSchema) {
    if (!aoa || !aoa.length) {
      throw new Error("엑셀 시트가 비어 있습니다. 표준 템플릿으로 다시 저장해 주세요.");
    }

    var expected = sheetSchema.columns.map(function (c) {
      return c.label;
    });
    var header = (aoa[0] || []).map(normalizeHeaderCell);
    var expectedNorm = expected.map(normalizeHeaderCell);

    for (var i = 0; i < expectedNorm.length; i++) {
      if (header[i] !== expectedNorm[i]) {
        var col = colLetter(i);
        throw new Error(
          "컬럼명이 일치하지 않습니다. " +
            col +
            "열은 '" +
            expectedNorm[i] +
            "' 이어야 합니다. (현재: '" +
            (header[i] || "") +
            "')"
        );
      }
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
        var n = toIntNonNeg(raw);
        if (n == null) {
          throw new Error("엑셀의 " + col + "열(금액) 형식이 올바르지 않습니다. 숫자만 입력해 주세요.");
        }
        return n;
      }
      if (type === "enum") {
        var v = String(raw == null ? "" : raw).trim();
        if (sheetSchema.columns[colIdx] && sheetSchema.columns[colIdx].enum) {
          var allowed = sheetSchema.columns[colIdx].enum;
          if (allowed.indexOf(v) >= 0) return v;
          throw new Error(
            "엑셀의 " + col + "열 값이 올바르지 않습니다. 허용: " + allowed.join(", ")
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
    // opts: { schema, onImportRequest(file, parsed), getCurrent, applyData(mode, parsed) }
    var root = document.createElement("div");
    root.className = "excel-tools";

    var row = document.createElement("div");
    row.className = "excel-tools__row";

    var btnTpl = document.createElement("button");
    btnTpl.type = "button";
    btnTpl.className = "excel-btn";
    btnTpl.textContent = "표준 엑셀 양식 다운로드";

    var btnUpload = document.createElement("button");
    btnUpload.type = "button";
    btnUpload.className = "excel-btn";
    btnUpload.textContent = "엑셀 업로드";

    var file = document.createElement("input");
    file.type = "file";
    file.accept = ".xlsx";
    file.hidden = true;

    row.appendChild(btnTpl);
    row.appendChild(btnUpload);
    row.appendChild(file);

    var dz = document.createElement("div");
    dz.className = "dropzone";
    dz.tabIndex = 0;
    dz.setAttribute("role", "button");
    dz.setAttribute("aria-label", "엑셀 파일을 업로드하세요");
    dz.innerHTML =
      "<div><strong>.xlsx</strong> 파일을 여기로 드래그 앤 드롭</div>" +
      "<div class=\"dropzone__sub\">또는 ‘엑셀 업로드’ 버튼을 눌러 선택하세요.</div>";

    var hint = document.createElement("p");
    hint.className = "excel-tools__hint text-sm";
    hint.textContent = "표준 양식을 사용하면 데이터 파싱 오류를 최소화할 수 있습니다.";

    var status = document.createElement("div");
    status.className = "excel-status is-hidden";
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

    root.appendChild(row);
    root.appendChild(dz);
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

    function doTemplateDownload() {
      try {
        ensureXlsx();
        var sheets = opts.schema.sheets.map(function (s) {
          var header = s.columns.map(function (c) {
            return c.label;
          });
          var row0 = [];
          if (s.sampleRow) {
            s.columns.forEach(function (c) {
              row0.push(s.sampleRow[c.key] == null ? "" : s.sampleRow[c.key]);
            });
          } else {
            row0 = s.columns.map(function () {
              return "";
            });
          }
          var aoa = [header, row0];
          return { name: s.name, aoa: aoa };
        });
        var wb = jsonToWb(sheets);
        XLSX.writeFile(wb, makeFilename(opts.schema.key + "_Template"));
      } catch (e) {
        setStatus("err", "템플릿 다운로드 실패", String(e && e.message ? e.message : e));
      }
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

    btnTpl.addEventListener("click", doTemplateDownload);
    btnUpload.addEventListener("click", function () {
      file.click();
    });
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

  function mount(containerId, schemaName, applyData) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var schema = Schemas[schemaName];
    if (!schema) throw new Error("알 수 없는 스키마: " + schemaName);
    renderTools(el, { schema: schema, applyData: applyData });
  }

  window.ExcelManager = {
    Schemas: Schemas,
    makeFilename: makeFilename,
    mount: mount,
    utils: {
      makeFilename: makeFilename,
      yyyymmdd: yyyymmdd,
      todayKey: todayKey,
      toIntNonNeg: toIntNonNeg,
      isFiniteNumber: isFiniteNumber,
    },
  };
})();

