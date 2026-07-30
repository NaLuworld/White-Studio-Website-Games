(function (global) {
  "use strict";

  var STORAGE_THEME_KEY = "ws_games_theme_v1";
  var LEGACY_THEME_KEY = "theme-mode";

  function normalizeTheme(input) {
    return String(input || "").trim().toLowerCase() === "light" ? "light" : "dark";
  }

  function readStoredTheme() {
    try {
      var next = localStorage.getItem(STORAGE_THEME_KEY);
      if (next === "light" || next === "dark") return next;
      var legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === "light" || legacy === "dark") return legacy;
    } catch (_) {}
    return "dark";
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
      localStorage.setItem(LEGACY_THEME_KEY, theme);
    } catch (_) {}
  }

  function applyTheme(nextTheme, options) {
    var theme = normalizeTheme(nextTheme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (!options || options.persist !== false) persistTheme(theme);
    syncThemeButtons();
    return theme;
  }

  function t(key) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      return global.WhiteStudioI18n.t(key);
    }
    return key;
  }

  function syncThemeButtons() {
    var theme = normalizeTheme(document.documentElement.dataset.theme);
    var next = theme === "dark" ? "light" : "dark";
    var buttons = document.querySelectorAll("[data-ws-theme-btn]");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      button.dataset.theme = theme;
      button.setAttribute(
        "aria-label",
        t(next === "light" ? "theme.switch_to_light" : "theme.switch_to_dark")
      );
      button.title = button.getAttribute("aria-label");
      var label = button.querySelector(".ws-theme-label");
      if (label) label.textContent = t(theme === "light" ? "theme.light" : "theme.dark");
    }
  }

  function bindThemeButton(button) {
    if (!button) return;
    button.setAttribute("data-ws-theme-btn", "");
    if (!button.querySelector(".ws-theme-icon")) {
      button.innerHTML =
        '<span class="ws-theme-icon" aria-hidden="true"></span><span class="ws-theme-label"></span>';
    }
    button.addEventListener("click", function () {
      var current = normalizeTheme(document.documentElement.dataset.theme);
      applyTheme(current === "dark" ? "light" : "dark");
    });
    syncThemeButtons();
  }

  function mountThemeButton(host) {
    if (!host) return null;
    var existing = host.querySelector("[data-ws-theme-btn]");
    if (existing) {
      bindThemeButton(existing);
      return existing;
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ws-theme-btn";
    button.innerHTML =
      '<span class="ws-theme-icon" aria-hidden="true"></span><span class="ws-theme-label"></span>';
    host.appendChild(button);
    bindThemeButton(button);
    return button;
  }

  async function bootChrome(options) {
    options = options || {};
    applyTheme(readStoredTheme(), { persist: false });

    if (global.WhiteStudioI18n) {
      await global.WhiteStudioI18n.init();
    }

    var actions = document.querySelector("[data-ws-header-actions]");
    if (actions) {
      if (global.WhiteStudioGamesAuth) {
        global.WhiteStudioGamesAuth.mountAuth(actions);
      }
      if (global.WhiteStudioI18n) {
        var switcherHost = document.createElement("div");
        switcherHost.className = "ws-site-controls";
        switcherHost.setAttribute("data-i18n-skip", "true");
        actions.appendChild(switcherHost);
        global.WhiteStudioI18n.mountSwitcher(switcherHost);
        mountThemeButton(switcherHost);
      } else {
        var themeHost = document.createElement("div");
        themeHost.className = "ws-site-controls";
        actions.appendChild(themeHost);
        mountThemeButton(themeHost);
      }
    }

    if (global.WhiteStudioGamesAuth) {
      var authResult = global.WhiteStudioGamesAuth.captureAuthResultFromUrl();
      var message = global.WhiteStudioGamesAuth.authResultMessage(authResult);
      if (message) global.WhiteStudioGamesAuth.showAuthToast(message.text, message.tone);
      await global.WhiteStudioGamesAuth.refreshSession();
      if (options.nicknameInput) {
        global.WhiteStudioGamesAuth.prefillNickname(options.nicknameInput);
        global.WhiteStudioGamesAuth.onSessionChange(function () {
          global.WhiteStudioGamesAuth.prefillNickname(options.nicknameInput);
        });
      }
    }

    if (global.WhiteStudioI18n) {
      global.WhiteStudioI18n.onChange(function () {
        syncThemeButtons();
        if (global.WhiteStudioI18n.applyAll) global.WhiteStudioI18n.applyAll(document);
      });
    }

    return {
      theme: normalizeTheme(document.documentElement.dataset.theme),
      lang: global.WhiteStudioI18n ? global.WhiteStudioI18n.getLang() : "zh-Hant"
    };
  }

  // Back-compat for older pages that still call bindThemeToggle.
  function bindThemeToggle(button) {
    if (!button) return;
    button.classList.add("ws-theme-btn");
    bindThemeButton(button);
  }

  if (global.WhiteStudioGames) {
    global.WhiteStudioGames.bindThemeToggle = bindThemeToggle;
    global.WhiteStudioGames.bootChrome = bootChrome;
    global.WhiteStudioGames.applyTheme = applyTheme;
  } else {
    global.WhiteStudioGames = {
      bindThemeToggle: bindThemeToggle,
      bootChrome: bootChrome,
      applyTheme: applyTheme
    };
  }
})(window);
