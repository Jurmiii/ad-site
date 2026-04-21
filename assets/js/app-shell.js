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
    // 튜토리얼은 "데모였던 흔적"으로 남겨도 되지만, 신규 경험을 위해 함께 초기화.
    localStorage.removeItem(DEMO_TUTORIAL_DONE_KEY);
    showNotice("데모 데이터가 해제되고, 현재 월의 실제 기록으로 전환되었습니다.");
  }

  function hasRealUserData() {
    // 데모/설정성 키를 제외하고, 실제 데이터성 키가 있으면 "사용자 데이터 있음"으로 판단
    var ignorePrefix = ["moneyCalendar.navFavorites.", "moneyCalendar.demo"];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf("moneyCalendar.") !== 0) continue;
      var ignored = false;
      for (var j = 0; j < ignorePrefix.length; j++) {
        if (k.indexOf(ignorePrefix[j]) === 0) ignored = true;
      }
      if (ignored) continue;
      // theme 등 UI 설정은 데이터로 보지 않음
      if (k === "moneyCalendar.theme") continue;
      return true;
    }
    return false;
  }

  function monthKeyOf(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    return y + "-" + m;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function makeDemoDataIfNeeded() {
    if (hasRealUserData()) return;
    if (isDemoActive()) return;

    var now = new Date();
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    var prevMk = monthKeyOf(prev);
    var keys = [];

    function put(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
      keys.push(key);
    }

    // 1. 계층형 수입 설계(직전 월 기준 고액 예시)
    put("moneyCalendar.incomeDesign.v1", {
      real: 5000000,
      scheduled: 0,
      other: 0,
      hope: 0,
    });

    // 4. Weekly 예산안(직전 월) — 예: 3월 수입 500만, 저축(잔여) 200만
    put("moneyCalendar.budgetSetup.v1." + prevMk, {
      real: 5000000,
      scheduled: 0,
      other: 0,
      hope: 0,
      living: 1500000,
      activity: 800000,
      essential: 700000,
      locked: false,
      lockedAt: null,
    });

    // 4. 예산 시뮬레이터(직전 월) — 총예산 기준을 제공
    put("moneyCalendar.budgetSimulator.v1." + prevMk, {
      total: 3000000,
      living: 50,
      activity: 27,
      essential: 23,
      at: new Date(prev.getFullYear(), prev.getMonth(), 3).toISOString(),
    });

    // 2. 비전 기반 예산(저축 목표 예시)
    put("moneyCalendar.visionBudget.v1", {
      totalIncome: 5000000,
      fixedExpense: 1200000,
      visions: [
        {
          id: "v1",
          title: "비상금 2,000만 원",
          horizon: "short",
          targetAmount: 20000000,
          currentProgress: 5200000,
          monthlyAllocation: 800000,
          order: 0,
        },
        {
          id: "v2",
          title: "연말 여행 적금",
          horizon: "short",
          targetAmount: 3000000,
          currentProgress: 1200000,
          monthlyAllocation: 300000,
          order: 1,
        },
        {
          id: "v3",
          title: "투자/자기계발 시드",
          horizon: "long",
          targetAmount: 50000000,
          currentProgress: 9800000,
          monthlyAllocation: 600000,
          order: 2,
        },
      ],
    });

    // 5~8. Daily Ledger(직전 월 일부 날짜)
    var dailyKey = "moneyCalendar.dailyLedger.v1";
    var ledger = {};
    function addDay(day, startBalance, txs, note) {
      var ds = prevMk + "-" + pad2(day);
      ledger[ds] = {
        date: ds,
        startBalance: startBalance,
        txs: txs,
        dayRating: "",
        dayNote: note || "",
        notes: [],
      };
    }
    addDay(
      2,
      3200000,
      [
        { id: "d1", type: "expense", category: "식비", memo: "외식", amount: 68000 },
        { id: "d2", type: "expense", category: "교통", memo: "택시", amount: 22000 },
      ],
      "지출이 커도 '기준'이 있으면 흔들리지 않는다"
    );
    addDay(4, 3110000, [{ id: "d3", type: "expense", category: "생활", memo: "장보기", amount: 146000 }], "");
    addDay(7, 2964000, [
      { id: "d4", type: "expense", category: "카페", memo: "미팅", amount: 18000 },
      { id: "d5", type: "income", category: "기타", memo: "부수입", amount: 120000 },
    ]);
    addDay(12, 3086000, [{ id: "d6", type: "expense", category: "활동", memo: "공연", amount: 98000 }], "");
    addDay(18, 2988000, [{ id: "d7", type: "expense", category: "필수", memo: "보험", amount: 210000 }], "");
    addDay(24, 2778000, [{ id: "d8", type: "expense", category: "식비", memo: "가족모임", amount: 185000 }], "");
    addDay(28, 2593000, [{ id: "d9", type: "expense", category: "저축", memo: "자동이체", amount: 500000 }], "저축은 '지출'이 아니라 '확정'이다");
    try {
      var rawExisting = localStorage.getItem(dailyKey);
      if (rawExisting) return; // 혹시 다른 탭/초기 상태가 있으면 덮어쓰지 않음
    } catch (e) {}
    put(dailyKey, ledger);

    localStorage.setItem(DEMO_ACTIVE_KEY, "1");
    localStorage.setItem(DEMO_KEYS_KEY, JSON.stringify(keys));

    showNotice("신규 온보딩 데모: 직전 달에 예시 데이터가 준비되었습니다.");
  }

  function maybeShowDemoTutorialPrompt() {
    if (!isDemoActive()) return;
    if (String(localStorage.getItem(DEMO_TUTORIAL_DONE_KEY) || "") === "1") return;
    try {
      if (sessionStorage.getItem("mc.demoPrompted") === "1") return;
      sessionStorage.setItem("mc.demoPrompted", "1");
    } catch (e) {}

    var ex = document.getElementById("mc-demo-tutorial");
    if (ex) return;

    var box = document.createElement("div");
    box.id = "mc-demo-tutorial";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.style.position = "fixed";
    box.style.inset = "0";
    box.style.zIndex = "1250";
    box.style.display = "grid";
    box.style.placeItems = "center";
    box.style.background = "rgba(15,23,42,0.42)";

    var panel = document.createElement("div");
    panel.style.width = "min(560px, calc(100vw - 32px))";
    panel.style.borderRadius = "20px";
    panel.style.border = "1px solid rgba(148,163,184,0.35)";
    panel.style.background = "color-mix(in srgb, var(--color-surface) 92%, transparent)";
    panel.style.backdropFilter = "blur(16px)";
    panel.style.boxShadow = "0 28px 90px rgba(0,0,0,0.35)";
    panel.style.padding = "18px 18px";
    panel.style.color = "var(--color-text-primary)";

    var title = document.createElement("div");
    title.style.fontWeight = "900";
    title.style.fontSize = "1rem";
    title.textContent = "튜토리얼 · 데모 데이터를 엑셀로 내려받기";

    var desc = document.createElement("p");
    desc.style.margin = "10px 0 0";
    desc.style.color = "var(--color-text-secondary)";
    desc.style.lineHeight = "1.6";
    desc.textContent =
      "신규 사용자에게 직전 달(데모) 데이터가 준비되었습니다. 13번 화면에서 「1~15 전 기능 통합 엑셀 추출」을 눌러 전체 파일을 한 번 내려받아 보세요.";

    var actions = document.createElement("div");
    actions.style.marginTop = "14px";
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.justifyContent = "flex-end";
    actions.style.flexWrap = "wrap";

    var go = document.createElement("button");
    go.type = "button";
    go.textContent = "13번으로 이동";
    go.style.borderRadius = "14px";
    go.style.border = "1px solid rgba(34,197,94,0.45)";
    go.style.background = "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))";
    go.style.color = "var(--color-text-primary)";
    go.style.fontWeight = "850";
    go.style.minHeight = "44px";
    go.style.padding = "0 14px";
    go.addEventListener("click", function () {
      window.location.href = joinBase("demo-guide.html");
    });

    var later = document.createElement("button");
    later.type = "button";
    later.textContent = "나중에";
    later.style.borderRadius = "14px";
    later.style.border = "1px solid var(--border-default)";
    later.style.background = "var(--color-surface)";
    later.style.color = "var(--color-text-primary)";
    later.style.fontWeight = "800";
    later.style.minHeight = "44px";
    later.style.padding = "0 14px";
    later.addEventListener("click", function () {
      try {
        box.remove();
      } catch (e) {}
    });

    actions.appendChild(later);
    actions.appendChild(go);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(actions);
    box.appendChild(panel);
    box.addEventListener("click", function (e) {
      if (e.target === box) later.click();
    });
    document.body.appendChild(box);
  }

  function maybeMarkTutorialDone() {
    // 13번 화면 방문을 튜토리얼 완료로 간주
    try {
      var id = inferFeatureId();
      if (id === 13 && isDemoActive() && String(localStorage.getItem(DEMO_TUTORIAL_DONE_KEY) || "") !== "1") {
        localStorage.setItem(DEMO_TUTORIAL_DONE_KEY, "1");
        showNotice("튜토리얼: 상단의 「1~15 전 기능 통합 엑셀 추출」을 눌러 데모를 내려받아 보세요.");
      }
    } catch (e) {}
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
  }

  function injectFavoriteBar() {
    if (document.getElementById("mc-fav-bar")) {
      renderFavoriteBar();
      return;
    }
    var headerInner = document.querySelector(".site-header__inner, .mc-global-header__inner");
    if (!headerInner) return;
    var brand = headerInner.querySelector(".brand, .mc-brand");
    if (!brand) return;
    var nav = document.createElement("nav");
    nav.id = "mc-fav-bar";
    nav.className = "mc-fav-bar";
    nav.setAttribute("aria-label", "즐겨찾기 바로가기");
    brand.insertAdjacentElement("afterend", nav);
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

    var exportHref = joinBase("backup-security/index.html");

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

  function injectDemoInlineGuide() {
    if (!isDemoActive()) return;
    if (document.querySelector('[data-mc-demo-guide="1"]')) return;
    var id = inferFeatureId();
    if (!id || id < 1 || id > 15) return;

    var exportHref = joinBase("backup-security/index.html");
    var el = document.createElement("aside");
    el.className = "mc-security-tip";
    el.setAttribute("data-mc-demo-guide", "1");
    el.setAttribute("role", "note");
    el.innerHTML =
      '<p class="mc-security-tip__text">' +
      '<span class="mc-security-tip__icon" aria-hidden="true">🧪</span>' +
      '<strong class="mc-security-tip__label">데모 안내:</strong> ' +
      "지금 보시는 데이터는 예시입니다. 상단의 엑셀 다운로드 버튼을 눌러 정교한 재정 템플릿을 확인해 보세요! " +
      '<a class="mc-security-tip__link" href="' +
      exportHref +
      '">13. 내보내기 · 복원</a>' +
      "</p>";

    var intro = document.querySelector("main .mc-page-intro");
    if (intro) intro.insertAdjacentElement("afterend", el);
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
    injectDemoInlineGuide();
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
    makeDemoDataIfNeeded();
    maybeShowDemoTutorialPrompt();
    maybeMarkTutorialDone();
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
