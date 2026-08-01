/**
 * Color Chain lobby UI bindings.
 */
(function (global) {
  "use strict";

  function t(key, fallback) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      var v = global.WhiteStudioI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function ColorChainLobby(els, net) {
    this.els = els;
    this.net = net;
    this.room = null;
  }

  ColorChainLobby.prototype.bind = function () {
    var self = this;
    var createBtn = this.els.createBtn;
    var joinBtn = this.els.joinBtn;
    var startBtn = this.els.startBtn;
    if (createBtn) {
      createBtn.addEventListener("click", function () {
        self.create().catch(function (err) {
          self.setStatus(err.message || "error");
        });
      });
    }
    if (joinBtn) {
      joinBtn.addEventListener("click", function () {
        self.join().catch(function (err) {
          self.setStatus(err.message || "error");
        });
      });
    }
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        self.net.send({ type: "game:start" });
      });
    }
    var maxSel = this.els.maxPlayers;
    var botsChk = this.els.fillBots;
    function pushConfig() {
      if (!self.room) return;
      self.net.send({
        type: "room:configure",
        maxPlayers: Number(maxSel && maxSel.value) || 2,
        fillBots: !!(botsChk && botsChk.checked)
      });
    }
    if (maxSel) maxSel.addEventListener("change", pushConfig);
    if (botsChk) botsChk.addEventListener("change", pushConfig);

    // Deep link ?room=CODE
    var params = new URLSearchParams(location.search);
    var roomQ = params.get("room");
    if (roomQ && this.els.codeInput) this.els.codeInput.value = roomQ;
  };

  ColorChainLobby.prototype.setStatus = function (text) {
    if (this.els.status) this.els.status.textContent = text || "";
  };

  ColorChainLobby.prototype.nickname = function () {
    var input = this.els.nameInput;
    var v = input && input.value ? input.value.trim() : "";
    return v || "Player";
  };

  ColorChainLobby.prototype.create = async function () {
    this.setStatus(t("color_chain.connecting", "Connecting…"));
    var data = await this.net.createRoom({
      name: this.nickname(),
      maxPlayers: Number(this.els.maxPlayers && this.els.maxPlayers.value) || 2,
      fillBots: !!(this.els.fillBots && this.els.fillBots.checked),
      playerToken: localStorage.getItem("ws_color_chain_token") || undefined
    });
    localStorage.setItem("ws_color_chain_token", data.playerToken);
    localStorage.setItem("ws_color_chain_code", data.code);
    await this.net.connect();
    this.showWaiting(data);
  };

  ColorChainLobby.prototype.join = async function () {
    this.setStatus(t("color_chain.connecting", "Connecting…"));
    var code = (this.els.codeInput && this.els.codeInput.value) || "";
    var data = await this.net.joinRoom({
      code: code,
      name: this.nickname(),
      playerToken: localStorage.getItem("ws_color_chain_token") || undefined
    });
    localStorage.setItem("ws_color_chain_token", data.playerToken);
    localStorage.setItem("ws_color_chain_code", data.code);
    await this.net.connect();
    this.showWaiting(data);
  };

  ColorChainLobby.prototype.showWaiting = function (data) {
    this.room = data.room;
    if (this.els.setupPanel) this.els.setupPanel.hidden = true;
    if (this.els.waitPanel) this.els.waitPanel.hidden = false;
    this.renderRoom(data.room);
    var share = location.origin + location.pathname + "?room=" + encodeURIComponent(data.code);
    if (this.els.shareLink) this.els.shareLink.textContent = share;
    if (this.els.roomCode) this.els.roomCode.textContent = data.code;
    this.setStatus(t("color_chain.in_room", "In room {code}").replace("{code}", data.code));
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
    if (this.els.startBtn) this.els.startBtn.hidden = !isHost || room.phase !== "lobby";
    if (this.els.hostControls) this.els.hostControls.hidden = !isHost || room.phase !== "lobby";
  };

  global.ColorChainLobby = ColorChainLobby;
})(window);
