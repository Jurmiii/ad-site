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

  function btnJson() {
    var s = JSON.stringify(snapshot(), null, 2);
    downloadBlob("MoneyCalendar_backup_" + ExcelManager.utils.yyyymmdd() + ".json", new Blob([s], { type: "application/json" }));
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
    var out = new Blob([JSON.stringify(pack)], { type: "application/octet-stream" });
    downloadBlob("MoneyCalendar_encrypted_" + ExcelManager.utils.yyyymmdd() + ".mcb", out);
  }

  async function restoreFromFile(file) {
    var text = await file.text();
    if (file.name.endsWith(".json") || text.trim().startsWith("{")) {
      var o = JSON.parse(text);
      if (!o || typeof o !== "object") throw new Error("JSON 형식이 올바르지 않습니다.");
      if (!confirm("localStorage를 이 파일 내용으로 덮어씁니다. 계속할까요?")) return;
      Object.keys(o).forEach(function (k) {
        localStorage.setItem(k, String(o[k]));
      });
      alert("복원이 완료되었습니다.");
      location.reload();
      return;
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

  function init() {
    document.getElementById("btn-json").addEventListener("click", function () {
      try {
        btnJson();
      } catch (e) {
        alert(String(e && e.message ? e.message : e));
      }
    });
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
