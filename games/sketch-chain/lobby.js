/**
 * Sketch Chain lobby — create / join / room settings.
 */
(function (global) {
  "use strict";

  var NICK_KEY = "ws_sketch_chain_nick";
  var TOKEN_KEY = "ws_sketch_chain_token";
  var CODE_KEY = "ws_sketch_chain_code";
  var PLAYER_ID_KEY = "ws_sketch_chain_player_id";
  var MIN_PLAYERS_TO_START = 2;

  function t(key, fallback, vars) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      var v = global.WhiteStudioI18n.t(key, vars);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function guestName() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return "Guest" + out;
  }

  function SketchChainLobby(els, net) {
    this.els = els;
    this.net = net;
    this.room = null;
    this.onInRoom = null;
  }

  SketchChainLobby.prototype.bind = function () {
    var self = this;
    this.restoreNick();
    this.updateDrawDurationLabel();

    var params = new URLSearchParams(location.search);
    var roomCode = params.get("room");
    if (roomCode && this.els.joinCode) {
      this.els.joinCode.value = roomCode;
      if (this.onGuidePhase) this.onGuidePhase("join_prompt");
    }

    if (this.els.createBtn) {
      this.els.createBtn.addEventListener("click", function () {
        self.createRoom().catch(function (err) {
          self.setStatus(err.message || "error", true);
        });
      });
    }
    if (this.els.joinBtn) {
      this.els.joinBtn.addEventListener("click", function () {
        self.joinRoom().catch(function (err) {
          self.setStatus(err.message || "error", true);
        });
      });
    }
    if (this.els.startBtn) {
      this.els.startBtn.addEventListener("click", function () {
        var sec = self.getDrawDurationSec();
        self.net.send({ type: "game:start", drawDurationSec: sec });
      });
    }
    if (this.els.copyBtn) {
      this.els.copyBtn.addEventListener("click", function () {
        self.copyShareLink();
      });
    }
    if (this.els.drawRange) {
      this.els.drawRange.addEventListener("input", function () {
        self.updateDrawDurationLabel();
        if (self.room && self.room.hostId === self.net.playerId) {
          self.net.send({
            type: "room:configure",
            drawDurationSec: self.getDrawDurationSec()
          });
        }
      });
    }
    if (this.els.nameInput) {
      this.els.nameInput.addEventListener("change", function () {
        var v = self.els.nameInput.value.trim();
        if (v) localStorage.setItem(NICK_KEY, v);
      });
    }
  };

  SketchChainLobby.prototype.restoreNick = function () {
    var saved = localStorage.getItem(NICK_KEY);
    if (this.els.nameInput && saved) this.els.nameInput.value = saved;
  };

  SketchChainLobby.prototype.getNickname = function () {
    var v = this.els.nameInput && this.els.nameInput.value.trim();
    return v || guestName();
  };

  SketchChainLobby.prototype.getDrawDurationSec = function () {
    if (!this.els.drawRange) return 300;
    return parseInt(this.els.drawRange.value, 10) || 300;
  };

  SketchChainLobby.prototype.updateDrawDurationLabel = function () {
    var sec = this.getDrawDurationSec();
    var minutes = Math.round((sec / 60) * 10) / 10;
    if (this.els.drawVal) this.els.drawVal.textContent = String(minutes);
    if (this.els.ruleDrawMin) this.els.ruleDrawMin.textContent = String(minutes);
  };

  SketchChainLobby.prototype.setStatus = function (msg, isError) {
    if (!this.els.status) return;
    this.els.status.textContent = msg || "";
    this.els.status.classList.toggle("is-error", !!isError);
  };

  SketchChainLobby.prototype.createRoom = async function () {
    var self = this;
    this.setStatus(t("sketch_chain.connecting", "Connecting…"), false);
    var token = localStorage.getItem(TOKEN_KEY);
    var data = await this.net.createRoom({
      name: this.getNickname(),
      drawDurationSec: this.getDrawDurationSec(),
      playerToken: token
    });
    localStorage.setItem(TOKEN_KEY, data.playerToken);
    localStorage.setItem(CODE_KEY, data.code);
    localStorage.setItem(PLAYER_ID_KEY, data.playerId);
    localStorage.setItem(NICK_KEY, this.getNickname());
    await this.net.connect();
    this.setStatus(t("sketch_chain.in_room", "In room {code}", { code: data.code }), false);
    if (self.onGuidePhase) self.onGuidePhase("invite_wait");
    if (this.onInRoom) this.onInRoom();
  };

  SketchChainLobby.prototype.joinRoom = async function () {
    var code = this.els.joinCode && this.els.joinCode.value.trim();
    if (!code) {
      this.setStatus(t("sketch_chain.need_code", "Enter a room code"), true);
      return;
    }
    this.setStatus(t("sketch_chain.connecting", "Connecting…"), false);
    var token = localStorage.getItem(TOKEN_KEY);
    var data = await this.net.joinRoom({
      code: code,
      name: this.getNickname(),
      playerToken: token
    });
    localStorage.setItem(TOKEN_KEY, data.playerToken);
    localStorage.setItem(CODE_KEY, data.code);
    localStorage.setItem(PLAYER_ID_KEY, data.playerId);
    localStorage.setItem(NICK_KEY, this.getNickname());
    await this.net.connect();
    this.setStatus(t("sketch_chain.in_room", "In room {code}", { code: data.code }), false);
    if (this.onGuidePhase) this.onGuidePhase("invite_wait");
    if (this.onInRoom) this.onInRoom();
  };

  SketchChainLobby.prototype.tryRestoreSession = async function () {
    var token = localStorage.getItem(TOKEN_KEY);
    var code = localStorage.getItem(CODE_KEY);
    if (!token || !code) return false;
    if (this.els.joinCode) this.els.joinCode.value = code;
    this.setStatus(t("sketch_chain.reconnecting", "Reconnecting…"), false);
    try {
      var data = await this.net.joinRoom({
        code: code,
        name: this.getNickname(),
        playerToken: token
      });
      localStorage.setItem(TOKEN_KEY, data.playerToken);
      localStorage.setItem(CODE_KEY, data.code);
      localStorage.setItem(PLAYER_ID_KEY, data.playerId);
      await this.net.connect();
      if (data.room) this.applyRoom(data.room);
      this.setStatus(t("sketch_chain.in_room", "In room {code}", { code: data.code }), false);
      if (this.onInRoom) this.onInRoom();
      return true;
    } catch (err) {
      localStorage.removeItem(CODE_KEY);
      localStorage.removeItem(PLAYER_ID_KEY);
      this.setStatus(err.message || "reconnect_failed", true);
      return false;
    }
  };

  SketchChainLobby.prototype.copyShareLink = function () {
    var self = this;
    var code = this.room && this.room.code;
    if (!code) return;
    var share = location.origin + "/games/sketch-chain/?room=" + encodeURIComponent(code);
    if (navigator.clipboard) navigator.clipboard.writeText(share).catch(function () {});
    if (this.els.copyBtn) {
      var old = this.els.copyBtn.textContent;
      this.els.copyBtn.textContent = t("sketch_chain.copied", "Copied!");
      setTimeout(function () {
        if (self.els.copyBtn) self.els.copyBtn.textContent = old;
      }, 1200);
    }
  };

  SketchChainLobby.prototype.applyRoom = function (room) {
    this.room = room;
    if (!room) return;

    if (this.els.roomCode) this.els.roomCode.textContent = room.code || "----";
    if (this.els.playerCount) this.els.playerCount.textContent = String((room.players || []).length);
    if (this.els.ruleRoundCount) {
      this.els.ruleRoundCount.textContent = String((room.players || []).length);
    }

    var isHost = room.hostId === this.net.playerId;
    if (this.els.startBtn) {
      this.els.startBtn.hidden = !isHost || room.status !== "lobby";
      this.els.startBtn.disabled = (room.players || []).length < 2;
    }
    if (this.els.drawRange) {
      this.els.drawRange.disabled = !isHost;
      if (room.drawDurationSec) this.els.drawRange.value = String(room.drawDurationSec);
    }
    this.updateDrawDurationLabel();

    if (this.els.lobbyPlayers) {
      var html = "";
      var me = this.net.playerId;
      (room.players || []).forEach(function (p) {
        var you = p.id === me;
        html +=
          "<li class=\"player-row\">" +
          "<div class=\"avatar\" style=\"background:" +
          (p.color || "#8854D0") +
          "22;\">" +
          (p.avatar || "🐼") +
          "</div>" +
          "<span class=\"name\">" +
          p.name +
          "</span>" +
          (you ? "<span class=\"tag-you\">" + t("sketch_chain.you_tag", "(you)") + "</span>" : "") +
          "</li>";
      });
      this.els.lobbyPlayers.innerHTML = html;
    }

    if (room.code) {
      this.setStatus(t("sketch_chain.in_room", "In room {code}", { code: room.code }), false);
    }

    if (room.status === "lobby" && isHost && (room.players || []).length >= MIN_PLAYERS_TO_START) {
      if (this.onGuidePhase) this.onGuidePhase("lobby_ready");
    }
  };

  global.SketchChainLobby = SketchChainLobby;
  global.SketchChainLobbyKeys = {
    NICK_KEY: NICK_KEY,
    TOKEN_KEY: TOKEN_KEY,
    CODE_KEY: CODE_KEY,
    PLAYER_ID_KEY: PLAYER_ID_KEY
  };
})(window);
