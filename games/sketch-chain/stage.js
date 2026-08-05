/**
 * Sketch Chain stage — write / draw / guess + canvas.
 */
(function (global) {
  "use strict";

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

  function SketchChainStage(els) {
    this.els = els;
    this.submitFn = null;
    this.timerHandle = null;
    this.timeLeft = 0;
    this.canvas = null;
    this.ctx = null;
    this.drawing = false;
    this.currentColor = "#1B1F3B";
    this.currentSize = 4;
    this.strokes = [];
    this.currentStroke = null;
    this.onSubmit = null;
    this._resizeBound = false;
  }

  SketchChainStage.prototype.showScreen = function (id) {
    var app = document.getElementById("sketch-chain-app");
    if (!app) return;
    app.querySelectorAll(".screen").forEach(function (s) {
      s.classList.remove("active");
    });
    var screen = document.getElementById(id);
    if (screen) screen.classList.add("active");
    app.classList.toggle("lock-scroll", id === "screen-stage");
  };

  SketchChainStage.prototype.enterRound = function (payload) {
    var roundNow = payload.roundNow || 0;
    var roundTotal = payload.roundTotal || 1;
    var stageType = payload.stageType || "write";
    var labels = {
      write: t("sketch_chain.stage_write", "✍️ Write prompt"),
      draw: t("sketch_chain.stage_draw", "🎨 Draw"),
      guess: t("sketch_chain.stage_guess", "🔍 Guess")
    };
    if (this.els.stageLabel) this.els.stageLabel.textContent = labels[stageType] || stageType;
    if (this.els.progressFill) {
      this.els.progressFill.style.width = Math.round((roundNow / roundTotal) * 100) + "%";
    }
    this.renderBody(stageType, payload.prompt);
    this.startDeadlineTimer(payload.deadlineAt);
    this.showScreen("screen-stage");
    document.body.classList.add("is-sc-playing");
  };

  SketchChainStage.prototype.renderBody = function (type, prompt) {
    var self = this;
    var body = this.els.stageBody;
    if (!body) return;
    this.submitFn = null;

    if (type === "write") {
      body.innerHTML =
        "<div class=\"text-stage\">" +
        "<div class=\"prompt-card card\"><div class=\"label\">" +
        t("sketch_chain.write_label", "Write a prompt") +
        "</div><div class=\"word\">" +
        t("sketch_chain.write_hint", "Others will draw this!") +
        "</div></div>" +
        "<textarea id=\"stage-input\" maxlength=\"40\" placeholder=\"" +
        escapeHtml(t("sketch_chain.write_ph", "e.g. A flying cat astronaut…")) +
        "\"></textarea>" +
        "<div class=\"char-count\"><span id=\"char-count\">0</span>/40</div>" +
        "</div>" +
        "<div class=\"stage-footer\"><button type=\"button\" class=\"btn green\" id=\"submit-btn\">" +
        t("sketch_chain.submit_write", "Submit prompt →") +
        "</button></div>";
      var ta = document.getElementById("stage-input");
      ta.addEventListener("input", function () {
        var cc = document.getElementById("char-count");
        if (cc) cc.textContent = String(ta.value.length);
      });
      this.submitFn = function () {
        var val = ta.value.trim() || t("sketch_chain.empty_write", "(no prompt — guess freely!)");
        self.fireSubmit({ type: "text", text: val });
      };
    } else if (type === "draw") {
      var word = prompt && prompt.text ? escapeHtml(prompt.text) : "…";
      body.innerHTML =
        "<div class=\"draw-stage\">" +
        "<div class=\"prompt-card card\"><div class=\"label\">" +
        t("sketch_chain.draw_label", "Draw this") +
        "</div><div class=\"word\">" +
        word +
        "</div></div>" +
        "<div class=\"canvas-wrap\" id=\"canvas-wrap\"><canvas id=\"board\"></canvas></div>" +
        "<div class=\"toolbar\">" +
        "<fieldset class=\"pens\" id=\"pen-colors\" style=\"border:none;padding:0;display:flex;gap:7px;\">" +
        "<div class=\"pen active\" data-color=\"#1B1F3B\" style=\"background:#1B1F3B;\"></div>" +
        "<div class=\"pen\" data-color=\"#FF5A5F\" style=\"background:#FF5A5F;\"></div>" +
        "<div class=\"pen\" data-color=\"#2D7DD2\" style=\"background:#2D7DD2;\"></div>" +
        "<div class=\"pen\" data-color=\"#FFC93C\" style=\"background:#FFC93C;\"></div>" +
        "<div class=\"pen\" data-color=\"#3BB273\" style=\"background:#3BB273;\"></div>" +
        "<div class=\"pen\" data-color=\"#8854D0\" style=\"background:#8854D0;\"></div>" +
        "<div class=\"pen\" data-color=\"#FFFFFF\" style=\"background:#FFFFFF;\" title=\"eraser\"></div>" +
        "</fieldset>" +
        "<fieldset class=\"sizes\" id=\"pen-sizes\" style=\"border:none;padding:0;display:flex;gap:7px;align-items:center;\">" +
        "<div class=\"size-dot active\" data-size=\"4\" style=\"width:9px;height:9px;\"></div>" +
        "<div class=\"size-dot\" data-size=\"9\" style=\"width:15px;height:15px;\"></div>" +
        "<div class=\"size-dot\" data-size=\"16\" style=\"width:21px;height:21px;\"></div>" +
        "</fieldset>" +
        "<div class=\"tools-right\">" +
        "<button type=\"button\" class=\"btn ghost sm\" id=\"undo-btn\">" +
        t("sketch_chain.undo", "↩ Undo") +
        "</button>" +
        "<button type=\"button\" class=\"btn ghost sm\" id=\"clear-btn\">" +
        t("sketch_chain.clear", "🗑 Clear") +
        "</button>" +
        "</div></div></div>" +
        "<div class=\"stage-footer\"><button type=\"button\" class=\"btn green\" id=\"submit-btn\">" +
        t("sketch_chain.submit_draw", "Done →") +
        "</button></div>";
      this.setupCanvas();
      this.submitFn = function () {
        self.fireSubmit({ type: "image", dataURL: self.exportCanvas() });
      };
    } else {
      var imgSrc = prompt && (prompt.imageUrl || prompt.dataURL) ? prompt.imageUrl || prompt.dataURL : "";
      body.innerHTML =
        "<div class=\"text-stage\">" +
        "<div class=\"prompt-card card\">" +
        "<div class=\"label\">" +
        t("sketch_chain.guess_label", "What is this drawing?") +
        "</div>" +
        (imgSrc ? "<img src=\"" + escapeHtml(imgSrc) + "\" alt=\"drawing\">" : "") +
        "</div>" +
        "<textarea id=\"stage-input\" maxlength=\"40\" placeholder=\"" +
        escapeHtml(t("sketch_chain.guess_ph", "Your guess…")) +
        "\"></textarea>" +
        "<div class=\"char-count\"><span id=\"char-count\">0</span>/40</div>" +
        "</div>" +
        "<div class=\"stage-footer\"><button type=\"button\" class=\"btn green\" id=\"submit-btn\">" +
        t("sketch_chain.submit_guess", "Submit guess →") +
        "</button></div>";
      var taG = document.getElementById("stage-input");
      taG.addEventListener("input", function () {
        var cc = document.getElementById("char-count");
        if (cc) cc.textContent = String(taG.value.length);
      });
      this.submitFn = function () {
        var val = taG.value.trim() || t("sketch_chain.empty_guess", "(I can't tell QQ)");
        self.fireSubmit({ type: "text", text: val });
      };
    }

    var btn = document.getElementById("submit-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        if (self.submitFn) self.submitFn();
      });
    }
  };

  SketchChainStage.prototype.fireSubmit = function (content) {
    if (this.onSubmit) this.onSubmit(content);
    this.showWaitingOverlay(true);
  };

  SketchChainStage.prototype.showWaitingOverlay = function (show) {
    if (this.els.waitingOverlay) this.els.waitingOverlay.classList.toggle("show", show);
  };

  SketchChainStage.prototype.updateSubmitProgress = function (submitted, total) {
    if (!this.els.waitingOverlay) return;
    var text = this.els.waitingOverlay.querySelector(".waiting-text");
    if (text) {
      text.textContent = t("sketch_chain.waiting_progress", "{n}/{total} finished this round", {
        n: submitted,
        total: total
      });
    }
  };

  SketchChainStage.prototype.startDeadlineTimer = function (deadlineAt) {
    var self = this;
    if (this.timerHandle) clearInterval(this.timerHandle);
    function tick() {
      var left = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      self.timeLeft = left;
      self.updateTimerDisplay();
      if (left <= 0) {
        clearInterval(self.timerHandle);
        if (self.submitFn) self.submitFn();
      }
    }
    tick();
    this.timerHandle = setInterval(tick, 250);
  };

  SketchChainStage.prototype.updateTimerDisplay = function () {
    if (!this.els.timer) return;
    var m = Math.floor(this.timeLeft / 60)
      .toString()
      .padStart(2, "0");
    var s = (this.timeLeft % 60).toString().padStart(2, "0");
    this.els.timer.textContent = m + ":" + s;
    this.els.timer.classList.toggle("low", this.timeLeft <= 10);
  };

  SketchChainStage.prototype.clearTimer = function () {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
  };

  SketchChainStage.prototype.setupCanvas = function () {
    var self = this;
    this.canvas = document.getElementById("board");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.strokes = [];
    this.currentStroke = null;
    this.drawing = false;
    this.currentColor = "#1B1F3B";
    this.currentSize = 4;

    document.querySelectorAll("#pen-colors .pen").forEach(function (pen) {
      pen.addEventListener("click", function () {
        document.querySelectorAll("#pen-colors .pen").forEach(function (p) {
          p.classList.remove("active");
        });
        pen.classList.add("active");
        self.currentColor = pen.dataset.color;
      });
    });
    document.querySelectorAll("#pen-sizes .size-dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        document.querySelectorAll("#pen-sizes .size-dot").forEach(function (d) {
          d.classList.remove("active");
        });
        dot.classList.add("active");
        self.currentSize = parseInt(dot.dataset.size, 10);
      });
    });
    var clearBtn = document.getElementById("clear-btn");
    var undoBtn = document.getElementById("undo-btn");
    if (clearBtn) clearBtn.addEventListener("click", function () {
      self.strokes = [];
      self.redraw();
    });
    if (undoBtn) undoBtn.addEventListener("click", function () {
      self.strokes.pop();
      self.redraw();
    });

    this.resizeCanvas();
    if (!this._resizeBound) {
      window.addEventListener("resize", function () {
        self.resizeCanvas();
      });
      this._resizeBound = true;
    }

    this.canvas.addEventListener(
      "pointerdown",
      function (e) {
        e.preventDefault();
        self.canvas.setPointerCapture(e.pointerId);
        self.drawing = true;
        var pos = self.getPos(e);
        self.currentStroke = { color: self.currentColor, size: self.currentSize, points: [pos] };
        self.strokes.push(self.currentStroke);
        self.redraw();
      },
      { passive: false }
    );
    this.canvas.addEventListener(
      "pointermove",
      function (e) {
        if (!self.drawing) return;
        e.preventDefault();
        var pos = self.getPos(e);
        self.currentStroke.points.push(pos);
        self.redraw();
      },
      { passive: false }
    );
    function endStroke(e) {
      if (e) e.preventDefault();
      self.drawing = false;
      self.currentStroke = null;
    }
    this.canvas.addEventListener("pointerup", endStroke, { passive: false });
    this.canvas.addEventListener("pointercancel", endStroke, { passive: false });
    this.canvas.addEventListener("pointerleave", function () {
      if (self.drawing) self.drawing = false;
    });
  };

  SketchChainStage.prototype.resizeCanvas = function () {
    if (!this.canvas) return;
    var wrap = document.getElementById("canvas-wrap");
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var ratio = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * ratio;
    this.canvas.height = rect.height * ratio;
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.redraw();
  };

  SketchChainStage.prototype.redraw = function () {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes.forEach(function (stroke) {
      if (stroke.points.length < 1) return;
      this.ctx.lineJoin = "round";
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.size;
      this.ctx.beginPath();
      stroke.points.forEach(function (pt, i) {
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      }, this);
      this.ctx.stroke();
    }, this);
  };

  SketchChainStage.prototype.getPos = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  SketchChainStage.prototype.exportCanvas = function () {
    if (!this.canvas) return "";
    var maxW = 800;
    var src = this.canvas;
    var w = src.width;
    var h = src.height;
    if (!w || !h) return src.toDataURL("image/jpeg", 0.7);
    var scale = w > maxW ? maxW / w : 1;
    var outW = Math.max(1, Math.round(w * scale));
    var outH = Math.max(1, Math.round(h * scale));
    var tmp = document.createElement("canvas");
    tmp.width = outW;
    tmp.height = outH;
    var g = tmp.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, outW, outH);
    g.drawImage(src, 0, 0, outW, outH);
    return tmp.toDataURL("image/jpeg", 0.7);
  };

  global.SketchChainStage = SketchChainStage;
})(window);
