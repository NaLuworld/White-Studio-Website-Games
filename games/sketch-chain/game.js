/**

 * Sketch Chain — boot + net event wiring.

 */

(function (global) {

  "use strict";



  var GUIDE_SEEN_KEY = "ws_sketch_chain_naru_v1";

  var guideFlags = {};



  function tipOnce(flag, tip) {

    if (guideFlags[flag]) return;

    guideFlags[flag] = true;

    if (global.WhiteStudioNaru && global.WhiteStudioNaru.queueTips) {

      global.WhiteStudioNaru.queueTips([tip]);

    }

  }



  function SketchChainGame() {

    this.net = new SketchChainNet();

    this.lobby = null;

    this.stage = null;

    this.reveal = null;

    this.submittedThisRound = false;

  }



  SketchChainGame.prototype.onGuidePhase = function (phase) {

    if (phase === "entry") {

      if (localStorage.getItem(GUIDE_SEEN_KEY) === "1") return;

      tipOnce("entry", {

        key: "naru.tip_sketch_chain_entry",

        anim: "point_down",

        target: "#create-room-btn",

        holdAnim: "look_user"

      });

      localStorage.setItem(GUIDE_SEEN_KEY, "1");

    } else if (phase === "join_prompt") {

      tipOnce("join_prompt", {

        key: "naru.tip_sketch_chain_join",

        anim: "point_down",

        target: "#join-room-btn",

        holdAnim: "look_user"

      });

    } else if (phase === "invite_wait") {

      tipOnce("invite_wait", {

        key: "naru.tip_sketch_chain_invite_wait",

        anim: "point_up",

        target: "#room-code",

        holdAnim: "look_user"

      });

    } else if (phase === "lobby_ready") {

      tipOnce("lobby_ready", {

        key: "naru.tip_sketch_chain_start",

        anim: "point_down",

        target: "#start-game-btn",

        holdAnim: "look_user"

      });

    } else if (phase === "write") {

      tipOnce("write", {

        key: "naru.tip_sketch_chain_write",

        anim: "point_down",

        target: "#stage-input",

        holdAnim: "look_user"

      });

    } else if (phase === "draw") {

      tipOnce("draw", {

        key: "naru.tip_sketch_chain_draw",

        anim: "point_down",

        target: "#board",

        holdAnim: "look_user"

      });

    } else if (phase === "reveal") {

      tipOnce("reveal", {

        key: "naru.tip_sketch_chain_reveal",

        anim: "wave",

        target: "#reveal-stage",

        holdAnim: "look_user"

      });

    } else if (phase === "play_again") {

      tipOnce("play_again", {

        key: "naru.tip_sketch_chain_again",

        anim: "celebrate",

        target: "#reveal-replay-btn",

        holdAnim: "look_user"

      });

    }

  };



  SketchChainGame.prototype.startGuide = function () {

    var params = new URLSearchParams(location.search);

    if (params.get("room")) this.onGuidePhase("join_prompt");

    else this.onGuidePhase("entry");

  };



  SketchChainGame.prototype.start = function (els) {

    var self = this;



    this.stage = new SketchChainStage({

      stageBody: els.stageBody,

      stageLabel: els.stageLabel,

      progressFill: els.progressFill,

      timer: els.timer,

      waitingOverlay: els.waitingOverlay

    });



    this.reveal = new SketchChainReveal({

      stepCount: els.revealStepCount,

      revealProgress: els.revealProgress,

      chainTitle: els.revealChainTitle,

      revealStage: els.revealStage

    });

    this.reveal.onReplay = function () {
      self.net.send({ type: "game:lobby_reset" });
      self.backToLobby();
    };

    this.reveal.onShowEnd = function () {
      self.onGuidePhase("play_again");
    };



    this.lobby = new SketchChainLobby(

      {

        nameInput: els.nameInput,

        roomCode: els.roomCode,

        lobbyPlayers: els.lobbyPlayers,

        playerCount: els.playerCount,

        ruleRoundCount: els.ruleRoundCount,

        ruleDrawMin: els.ruleDrawMin,

        drawRange: els.drawRange,

        drawVal: els.drawVal,

        createBtn: els.createBtn,

        joinBtn: els.joinBtn,

        joinCode: els.joinCode,

        startBtn: els.startBtn,

        copyBtn: els.copyBtn,

        status: els.status

      },

      this.net

    );

    this.lobby.onGuidePhase = function (phase) {

      self.onGuidePhase(phase);

    };

    this.lobby.bind();

    this.lobby.onInRoom = function () {

      document.body.classList.remove("is-sc-playing");

    };



    this.stage.onSubmit = function (content) {

      if (self.submittedThisRound) return;

      self.submittedThisRound = true;

      self.net.send({ type: "round:submit", content: content });

    };



    if (els.waitingOverlay) {

      var wt = els.waitingOverlay.querySelector(".waiting-text");

      if (wt) {

        wt.textContent =

          global.WhiteStudioI18n && global.WhiteStudioI18n.t

            ? global.WhiteStudioI18n.t("sketch_chain.waiting")

            : "Waiting for other players…";

      }

    }



    this.net.on("room:state", function (msg) {

      var room = msg.room || msg.data || msg;

      self.lobby.applyRoom(room);

      if (room && room.status === "lobby") {

        self.backToLobby();

      }

    });



    this.net.on("room:error", function (msg) {

      self.lobby.setStatus((msg.message || msg.error) || "error", true);

    });



    this.net.on("round:start", function (msg) {

      self.submittedThisRound = false;

      self.stage.showWaitingOverlay(false);

      self.stage.enterRound(msg);

      if (msg.stageType === "write") self.onGuidePhase("write");

      else if (msg.stageType === "draw") self.onGuidePhase("draw");

    });



    this.net.on("round:player_submitted", function (msg) {

      self.stage.updateSubmitProgress(msg.submittedCount || 0, msg.totalCount || 0);

    });



    this.net.on("round:all_done", function () {

      self.stage.showWaitingOverlay(false);

      self.stage.clearTimer();

    });



    this.net.on("round:waiting", function (msg) {

      self.submittedThisRound = true;

      self.stage.showWaitingOverlay(true);

      self.stage.updateSubmitProgress(msg.submittedCount || 0, msg.totalCount || 0);

    });



    this.net.on("game:reveal_start", function (msg) {

      self.stage.clearTimer();

      self.stage.showWaitingOverlay(false);

      self.reveal.start(msg);

      self.onGuidePhase("reveal");

    });



    this.net.on("close", function () {

      self.lobby.setStatus("Disconnected", true);

    });



    document.addEventListener(

      "touchmove",

      function (e) {

        var app = document.getElementById("sketch-chain-app");

        if (app && app.classList.contains("lock-scroll")) e.preventDefault();

      },

      { passive: false }

    );



    if (els.backBtn) {

      els.backBtn.addEventListener("click", function () {

        if (

          document.body.classList.contains("is-sc-playing") &&

          !confirm(

            global.WhiteStudioI18n && global.WhiteStudioI18n.t

              ? global.WhiteStudioI18n.t("sketch_chain.leave_confirm")

              : "Leave this room?"

          )

        ) {

          return;

        }

        self.leave();

        location.href = "/";

      });

    }



    var params = new URLSearchParams(location.search);
    var urlRoom = params.get("room");
    var savedCode = global.SketchChainLobbyKeys
      ? localStorage.getItem(global.SketchChainLobbyKeys.CODE_KEY)
      : null;
    if (!urlRoom || String(urlRoom).toUpperCase() === String(savedCode || "").toUpperCase()) {
      self.lobby.tryRestoreSession().then(function (ok) {
        if (!ok) self.showLobby();
      });
    } else {
      this.showLobby();
    }
  };



  SketchChainGame.prototype.showLobby = function () {

    document.body.classList.remove("is-sc-playing");

    var app = document.getElementById("sketch-chain-app");

    if (app) {

      app.querySelectorAll(".screen").forEach(function (s) {

        s.classList.remove("active");

      });

      var lobby = document.getElementById("screen-lobby");

      if (lobby) lobby.classList.add("active");

      app.classList.remove("lock-scroll");

    }

  };



  SketchChainGame.prototype.backToLobby = function () {

    this.reveal.destroy();

    this.showLobby();

    this.submittedThisRound = false;

  };



  SketchChainGame.prototype.leave = function () {

    this.reveal.destroy();

    this.stage.clearTimer();

    this.net.disconnect();

  };



  global.SketchChainGame = SketchChainGame;

})(window);


