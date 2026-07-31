(function (global) {
  function t(key, vars) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      return global.WhiteStudioI18n.t(key, vars);
    }
    return key;
  }

  function renderLeaderboard(root, entries, emptyMessage) {
    if (!root) return;
    var list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      root.innerHTML =
        '<p class="ws-status">' +
        escapeHtml(emptyMessage || t("snake.board_empty")) +
        "</p>";
      return;
    }

    var rows = list
      .map(function (entry) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(String(entry.rank)) +
          "</td>" +
          "<td>" +
          escapeHtml(entry.playerName || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(String(entry.score)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    root.innerHTML =
      '<table class="ws-leaderboard" aria-label="' +
      escapeHtml(t("snake.board_title")) +
      '">' +
      "<thead><tr><th>" +
      escapeHtml(t("snake.col_rank")) +
      "</th><th>" +
      escapeHtml(t("snake.col_player")) +
      "</th><th>" +
      escapeHtml(t("snake.col_score")) +
      "</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table>";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function mountLeaderboard(options) {
    var api = options.api;
    var gameId = options.gameId;
    var boardRoot = options.boardRoot;
    var statusEl = options.statusEl;
    var form = options.form;
    var nameInput = options.nameInput;
    var scoreValueEl = options.scoreValueEl;
    var refreshButton = options.refreshButton;
    var lastEntries = [];

    async function refresh() {
      if (statusEl) {
        statusEl.textContent = t("snake.board_loading");
        statusEl.className = "ws-status";
      }
      try {
        var result = await api.getLeaderboard(gameId, options.limit || 20);
        lastEntries = (result.data && result.data.entries) || [];
        renderLeaderboard(boardRoot, lastEntries);
        if (statusEl) {
          statusEl.textContent = t("snake.board_updated", {
            time: new Date().toLocaleTimeString()
          });
          statusEl.className = "ws-status ws-status--ok";
        }
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = error.message || t("snake.board_fail");
          statusEl.className = "ws-status ws-status--error";
        }
      }
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        refresh();
      });
    }

    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var playerName = nameInput ? nameInput.value.trim() : "";
        var score = scoreValueEl ? Number(scoreValueEl.textContent || scoreValueEl.value || 0) : 0;
        if (statusEl) {
          statusEl.textContent = t("snake.loading");
          statusEl.className = "ws-status";
        }
        try {
          await api.submitScore(gameId, playerName, score);
          if (statusEl) {
            statusEl.textContent = t("snake.submit_ok");
            statusEl.className = "ws-status ws-status--ok";
          }
          try {
            localStorage.setItem("ws-games-player-name", playerName);
          } catch (_) {}
          await refresh();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message || t("snake.submit_fail");
            statusEl.className = "ws-status ws-status--error";
          }
        }
      });
    }

    if (nameInput) {
      try {
        var saved = localStorage.getItem("ws-games-player-name");
        if (saved && !nameInput.value) nameInput.value = saved;
      } catch (_) {}
    }

    if (global.WhiteStudioI18n && global.WhiteStudioI18n.onChange) {
      global.WhiteStudioI18n.onChange(function () {
        if (lastEntries.length) renderLeaderboard(boardRoot, lastEntries);
      });
    }

    await refresh();
    return { refresh: refresh };
  }

  global.WhiteStudioLeaderboard = {
    mountLeaderboard: mountLeaderboard,
    renderLeaderboard: renderLeaderboard
  };
})(window);
