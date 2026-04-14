/**
 * Money Calendar - Theme provider (static site)
 * - default: system preference
 * - user override: localStorage("mc-theme") = "light" | "dark" | "system"
 * - applies: <html data-theme="light|dark">
 */

(function () {
  "use strict";

  var KEY = "mc-theme";

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function getStored() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
      return "system";
    } catch {
      return "system";
    }
  }

  function setStored(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  }

  function apply(themeMode) {
    var mode = themeMode === "system" ? getSystemTheme() : themeMode;
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    window.dispatchEvent(new CustomEvent("mc-theme-change", { detail: { mode: mode, pref: themeMode } }));
  }

  function toggle() {
    var curPref = getStored();
    var curMode = document.documentElement.getAttribute("data-theme") || getSystemTheme();

    // If user hasn't chosen yet, toggling should explicitly set opposite of current mode.
    var next = curMode === "dark" ? "light" : "dark";
    setStored(next);
    apply(next);
    return next;
  }

  function init() {
    var pref = getStored();
    apply(pref);

    // keep in sync with system when pref=system
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (getStored() === "system") apply("system");
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    // Wire all toggles
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("[data-theme-toggle]");
      if (!btn) return;
      var next = toggle();
      if (btn && btn.setAttribute) {
        btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
      }
    });

    // Set initial pressed state on any toggle button
    window.setTimeout(function () {
      var mode = document.documentElement.getAttribute("data-theme") || getSystemTheme();
      document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      });
    }, 0);
  }

  init();

  window.MCTheme = {
    get: function () {
      return document.documentElement.getAttribute("data-theme") || getSystemTheme();
    },
    getPref: getStored,
    setPref: function (pref) {
      setStored(pref);
      apply(pref);
    },
    toggle: toggle,
  };
})();

