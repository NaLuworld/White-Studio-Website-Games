(function (global) {
  function renderLeaderboard(root, entries, emptyMessage) {
    if (!root) return;
    var list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      root.innerHTML = '<p class="ws-status">' + (emptyMessage || "No scores yet. Be the first.") + "</p>";
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
      '<table class="ws-leaderboard" aria-label="Leaderboard">' +
      "<thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>" +
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

    async function refresh() {
      if (statusEl) {
        statusEl.textContent = "Loading leaderboard…";
        statusEl.className = "ws-status";
      }
      try {
        var result = await api.getLeaderboard(gameId, options.limit || 20);
        renderLeaderboard(boardRoot, result.data && result.data.entries);
        if (statusEl) {
          statusEl.textContent = "Updated " + new Date().toLocaleTimeString();
          statusEl.className = "ws-status ws-status--ok";
        }
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = error.message || "Failed to load leaderboard.";
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
          statusEl.textContent = "Submitting…";
          statusEl.className = "ws-status";
        }
        try {
          await api.submitScore(gameId, playerName, score);
          if (statusEl) {
            statusEl.textContent = "Score saved.";
            statusEl.className = "ws-status ws-status--ok";
          }
          try {
            localStorage.setItem("ws-games-player-name", playerName);
          } catch (_) {}
          await refresh();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message || "Submit failed.";
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

    await refresh();
    return { refresh: refresh };
  }

  global.WhiteStudioLeaderboard = {
    mountLeaderboard: mountLeaderboard,
    renderLeaderboard: renderLeaderboard
  };
})(window);
