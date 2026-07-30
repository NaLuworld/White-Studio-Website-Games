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
        escapeHtml(emptyMessage || t("demo.board_empty")) +
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
      escapeHtml(t("demo.board_title")) +
      '">' +
      "<thead><tr><th>" +
      escapeHtml(t("demo.col_rank")) +
      "</th><th>" +
      escapeHtml(t("demo.col_player")) +
      "</th><th>" +
      escapeHtml(t("demo.col_score")) +
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
        statusEl.textContent = t("demo.board_loading");
        statusEl.className = "ws-status";
      }
      try {
        var result = await api.getLeaderboard(gameId, options.limit || 20);
        lastEntries = (result.data && result.data.entries) || [];
        renderLeaderboard(boardRoot, lastEntries);
        if (statusEl) {
          statusEl.textContent = t("demo.board_updated", {
            time: new Date().toLocaleTimeString()
          });
          statusEl.className = "ws-status ws-status--ok";
        }
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = error.message || t("demo.board_fail");
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
          statusEl.textContent = t("demo.loading");
          statusEl.className = "ws-status";
        }
        try {
          await api.submitScore(gameId, playerName, score);
          if (statusEl) {
            statusEl.textContent = t("demo.submit_ok");
            statusEl.className = "ws-status ws-status--ok";
          }
          try {
            localStorage.setItem("ws-games-player-name", playerName);
          } catch (_) {}
          await refresh();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message || t("demo.submit_fail");
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
