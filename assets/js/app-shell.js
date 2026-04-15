/**
 * Global header / drawer — 1~15 기능 내비, 현재 페이지 강조
 * 각 HTML에서 window.__MC_ASSETS_BASE 를 설정하세요 (예: ".." 또는 ".")
 */
(function () {
  "use strict";

  function injectBrandMark() {
    // 캘린더 심볼: 겹치는 선(교차 스트로크)을 만들지 않는 미니멀 기하 형태.
    // 배경 그라데이션은 CSS(컨테이너)에서 통일하고, SVG는 단색(white)만 사용한다.
    var svg =
      '<svg viewBox="0 0 44 44" role="img" aria-label="Money Calendar" xmlns="http://www.w3.org/2000/svg">' +
      '  <rect x="10.5" y="12" width="23" height="22" rx="6.5" fill="none" stroke="#fff" stroke-width="2.6"/>' +
      '  <path d="M10.5 18.8H33.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' +
      '  <rect x="14" y="10" width="4.4" height="6.4" rx="2.2" fill="#fff" opacity=".95"/>' +
      '  <rect x="25.6" y="10" width="4.4" height="6.4" rx="2.2" fill="#fff" opacity=".95"/>' +
      '  <g fill="#fff" opacity=".92">' +
      '    <rect x="15.2" y="22.4" width="3.6" height="3.6" rx="1.2"/>' +
      '    <rect x="20.2" y="22.4" width="3.6" height="3.6" rx="1.2"/>' +
      '    <rect x="25.2" y="22.4" width="3.6" height="3.6" rx="1.2"/>' +
      '    <rect x="15.2" y="27.4" width="3.6" height="3.6" rx="1.2"/>' +
      '    <rect x="20.2" y="27.4" width="3.6" height="3.6" rx="1.2"/>' +
      '    <rect x="25.2" y="27.4" width="3.6" height="3.6" rx="1.2"/>' +
      "  </g>" +
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

  function normalizeBrandText() {
    // 홈(.brand__text)과 기능(.mc-brand__titles)을 동일 텍스트 구성으로 맞춘다.
    var titles = document.querySelectorAll(".mc-brand__titles");
    for (var i = 0; i < titles.length; i++) {
      var el = titles[i];
      if (!el || (el.getAttribute && el.getAttribute("data-mc-brand") === "1")) continue;
      el.classList.add("brand__text");
      el.innerHTML =
        '<span class="brand__name">Money Calendar</span>' +
        '<span class="brand__tag">머니 캘린더</span>';
      el.setAttribute("data-mc-brand", "1");
    }
  }

  function normalizeDrawerTitle() {
    // 서비스 전체에서 동일한 드로어 타이틀(카테고리 메뉴) 표기 유지
    var els = document.querySelectorAll(".drawer__title");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || (el.getAttribute && el.getAttribute("data-mc-drawer-title") === "1")) continue;
      el.textContent = "가계부 시리즈";
      el.setAttribute("data-mc-drawer-title", "1");
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

  function injectFeatureGuide() {
    // 기능 페이지 본문 상단의 '초록색 중복 제목'(.mc-page-intro__kicker)만 교체한다.
    var guideById = {
      1: "나의 소득을 4단계로 분류하여 자산의 성격을 명확히 파악합니다.",
      2: "미래의 꿈과 현재의 지출을 연결하여 우선순위 예산을 수립합니다.",
      3: "확정된 계획은 기록으로 남겨 목표 달성을 위한 엄격함을 유지합니다.",
      4: "지출 비중을 시각적으로 조정하여 가장 건강한 예산 비율을 찾습니다.",
      5: "이동 중에도 지연 없이, 즉시 지출을 기록하고 남은 예산을 확인합니다.",
      6: "오늘의 소비를 스스로 평가하며 재정 습관을 돌아보는 시간을 갖습니다.",
      7: "작은 지출이 내 예산에서 차지하는 무게를 퍼센트(%)로 체감합니다.",
      8: "지출이 없는 날의 성취를 기록하고 캘린더를 보람으로 채웁니다.",
      9: "한 주간의 데이터를 분석하여 더 나은 다음 주를 위한 전략을 제안합니다.",
      10: "계획과 실제 집행 내역을 대조하여 재정 운영의 오차를 확인합니다.",
      11: "시간의 흐름에 따라 변화하는 나의 소비 성향을 그래프로 추적합니다.",
      12: "데이터 속에 숨겨진 지출 패턴을 찾아 똑똑한 조언을 제공합니다.",
      13: "머니 캘린더의 모든 데이터를 시트별로 정리된 단 하나의 파일로 소장합니다.",
      14: "매우 중요한 개인 재정 정보를 안전하게 보호하고 파일로 백업합니다.",
      15: "익명으로 재정 습관을 공유하며 건강한 소비 문화를 함께 만듭니다.",
    };

    var id = inferFeatureId();
    if (!id || !guideById[id]) return;

    var els = document.querySelectorAll(".mc-page-intro__kicker");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || (el.getAttribute && el.getAttribute("data-mc-guide") === "1")) continue;
      el.textContent = guideById[id];
      el.setAttribute("data-mc-guide", "1");
    }
  }

  function init() {
    injectBrandMark();
    normalizeBrandText();
    normalizeDrawerTitle();
    injectFeatureGuide();
    buildDrawerList(inferFeatureId());
    wireDrawer();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
