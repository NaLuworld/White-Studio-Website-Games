/**
 * Color Chain DOM renderer — server state + play/draw feedback animations.
 */
(function (global) {
  "use strict";

  var SYMBOL = { skip: "⦸", reverse: "⇄", draw2: "+2", wild: "", wild4: "+4" };
  var RING = { red: "#e5493d", yellow: "#f2b134", green: "#3fa34d", blue: "#2f7fd1" };
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    if (!c) return "";
    if (c.type === "num") return String(c.value);
    return SYMBOL[c.type] != null ? SYMBOL[c.type] : "";
  }

  function cardShort(c) {
    if (!c) return "";
    if (c.type === "wild") return t("color_chain.fx_wild", "Wild");
    if (c.type === "wild4") return "+4";
    if (c.type === "draw2") return "+2";
    if (c.type === "skip") return t("color_chain.fx_skip", "Skip");
    if (c.type === "reverse") return t("color_chain.fx_reverse", "Reverse");
    var color = t("color_chain.color_" + c.color, c.color);
    return color + " " + String(c.value);
  }

  function renderCard(c, opts) {
    opts = opts || {};
    var div = document.createElement("div");
    div.className = "cc-card" + (opts.mini ? " cc-card--mini" : "") + (opts.faceDown ? " cc-card--back" : "");
    if (opts.animClass) div.classList.add(opts.animClass);
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
    this.prev = null;
    this._toastTimer = null;
  }

  ColorChainRender.prototype.showToast = function (text) {
    var toast = document.getElementById("cc-fx-toast");
    if (!toast || !text) return;
    toast.hidden = false;
    toast.textContent = text;
    toast.classList.remove("is-show");
    void toast.offsetWidth;
    toast.classList.add("is-show");
    if (this._toastTimer) clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function () {
      toast.classList.remove("is-show");
      toast.hidden = true;
    }, 1600);
  };

  ColorChainRender.prototype.pulseDiscard = function (card) {
    var discard = this.root.querySelector("#cc-discard");
    if (!discard || !card) return;
    var el = discard.querySelector(".cc-card");
    if (!el) return;
    el.classList.remove("cc-card--land");
    void el.offsetWidth;
    el.classList.add("cc-card--land");
  };

  ColorChainRender.prototype.spawnFlyToDiscard = function (card) {
    if (reduceMotion || !card) {
      this.pulseDiscard(card);
      return;
    }
    var layer = document.getElementById("cc-fx-layer");
    var discard = this.root.querySelector("#cc-discard");
    if (!layer || !discard) {
      this.pulseDiscard(card);
      return;
    }
    var fly = renderCard(card, { animClass: "cc-card--fly" });
    layer.appendChild(fly);
    var rect = discard.getBoundingClientRect();
    var rootRect = this.root.getBoundingClientRect();
    fly.style.left = Math.max(12, rootRect.width / 2 - 32) + "px";
    fly.style.top = Math.max(40, rootRect.height * 0.55) + "px";
    requestAnimationFrame(function () {
      fly.style.left = rect.left - rootRect.left + "px";
      fly.style.top = rect.top - rootRect.top + "px";
      fly.classList.add("is-flying");
    });
    setTimeout(function () {
      if (fly.parentNode) fly.parentNode.removeChild(fly);
    }, 420);
  };

  ColorChainRender.prototype.diffAndAnimate = function (state) {
    var prev = this.prev;
    if (!prev || prev.phase !== "playing" || state.phase !== "playing") return;

    var prevIds = {};
    (prev.myHand || []).forEach(function (c) {
      prevIds[c.id] = true;
    });
    var nextIds = {};
    var gained = [];
    (state.myHand || []).forEach(function (c) {
      nextIds[c.id] = true;
      if (!prevIds[c.id]) gained.push(c);
    });
    var lost = [];
    (prev.myHand || []).forEach(function (c) {
      if (!nextIds[c.id]) lost.push(c);
    });

    var prevTop = prev.topDiscard && prev.topDiscard.id;
    var nextTop = state.topDiscard && state.topDiscard.id;
    var topChanged = prevTop !== nextTop && !!state.topDiscard;

    if (lost.length === 1 && topChanged && state.topDiscard.id === lost[0].id) {
      this._pendingFly = state.topDiscard;
      this._pendingLand = true;
      this.showToast(
        t("color_chain.fx_you_played", "You played {card}").replace("{card}", cardShort(state.topDiscard))
      );
    } else if (topChanged && lost.length === 0) {
      this._pendingLand = true;
      this.showToast(
        t("color_chain.fx_played", "Played {card}").replace("{card}", cardShort(state.topDiscard))
      );
    } else {
      this._pendingFly = null;
      this._pendingLand = false;
    }

    if (gained.length > 0) {
      this._pendingDrawnIds = gained.map(function (c) {
        return c.id;
      });
      if (gained.length === 1) {
        this.showToast(
          t("color_chain.fx_you_drew_one", "You drew {card}").replace("{card}", cardShort(gained[0]))
        );
      } else {
        this.showToast(
          t("color_chain.fx_you_drew_n", "You drew {n} cards").replace("{n}", String(gained.length))
        );
      }
    } else {
      this._pendingDrawnIds = null;
    }
  };

  ColorChainRender.prototype.apply = function (state) {
    if (!state || state.type !== "game:state") return;

    this.diffAndAnimate(state);

    this.state = state;
    this.root.dataset.skin = resolveVisual("table.felt");
    this.root.hidden = false;

    var status = this.root.querySelector("#cc-status");
    var msg = this.root.querySelector("#cc-table-msg");
    var discard = this.root.querySelector("#cc-discard");
    var drawCount = this.root.querySelector("#cc-draw-count");
    var colorRing = this.root.querySelector("#cc-color-ring");
    var myHand = this.root.querySelector("#cc-my-hand");
    var oppRow = this.root.querySelector("#cc-opponents");
    var drawBtn = document.getElementById("cc-draw-btn");
    var lastBtn = document.getElementById("cc-last-btn");
    var catchBtn = document.getElementById("cc-catch-btn");
    var challengeBtn = document.getElementById("cc-challenge-btn");

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
      if (state.topDiscard) {
        var discCard = renderCard(state.topDiscard);
        discard.appendChild(discCard);
      }
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
      var prevOpp = {};
      if (this.prev && this.prev.seats) {
        this.prev.seats.forEach(function (s) {
          prevOpp[s.index] = s.handCount;
        });
      }
      (state.seats || []).forEach(function (seat) {
        if (seat.index === state.viewerSeat) return;
        var zone = document.createElement("div");
        var grew = prevOpp[seat.index] != null && seat.handCount > prevOpp[seat.index];
        zone.className =
          "cc-opp" +
          (seat.isTurn ? " cc-opp--turn" : "") +
          (!seat.connected ? " cc-opp--away" : "") +
          (grew ? " cc-opp--drew" : "");
        var label = document.createElement("div");
        label.className = "cc-opp__label";
        label.textContent = seat.name + (seat.isBot ? " · AI" : "") + " · " + seat.handCount;
        if (grew) {
          var badge = document.createElement("span");
          badge.className = "cc-opp__badge";
          badge.textContent = "+" + (seat.handCount - prevOpp[seat.index]);
          label.appendChild(badge);
        }
        var hand = document.createElement("div");
        hand.className = "cc-hand cc-hand--opp";
        var n = Math.min(seat.handCount, 12);
        for (var i = 0; i < n; i++) {
          hand.appendChild(
            renderCard(null, {
              mini: true,
              faceDown: true,
              animClass: grew && i >= n - Math.min(4, seat.handCount - prevOpp[seat.index]) ? "cc-card--drawn" : ""
            })
          );
        }
        zone.appendChild(label);
        zone.appendChild(hand);
        oppRow.appendChild(zone);
      });
    }

    var playable = {};
    (state.playableCardIds || []).forEach(function (id) {
      playable[id] = true;
    });
    var drawnSet = {};
    (this._pendingDrawnIds || []).forEach(function (id) {
      drawnSet[id] = true;
    });
    var self = this;
    if (myHand) {
      myHand.innerHTML = "";
      (state.myHand || []).forEach(function (c) {
        var el = renderCard(c, {
          playable: !!playable[c.id],
          animClass: drawnSet[c.id] ? "cc-card--drawn" : ""
        });
        el.addEventListener("click", function () {
          if (playable[c.id] && self.hooks.onPlayCard) self.hooks.onPlayCard(c.id);
        });
        myHand.appendChild(el);
      });
    }
    this._pendingDrawnIds = null;

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

    if (this._pendingFly) {
      this.spawnFlyToDiscard(this._pendingFly);
      this._pendingFly = null;
    }
    if (this._pendingLand) {
      var selfLand = this;
      requestAnimationFrame(function () {
        selfLand.pulseDiscard(state.topDiscard);
      });
      this._pendingLand = false;
    }

    this.prev = {
      phase: state.phase,
      topDiscard: state.topDiscard ? { id: state.topDiscard.id, color: state.topDiscard.color, type: state.topDiscard.type, value: state.topDiscard.value } : null,
      myHand: (state.myHand || []).map(function (c) {
        return { id: c.id, color: c.color, type: c.type, value: c.value };
      }),
      seats: (state.seats || []).map(function (s) {
        return { index: s.index, handCount: s.handCount };
      })
    };
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
