(function (global) {
  "use strict";

  var menuOpen = false;
  var menuLastFocus = null;
  var drawerEls = null;

  function t(key, vars) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      return global.WhiteStudioI18n.t(key, vars);
    }
    return key;
  }

  function getFocusable(root) {
    if (!root) return [];
    return Array.prototype.slice.call(
      root.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
    });
  }

  function syncDrawerChoices() {
    if (!drawerEls) return;
    var lang =
      global.WhiteStudioI18n && typeof global.WhiteStudioI18n.getLang === "function"
        ? global.WhiteStudioI18n.getLang()
        : "zh-Hant";

    drawerEls.title.textContent = t("nav.menu_title");
    drawerEls.close.setAttribute("aria-label", t("nav.close_menu"));
    drawerEls.close.title = t("nav.close_menu");
    drawerEls.prefsTitle.textContent = t("nav.prefs_title");
    drawerEls.accountTitle.textContent = t("nav.account_title");
    drawerEls.langLabel.textContent = t("nav.language");

    var langButtons = drawerEls.scroll.querySelectorAll("[data-drawer-lang]");
    for (var i = 0; i < langButtons.length; i++) {
      var lb = langButtons[i];
      var code = lb.getAttribute("data-drawer-lang");
      var active = code === lang;
      lb.classList.toggle("is-active", active);
      lb.setAttribute("aria-checked", active ? "true" : "false");
      lb.textContent = t(code === "en" ? "lang.english" : "lang.traditional_chinese");
    }

    var session =
      global.WhiteStudioGamesAuth && typeof global.WhiteStudioGamesAuth.getSessionSnapshot === "function"
        ? global.WhiteStudioGamesAuth.getSessionSnapshot()
        : null;
    var loggedIn = Boolean(session && session.authenticated && session.user);
    var name =
      global.WhiteStudioGamesAuth && typeof global.WhiteStudioGamesAuth.displayName === "function"
        ? global.WhiteStudioGamesAuth.displayName(session)
        : "Discord";

    drawerEls.login.hidden = loggedIn;
    drawerEls.logout.hidden = !loggedIn;
    drawerEls.accountHint.hidden = loggedIn;
    drawerEls.login.textContent = t("auth.login");
    drawerEls.logout.textContent = t("auth.logout");
    if (loggedIn) {
      drawerEls.accountHint.hidden = false;
      drawerEls.accountHint.textContent = t("auth.logged_in_as", { name: name });
    } else {
      drawerEls.accountHint.hidden = false;
      drawerEls.accountHint.textContent = t("nav.account_guest");
    }

    if (drawerEls.toggle) {
      drawerEls.toggle.setAttribute("aria-label", t(menuOpen ? "nav.close_menu" : "nav.open_menu"));
      drawerEls.toggle.title = drawerEls.toggle.getAttribute("aria-label");
      drawerEls.toggle.setAttribute("aria-expanded", menuOpen ? "true" : "false");
    }
  }

  function setMenuOpen(open) {
    if (!drawerEls) return;
    menuOpen = Boolean(open);
    document.body.dataset.menuOpen = menuOpen ? "1" : "0";
    drawerEls.overlay.classList.toggle("is-open", menuOpen);
    drawerEls.drawer.classList.toggle("is-open", menuOpen);
    drawerEls.overlay.hidden = !menuOpen;
    drawerEls.drawer.hidden = !menuOpen;
    drawerEls.drawer.setAttribute("aria-hidden", menuOpen ? "false" : "true");
    syncDrawerChoices();

    if (menuOpen) {
      menuLastFocus = document.activeElement;
      var focusables = getFocusable(drawerEls.drawer);
      if (focusables.length) focusables[0].focus();
    } else if (menuLastFocus && typeof menuLastFocus.focus === "function") {
      try {
        menuLastFocus.focus();
      } catch (_) {}
      menuLastFocus = null;
    }
  }

  function mountMenuDrawer(actionsHost) {
    if (drawerEls) return drawerEls;
    if (!actionsHost) return null;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ws-menu-btn ws-mobile-only";
    toggle.setAttribute("data-ws-menu-toggle", "");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "ws-menu-drawer");
    toggle.innerHTML = '<span class="ws-menu-btn__bars" aria-hidden="true"></span>';
    actionsHost.appendChild(toggle);

    var overlay = document.createElement("div");
    overlay.className = "ws-menu-overlay";
    overlay.setAttribute("data-ws-menu-overlay", "");
    overlay.hidden = true;

    var drawer = document.createElement("aside");
    drawer.id = "ws-menu-drawer";
    drawer.className = "ws-menu-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "ws-menu-drawer-title");
    drawer.setAttribute("aria-hidden", "true");
    drawer.hidden = true;

    drawer.innerHTML =
      '<div class="ws-menu-drawer__header">' +
      '<h2 class="ws-menu-drawer__title" id="ws-menu-drawer-title"></h2>' +
      '<button type="button" class="ws-menu-drawer__close" data-ws-menu-close aria-label="Close">×</button>' +
      "</div>" +
      '<div class="ws-menu-drawer__scroll">' +
      '<section class="ws-menu-drawer__section">' +
      '<p class="ws-menu-drawer__section-title" data-ws-menu-prefs-title></p>' +
      '<div class="ws-menu-drawer__row">' +
      '<p class="ws-menu-drawer__hint" data-ws-menu-lang-label></p>' +
      '<button type="button" class="ws-menu-drawer__choice" data-drawer-lang="zh-Hant" role="radio"></button>' +
      '<button type="button" class="ws-menu-drawer__choice" data-drawer-lang="en" role="radio"></button>' +
      "</div>" +
      "</section>" +
      '<section class="ws-menu-drawer__section">' +
      '<p class="ws-menu-drawer__section-title" data-ws-menu-account-title></p>' +
      '<p class="ws-menu-drawer__hint" data-ws-menu-account-hint></p>' +
      '<button type="button" class="ws-menu-drawer__action" data-ws-menu-login></button>' +
      '<button type="button" class="ws-menu-drawer__action" data-ws-menu-logout hidden></button>' +
      "</section>" +
      "</div>";

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    drawerEls = {
      toggle: toggle,
      overlay: overlay,
      drawer: drawer,
      title: drawer.querySelector("#ws-menu-drawer-title"),
      close: drawer.querySelector("[data-ws-menu-close]"),
      scroll: drawer.querySelector(".ws-menu-drawer__scroll"),
      prefsTitle: drawer.querySelector("[data-ws-menu-prefs-title]"),
      accountTitle: drawer.querySelector("[data-ws-menu-account-title]"),
      langLabel: drawer.querySelector("[data-ws-menu-lang-label]"),
      accountHint: drawer.querySelector("[data-ws-menu-account-hint]"),
      login: drawer.querySelector("[data-ws-menu-login]"),
      logout: drawer.querySelector("[data-ws-menu-logout]")
    };

    toggle.addEventListener("click", function () {
      setMenuOpen(!menuOpen);
    });
    overlay.addEventListener("click", function () {
      setMenuOpen(false);
    });
    drawerEls.close.addEventListener("click", function () {
      setMenuOpen(false);
    });

    drawer.addEventListener("click", function (event) {
      var langBtn = event.target.closest("[data-drawer-lang]");
      if (langBtn && global.WhiteStudioI18n) {
        Promise.resolve(global.WhiteStudioI18n.setLang(langBtn.getAttribute("data-drawer-lang"))).then(
          function () {
            syncDrawerChoices();
          }
        );
      }
    });

    drawerEls.login.addEventListener("click", function () {
      if (global.WhiteStudioGamesAuth) {
        global.WhiteStudioGamesAuth.startDiscordLogin(window.location.href);
      }
    });

    drawerEls.logout.addEventListener("click", async function () {
      if (!global.WhiteStudioGamesAuth) return;
      drawerEls.logout.disabled = true;
      try {
        var apiBase = global.WhiteStudioGamesAuth.getApiBase();
        await fetch(apiBase + "/api/games/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        await global.WhiteStudioGamesAuth.refreshSession();
        global.WhiteStudioGamesAuth.showAuthToast(t("auth.toast_logout"), "muted");
        setMenuOpen(false);
      } catch (_) {
        global.WhiteStudioGamesAuth.showAuthToast(t("auth.toast_logout_fail"), "error");
      } finally {
        drawerEls.logout.disabled = false;
        syncDrawerChoices();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!menuOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      var focusables = getFocusable(drawer);
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    if (global.WhiteStudioGamesAuth && global.WhiteStudioGamesAuth.onSessionChange) {
      global.WhiteStudioGamesAuth.onSessionChange(function () {
        syncDrawerChoices();
      });
    }

    syncDrawerChoices();
    return drawerEls;
  }

  async function bootChrome(options) {
    options = options || {};

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
        switcherHost.className = "ws-site-controls ws-desktop-only";
        switcherHost.setAttribute("data-i18n-skip", "true");
        actions.appendChild(switcherHost);
        global.WhiteStudioI18n.mountSwitcher(switcherHost);
      }
      mountMenuDrawer(actions);
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
        syncDrawerChoices();
        if (global.WhiteStudioI18n.applyAll) global.WhiteStudioI18n.applyAll(document);
      });
      global.WhiteStudioI18n.applyAll(document);
    }

    return {
      lang: global.WhiteStudioI18n ? global.WhiteStudioI18n.getLang() : "zh-Hant",
      setMenuOpen: setMenuOpen
    };
  }

  if (global.WhiteStudioGames) {
    global.WhiteStudioGames.bootChrome = bootChrome;
    global.WhiteStudioGames.setMenuOpen = setMenuOpen;
  } else {
    global.WhiteStudioGames = {
      bootChrome: bootChrome,
      setMenuOpen: setMenuOpen
    };
  }
})(window);
