/**
 * Sketch Chain WebSocket + REST client.
 */
(function (global) {
  "use strict";

  function SketchChainNet() {
    this._client = global.WsRoomClient.create("sketch-chain");
    this.ws = null;
    this.playerId = null;
    this.playerToken = null;
    this.code = null;
    this.handlers = {};
    this._closedByUser = false;
  }

  SketchChainNet.prototype.on = function (type, fn) {
    this._client.on(type, fn);
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  };

  SketchChainNet.prototype.emit = function (type, data) {
    this._client.emit(type, data);
  };

  SketchChainNet.prototype._syncFromClient = function () {
    this.ws = this._client.ws;
    this.playerId = this._client.playerId;
    this.playerToken = this._client.playerToken;
    this.code = this._client.code;
  };

  SketchChainNet.prototype.createRoom = async function (opts) {
    var data = await this._client.createRoom({
      name: opts.name,
      drawDurationSec: opts.drawDurationSec,
      playerToken: opts.playerToken || undefined
    });
    this._syncFromClient();
    return data;
  };

  SketchChainNet.prototype.joinRoom = async function (opts) {
    var data = await this._client.joinRoom({
      code: opts.code,
      name: opts.name,
      playerToken: opts.playerToken || undefined
    });
    this._syncFromClient();
    return data;
  };

  SketchChainNet.prototype.connect = function () {
    var self = this;
    this._closedByUser = false;
    return this._client
      .connect({
        onOpen: function () {
          self._client.send({ type: "room:rejoin" });
        }
      })
      .then(function () {
        self._syncFromClient();
      });
  };

  SketchChainNet.prototype.send = function (payload) {
    return this._client.send(payload);
  };

  SketchChainNet.prototype.disconnect = function () {
    this._closedByUser = true;
    this._client.disconnect();
    this.ws = null;
  };

  global.SketchChainNet = SketchChainNet;
})(window);
