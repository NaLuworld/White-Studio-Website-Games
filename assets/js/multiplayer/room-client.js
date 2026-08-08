/**
 * Shared multiplayer room transport helpers for White Studio party games.
 */
(function (global) {
  "use strict";

  var ROOMS_PROTOCOL_VERSION = 1;
  var RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
  var FATAL_ERROR_CODES = {
    ROOM_NOT_FOUND: true,
    room_not_found: true,
    unauthorized: true,
    invalid_token: true,
    do_quota_exceeded: true
  };

  function roomsOrigin() {
    var params = new URLSearchParams(location.search);
    var stagingRooms = params.get("rooms");
    if (stagingRooms) return stagingRooms.replace(/\/+$/, "");
    var roomsMeta = document.querySelector('meta[name="ws-rooms-origin"]');
    if (roomsMeta && roomsMeta.content) return roomsMeta.content.replace(/\/+$/, "");
    var apiMeta = document.querySelector('meta[name="ws-api-origin"]');
    if (apiMeta && apiMeta.content) return apiMeta.content.replace(/\/+$/, "");
    return "https://rooms.white-studio.org";
  }

  function wsOriginFromHttp(httpOrigin) {
    return httpOrigin.replace(/^http/, "ws");
  }

  function parseJsonResponse(json) {
    if (!json || json.ok === false) {
      var code = (json && json.error && json.error.code) || "request_failed";
      var message = (json && json.error && json.error.message) || code;
      var err = new Error(message);
      err.code = code;
      throw err;
    }
    return json.data;
  }

  function jitterMs(base) {
    return Math.floor(base + Math.random() * Math.min(250, base * 0.2));
  }

  function createRoomClient(gameId) {
    return {
      gameId: gameId,
      ws: null,
      playerId: null,
      playerToken: null,
      code: null,
      lastSeq: 0,
      handlers: {},
      _closedByUser: false,
      _reconnectTimer: null,
      _reconnectAttempt: 0,
      _fatalError: false,
      _connectGeneration: 0,
      _onlineHandler: null,
      _connecting: false,

      on: function (type, fn) {
        if (!this.handlers[type]) this.handlers[type] = [];
        this.handlers[type].push(fn);
      },

      emit: function (type, data) {
        var list = this.handlers[type] || [];
        for (var i = 0; i < list.length; i++) list[i](data);
      },

      apiOrigin: function () {
        return roomsOrigin();
      },

      createRoom: async function (body) {
        var res = await fetch(this.apiOrigin() + "/api/games/" + this.gameId + "/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {})
        });
        var json = await res.json().catch(function () {
          return { ok: false, error: { code: "bad_response", message: "bad_response" } };
        });
        var data = parseJsonResponse(json);
        this.playerId = data.playerId;
        this.playerToken = data.playerToken;
        this.code = data.code;
        if (data.seq != null) this.lastSeq = data.seq;
        return data;
      },

      joinRoom: async function (opts) {
        var code = String((opts && opts.code) || "")
          .trim()
          .toUpperCase();
        var res = await fetch(
          this.apiOrigin() + "/api/games/" + this.gameId + "/rooms/" + encodeURIComponent(code) + "/join",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: opts && opts.name,
              playerToken: (opts && opts.playerToken) || undefined
            })
          }
        );
        var json = await res.json().catch(function () {
          return { ok: false, error: { code: "bad_response", message: "bad_response" } };
        });
        var data = parseJsonResponse(json);
        this.playerId = data.playerId;
        this.playerToken = data.playerToken;
        this.code = data.code;
        if (data.seq != null) this.lastSeq = data.seq;
        return data;
      },

      _detachSocketHandlers: function (ws) {
        if (!ws) return;
        ws.onopen = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.onmessage = null;
      },

      _closeSocketQuietly: function () {
        var prev = this.ws;
        this.ws = null;
        this._connecting = false;
        if (!prev) return;
        this._detachSocketHandlers(prev);
        try {
          if (prev.readyState === WebSocket.CONNECTING || prev.readyState === WebSocket.OPEN) {
            prev.close(1000, "replaced");
          }
        } catch (_) {}
      },

      _bindOnlineResume: function (opts) {
        var self = this;
        if (typeof window === "undefined" || this._onlineHandler) return;
        this._onlineHandler = function () {
          if (self._closedByUser || self._fatalError) return;
          if (!self.code || !self.playerId || !self.playerToken) return;
          if (self.ws && (self.ws.readyState === WebSocket.OPEN || self.ws.readyState === WebSocket.CONNECTING)) {
            return;
          }
          self._scheduleReconnect(opts, true);
        };
        window.addEventListener("online", this._onlineHandler);
      },

      connect: function (opts) {
        var self = this;
        opts = opts || {};
        if (!this.code || !this.playerId || !this.playerToken) {
          return Promise.reject(new Error("missing_session"));
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          this._bindOnlineResume(opts);
          return Promise.reject(new Error("offline"));
        }
        // Enforce single CONNECTING/OPEN socket.
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          return Promise.resolve();
        }
        if (this._connecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
          return Promise.resolve();
        }

        this._closedByUser = false;
        this._closeSocketQuietly();
        this._bindOnlineResume(opts);
        this._connecting = true;
        var generation = ++this._connectGeneration;

        return new Promise(function (resolve, reject) {
          var url =
            wsOriginFromHttp(self.apiOrigin()) +
            "/api/games/" +
            self.gameId +
            "/rooms/" +
            encodeURIComponent(self.code) +
            "/ws?playerId=" +
            encodeURIComponent(self.playerId) +
            "&token=" +
            encodeURIComponent(self.playerToken);
          var ws = new WebSocket(url);
          self.ws = ws;

          ws.onopen = function () {
            if (generation !== self._connectGeneration) return;
            self._connecting = false;
            self._reconnectAttempt = 0;
            self.emit("open");
            self.send({
              type: "session:hello",
              protocolVersion: ROOMS_PROTOCOL_VERSION
            });
            if (typeof opts.onOpen === "function") opts.onOpen();
            resolve();
          };
          ws.onerror = function () {
            if (generation !== self._connectGeneration) return;
            self._connecting = false;
            reject(new Error("ws_error"));
          };
          ws.onclose = function () {
            if (generation !== self._connectGeneration) return;
            self._connecting = false;
            if (self.ws === ws) self.ws = null;
            self.emit("close");
            if (!self._closedByUser && !self._fatalError) self._scheduleReconnect(opts);
          };
          ws.onmessage = function (ev) {
            if (generation !== self._connectGeneration) return;
            var msg;
            try {
              msg = JSON.parse(ev.data);
            } catch (_) {
              return;
            }
            if (msg && typeof msg.seq === "number") self.lastSeq = msg.seq;
            if (msg && msg.type === "error") {
              var errCode = (msg.error && msg.error.code) || msg.error || "error";
              if (FATAL_ERROR_CODES[errCode]) {
                self._fatalError = true;
                self.emit("fatal", msg);
              }
            }
            self.emit("message", msg);
            if (msg && msg.type) self.emit(msg.type, msg);
          };
        });
      },

      _scheduleReconnect: function (opts, immediate) {
        var self = this;
        if (this._reconnectTimer || this._fatalError || this._closedByUser) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          this._bindOnlineResume(opts);
          return;
        }
        var idx = Math.min(this._reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1);
        var delay = immediate ? 0 : jitterMs(RECONNECT_BACKOFF_MS[idx]);
        this._reconnectAttempt += 1;
        this._reconnectTimer = setTimeout(function () {
          self._reconnectTimer = null;
          if (self._closedByUser || self._fatalError) return;
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            self._bindOnlineResume(opts);
            return;
          }
          self.connect(opts).catch(function () {
            self._scheduleReconnect(opts);
          });
        }, delay);
      },

      send: function (payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        if (payload && typeof payload === "object" && !payload.actionId) {
          // Optional client actionId for DO idempotency (Color Chain).
          if (String(payload.type || "").indexOf("action:") === 0 && global.crypto && crypto.randomUUID) {
            payload = Object.assign({}, payload, { actionId: crypto.randomUUID() });
          }
        }
        this.ws.send(JSON.stringify(payload));
        return true;
      },

      disconnect: function () {
        this._closedByUser = true;
        this._connectGeneration += 1;
        if (this._reconnectTimer) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }
        if (this._onlineHandler && typeof window !== "undefined") {
          window.removeEventListener("online", this._onlineHandler);
          this._onlineHandler = null;
        }
        this._closeSocketQuietly();
      }
    };
  }

  global.WsRoomClient = {
    create: createRoomClient,
    roomsOrigin: roomsOrigin,
    PROTOCOL_VERSION: ROOMS_PROTOCOL_VERSION,
    RECONNECT_BACKOFF_MS: RECONNECT_BACKOFF_MS
  };
})(window);
