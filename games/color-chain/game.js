/**
 * Color Chain — page boot + flow (lobby → play → result).
 */
(function () {
  "use strict";

  function t(key, fallback, vars) {
    var v = fallback || key;
    if (window.WhiteStudioI18n && typeof WhiteStudioI18n.t === "function") {
      var x = WhiteStudioI18n.t(key, vars);
      if (x && x !== key) v = x;
    }
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        v = v.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      });
    }
    return v;
  }

  // Lightweight SFX (skin node sfx.*)
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        return;
      }
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  document.addEventListener("click", ensureAudio, { once: true });
  function tone(freq, startOffset, dur, type, vol) {
    if (!audioCtx) return;
    var t0 = audioCtx.currentTime + startOffset;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.14, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
  function sfxPlay() {
    if (ColorChainRender.resolveVisual("sfx.play") !== "synth") return;
    tone(520, 0, 0.09, "triangle", 0.16);
    tone(760, 0.05, 0.1, "triangle", 0.12);
  }

  var net = new ColorChainNet();
  var lastScore = 0;
  var tableRoot = document.getElementById("cc-table");
  var render = new ColorChainRender(tableRoot, {
    onPlayCard: function (cardId) {
      if (render.state && (render.state.pendingWild || render.state.pendingReveal)) return;
      sfxPlay();
      net.send({ type: "action:playCard", cardId: cardId });
    }
  });

  var lobby = new ColorChainLobby(
    {
      createBtn: document.getElementById("cc-create"),
      joinBtn: document.getElementById("cc-join"),
      startBtn: document.getElementById("cc-start"),
      nameInput: document.getElementById("player-name"),
      codeInput: document.getElementById("cc-code"),
      maxPlayers: document.getElementById("cc-max-players"),
      fillBots: document.getElementById("cc-fill-bots"),
      setupPanel: document.getElementById("cc-setup"),
      waitPanel: document.getElementById("cc-waiting"),
      seatList: document.getElementById("cc-seat-list"),
      shareLink: document.getElementById("cc-share"),
      roomCode: document.getElementById("cc-room-code"),
      status: document.getElementById("cc-lobby-status"),
      hostControls: document.getElementById("cc-host-controls")
    },
    net
  );
  lobby.bind();

  function showPlay() {
    var lobbyPanel = document.getElementById("cc-lobby");
    if (lobbyPanel) lobbyPanel.hidden = true;
    if (tableRoot) tableRoot.hidden = false;
    var controls = document.getElementById("cc-controls");
    if (controls) controls.hidden = false;
  }

  function showResult(endMsg) {
    var sheet = document.getElementById("result-sheet");
    var body = document.getElementById("result-body");
    if (sheet) sheet.hidden = false;
    if (body) body.textContent = endMsg;
    var scoreEl = document.getElementById("submit-score-value");
    if (scoreEl) scoreEl.textContent = String(lastScore);
    var form = document.getElementById("score-form");
    if (form) form.hidden = lastScore <= 0;
  }

  net.on("room:state", function (msg) {
    if (msg.room) lobby.renderRoom(msg.room);
  });

  net.on("game:state", function (msg) {
    showPlay();
    render.apply(msg);
    var hudScore = document.getElementById("live-score");
    if (hudScore && msg.scores && net.playerId && msg.scores[net.playerId] != null) {
      hudScore.textContent = String(msg.scores[net.playerId]);
    }
  });

  net.on("game:reveal", function (msg) {
    render.showReveal(msg);
  });

  net.on("game:end", function (msg) {
    var won =
      msg.winnerSeat != null &&
      msg.room &&
      msg.room.seats &&
      msg.room.seats[msg.winnerSeat] &&
      msg.room.seats[msg.winnerSeat].id === net.playerId;
    lastScore = (msg.scores && msg.scores[net.playerId]) || 0;
    var winnerName =
      msg.room && msg.room.seats && msg.room.seats[msg.winnerSeat]
        ? msg.room.seats[msg.winnerSeat].name
        : "?";
    showResult(
      won
        ? t("color_chain.result_win", "You win! Score {score}.", { score: lastScore })
        : t("color_chain.result_lose", "{name} wins. Score {score}.", {
            name: winnerName,
            score: lastScore
          })
    );
  });

  net.on("error", function (msg) {
    var status = document.getElementById("cc-lobby-status");
    if (status) status.textContent = (msg && msg.error) || "error";
    var tableMsg = document.getElementById("cc-table-msg");
    if (tableMsg && msg && msg.error) tableMsg.textContent = String(msg.error);
  });

  // Controls
  var drawBtn = document.getElementById("cc-draw-btn");
  if (drawBtn) {
    drawBtn.addEventListener("click", function () {
      net.send({ type: "action:drawCard" });
    });
  }
  var drawPile = document.getElementById("cc-draw-pile");
  if (drawPile) {
    drawPile.addEventListener("click", function () {
      net.send({ type: "action:drawCard" });
    });
  }
  var lastBtn = document.getElementById("cc-last-btn");
  if (lastBtn) {
    lastBtn.addEventListener("click", function () {
      net.send({ type: "action:callLastCard" });
    });
  }
  var catchBtn = document.getElementById("cc-catch-btn");
  if (catchBtn) {
    catchBtn.addEventListener("click", function () {
      var st = render.state;
      if (!st || !st.catchTargets || !st.catchTargets.length) return;
      net.send({ type: "action:catchMissedCall", targetSeatIndex: st.catchTargets[0] });
    });
  }
  var challengeBtn = document.getElementById("cc-challenge-btn");
  if (challengeBtn) {
    challengeBtn.addEventListener("click", function () {
      net.send({ type: "action:challenge" });
    });
  }
  var revealClose = document.getElementById("cc-reveal-close");
  if (revealClose) {
    revealClose.addEventListener("click", function () {
      document.getElementById("cc-reveal-modal").classList.remove("is-open");
      net.send({ type: "action:challengeAck" });
    });
  }
  var colorModal = document.getElementById("cc-color-modal");
  if (colorModal) {
    colorModal.addEventListener("click", function (e) {
      var sw = e.target.closest("[data-color]");
      if (!sw) return;
      net.send({ type: "action:chooseColor", color: sw.getAttribute("data-color") });
      colorModal.classList.remove("is-open");
    });
  }

  var againBtn = document.getElementById("again-button");
  if (againBtn) {
    againBtn.addEventListener("click", function () {
      location.href = location.pathname;
    });
  }

  var backBtn = document.getElementById("back-button");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (!confirm(t("color_chain.leave_confirm", "Leave this room?"))) return;
      net.disconnect();
      location.href = "/";
    });
  }

  window.ColorChainGame = { net: net, lobby: lobby, render: render };
})();
