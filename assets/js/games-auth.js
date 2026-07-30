(function (global) {
  "use strict";

  var DEFAULT_API = "https://api.white-studio.org";
  var DISCORD_ICON =
    '<svg viewBox="0 0 640 512" aria-hidden="true"><path fill="currentColor" d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"/></svg>';

  var sessionSnapshot = {
    ok: true,
    authenticated: false,
    authorized: false,
    user: null,
    error: null
  };
  var listeners = [];
  var openMenu = null;
  var mountedRoots = [];

  function t(key, vars) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      return global.WhiteStudioI18n.t(key, vars);
    }
    return key;
  }

  function getApiBase() {
    try {
      var meta =
        document.querySelector('meta[name="ws-api-origin"]') ||
        document.querySelector('meta[name="ws-api-base"]');
      var fromMeta = meta && meta.content ? meta.content.trim() : "";
      if (fromMeta) return fromMeta.replace(/\/+$/, "");
    } catch (_) {}
    return DEFAULT_API;
  }

  function captureAuthResultFromUrl() {
    if (captureAuthResultFromUrl._done) return captureAuthResultFromUrl._value || "";
    var url = new URL(window.location.href);
    var result = url.searchParams.get("authResult") || "";
    if (result) {
      url.searchParams.delete("authResult");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
    captureAuthResultFromUrl._done = true;
    captureAuthResultFromUrl._value = result;
    return result;
  }

  function startDiscordLogin(returnTo) {
    var start = new URL(getApiBase() + "/auth/games/discord/start");
    start.searchParams.set("returnTo", returnTo || window.location.href);
    window.location.assign(start.toString());
  }

  async function apiRequest(path, options) {
    options = options || {};
    var headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    var response;
    try {
      response = await fetch(getApiBase() + path, {
        ...options,
        headers: headers,
        credentials: "include"
      });
    } catch (_) {
      var unreachable = new Error("Worker unreachable");
      unreachable.code = "WORKER_UNREACHABLE";
      throw unreachable;
    }

    var payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok || (payload && payload.ok === false)) {
      var message =
        (payload && payload.error && (payload.error.message || payload.error)) ||
        "Request failed (" + response.status + ")";
      var err = new Error(typeof message === "string" ? message : "Request failed");
      err.status = response.status;
      err.code =
        (payload && payload.error && payload.error.code) ||
        (payload && payload.code) ||
        (response.status === 404 ? "ROUTE_NOT_FOUND" : "REQUEST_FAILED");
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  function authResultMessage(code) {
    switch (code) {
      case "games_ok":
        return { tone: "ok", text: t("auth.toast_ok") };
      case "games_cancelled":
      case "discord_oauth_cancelled":
        return { tone: "muted", text: t("auth.toast_cancelled") };
      case "games_state_invalid":
      case "discord_oauth_state_invalid":
        return { tone: "error", text: t("auth.toast_invalid") };
      case "games_unavailable":
      case "discord_oauth_unavailable":
        return { tone: "error", text: t("auth.toast_unavailable") };
      default:
        return code ? { tone: "error", text: code } : null;
    }
  }

  function setSession(next) {
    sessionSnapshot = next;
    listeners.forEach(function (callback) {
      try {
        callback(sessionSnapshot);
      } catch (_) {}
    });
    document.dispatchEvent(
      new CustomEvent("ws-games-session", { detail: sessionSnapshot })
    );
  }

  function onSessionChange(callback) {
    if (typeof callback !== "function") return function () {};
    listeners.push(callback);
    callback(sessionSnapshot);
    return function () {
      listeners = listeners.filter(function (fn) {
        return fn !== callback;
      });
    };
  }

  async function refreshSession() {
    try {
      var payload = await apiRequest("/api/games/session");
      setSession({
        ok: true,
        authenticated: Boolean(payload && payload.authenticated),
        authorized: Boolean(payload && payload.authorized),
        user: (payload && payload.user) || null,
        error: null
      });
      return sessionSnapshot;
    } catch (error) {
      setSession({
        ok: false,
        authenticated: false,
        authorized: false,
        user: null,
        error: (error && error.code) || "REQUEST_FAILED"
      });
      return sessionSnapshot;
    }
  }

  function displayName(session) {
    return (
      (session && session.user && session.user.displayName) ||
      (session && session.user && session.user.username) ||
      (session && session.user && session.user.discordUserId) ||
      "Discord"
    );
  }

  function avatarUrlFor(session) {
    var direct = session && session.user && session.user.avatarUrl;
    if (direct) return direct;
    var id = String((session && session.user && session.user.discordUserId) || "0");
    var index = 0;
    try {
      index = Number(BigInt(id) % 6n);
    } catch (_) {
      index = Number(id.replace(/\D/g, "").slice(-1) || 0) % 6;
    }
    return "https://cdn.discordapp.com/embed/avatars/" + index + ".png";
  }

  function ensureToastHost() {
    var host = document.querySelector("[data-games-auth-toast]");
    if (host) return host;
    host = document.createElement("div");
    host.className = "ws-auth-toast";
    host.setAttribute("data-games-auth-toast", "");
    host.hidden = true;
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
    return host;
  }

  function showAuthToast(message, tone) {
    if (!message) return;
    var host = ensureToastHost();
    host.hidden = false;
    host.dataset.tone = tone || "muted";
    host.textContent = message;
    window.clearTimeout(showAuthToast._timer);
    showAuthToast._timer = window.setTimeout(function () {
      host.hidden = true;
    }, 4200);
  }

  function closeOpenMenu() {
    if (!openMenu) return;
    var menu = openMenu.querySelector(".ws-auth-menu");
    openMenu.classList.remove("is-open");
    var btn = openMenu.querySelector("[data-games-auth-menu-btn]");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;
    openMenu = null;
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }

  function buildAuthControls(variant) {
    var wrap = document.createElement("div");
    wrap.className =
      variant === "drawer"
        ? "ws-auth-controls is-drawer"
        : "ws-auth-controls";
    wrap.setAttribute("data-games-auth-controls", variant);
    wrap.dataset.state = "idle";

    var loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.className = "ws-auth-login";
    loginBtn.innerHTML = DISCORD_ICON + "<span></span>";

    var userShell = document.createElement("div");
    userShell.className = "ws-auth-user";
    setVisible(userShell, false);

    var menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "ws-auth-user-face";
    menuBtn.setAttribute("data-games-auth-menu-btn", "");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-haspopup", "menu");

    var avatar = document.createElement("img");
    avatar.className = "ws-auth-avatar";
    avatar.alt = "";
    avatar.width = 28;
    avatar.height = 28;
    avatar.decoding = "async";
    avatar.referrerPolicy = "no-referrer";

    var copy = document.createElement("span");
    copy.className = "ws-auth-copy";
    var nameEl = document.createElement("span");
    nameEl.className = "ws-auth-label";
    var metaEl = document.createElement("span");
    metaEl.className = "ws-auth-meta";
    copy.appendChild(nameEl);
    copy.appendChild(metaEl);
    menuBtn.appendChild(avatar);
    menuBtn.appendChild(copy);

    var menu = document.createElement("div");
    menu.className = "ws-auth-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    var logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "ws-auth-menu-item";
    logoutBtn.setAttribute("role", "menuitem");
    menu.appendChild(logoutBtn);

    var drawerLogout = document.createElement("button");
    drawerLogout.type = "button";
    drawerLogout.className = "ws-auth-logout";
    setVisible(drawerLogout, false);

    userShell.appendChild(menuBtn);
    if (variant === "header") userShell.appendChild(menu);
    else userShell.appendChild(drawerLogout);

    wrap.appendChild(loginBtn);
    wrap.appendChild(userShell);

    loginBtn.addEventListener("click", function () {
      startDiscordLogin(window.location.href);
    });

    async function doLogout(btn) {
      btn.disabled = true;
      try {
        await apiRequest("/api/games/logout", { method: "POST", body: "{}" });
        closeOpenMenu();
        await refreshSession();
        showAuthToast(t("auth.toast_logout"), "muted");
      } catch (error) {
        showAuthToast(
          error && error.code === "ROUTE_NOT_FOUND"
            ? t("auth.toast_logout_undeployed")
            : t("auth.toast_logout_fail"),
          "error"
        );
      } finally {
        btn.disabled = false;
      }
    }

    logoutBtn.addEventListener("click", function () {
      doLogout(logoutBtn);
    });
    drawerLogout.addEventListener("click", function () {
      doLogout(drawerLogout);
    });

    menuBtn.addEventListener("click", function () {
      if (variant === "drawer") return;
      var willOpen = !userShell.classList.contains("is-open");
      closeOpenMenu();
      if (!willOpen) return;
      userShell.classList.add("is-open");
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
      openMenu = userShell;
    });

    function render(session) {
      var loggedIn = Boolean(session && session.authenticated);
      setVisible(loginBtn, !loggedIn);
      setVisible(userShell, loggedIn);
      if (variant === "drawer") setVisible(drawerLogout, loggedIn);

      logoutBtn.textContent = t("auth.logout");
      drawerLogout.textContent = t("auth.logout");

      if (!loggedIn) {
        wrap.dataset.state =
          session && (session.error === "WORKER_UNREACHABLE" || session.error === "ROUTE_NOT_FOUND")
            ? "error"
            : "idle";
        var span = loginBtn.querySelector("span");
        if (span) {
          if (session && session.error === "WORKER_UNREACHABLE") span.textContent = t("auth.unreachable");
          else if (session && session.error === "ROUTE_NOT_FOUND") span.textContent = t("auth.undeployed");
          else span.textContent = t("auth.login");
        }
        loginBtn.disabled = Boolean(session && session.error === "ROUTE_NOT_FOUND");
        loginBtn.title = t("auth.login_title");
        closeOpenMenu();
        return;
      }

      var name = displayName(session);
      nameEl.textContent = name;
      metaEl.textContent = t("auth.role");
      avatar.src = avatarUrlFor(session);
      avatar.alt = name;
      menuBtn.setAttribute("aria-label", t("auth.logged_in_as", { name: name }));
      wrap.dataset.state = "ok";
      loginBtn.disabled = false;
    }

    onSessionChange(render);
    if (global.WhiteStudioI18n && global.WhiteStudioI18n.onChange) {
      global.WhiteStudioI18n.onChange(function () {
        render(sessionSnapshot);
      });
    }
    return wrap;
  }

  function mountInto(parent, variant, beforeSelector) {
    if (!parent) return null;
    if (mountedRoots.indexOf(parent) !== -1) return parent.querySelector("[data-games-auth-controls]");
    var existing = parent.querySelector('[data-games-auth-controls="' + variant + '"]');
    if (existing) {
      mountedRoots.push(parent);
      return existing;
    }
    var controls = buildAuthControls(variant);
    var before = beforeSelector ? parent.querySelector(beforeSelector) : null;
    if (before) parent.insertBefore(controls, before);
    else parent.appendChild(controls);
    mountedRoots.push(parent);
    return controls;
  }

  function mountAuth(actionsEl) {
    return mountInto(actionsEl, "header", ".ws-menu-toggle");
  }

  function mountDrawerAuth(host) {
    return mountInto(host, "drawer");
  }

  function prefillNickname(input) {
    if (!input || input.value) return;
    var name = displayName(sessionSnapshot);
    if (sessionSnapshot.authenticated && name && name !== "Discord") {
      input.value = String(name).slice(0, input.maxLength || 24);
    }
  }

  document.addEventListener("click", function (event) {
    if (openMenu && !openMenu.contains(event.target)) closeOpenMenu();
  });

  global.WhiteStudioGamesAuth = {
    getApiBase: getApiBase,
    startDiscordLogin: startDiscordLogin,
    refreshSession: refreshSession,
    getSessionSnapshot: function () {
      return sessionSnapshot;
    },
    onSessionChange: onSessionChange,
    mountAuth: mountAuth,
    mountDrawerAuth: mountDrawerAuth,
    captureAuthResultFromUrl: captureAuthResultFromUrl,
    authResultMessage: authResultMessage,
    showAuthToast: showAuthToast,
    prefillNickname: prefillNickname,
    displayName: displayName
  };
})(window);
