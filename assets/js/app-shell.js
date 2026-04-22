/**
 * Global header / drawer — 1~15 기능 내비, 현재 페이지 강조
 * 각 HTML에서 window.__MC_ASSETS_BASE 를 설정하세요 (예: ".." 또는 ".")
 */
(function () {
  "use strict";

  function injectBrandMark() {
    // 로고는 프로젝트에 포함된 단일 파일(mc-logo.svg)을 사용한다.
    // 각 HTML에서 window.__MC_ASSETS_BASE 를 "." 또는 ".." 로 설정하므로,
    // 여기서는 그 값을 이용해 상대 경로를 안전하게 생성한다.
    var base = (window && window.__MC_ASSETS_BASE) || ".";
    var src = String(base).replace(/\/$/, "") + "/images/icon/mc-logo.svg";
    var imgHtml =
      '<img src="' +
      src +
      '" width="44" height="44" alt="" role="presentation" loading="eager" decoding="async" />';

    var marks = document.querySelectorAll(".mc-brand__mark, .brand__mark");
    for (var i = 0; i < marks.length; i++) {
      var el = marks[i];
      if (el && el.getAttribute && el.getAttribute("data-mc-logo") === "1") continue;
      if (el) {
        el.innerHTML = imgHtml;
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

  function normalizeHeaderBrandLayout() {
    // 홈(index.html)의 brand 레이아웃을 표준으로 삼아, 기능 페이지 헤더도 동일 클래스/구조로 정규화한다.
    var brands = document.querySelectorAll(".mc-brand");
    for (var i = 0; i < brands.length; i++) {
      var a = brands[i];
      if (!a || (a.getAttribute && a.getAttribute("data-mc-brand-layout") === "1")) continue;
      a.classList.add("brand");
      // mark
      var mark = a.querySelector(".mc-brand__mark");
      if (mark) mark.classList.add("brand__mark");
      // titles wrapper
      var titles = a.querySelector(".mc-brand__titles");
      if (titles) titles.classList.add("brand__text");
      a.setAttribute("data-mc-brand-layout", "1");
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

  function normalizeDrawerAria() {
    var drawer = document.getElementById("drawer");
    if (!drawer || (drawer.getAttribute && drawer.getAttribute("data-mc-drawer-aria") === "1")) return;
    drawer.setAttribute("aria-label", "가계부 시리즈 메뉴");
    drawer.setAttribute("data-mc-drawer-aria", "1");
  }

  var FAV_STORAGE_KEY = "moneyCalendar.navFavorites.v1";
  var MAX_FAVORITES = 5;
  var DEMO_ACTIVE_KEY = "moneyCalendar.demoActive.v1";
  var DEMO_KEYS_KEY = "moneyCalendar.demoKeys.v1";
  var DEMO_TUTORIAL_DONE_KEY = "moneyCalendar.demoTutorialDone.v1";
  var DRAWER_FAV_TIP_KEY = "moneyCalendar.drawerFavTipDismissed.v1";

  function showNotice(message) {
    try {
      var ex = document.getElementById("mc-notice");
      if (ex) ex.remove();
    } catch (e) {}

    var el = document.createElement("div");
    el.id = "mc-notice";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.position = "fixed";
    el.style.right = "16px";
    el.style.bottom = "16px";
    el.style.zIndex = "1200";
    el.style.maxWidth = "420px";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid rgba(148,163,184,0.35)";
    el.style.background = "color-mix(in srgb, var(--color-surface) 92%, transparent)";
    el.style.backdropFilter = "blur(14px)";
    el.style.boxShadow = "0 18px 60px rgba(0,0,0,0.22)";
    el.style.color = "var(--color-text-primary)";
    el.style.fontWeight = "750";
    el.style.lineHeight = "1.35";
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(function () {
      try {
        el.remove();
      } catch (e) {}
    }, 2400);
  }

  function isDemoActive() {
    return String(localStorage.getItem(DEMO_ACTIVE_KEY) || "") === "1";
  }

  function readDemoKeys() {
    try {
      var raw = localStorage.getItem(DEMO_KEYS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function purgeDemoData() {
    var keys = readDemoKeys();
    for (var i = 0; i < keys.length; i++) {
      try {
        localStorage.removeItem(keys[i]);
      } catch (e) {}
    }
    localStorage.removeItem(DEMO_KEYS_KEY);
    localStorage.removeItem(DEMO_ACTIVE_KEY);
    localStorage.removeItem(DEMO_TUTORIAL_DONE_KEY);
  }

  function getFavorites() {
    try {
      var raw = localStorage.getItem(FAV_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
        .map(function (x) {
          return parseInt(String(x), 10);
        })
        .filter(function (id) {
          return id >= 1 && id <= 15;
        });
    } catch (e) {
      return [];
    }
  }

  function setFavorites(ids) {
    var seen = {};
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (id < 1 || id > 15 || seen[id]) continue;
      seen[id] = true;
      out.push(id);
      if (out.length >= MAX_FAVORITES) break;
    }
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(out));
  }

  function isFavorite(id) {
    return getFavorites().indexOf(id) >= 0;
  }

  function toggleFavorite(id) {
    var favs = getFavorites().slice();
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1);
    else {
      if (favs.length >= MAX_FAVORITES) {
        showNotice("즐겨찾기는 최대 5개까지 가능합니다.");
        return;
      }
      favs.push(id);
    }
    setFavorites(favs);
    buildDrawerList(inferFeatureId());
    renderFavoriteBar();
  }

  function renderFavoriteBar() {
    var nav = document.getElementById("mc-fav-bar");
    if (!nav) return;
    nav.textContent = "";
    nav.classList.add("mc-fav-bar--grid");
    var favs = getFavorites();
    var list = window.MONEY_CALENDAR_NAV || [];
    for (var slot = 0; slot < MAX_FAVORITES; slot++) {
      var cell = document.createElement("div");
      cell.className = "mc-fav-bar__cell";
      if (slot < favs.length) {
        var fid = favs[slot];
        var item = null;
        for (var j = 0; j < list.length; j++) {
          if (list[j].id === fid) {
            item = list[j];
            break;
          }
        }
        if (item) {
          var a = document.createElement("a");
          a.className = "mc-fav-bar__link";
          a.href = navHref(item);
          var label = item.title || "";
          if (label.length > 11) label = label.slice(0, 11) + "…";
          a.textContent = label;
          a.title = item.title;
          cell.appendChild(a);
        }
      }
      nav.appendChild(cell);
    }

    var dd = document.getElementById("mc-fav-dropdown");
    if (!dd) return;
    dd.textContent = "";
    var summary = document.createElement("summary");
    summary.textContent = "즐겨찾기";
    var panel = document.createElement("div");
    panel.className = "mc-fav-dropdown__panel";
    if (!favs.length) {
      var empty = document.createElement("p");
      empty.className = "mc-fav-dropdown__empty";
      empty.textContent = "메뉴(☰)에서 ☆로 즐겨찾기를 추가하세요.";
      panel.appendChild(empty);
    } else {
      for (var fi = 0; fi < favs.length; fi++) {
        var favId = favs[fi];
        var favItem = null;
        for (var k = 0; k < list.length; k++) {
          if (list[k].id === favId) {
            favItem = list[k];
            break;
          }
        }
        if (favItem) {
          var link = document.createElement("a");
          link.className = "mc-fav-dropdown__link";
          link.href = navHref(favItem);
          link.textContent = favItem.title;
          panel.appendChild(link);
        }
      }
    }
    dd.appendChild(summary);
    dd.appendChild(panel);
  }

  function injectFavoriteBar() {
    var headerInner = document.querySelector(".site-header__inner, .mc-global-header__inner");
    if (!headerInner) return;
    var brand = headerInner.querySelector(".brand, .mc-brand");
    if (!brand) return;

    if (!document.getElementById("mc-fav-bar")) {
      var nav = document.createElement("nav");
      nav.id = "mc-fav-bar";
      nav.className = "mc-fav-bar";
      nav.setAttribute("aria-label", "즐겨찾기 바로가기");
      brand.insertAdjacentElement("afterend", nav);
    }
    if (!document.getElementById("mc-fav-dropdown")) {
      var details = document.createElement("details");
      details.id = "mc-fav-dropdown";
      details.className = "mc-fav-dropdown";
      details.setAttribute("aria-label", "즐겨찾기 바로가기");
      var navEl = document.getElementById("mc-fav-bar");
      if (navEl) navEl.insertAdjacentElement("afterend", details);
    }
    renderFavoriteBar();
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
          var row = document.createElement("div");
          row.className = "mc-drawer__row";

          var a = document.createElement("a");
          a.className = "drawer__item mc-drawer__item mc-drawer__item-link";
          a.href = navHref(item);
          var isActive = item.id === activeId;
          if (isActive) {
            row.classList.add("is-active");
            a.setAttribute("aria-current", "page");
          }

          var num = document.createElement("span");
          num.className = "mc-drawer__num";
          num.textContent = String(item.id);
          var t = document.createElement("span");
          t.className = "mc-drawer__title";
          t.textContent = item.title;
          a.appendChild(num);
          a.appendChild(t);

          var starBtn = document.createElement("button");
          starBtn.type = "button";
          starBtn.className = "mc-drawer__fav" + (isFavorite(item.id) ? " is-on" : "");
          starBtn.setAttribute("data-mc-fav-id", String(item.id));
          starBtn.setAttribute("aria-label", (isFavorite(item.id) ? "즐겨찾기 해제: " : "즐겨찾기 추가: ") + item.title);
          starBtn.setAttribute("aria-pressed", isFavorite(item.id) ? "true" : "false");
          starBtn.textContent = isFavorite(item.id) ? "★" : "☆";
          starBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(item.id);
          });

          row.appendChild(a);
          row.appendChild(starBtn);
          list.appendChild(row);
        });

      wrap.appendChild(list);
      host.appendChild(wrap);
    }

    // 카테고리(전역): 예산 / 기록 / 분석 / 관리
    section("예산", 1, 4);
    section("기록", 5, 8);
    section("분석", 9, 12);
    section("관리", 13, 15);
  }

  function tryShowDrawerFavTip() {
    try {
      if (String(localStorage.getItem(DRAWER_FAV_TIP_KEY) || "") === "1") return;
      var drawer = document.getElementById("drawer");
      if (!drawer) return;
      var panel = drawer.querySelector(".drawer__panel");
      if (!panel || panel.querySelector("[data-mc-drawer-fav-tip=\"1\"]")) return;

      var tip = document.createElement("div");
      tip.className = "mc-drawer-fav-tip";
      tip.setAttribute("data-mc-drawer-fav-tip", "1");
      tip.setAttribute("role", "status");

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "mc-drawer-fav-tip__close";
      closeBtn.setAttribute("aria-label", "말풍선 닫기");
      closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

      var p = document.createElement("p");
      p.className = "mc-drawer-fav-tip__text";
      p.textContent = "데일리 기능들을 즐겨찾기에 추가해 보세요! 더 빠르게 기록하고 관리할 수 있습니다.";

      closeBtn.addEventListener("click", function () {
        try {
          localStorage.setItem(DRAWER_FAV_TIP_KEY, "1");
        } catch (e) {}
        try {
          tip.remove();
        } catch (e2) {}
      });

      tip.appendChild(p);
      tip.appendChild(closeBtn);
      var topEl = panel.querySelector(".drawer__top");
      if (topEl) topEl.insertAdjacentElement("afterend", tip);
      else panel.insertBefore(tip, panel.firstChild);
    } catch (e) {}
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
      tryShowDrawerFavTip();
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

  function injectSecurityTip() {
    var id = inferFeatureId();
    if (!id || id < 1 || id > 15) return;
    if (document.querySelector('[data-mc-security-tip="1"]')) return;

    var exportHref = joinBase("backup-security/13_export_restore.html");

    var el = document.createElement("aside");
    el.className = "mc-security-tip";
    el.setAttribute("data-mc-security-tip", "1");
    el.setAttribute("role", "note");
    el.innerHTML =
      '<p class="mc-security-tip__text">' +
      '<span class="mc-security-tip__icon" aria-hidden="true">💡</span>' +
      '<strong class="mc-security-tip__label">보안 팁:</strong> ' +
      "공용 환경에서 이용하신 경우, 반드시 " +
      '<a class="mc-security-tip__link" href="' +
      exportHref +
      '">13. 내보내기 · 복원</a>을 통해 기록을 소장하신 후 ' +
      "브라우저의 '쿠키 및 사이트 데이터 삭제'를 진행하여 개인 재정 정보를 보호해 주세요." +
      "</p>";

    var root = document.getElementById("excel-control-root");
    if (root && root.parentNode) {
      root.insertAdjacentElement("afterend", el);
      return;
    }
    var intro = document.querySelector("main .mc-page-intro");
    if (intro && intro.parentNode) {
      intro.insertAdjacentElement("afterend", el);
    }
  }

  function injectScrollTopButton() {
    if (document.getElementById("mc-scroll-top")) return;
    var body = document.body;
    if (!body) return;

    var isTour = body.classList.contains("page-demo-tour");
    var isMcApp = body.classList.contains("mc-app");

    if (!isTour && !isMcApp) return;

    if (isMcApp) {
      var fid = inferFeatureId();
      if (fid === 12 || fid === 13) return;
    }

    var btn = document.createElement("button");
    btn.id = "mc-scroll-top";
    btn.type = "button";
    btn.className = "mc-scroll-top";
    btn.setAttribute("aria-label", "맨 위로");
    btn.setAttribute("data-mc-scroll-top", "1");
    if (isTour) btn.setAttribute("data-mc-scroll-top-tour", "1");
    btn.innerHTML =
      '<svg class="mc-scroll-top__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 19V5M5 12l7-7 7 7"/>' +
      "</svg>" +
      '<span class="mc-scroll-top__label">TOP</span>';
    document.body.appendChild(btn);

    function countMainSections() {
      var main = document.getElementById("main");
      if (!main) return 0;
      var ch = main.children;
      var n = 0;
      var i;
      for (i = 0; i < ch.length; i++) {
        if (ch[i].tagName === "SECTION") n += 1;
      }
      return n;
    }

    function shouldShow() {
      var docEl = document.documentElement;
      var vh = window.innerHeight || docEl.clientHeight || 0;
      if (vh <= 0) return false;
      var range = docEl.scrollHeight - vh;
      if (range <= 32) return false;
      if (isTour) return true;
      return countMainSections() > 2;
    }

    function sync() {
      btn.hidden = !shouldShow();
    }

    btn.addEventListener("click", function () {
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    });

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("load", sync);
    try {
      window.visualViewport &&
        window.visualViewport.addEventListener("resize", sync);
    } catch (e) {}
  }

  function injectFeatureGuide() {
    // 기능 페이지 본문 상단의 '초록색 중복 제목'(.mc-page-intro__kicker)만 교체한다.
    var guideById = {
      1: "네 겹의 수입은 비전의 뼈대이며, 마지막 한 자리까지가 완성도를 가릅니다.",
      2: "남은 재원은 가치 있는 배정으로 비전에 붙일 때 비로소 100%에 닿습니다.",
      3: "확정된 계획을 기록에 남겨 미완의 설계를 닫아 갑니다.",
      4: "슬라이더로 균형을 맞추며, 가장 건강한 예산 비율을 완성을 위한 선택으로 짓습니다.",
      5: "즉시 기록해 오늘의 한 건이 비전을 채우는 한 조각임을 남깁니다.",
      6: "오늘의 소비를 스스로 평가하며 다음 완성을 위한 선택을 정리합니다.",
      7: "비중을 보면 작은 한 건도 비전에 닿는 크기인지 가늠할 수 있습니다.",
      8: "예산 준수 스티커는 세운 틀 안에 머문 하루를, 퀵 입력은 그 틀을 벗어난 돌발 지출을 기록하게 합니다.",
      9: "주차 흐름은 가치 있는 배정이 실제로 어디에 붙었는지 보여 줍니다.",
      10: "계획과 실적의 차이는 다음 달에 비전을 얼마나 채울지 가리킵니다.",
      11: "시간 축은 습관이 비전을 얼마나 채우는지 드러냅니다.",
      12: "패턴을 읽는 것은 규율 강요가 아니라 완성을 위한 선택지를 보는 일입니다.",
      13: "통합 엑셀로 소장하고, 보안 비밀번호로 안전하게 보관하거나 덮어씌워 복원합니다.",
      14: "월 할당 비전으로 성장 곡선을 그리고, 목표에 닿을지를 시각적으로 가늠합니다.",
      15: "한 화면 요약은 지금 내 비전이 얼마나 채워졌는지 스스로 마주하는 진단대입니다.",
    };

    var id = inferFeatureId();
    if (!id || !guideById[id]) return;

    var els = document.querySelectorAll(".mc-page-intro__kicker");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || (el.getAttribute && el.getAttribute("data-mc-guide") === "1")) continue;
      el.textContent = guideById[id];
      el.setAttribute("data-mc-guide", "1");
      if (id === 1 || id === 4 || id === 8 || id === 10 || id === 14) {
        el.classList.add("mc-intro-single-line");
      }
    }
  }

  function init() {
    injectBrandMark();
    normalizeBrandText();
    normalizeHeaderBrandLayout();
    normalizeDrawerTitle();
    normalizeDrawerAria();
    injectFeatureGuide();
    injectSecurityTip();
    (function normalizeCalendarInputs() {
      var t = new Date();
      var today =
        t.getFullYear() +
        "-" +
        String(t.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(t.getDate()).padStart(2, "0");
      var thisMonth = today.slice(0, 7);

      document.querySelectorAll('input[type="date"]').forEach(function (el) {
        try {
          if (!el.value) el.value = today;
          el.max = today;
        } catch (e) {}
      });
      document.querySelectorAll('input[type="month"]').forEach(function (el) {
        try {
          if (!el.value) el.value = thisMonth;
          el.max = thisMonth;
        } catch (e) {}
      });
    })();
    injectFavoriteBar();
    injectScrollTopButton();
    buildDrawerList(inferFeatureId());
    wireDrawer();
    window.addEventListener("storage", function (e) {
      if (e.key === FAV_STORAGE_KEY) {
        buildDrawerList(inferFeatureId());
        renderFavoriteBar();
      }
      if (e.key === DEMO_ACTIVE_KEY && !isDemoActive()) {
        renderFavoriteBar();
      }
    });
  }

  // 다른 기능 스크립트에서 데모 전환을 트리거할 수 있도록 노출
  window.MoneyCalendarDemo = {
    isActive: isDemoActive,
    purge: purgeDemoData,
  };

  try {
    if (isDemoActive()) {
      purgeDemoData();
    }
  } catch (e) {}

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
