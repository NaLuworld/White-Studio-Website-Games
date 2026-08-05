/**
 * Sketch Chain reveal — server-synced auto-play chat thread.
 */
(function (global) {
  "use strict";

  var SPLASH_MS = 5000;
  var IMAGE_DELAY_MS = 3000;
  var GROUP_HOLD_MS = 4000;

  function t(key, fallback, vars) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      var v = global.WhiteStudioI18n.t(key, vars);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function SketchChainReveal(els) {
    this.els = els;
    this.sequence = [];
    this.revealIndex = 0;
    this.revealTimer = null;
    this.playersByChain = [];
    this.onReplay = null;
    this.onShowEnd = null;
  }

  SketchChainReveal.prototype.start = function (payload) {
    this.sequence = payload.sequence || [];
    this.revealIndex = 0;
    this.playersByChain = payload.chainOwners || [];
    var startedAt = payload.revealStartedAt || Date.now();
    this._startedAt = startedAt;
    if (this.els.chainTitle) this.els.chainTitle.textContent = "";
    this.showScreen();
    this.scheduleFromServer(startedAt);
  };

  SketchChainReveal.prototype.showScreen = function () {
    var app = document.getElementById("sketch-chain-app");
    if (!app) return;
    app.querySelectorAll(".screen").forEach(function (s) {
      s.classList.remove("active");
    });
    var screen = document.getElementById("screen-reveal");
    if (screen) screen.classList.add("active");
    app.classList.remove("lock-scroll");
    document.body.classList.add("is-sc-playing");
  };

  SketchChainReveal.prototype.scheduleFromServer = function (startedAt) {
    var self = this;
    if (this.revealTimer) clearTimeout(this.revealTimer);

    function walk() {
      if (self.revealIndex >= self.sequence.length) {
        self.renderEnd();
        return;
      }
      var step = self.sequence[self.revealIndex];
      var stepAt = step.revealAt != null ? step.revealAt : startedAt;
      var delay = Math.max(0, stepAt - Date.now());
      self.revealTimer = setTimeout(function () {
        self.playStep(step);
        self.revealIndex++;
        walk();
      }, delay);
    }
    walk();
  };

  SketchChainReveal.prototype.playStep = function (step) {
    if (this.els.stepCount) {
      this.els.stepCount.textContent =
        String(this.revealIndex + 1) + " / " + String(this.sequence.length);
    }

    if (step.type === "splash") {
      if (this.els.chainTitle) this.els.chainTitle.textContent = "";
      if (this.els.revealStage) {
        this.els.revealStage.innerHTML =
          "<div class=\"reveal-splash\"><div class=\"brush-title\">" +
          t("sketch_chain.reveal_splash", "Get ready!") +
          "</div></div>";
      }
      this.restartProgressBar(SPLASH_MS);
      return;
    }

    if (step.type === "group") {
      if (step.isFirstOfChain) {
        var ownerName =
          step.ownerName ||
          (this.playersByChain[step.chainIndex] && this.playersByChain[step.chainIndex].name) ||
          "";
        if (this.els.chainTitle) {
          this.els.chainTitle.textContent =
            "📖 " + t("sketch_chain.chain_title", "{name}'s chain", { name: ownerName });
        }
        if (this.els.revealStage) this.els.revealStage.innerHTML = "";
      }
      var entries = step.entries || [];
      if (entries[0]) this.appendBubble(entries[0], step.startIndex || 0);
      if (entries.length > 1) {
        setTimeout(
          function () {
            this.appendBubble(entries[1], (step.startIndex || 0) + 1);
          }.bind(this),
          IMAGE_DELAY_MS
        );
      }
      this.restartProgressBar(IMAGE_DELAY_MS + GROUP_HOLD_MS);
    }
  };

  SketchChainReveal.prototype.appendBubble = function (entry, entryIndex) {
    if (!this.els.revealStage) return;
    var isText = entry.type === "text";
    var row = document.createElement("div");
    row.className = "chat-row " + (isText ? "right" : "left");
    var imgSrc = entry.imageUrl || entry.dataURL || "";
    var bubbleHtml = isText
      ? "<div class=\"text-bubble\">" + escapeHtml(entry.text || "") + "</div>"
      : "<img class=\"image-bubble\" src=\"" + escapeHtml(imgSrc) + "\" alt=\"drawing\">";
    var icon = entryIndex === 0 ? "✍️" : entry.type === "image" ? "🎨" : "🔍";
    row.innerHTML =
      "<div class=\"chat-col\">" +
      "<div class=\"chat-author\">" +
      icon +
      " " +
      escapeHtml(entry.authorName || entry.author || "") +
      "</div>" +
      bubbleHtml +
      "</div>";
    this.els.revealStage.appendChild(row);
    this.els.revealStage.scrollTop = this.els.revealStage.scrollHeight;
  };

  SketchChainReveal.prototype.restartProgressBar = function (duration) {
    if (!this.els.revealProgress) return;
    var bar = this.els.revealProgress;
    bar.style.transition = "none";
    bar.style.width = "0%";
    void bar.offsetWidth;
    bar.style.transition = "width " + duration + "ms linear";
    bar.style.width = "100%";
  };

  SketchChainReveal.prototype.renderEnd = function () {
    if (this.els.stepCount) this.els.stepCount.textContent = t("sketch_chain.reveal_done", "Done");
    if (this.els.revealProgress) this.els.revealProgress.style.width = "100%";
    if (this.els.chainTitle) this.els.chainTitle.textContent = "";
    if (this.els.revealStage) {
      this.els.revealStage.innerHTML =
        "<div class=\"reveal-end\">" +
        "<div class=\"brush-title\" style=\"font-size:36px;\">" +
        t("sketch_chain.reveal_all_done", "All chains revealed!") +
        "</div>" +
        "<button type=\"button\" class=\"btn green\" id=\"reveal-replay-btn\">" +
        t("sketch_chain.play_again", "Play again") +
        "</button></div>";
      var btn = document.getElementById("reveal-replay-btn");
      if (btn) {
        var self = this;
        btn.addEventListener("click", function () {
          if (self.onReplay) self.onReplay();
        });
      }
    }
    if (this.onShowEnd) this.onShowEnd();
  };

  SketchChainReveal.prototype.destroy = function () {
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.revealTimer = null;
  };

  global.SketchChainReveal = SketchChainReveal;
  global.SketchChainRevealTiming = {
    SPLASH_MS: SPLASH_MS,
    IMAGE_DELAY_MS: IMAGE_DELAY_MS,
    GROUP_HOLD_MS: GROUP_HOLD_MS
  };
})(window);
