/**
 * Color Chain — flow + phase Naru tips (lobby → play → result).
 */
(function () {
  "use strict";

  var GUIDE_SEEN_KEY = "ws_color_chain_guide_v1";

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

  var guideFlags = {
    entry: false,
    join_prompt: false,
    invite_wait: false,
    invite_settings: false,
    your_turn: false,
    call_last: false,
    challenge: false,
    result: false
  };

  function tipOnce(flag, tip) {
    if (guideFlags[flag]) return;
    guideFlags[flag] = true;
    if (window.WhiteStudioNaru && WhiteStudioNaru.queueTips) {
      WhiteStudioNaru.queueTips([tip]);
    }
  }

  function onGuidePhase(phase) {
    if (phase === "entry") {
      if (localStorage.getItem(GUIDE_SEEN_KEY) === "1") return;
      tipOnce("entry", {
        key: "naru.tip_color_chain_entry",
        anim: "point_down",
        target: "#cc-quick-play",
        holdAnim: "look_user"
      });
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } else if (phase === "join_prompt") {
      tipOnce("join_prompt", {
        key: "naru.tip_color_chain_join",
        anim: "point_down",
        target: "#cc-join",
        holdAnim: "look_user"
      });
    } else if (phase === "invite_settings") {
      tipOnce("invite_settings", {
        key: "naru.tip_color_chain_invite_settings",
        anim: "point_down",
        target: "#cc-invite-create",
        holdAnim: "look_user"
      });
    } else if (phase === "invite_wait") {
      tipOnce("invite_wait", {
        key: "naru.tip_color_chain_invite_wait",
        anim: "point_up",
        target: "#cc-room-code",
        holdAnim: "look_user"
      });
    } else if (phase === "your_turn") {
      tipOnce("your_turn", {
        key: "naru.tip_color_chain_your_turn",
        anim: "point_down",
        target: "#cc-my-hand",
        holdAnim: "look_user"
      });
    } else if (phase === "call_last") {
      tipOnce("call_last", {
        key: "naru.tip_color_chain_last",
        anim: "wave",
        target: "#cc-last-btn",
        holdAnim: "look_user"
      });
    } else if (phase === "challenge") {
      tipOnce("challenge", {
        key: "naru.tip_color_chain_challenge",
        anim: "think",
        target: "#cc-challenge-btn",
        holdAnim: "look_user"
      });
    } else if (phase === "result") {
      tipOnce("result", {
        key: "naru.tip_color_chain_result",
        anim: "celebrate",
        target: "#result-sheet",
        holdAnim: "look_user"
      });
    }
  }

  var net = new ColorChainNet();
  var lastScore = 0;
  var tableRoot = document.getElementById("cc-table");
  var render = new ColorChainRender(tableRoot, {
    onPlayCard: function (cardId) {
      if (render.state && (render.state.pendingWild || render.state.pendingReveal)) return;
      sfxPlay();
      net.send({ type: "action:playCard", cardId: cardId });
    },
    onSfxPlay: sfxPlay
  });

  var lobby = new ColorChainLobby(
    {
      quickPlayBtn: document.getElementById("cc-quick-play"),
      inviteBtn: document.getElementById("cc-invite"),
      inviteCreateBtn: document.getElementById("cc-invite-create"),
      showJoinBtn: document.getElementById("cc-show-join"),
      joinBtn: document.getElementById("cc-join"),
      startBtn: document.getElementById("cc-start"),
      copyBtn: document.getElementById("cc-copy-link"),
      nameInput: document.getElementById("player-name"),
      codeInput: document.getElementById("cc-code"),
      maxPlayers: document.getElementById("cc-max-players"),
      fillBots: document.getElementById("cc-fill-bots"),
      setupPanel: document.getElementById("cc-setup"),
      waitPanel: document.getElementById("cc-waiting"),
      secondaryPanel: document.getElementById("cc-secondary"),
      joinFields: document.getElementById("cc-join-fields"),
      inviteFields: document.getElementById("cc-invite-fields"),
      seatList: document.getElementById("cc-seat-list"),
      shareLink: document.getElementById("cc-share"),
      roomCode: document.getElementById("cc-room-code"),
      status: document.getElementById("cc-lobby-status"),
      hostControls: document.getElementById("cc-host-controls")
    },
    net
  );
  lobby.onPhase = onGuidePhase;
  lobby.bind();

  function setPlayingChrome(on) {
    document.body.classList.toggle("is-cc-playing", !!on);
    var board = document.getElementById("cc-leaderboard");
    if (board) board.hidden = !!on;
    var hud = document.querySelector(".ws-game-hud");
    if (hud) hud.hidden = !!on;
  }

  function showPlay() {
    var lobbyPanel = document.getElementById("cc-lobby");
    if (lobbyPanel) lobbyPanel.hidden = true;
    if (tableRoot) tableRoot.hidden = false;
    var controls = document.getElementById("cc-controls");
    if (controls) controls.hidden = false;
    setPlayingChrome(true);
  }

  function showResult(endMsg) {
    setPlayingChrome(false);
    var sheet = document.getElementById("result-sheet");
    var body = document.getElementById("result-body");
    if (sheet) sheet.hidden = false;
    if (body) body.textContent = endMsg;
    var scoreEl = document.getElementById("submit-score-value");
    if (scoreEl) scoreEl.textContent = String(lastScore);
    var form = document.getElementById("score-form");
    if (form) form.hidden = lastScore <= 0;
    var board = document.getElementById("cc-leaderboard");
    if (board) board.hidden = false;
    onGuidePhase("result");
  }

  function maybePlayTips(msg) {
    if (msg.phase !== "playing") return;
    if (msg.viewerSeat === msg.currentSeat && !msg.pendingWild && !msg.pendingReveal) {
      onGuidePhase("your_turn");
    }
    var lastBtn = document.getElementById("cc-last-btn");
    if (lastBtn && !lastBtn.hidden && msg.canCallLast) onGuidePhase("call_last");
    var challengeBtn = document.getElementById("cc-challenge-btn");
    if (challengeBtn && !challengeBtn.hidden) onGuidePhase("challenge");
  }

  net.on("room:state", function (msg) {
    if (msg.room) lobby.renderRoom(msg.room);
  });

  net.on("game:state", function (msg) {
    showPlay();
    render.apply(msg);
    maybePlayTips(msg);
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
      location.href = "/games/color-chain/";
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

  function startGuide() {
    var params = new URLSearchParams(location.search);
    if (params.get("room")) onGuidePhase("join_prompt");
    else onGuidePhase("entry");
  }

  window.ColorChainGame = {
    net: net,
    lobby: lobby,
    render: render,
    startGuide: startGuide
  };
})();
