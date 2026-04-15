/**
 * Money Calendar 기능 15 — 공개형 공유 페이지 (로컬 목업 게시판)
 */
(function () {
  "use strict";

  var KEY = "moneyCalendar.publicBoard.v1";

  function load() {
    try {
      var r = localStorage.getItem(KEY);
      if (!r) return [];
      var a = JSON.parse(r);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }

  function save(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 200)));
  }

  function render() {
    var ul = document.getElementById("co-list");
    ul.textContent = "";
    load()
      .slice()
      .reverse()
      .forEach(function (p) {
        var li = document.createElement("li");
        li.className = "co-post";
        var meta = document.createElement("p");
        meta.className = "co-post__meta";
        meta.textContent = (p.at || "") + " · " + p.nick;
        var body = document.createElement("p");
        body.className = "mt-10 text-body";
        body.textContent = p.body || "";
        li.appendChild(meta);
        li.appendChild(body);
        ul.appendChild(li);
      });
  }

  function init() {
    document.getElementById("co-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nick = String(document.getElementById("co-nick").value || "").trim();
      var body = String(document.getElementById("co-body").value || "").trim();
      if (!nick || !body) return;
      var arr = load();
      arr.push({
        id: Date.now().toString(36),
        nick: nick.slice(0, 24),
        body: body.slice(0, 800),
        at: new Date().toISOString(),
      });
      save(arr);
      /** @type {HTMLFormElement} */ (e.target).reset();
      render();
    });
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
