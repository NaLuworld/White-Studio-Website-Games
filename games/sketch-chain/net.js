/**
 * Sketch Chain WebSocket + REST client.
 */
(function (global) {
  "use strict";

  function roomsOrigin() {
    var roomsMeta = document.querySelector('meta[name="ws-rooms-origin"]');
    if (roomsMeta && roomsMeta.content) return roomsMeta.content;
    var apiMeta = document.querySelector('meta[name="ws-api-origin"]');
    if (apiMeta && apiMeta.content) return apiMeta.content;
    return "https://rooms.white-studio.org";
  }

  function apiOrigin() {
    return roomsOrigin();
  }

  function wsOrigin() {
    var http = apiOrigin();
    return http.replace(/^http/, "ws");
  }

  function SketchChainNet() {
    this.ws = null;
    this.playerId = null;
    this.playerToken = null;
    this.code = null;
    this.handlers = {};
    this._closedByUser = false;
    this._reconnectTimer = null;
  }

  SketchChainNet.prototype.on = function (type, fn) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  };

  SketchChainNet.prototype.emit = function (type, data) {
    var list = this.handlers[type] || [];
    for (var i = 0; i < list.length; i++) list[i](data);
  };

  SketchChainNet.prototype.createRoom = async function (opts) {
    var res = await fetch(apiOrigin() + "/api/games/sketch-chain/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: opts.name,
        drawDurationSec: opts.drawDurationSec,
        playerToken: opts.playerToken || undefined
      })
    });
    var json = await res.json();
    if (!json.ok) throw new Error((json.error && json.error.message) || "create_failed");
    this.playerId = json.data.playerId;
    this.playerToken = json.data.playerToken;
    this.code = json.data.code;
    return json.data;
  };

  SketchChainNet.prototype.joinRoom = async function (opts) {
    var code = String(opts.code || "")
      .trim()
      .toUpperCase();
    var res = await fetch(
      apiOrigin() + "/api/games/sketch-chain/rooms/" + encodeURIComponent(code) + "/join",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: opts.name,
          playerToken: opts.playerToken || undefined
        })
      }
    );
    var json = await res.json();
    if (!json.ok) throw new Error((json.error && json.error.message) || "join_failed");
    this.playerId = json.data.playerId;
    this.playerToken = json.data.playerToken;
    this.code = json.data.code;
    return json.data;
  };

  SketchChainNet.prototype.connect = function () {
    var self = this;
    if (!this.code || !this.playerId || !this.playerToken) {
      return Promise.reject(new Error("missing_session"));
    }
    this._closedByUser = false;
    return new Promise(function (resolve, reject) {
      var url =
        wsOrigin() +
        "/api/games/sketch-chain/rooms/" +
        encodeURIComponent(self.code) +
        "/ws?playerId=" +
        encodeURIComponent(self.playerId) +
        "&token=" +
        encodeURIComponent(self.playerToken);
      var ws = new WebSocket(url);
      self.ws = ws;
      ws.onopen = function () {
        self.emit("open");
        self.send({ type: "room:rejoin" });
        resolve();
      };
      ws.onerror = function () {
        reject(new Error("ws_error"));
      };
      ws.onclose = function () {
        self.emit("close");
        if (!self._closedByUser) self._scheduleReconnect();
      };
      ws.onmessage = function (ev) {
        var msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        self.emit("message", msg);
        if (msg && msg.type) self.emit(msg.type, msg);
      };
    });
  };

  SketchChainNet.prototype._scheduleReconnect = function () {
    var self = this;
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(function () {
      self._reconnectTimer = null;
      self.connect().catch(function () {
        self._scheduleReconnect();
      });
    }, 1500);
  };

  SketchChainNet.prototype.send = function (payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  };

  SketchChainNet.prototype.disconnect = function () {
    this._closedByUser = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
  };

  global.SketchChainNet = SketchChainNet;
})(window);
