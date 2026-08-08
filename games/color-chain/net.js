/**
 * Color Chain WebSocket + REST client.
 */
(function (global) {
  "use strict";

  function ColorChainNet() {
    this._client = global.WsRoomClient.create("color-chain");
    this.ws = null;
    this.playerId = null;
    this.playerToken = null;
    this.code = null;
    this.handlers = {};
    this._closedByUser = false;
  }

  ColorChainNet.prototype.on = function (type, fn) {
    this._client.on(type, fn);
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  };

  ColorChainNet.prototype.emit = function (type, data) {
    this._client.emit(type, data);
  };

  ColorChainNet.prototype._syncFromClient = function () {
    this.ws = this._client.ws;
    this.playerId = this._client.playerId;
    this.playerToken = this._client.playerToken;
    this.code = this._client.code;
  };

  ColorChainNet.prototype.createRoom = async function (opts) {
    var data = await this._client.createRoom({
      name: opts.name,
      maxPlayers: opts.maxPlayers,
      fillBots: opts.fillBots,
      playerToken: opts.playerToken || undefined
    });
    this._syncFromClient();
    return data;
  };

  ColorChainNet.prototype.joinRoom = async function (opts) {
    var data = await this._client.joinRoom({
      code: opts.code,
      name: opts.name,
      playerToken: opts.playerToken || undefined
    });
    this._syncFromClient();
    return data;
  };

  ColorChainNet.prototype.connect = function () {
    var self = this;
    this._closedByUser = false;
    return this._client.connect().then(function () {
      self._syncFromClient();
    });
  };

  ColorChainNet.prototype.send = function (payload) {
    return this._client.send(payload);
  };

  ColorChainNet.prototype.disconnect = function () {
    this._closedByUser = true;
    this._client.disconnect();
    this.ws = null;
  };

  global.ColorChainNet = ColorChainNet;
})(window);
