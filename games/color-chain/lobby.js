/**
 * Color Chain lobby — quick play / invite / join.
 */
(function (global) {
  "use strict";

  var NICK_KEY = "ws_color_chain_nick";
  var TOKEN_KEY = "ws_color_chain_token";
  var CODE_KEY = "ws_color_chain_code";

  function t(key, fallback) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      var v = global.WhiteStudioI18n.t(key);
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

  function ColorChainLobby(els, net) {
    this.els = els;
    this.net = net;
    this.room = null;
    this.mode = "entry"; // entry | invite | join
    this.quickPending = false;
    this.onPhase = null;
  }

  ColorChainLobby.prototype.bind = function () {
    var self = this;
    this.restoreNick();

    if (this.els.quickPlayBtn) {
      this.els.quickPlayBtn.addEventListener("click", function () {
        self.quickPlay().catch(function (err) {
          self.setStatus(err.message || "error");
        });
      });
    }
    if (this.els.inviteBtn) {
      this.els.inviteBtn.addEventListener("click", function () {
        self.showSecondary("invite");
        if (self.onPhase) self.onPhase("invite_settings");
      });
    }
    if (this.els.inviteCreateBtn) {
      this.els.inviteCreateBtn.addEventListener("click", function () {
        self.invite().catch(function (err) {
          self.setStatus(err.message || "error");
        });
      });
    }
    if (this.els.showJoinBtn) {
      this.els.showJoinBtn.addEventListener("click", function () {
        self.showSecondary("join");
        if (self.onPhase) self.onPhase("join_prompt");
      });
    }
    if (this.els.joinBtn) {
      this.els.joinBtn.addEventListener("click", function () {
        self.join().catch(function (err) {
          self.setStatus(err.message || "error");
        });
      });
    }
    if (this.els.startBtn) {
      this.els.startBtn.addEventListener("click", function () {
        self.net.send({ type: "game:start" });
      });
    }
    if (this.els.copyBtn) {
      this.els.copyBtn.addEventListener("click", function () {
        self.copyShareLink();
      });
    }

    var maxSel = this.els.maxPlayers;
    var botsChk = this.els.fillBots;
    function pushConfig() {
      if (!self.room || self.room.phase !== "lobby") return;
      self.net.send({
        type: "room:configure",
        maxPlayers: Number(maxSel && maxSel.value) || 2,
        fillBots: !!(botsChk && botsChk.checked)
      });
    }
    if (maxSel) maxSel.addEventListener("change", pushConfig);
    if (botsChk) botsChk.addEventListener("change", pushConfig);

    if (this.els.nameInput) {
      this.els.nameInput.addEventListener("change", function () {
        var v = self.els.nameInput.value.trim();
        if (v) localStorage.setItem(NICK_KEY, v);
      });
    }

    var params = new URLSearchParams(location.search);
    var roomQ = params.get("room");
    if (roomQ) {
      if (this.els.codeInput) this.els.codeInput.value = String(roomQ).toUpperCase();
      this.showSecondary("join");
    }
  };

  ColorChainLobby.prototype.restoreNick = function () {
    var saved = localStorage.getItem(NICK_KEY) || "";
    if (this.els.nameInput && saved) this.els.nameInput.value = saved;
  };

  ColorChainLobby.prototype.showSecondary = function (mode) {
    this.mode = mode;
    if (this.els.secondaryPanel) this.els.secondaryPanel.hidden = false;
    if (this.els.joinFields) this.els.joinFields.hidden = mode !== "join";
    if (this.els.inviteFields) this.els.inviteFields.hidden = mode !== "invite";
  };

  ColorChainLobby.prototype.setStatus = function (text) {
    if (this.els.status) this.els.status.textContent = text || "";
  };

  ColorChainLobby.prototype.nickname = function () {
    var input = this.els.nameInput;
    var v = input && input.value ? input.value.trim() : "";
    if (!v) {
      v = guestName();
      if (input) input.value = v;
    }
    localStorage.setItem(NICK_KEY, v);
    return v;
  };

  ColorChainLobby.prototype.quickPlay = async function () {
    this.quickPending = true;
    this.mode = "quick";
    this.setStatus(t("color_chain.connecting", "Connecting…"));
    if (this.els.fillBots) this.els.fillBots.checked = true;
    if (this.els.maxPlayers) this.els.maxPlayers.value = "2";
    var data = await this.net.createRoom({
      name: this.nickname(),
      maxPlayers: 2,
      fillBots: true,
      playerToken: localStorage.getItem(TOKEN_KEY) || undefined
    });
    localStorage.setItem(TOKEN_KEY, data.playerToken);
    localStorage.setItem(CODE_KEY, data.code);
    await this.net.connect();
    this.showWaiting(data, { autoStart: true });
    this.net.send({ type: "game:start" });
    this.quickPending = false;
  };

  ColorChainLobby.prototype.invite = async function () {
    this.quickPending = false;
    this.mode = "invite";
    this.setStatus(t("color_chain.connecting", "Connecting…"));
    var data = await this.net.createRoom({
      name: this.nickname(),
      maxPlayers: Number(this.els.maxPlayers && this.els.maxPlayers.value) || 2,
      fillBots: !!(this.els.fillBots && this.els.fillBots.checked),
      playerToken: localStorage.getItem(TOKEN_KEY) || undefined
    });
    localStorage.setItem(TOKEN_KEY, data.playerToken);
    localStorage.setItem(CODE_KEY, data.code);
    await this.net.connect();
    this.showWaiting(data, { autoStart: false });
    if (this.onPhase) this.onPhase("invite_wait");
  };

  ColorChainLobby.prototype.join = async function () {
    this.quickPending = false;
    this.mode = "join";
    this.setStatus(t("color_chain.connecting", "Connecting…"));
    var code = (this.els.codeInput && this.els.codeInput.value) || "";
    var data = await this.net.joinRoom({
      code: code,
      name: this.nickname(),
      playerToken: localStorage.getItem(TOKEN_KEY) || undefined
    });
    localStorage.setItem(TOKEN_KEY, data.playerToken);
    localStorage.setItem(CODE_KEY, data.code);
    await this.net.connect();
    this.showWaiting(data, { autoStart: false });
    if (this.onPhase) this.onPhase("invite_wait");
  };

  ColorChainLobby.prototype.tryRestoreSession = async function () {
    var token = localStorage.getItem(TOKEN_KEY);
    var code = localStorage.getItem(CODE_KEY);
    if (!token || !code) return false;
    if (this.els.codeInput) this.els.codeInput.value = code;
    this.setStatus(t("color_chain.reconnecting", "Reconnecting…"));
    try {
      var data = await this.net.joinRoom({
        code: code,
        name: this.nickname(),
        playerToken: token
      });
      localStorage.setItem(TOKEN_KEY, data.playerToken);
      localStorage.setItem(CODE_KEY, data.code);
      await this.net.connect();
      this.showWaiting(data, { autoStart: false });
      if (this.onPhase) this.onPhase("invite_wait");
      return true;
    } catch (err) {
      localStorage.removeItem(CODE_KEY);
      this.setStatus(err.message || "reconnect_failed");
      return false;
    }
  };

  ColorChainLobby.prototype.showWaiting = function (data, opts) {
    opts = opts || {};
    this.room = data.room;
    if (this.els.setupPanel) this.els.setupPanel.hidden = true;
    if (this.els.waitPanel) this.els.waitPanel.hidden = !!opts.autoStart;
    this.renderRoom(data.room);
    var share = location.origin + "/games/color-chain/?room=" + encodeURIComponent(data.code);
    if (this.els.shareLink) this.els.shareLink.textContent = share;
    if (this.els.roomCode) this.els.roomCode.textContent = data.code;
    this.setStatus(
      opts.autoStart
        ? t("color_chain.connecting", "Connecting…")
        : t("color_chain.in_room", "In room {code}").replace("{code}", data.code)
    );
    if (!opts.autoStart && (this.mode === "invite" || this.mode === "join") && this.onPhase) {
      this.onPhase("invite_wait");
    }
  };

  ColorChainLobby.prototype.copyShareLink = function () {
    var share = this.els.shareLink ? this.els.shareLink.textContent : "";
    if (!share) return;
    var self = this;
    function done() {
      self.setStatus(t("color_chain.copied", "Link copied"));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(share).then(done).catch(function () {
        window.prompt(t("color_chain.copy_link", "Copy link"), share);
      });
    } else {
      window.prompt(t("color_chain.copy_link", "Copy link"), share);
      done();
    }
  };

  ColorChainLobby.prototype.renderRoom = function (room) {
    this.room = room;
    var list = this.els.seatList;
    if (!list) return;
    list.innerHTML = "";
    (room.seats || []).forEach(function (s) {
      var li = document.createElement("li");
      li.textContent =
        s.name +
        (s.id === room.hostId ? " ★" : "") +
        (s.isBot ? " (AI)" : "") +
        (s.connected === false ? " · offline" : "");
      list.appendChild(li);
    });
    var isHost = this.net.playerId === room.hostId;
    var showStart = isHost && room.phase === "lobby" && this.mode !== "quick";
    if (this.els.startBtn) this.els.startBtn.hidden = !showStart;
    if (this.els.hostControls) this.els.hostControls.hidden = !isHost || room.phase !== "lobby";
  };

  global.ColorChainLobby = ColorChainLobby;
})(window);
