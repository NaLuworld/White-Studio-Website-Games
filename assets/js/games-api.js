(function (global) {
  var DEFAULT_API = "https://api.white-studio.org";

  function resolveApiOrigin() {
    try {
      var meta = document.querySelector('meta[name="ws-api-origin"]');
      var fromMeta = meta && meta.content ? meta.content.trim() : "";
      if (fromMeta) return fromMeta.replace(/\/$/, "");
    } catch (_) {}
    return DEFAULT_API;
  }

  async function parseJson(response) {
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
      var error = new Error(typeof message === "string" ? message : "Request failed");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function createGamesApi(options) {
    var origin = (options && options.origin) || resolveApiOrigin();

    async function request(path, init) {
      var response = await fetch(origin + path, {
        credentials: "omit",
        ...init,
        headers: {
          Accept: "application/json",
          ...(init && init.headers ? init.headers : {})
        }
      });
      return parseJson(response);
    }

    return {
      origin: origin,
      listGames: function () {
        return request("/api/games");
      },
      getLeaderboard: function (gameId, limit) {
        var query = typeof limit === "number" ? "?limit=" + encodeURIComponent(limit) : "";
        return request("/api/games/" + encodeURIComponent(gameId) + "/leaderboard" + query);
      },
      submitScore: function (gameId, playerName, score) {
        return request("/api/games/" + encodeURIComponent(gameId) + "/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName: playerName, score: score })
        });
      }
    };
  }

  function bindThemeToggle(button) {
    if (!button) return;
    function syncLabel() {
      var mode = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      button.setAttribute("aria-pressed", mode === "light" ? "true" : "false");
      button.textContent = mode === "light" ? "Dark" : "Light";
    }
    syncLabel();
    button.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      try {
        localStorage.setItem("theme-mode", next);
      } catch (_) {}
      syncLabel();
    });
  }

  global.WhiteStudioGames = {
    createGamesApi: createGamesApi,
    bindThemeToggle: bindThemeToggle,
    resolveApiOrigin: resolveApiOrigin
  };
})(window);
