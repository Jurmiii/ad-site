/**
 * Money Calendar 기능 14 — 데이터 암호화 및 백업
 */
(function () {
  "use strict";

  function snapshot() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k) o[k] = localStorage.getItem(k);
    }
    return o;
  }

  function downloadBlob(name, blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function yyyymmdd() {
    try {
      if (typeof ExcelManager !== "undefined" && ExcelManager.utils && ExcelManager.utils.yyyymmdd) {
        return ExcelManager.utils.yyyymmdd();
      }
    } catch (e) {}
    var d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function showDownloadGuideModal() {
    // 요구 문구(그대로)
    var msg =
      "이 파일은 머니 캘린더 전용 보안 파일(.zip)입니다. 일반적인 압축 해제나 엑셀 프로그램으로는 열리지 않는 것이 정상이니, 나중에 [불러오기] 메뉴를 통해 안전하게 복원해 주세요.";

    var ex = document.getElementById("mc-backup-guide");
    if (ex) ex.remove();

    var root = document.createElement("div");
    root.id = "mc-backup-guide";
    root.className = "mc-modal";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "보안 백업 안내");

    var panel = document.createElement("div");
    panel.className = "mc-modal__panel";

    var title = document.createElement("div");
    title.className = "mc-modal__title";
    title.textContent = "보안 백업 파일 다운로드 안내";

    var desc = document.createElement("p");
    desc.className = "mc-modal__desc";
    desc.textContent = msg;

    var actions = document.createElement("div");
    actions.className = "mc-modal__actions";

    function close() {
      try {
        root.remove();
      } catch (e) {}
    }

    var ok = document.createElement("button");
    ok.type = "button";
    ok.className = "mc-modal__btn mc-modal__btn--primary";
    ok.textContent = "확인";
    ok.addEventListener("click", close);

    actions.appendChild(ok);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(actions);
    root.appendChild(panel);
    root.addEventListener("click", function (e) {
      if (e.target === root) close();
    });
    window.addEventListener(
      "keydown",
      function onKey(e) {
        if (e.key === "Escape") {
          window.removeEventListener("keydown", onKey);
          close();
        }
      },
      { once: true }
    );
    document.body.appendChild(root);
  }

  async function zipBlob(filenameInZip, textPayload) {
    if (typeof JSZip === "undefined") throw new Error("ZIP 라이브러리를 불러오지 못했습니다.");
    var zip = new JSZip();
    zip.file(filenameInZip, textPayload);
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  async function unzipToText(file) {
    if (typeof JSZip === "undefined") throw new Error("ZIP 라이브러리를 불러오지 못했습니다.");
    var buf = await file.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var names = Object.keys(zip.files || {});
    if (!names.length) throw new Error("ZIP 내부 파일을 찾지 못했습니다.");
    // 우선순위: manifest → payload
    var preferred = null;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (n.toLowerCase().indexOf("payload") >= 0) {
        preferred = n;
        break;
      }
    }
    if (!preferred) preferred = names[0];
    var entry = zip.file(preferred);
    if (!entry) throw new Error("ZIP 내부 파일을 읽지 못했습니다.");
    return await entry.async("text");
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBuf(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function btnEnc() {
    var pw = String(document.getElementById("bk-pass").value || "");
    if (pw.length < 4) throw new Error("비밀번호를 4자 이상 입력해 주세요.");
    if (!window.crypto || !crypto.subtle) throw new Error("이 브라우저에서는 Web Crypto를 사용할 수 없습니다.");
    var enc = new TextEncoder();
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pw), { name: "PBKDF2" }, false, [
      "deriveBits",
      "deriveKey",
    ]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    var plain = enc.encode(JSON.stringify(snapshot()));
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plain);
    var pack = {
      v: 1,
      salt: bufToB64(salt.buffer),
      iv: bufToB64(iv.buffer),
      data: bufToB64(ct),
    };
    var payload = JSON.stringify(pack);
    var z = await zipBlob("payload.mcsec", payload);
    downloadBlob("MoneyCalendar_Backup_" + yyyymmdd() + ".zip", z);
    showDownloadGuideModal();
  }

  async function restoreFromFile(file) {
    var text = "";
    if (String(file.name || "").toLowerCase().endsWith(".zip")) {
      text = await unzipToText(file);
    } else {
      throw new Error("보안 백업 파일(.zip)만 복원할 수 있습니다.");
    }
    var pw = String(document.getElementById("bk-pass-in").value || "");
    if (pw.length < 4) throw new Error("복원 비밀번호를 입력해 주세요.");
    var pack = JSON.parse(text);
    if (!pack || pack.v !== 1) throw new Error("암호화 파일 형식이 올바르지 않습니다.");
    var enc = new TextEncoder();
    var salt = new Uint8Array(b64ToBuf(pack.salt));
    var iv = new Uint8Array(b64ToBuf(pack.iv));
    var ct = b64ToBuf(pack.data);
    var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pw), { name: "PBKDF2" }, false, [
      "deriveBits",
      "deriveKey",
    ]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    var plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    var json = new TextDecoder().decode(plainBuf);
    var o2 = JSON.parse(json);
    if (!confirm("복호화된 데이터로 localStorage를 덮어씁니다. 계속할까요?")) return;
    Object.keys(o2).forEach(function (k) {
      localStorage.setItem(k, String(o2[k]));
    });
    alert("암호화 백업 복원이 완료되었습니다.");
    location.reload();
  }

  function exportReadme() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["항목", "값"],
        ["백업 JSON", "평문 JSON 버튼 사용"],
        ["암호화", "AES-GCM + PBKDF2"],
      ]),
      "BackupReadme"
    );
    XLSX.writeFile(wb, ExcelManager.makeFilename("BackupReadme"));
  }

  function wirePassToggle(inputId, btnId) {
    var inp = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (!inp || !btn) return;
    btn.addEventListener("click", function () {
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "비밀번호 숨기기" : "비밀번호 표시");
    });
  }

  function init() {
    wirePassToggle("bk-pass", "bk-pass-toggle");
    wirePassToggle("bk-pass-in", "bk-pass-in-toggle");
    var fileIn = document.getElementById("bk-file");
    var fileTrig = document.getElementById("bk-file-trigger");
    var fileName = document.getElementById("bk-file-name");
    if (fileIn && fileTrig && fileName) {
      fileTrig.addEventListener("click", function () {
        fileIn.click();
      });
      fileIn.addEventListener("change", function () {
        var f = fileIn.files && fileIn.files[0];
        fileName.textContent = f && f.name ? f.name : "선택된 파일 없음";
      });
    }
    document.getElementById("btn-enc").addEventListener("click", function () {
      btnEnc().catch(function (e) {
        alert(String(e && e.message ? e.message : e));
      });
    });
    document.getElementById("btn-restore").addEventListener("click", function () {
      var f = document.getElementById("bk-file").files && document.getElementById("bk-file").files[0];
      if (!f) {
        alert("파일을 선택해 주세요.");
        return;
      }
      restoreFromFile(f).catch(function (e) {
        alert(String(e && e.message ? e.message : e));
      });
    });
    if (typeof ExcelManager !== "undefined") {
      ExcelManager.mount("excel-control-root", "ShellTooling", {
        applyData: function () {},
        onExportCurrent: exportReadme,
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
