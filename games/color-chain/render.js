/**
 * Color Chain DOM renderer — server state only (no rule adjudication).
 */
(function (global) {
  "use strict";

  var SYMBOL = { skip: "⦸", reverse: "⇄", draw2: "+2", wild: "", wild4: "+4" };
  var RING = { red: "#e5493d", yellow: "#f2b134", green: "#3fa34d", blue: "#2f7fd1" };

  var DEFAULT_SKIN = {
    "card.face": "default",
    "card.back": "default",
    "table.felt": "default",
    "hud.frame": "default",
    "sfx.play": "synth"
  };

  function resolveVisual(nodeId, equippedSkinId) {
    void equippedSkinId;
    return DEFAULT_SKIN[nodeId] || "default";
  }

  function t(key, fallback) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      var v = global.WhiteStudioI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function cardLabel(c) {
    if (c.type === "num") return String(c.value);
    return SYMBOL[c.type] != null ? SYMBOL[c.type] : "";
  }

  function renderCard(c, opts) {
    opts = opts || {};
    var div = document.createElement("div");
    div.className = "cc-card" + (opts.mini ? " cc-card--mini" : "") + (opts.faceDown ? " cc-card--back" : "");
    div.dataset.skin = resolveVisual(opts.faceDown ? "card.back" : "card.face");
    if (!opts.faceDown && c) {
      div.classList.add("cc-card--" + c.color);
      if (opts.playable) div.classList.add("cc-card--playable");
      if (opts.match) div.classList.add("cc-card--match");
      var core = document.createElement("div");
      core.className = "cc-card__core";
      var label = cardLabel(c);
      if (c.type === "wild") {
        var dot = document.createElement("div");
        dot.className = "cc-card__symbol cc-card__symbol--wild";
        core.appendChild(dot);
      } else {
        var tl = document.createElement("div");
        tl.className = "cc-card__corner cc-card__corner--tl";
        tl.textContent = label;
        var br = document.createElement("div");
        br.className = "cc-card__corner cc-card__corner--br";
        br.textContent = label;
        var sym = document.createElement("div");
        sym.className = "cc-card__symbol";
        sym.textContent = label;
        core.appendChild(tl);
        core.appendChild(sym);
        core.appendChild(br);
      }
      div.appendChild(core);
      if (c.id != null) div.dataset.cardId = String(c.id);
    }
    return div;
  }

  function ColorChainRender(root, hooks) {
    this.root = root;
    this.hooks = hooks || {};
    this.state = null;
  }

  ColorChainRender.prototype.apply = function (state) {
    this.state = state;
    if (!state || state.type !== "game:state") return;
    this.root.dataset.skin = resolveVisual("table.felt");
    this.root.hidden = false;

    var status = this.root.querySelector("#cc-status");
    var msg = this.root.querySelector("#cc-table-msg");
    var discard = this.root.querySelector("#cc-discard");
    var drawCount = this.root.querySelector("#cc-draw-count");
    var colorRing = this.root.querySelector("#cc-color-ring");
    var myHand = this.root.querySelector("#cc-my-hand");
    var oppRow = this.root.querySelector("#cc-opponents");
    var drawBtn = this.root.querySelector("#cc-draw-btn");
    var lastBtn = this.root.querySelector("#cc-last-btn");
    var catchBtn = this.root.querySelector("#cc-catch-btn");
    var challengeBtn = this.root.querySelector("#cc-challenge-btn");

    if (status) {
      status.textContent =
        state.phase === "ended"
          ? t("color_chain.status_ended", "Match over")
          : state.viewerSeat === state.currentSeat
            ? t("color_chain.status_your_turn", "Your turn")
            : t("color_chain.status_wait", "Waiting…");
    }
    if (msg) msg.textContent = state.message || "";

    if (discard) {
      discard.innerHTML = "";
      if (state.topDiscard) discard.appendChild(renderCard(state.topDiscard));
    }
    if (colorRing) {
      colorRing.style.borderColor = state.activeColor ? RING[state.activeColor] || "transparent" : "transparent";
    }
    if (drawCount) {
      drawCount.textContent = t("color_chain.deck_count", "Deck · {n}").replace(
        "{n}",
        String(state.deckCount != null ? state.deckCount : 0)
      );
    }

    if (oppRow) {
      oppRow.innerHTML = "";
      (state.seats || []).forEach(function (seat) {
        if (seat.index === state.viewerSeat) return;
        var zone = document.createElement("div");
        zone.className = "cc-opp" + (seat.isTurn ? " cc-opp--turn" : "") + (!seat.connected ? " cc-opp--away" : "");
        var label = document.createElement("div");
        label.className = "cc-opp__label";
        label.textContent = seat.name + (seat.isBot ? " · AI" : "") + " · " + seat.handCount;
        var hand = document.createElement("div");
        hand.className = "cc-hand cc-hand--opp";
        var n = Math.min(seat.handCount, 12);
        for (var i = 0; i < n; i++) hand.appendChild(renderCard(null, { mini: true, faceDown: true }));
        zone.appendChild(label);
        zone.appendChild(hand);
        oppRow.appendChild(zone);
      });
    }

    var playable = {};
    (state.playableCardIds || []).forEach(function (id) {
      playable[id] = true;
    });
    var self = this;
    if (myHand) {
      myHand.innerHTML = "";
      (state.myHand || []).forEach(function (c) {
        var el = renderCard(c, { playable: !!playable[c.id] });
        el.addEventListener("click", function () {
          if (playable[c.id] && self.hooks.onPlayCard) self.hooks.onPlayCard(c.id);
        });
        myHand.appendChild(el);
      });
    }

    var myTurn = state.viewerSeat === state.currentSeat && state.phase === "playing" && !state.pendingReveal;
    if (drawBtn) {
      drawBtn.disabled = !myTurn || !!state.pendingWild;
      drawBtn.textContent = state.pendingDraw
        ? t("color_chain.draw_n", "Draw {n}").replace("{n}", String(state.pendingDraw.amount))
        : t("color_chain.draw", "Draw");
    }
    if (lastBtn) {
      lastBtn.hidden = !state.canCallLast;
      lastBtn.classList.toggle("is-show", !!state.canCallLast);
    }
    if (challengeBtn) {
      var canCh = !!(state.pendingDraw && state.pendingDraw.canChallenge && myTurn);
      challengeBtn.hidden = !canCh;
      challengeBtn.classList.toggle("is-show", canCh);
    }
    if (catchBtn) {
      var canCatch = (state.catchTargets || []).length > 0 && state.phase === "playing";
      catchBtn.hidden = !canCatch;
      catchBtn.classList.toggle("is-show", canCatch);
    }

    var colorModal = document.getElementById("cc-color-modal");
    if (colorModal) colorModal.classList.toggle("is-open", !!state.pendingWild);
  };

  ColorChainRender.prototype.showReveal = function (payload) {
    var modal = document.getElementById("cc-reveal-modal");
    var handEl = document.getElementById("cc-reveal-hand");
    var result = document.getElementById("cc-reveal-result");
    if (!modal || !handEl || !result) return;
    handEl.innerHTML = "";
    (payload.handSnapshot || []).forEach(function (c) {
      handEl.appendChild(
        renderCard(c, { mini: true, match: c.color === payload.requiredColor })
      );
    });
    var colorName = t("color_chain.color_" + payload.requiredColor, payload.requiredColor);
    result.textContent = payload.illegal
      ? t("color_chain.reveal_illegal", "They still had {color} — challenge succeeds.").replace(
          "{color}",
          colorName
        )
      : t("color_chain.reveal_legal", "No {color} in hand — challenge fails.").replace("{color}", colorName);
    modal.classList.add("is-open");
  };

  ColorChainRender.renderCard = renderCard;
  ColorChainRender.resolveVisual = resolveVisual;
  global.ColorChainRender = ColorChainRender;
})(window);
