/**
 * Global header / drawer — 1~15 기능 내비, 현재 페이지 강조
 * 각 HTML에서 window.__MC_ASSETS_BASE 를 설정하세요 (예: ".." 또는 ".")
 */
(function () {
  "use strict";

  function injectBrandMark() {
    // SVG는 흰색 라인만 사용하고, 배경 그라데이션은 CSS에서 통일한다.
    var svg =
      '<svg viewBox="0 0 44 44" role="img" aria-label="Money Calendar" xmlns="http://www.w3.org/2000/svg">' +
      '  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">' +
      '    <rect x="12.5" y="12.5" width="19" height="19" rx="5.5" stroke-width="2.6"/>' +
      '    <path d="M12.5 18.6h19" stroke-width="2.6"/>' +
      '    <path d="M18.9 12.5v19" stroke-width="2.2" opacity=".9"/>' +
      '    <path d="M25.1 12.5v19" stroke-width="2.2" opacity=".9"/>' +
      "  </g>" +
      '  <circle cx="31.2" cy="31.2" r="6.2" fill="rgba(255,255,255,.18)"/>' +
      '  <path d="M31.2 28.6v5.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' +
      "</svg>";

    var marks = document.querySelectorAll(".mc-brand__mark, .brand__mark");
    for (var i = 0; i < marks.length; i++) {
      var el = marks[i];
      if (el && el.getAttribute && el.getAttribute("data-mc-logo") === "1") continue;
      if (el) {
        el.innerHTML = svg;
        el.setAttribute("data-mc-logo", "1");
      }
    }
  }

  function assetBase() {
    var b = window.__MC_ASSETS_BASE;
    if (b == null || b === "") return ".";
    return String(b).replace(/\/+$/, "");
  }

  function joinBase(rel) {
    var base = assetBase();
    if (base === ".") return "./" + rel.replace(/^\.\//, "");
    return base + "/" + rel.replace(/^\.\//, "");
  }

  function parsePathAndQuery(full) {
    var q = full.indexOf("?");
    if (q < 0) return { path: full, search: "" };
    return { path: full.slice(0, q), search: full.slice(q) };
  }

  function navHref(item) {
    var pq = parsePathAndQuery(item.path);
    return joinBase(pq.path) + pq.search;
  }

  function currentFeatureId() {
    var body = document.body;
    if (body && body.dataset && body.dataset.mcFeatureId) {
      var n = parseInt(body.dataset.mcFeatureId, 10);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function pathMatches(locPath, itemPathOnly) {
    var norm = locPath.replace(/\\/g, "/").toLowerCase();
    var target = itemPathOnly.replace(/\\/g, "/").toLowerCase();
    return norm.indexOf(target) >= 0;
  }

  function inferFeatureId() {
    var id = currentFeatureId();
    if (id > 0) return id;
    var nav = window.MONEY_CALENDAR_NAV;
    if (!nav || !nav.length) return 0;
    var loc = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    var have = new URLSearchParams(window.location.search || "");

    if (pathMatches(loc, "daily/index.html")) return 5;

    for (var i = 0; i < nav.length; i++) {
      var item = nav[i];
      var pq = parsePathAndQuery(item.path);
      var pLow = pq.path.replace(/\\/g, "/").toLowerCase();
      if (!pathMatches(loc, pLow)) continue;
      if (pq.search) {
        var want = new URLSearchParams(pq.search.replace(/^\?/, ""));
        var match = true;
        want.forEach(function (v, k) {
          if (String(have.get(k) || "") !== String(v)) match = false;
        });
        if (match) return item.id;
      } else {
        if (!have.toString()) return item.id;
      }
    }

    for (var j = 0; j < nav.length; j++) {
      var pq2 = parsePathAndQuery(nav[j].path);
      if (pq2.search) continue;
      if (pathMatches(loc, pq2.path)) return nav[j].id;
    }
    return 0;
  }

  function buildDrawerList(activeId) {
    var nav = window.MONEY_CALENDAR_NAV;
    var host = document.getElementById("mc-drawer-list");
    if (!nav || !nav.length || !host) return;

    host.textContent = "";
    function section(title, fromId, toId) {
      var wrap = document.createElement("div");
      wrap.className = "mc-drawer__section";

      var h = document.createElement("div");
      h.className = "mc-drawer__section-title";
      h.textContent = title;
      wrap.appendChild(h);

      var list = document.createElement("div");
      list.className = "mc-drawer__section-list";

      nav
        .filter(function (x) {
          return x.id >= fromId && x.id <= toId;
        })
        .forEach(function (item) {
      var a = document.createElement("a");
      a.className = "drawer__item mc-drawer__item";
          a.href = navHref(item);
          var isActive = item.id === activeId;
          if (isActive) {
            a.classList.add("is-active");
            a.setAttribute("aria-current", "page");
          }

      // 번호 + 기능명 (15단계 메커니즘 강조)
      var num = document.createElement("span");
      num.className = "mc-drawer__num";
      num.textContent = String(item.id);
      var t = document.createElement("span");
      t.className = "mc-drawer__title";
      t.textContent = item.title;
      a.appendChild(num);
      a.appendChild(t);
          list.appendChild(a);
        });

      wrap.appendChild(list);
      host.appendChild(wrap);
    }

    section("예산 및 수입 설계", 1, 4);
    section("실시간 기록 및 평가", 5, 8);
    section("결산 및 분석", 9, 12);
    section("데이터 연동 및 관리", 13, 15);
  }

  function wireDrawer() {
    var drawer = document.getElementById("drawer");
    var openBtn = document.getElementById("drawer-open");
    if (!drawer || !openBtn) return;

    var lastFocus = null;

    function setExpanded(v) {
      openBtn.setAttribute("aria-expanded", v ? "true" : "false");
      openBtn.setAttribute("aria-label", v ? "메뉴 닫기" : "메뉴 열기");
    }

    function openDrawer() {
      if (!drawer.hidden) return;
      lastFocus = document.activeElement;
      drawer.hidden = false;
      drawer.classList.add("is-open");
      document.documentElement.classList.add("is-drawer-open");
      document.body.classList.add("is-drawer-open");
      setExpanded(true);
      var focusTarget = drawer.querySelector(".drawer__close");
      if (focusTarget) focusTarget.focus();
    }

    function closeDrawer() {
      if (drawer.hidden) return;
      drawer.classList.remove("is-open");
      document.documentElement.classList.remove("is-drawer-open");
      document.body.classList.remove("is-drawer-open");
      setExpanded(false);
      window.setTimeout(function () {
        drawer.hidden = true;
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
        lastFocus = null;
      }, 240);
    }

    openBtn.addEventListener("click", function () {
      if (drawer.hidden) openDrawer();
      else closeDrawer();
    });

    drawer.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest("[data-drawer-close]")) closeDrawer();
    });

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  function init() {
    injectBrandMark();
    buildDrawerList(inferFeatureId());
    wireDrawer();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
