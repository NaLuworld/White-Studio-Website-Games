(function (global) {
  "use strict";

  var STORAGE_LANG_KEY = "ws_games_lang_v1";
  var DEFAULT_LANG = "zh-Hant";
  var SUPPORTED = [
    { code: "zh-Hant", labelKey: "lang.traditional_chinese" },
    { code: "en", labelKey: "lang.english" }
  ];

  var catalogs = Object.create(null);
  var currentLang = DEFAULT_LANG;
  var ready = false;
  var listeners = [];

  function canonicalizeLang(input) {
    var raw = String(input || "")
      .trim()
      .replace("_", "-");
    if (!raw) return DEFAULT_LANG;
    var low = raw.toLowerCase();
    if (low === "zh-hant" || low === "zh-tw" || low === "zh-hk") return "zh-Hant";
    if (low.indexOf("en") === 0) return "en";
    return DEFAULT_LANG;
  }

  function getStoredLang() {
    try {
      return canonicalizeLang(localStorage.getItem(STORAGE_LANG_KEY));
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function persistLang(lang) {
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (_) {}
  }

  function interpolate(template, vars) {
    var out = String(template == null ? "" : template);
    if (!vars) return out;
    return out.replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] == null ? "" : String(vars[key]);
    });
  }

  function t(key, vars) {
    var bag = catalogs[currentLang] || catalogs[DEFAULT_LANG] || {};
    var fallback = catalogs[DEFAULT_LANG] || {};
    var value = bag[key] != null ? bag[key] : fallback[key];
    if (value == null) return key;
    return interpolate(value, vars);
  }

  function applyNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.hasAttribute("data-i18n-skip")) return;

    var key = node.getAttribute("data-i18n");
    if (key) {
      node.textContent = t(key);
    }

    var attrSpec = node.getAttribute("data-i18n-attr");
    if (attrSpec) {
      attrSpec.split(";").forEach(function (part) {
        var trimmed = part.trim();
        if (!trimmed) return;
        var pieces = trimmed.split(":");
        var attr = pieces[0] && pieces[0].trim();
        var attrKey = pieces[1] && pieces[1].trim();
        if (attr && attrKey) node.setAttribute(attr, t(attrKey));
      });
    }
  }

  function applyAll(root) {
    var scope = root || document;
    if (scope.querySelectorAll) {
      var nodes = scope.querySelectorAll("[data-i18n], [data-i18n-attr]");
      for (var i = 0; i < nodes.length; i++) applyNode(nodes[i]);
    }
    if (scope.matches && (scope.hasAttribute("data-i18n") || scope.hasAttribute("data-i18n-attr"))) {
      applyNode(scope);
    }
  }

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn(currentLang);
      } catch (_) {}
    });
    document.dispatchEvent(
      new CustomEvent("ws-games-lang", { detail: { lang: currentLang } })
    );
  }

  async function loadCatalog(lang) {
    var code = canonicalizeLang(lang);
    if (catalogs[code]) return catalogs[code];
    var response = await fetch(
      "/assets/i18n/" + encodeURIComponent(code) + ".json?v=20260802k",
      {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      }
    );
    if (!response.ok) throw new Error("Failed to load i18n catalog: " + code);
    var json = await response.json();
    catalogs[code] = json && typeof json === "object" ? json : {};
    return catalogs[code];
  }

  async function setLang(nextLang, options) {
    var lang = canonicalizeLang(nextLang);
    await loadCatalog(lang);
    currentLang = lang;
    document.documentElement.lang = lang;
    if (!options || options.persist !== false) persistLang(lang);
    applyAll(document);
    notify();
    return lang;
  }

  async function init(options) {
    if (ready) return currentLang;
    var preferred = (options && options.lang) || getStoredLang();
    // Preload every supported locale so the switcher never falls back silently.
    await Promise.all(
      SUPPORTED.map(function (item) {
        return loadCatalog(item.code);
      }).concat([loadCatalog(preferred)])
    );
    ready = true;
    return setLang(preferred, { persist: true });
  }

  function onChange(callback) {
    if (typeof callback !== "function") return function () {};
    listeners.push(callback);
    return function () {
      listeners = listeners.filter(function (fn) {
        return fn !== callback;
      });
    };
  }

  function mountSwitcher(host) {
    if (!host) return null;
    if (host.querySelector("[data-ws-i18n-switcher]")) {
      return host.querySelector("[data-ws-i18n-switcher]");
    }

    var root = document.createElement("div");
    root.className = "ws-i18n-switcher";
    root.setAttribute("data-ws-i18n-switcher", "");
    root.setAttribute("data-i18n-skip", "true");

    var button = document.createElement("button");
    button.type = "button";
    button.className = "ws-i18n-btn";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML =
      '<span class="ws-i18n-dot" aria-hidden="true"></span>' +
      '<span class="ws-i18n-label"></span>' +
      '<span class="ws-i18n-arrow" aria-hidden="true"></span>';

    var menu = document.createElement("div");
    menu.className = "ws-i18n-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    SUPPORTED.forEach(function (item) {
      var option = document.createElement("button");
      option.type = "button";
      option.setAttribute("role", "menuitemradio");
      option.dataset.lang = item.code;
      option.addEventListener("click", function () {
        Promise.resolve(setLang(item.code)).finally(function () {
          menu.hidden = true;
          button.setAttribute("aria-expanded", "false");
        });
      });
      menu.appendChild(option);
    });

    function sync() {
      var label = button.querySelector(".ws-i18n-label");
      var active = SUPPORTED.find(function (item) {
        return item.code === currentLang;
      });
      if (label) label.textContent = t(active ? active.labelKey : "lang.traditional_chinese");
      var options = menu.querySelectorAll("[data-lang]");
      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        var code = opt.getAttribute("data-lang");
        var meta = SUPPORTED.find(function (item) {
          return item.code === code;
        });
        opt.textContent = t(meta ? meta.labelKey : code);
        var pressed = code === currentLang;
        opt.setAttribute("aria-pressed", pressed ? "true" : "false");
        opt.classList.toggle("active", pressed);
      }
    }

    button.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (event) {
      if (!root.contains(event.target)) {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });

    root.appendChild(button);
    root.appendChild(menu);
    host.appendChild(root);
    onChange(sync);
    sync();
    return root;
  }

  global.WhiteStudioI18n = {
    init: init,
    t: t,
    setLang: setLang,
    getLang: function () {
      return currentLang;
    },
    applyAll: applyAll,
    mountSwitcher: mountSwitcher,
    onChange: onChange,
    supported: SUPPORTED.slice()
  };
})(window);
