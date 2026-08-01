(function () {
  var canvas = document.getElementById("game-canvas");
  var overlay = document.getElementById("game-overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var overlayBody = document.getElementById("overlay-body");
  var overlayActions = document.getElementById("overlay-actions");
  var startButton = document.getElementById("start-button");
  var scoreEl = document.getElementById("live-score");
  var playScoreEl = document.getElementById("play-score");
  var bestEl = document.getElementById("best-score");
  var submitScoreEl = document.getElementById("submit-score-value");
  var pauseButton = document.getElementById("pause-button");
  var backButton = document.getElementById("back-button");
  var touchPad = document.getElementById("touch-pad");
  var resultSheet = document.getElementById("result-sheet");
  var resultBody = document.getElementById("result-body");
  var againButton = document.getElementById("again-button");
  var viewBoardButton = document.getElementById("view-board-button");
  var boardPanel = document.querySelector(".leaderboard-panel");
  var page = document.body;

  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  var COLS = 17;
  var ROWS = 17;
  var POINTS_PER_FOOD = 10;
  var BASE_STEP_MS = 160;
  var MIN_STEP_MS = 70;
  var SWIPE_THRESHOLD = 22;

  var running = false;
  var paused = false;
  var raf = 0;
  var score = 0;
  var best = 0;
  var snake = [];
  var dir = { x: 1, y: 0 };
  var pendingDir = { x: 1, y: 0 };
  var food = { x: 8, y: 8 };
  var lastStepTs = 0;
  var accum = 0;
  var pointerId = null;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var pointerMoved = false;
  var leaveArmed = false;

  try {
    best = Number(localStorage.getItem("ws-snake-best") || 0) || 0;
  } catch (_) {}
  if (bestEl) bestEl.textContent = String(best);

  function t(key, vars) {
    if (window.WhiteStudioI18n && typeof window.WhiteStudioI18n.t === "function") {
      return window.WhiteStudioI18n.t(key, vars);
    }
    return key;
  }

  function setScoreDisplay(value) {
    var text = String(value);
    if (scoreEl) scoreEl.textContent = text;
    if (playScoreEl) playScoreEl.textContent = text;
    if (submitScoreEl) submitScoreEl.textContent = text;
  }

  function setMode(mode) {
    page.classList.remove("is-playing", "is-result", "is-paused");
    if (mode === "playing") page.classList.add("is-playing");
    if (mode === "result") page.classList.add("is-result");
    if (mode === "paused") {
      page.classList.add("is-playing");
      page.classList.add("is-paused");
    }
    if (touchPad) touchPad.setAttribute("aria-hidden", mode === "playing" || mode === "paused" ? "false" : "true");
    if (resultSheet) {
      resultSheet.hidden = mode !== "result";
    }
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(1, Math.floor(rect.width));
    var height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellSize(width, height) {
    return Math.floor(Math.min(width / COLS, height / ROWS));
  }

  function boardOrigin(width, height, size) {
    return {
      x: Math.floor((width - size * COLS) / 2),
      y: Math.floor((height - size * ROWS) / 2)
    };
  }

  function resetGame() {
    var midX = Math.floor(COLS / 2);
    var midY = Math.floor(ROWS / 2);
    snake = [
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
      { x: midX - 3, y: midY }
    ];
    dir = { x: 1, y: 0 };
    pendingDir = { x: 1, y: 0 };
    score = 0;
    lastStepTs = 0;
    accum = 0;
    placeFood();
    setScoreDisplay(0);
  }

  function placeFood() {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) {
      occupied[snake[i].x + "," + snake[i].y] = true;
    }
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!occupied[x + "," + y]) free.push({ x: x, y: y });
      }
    }
    if (!free.length) {
      food = { x: -1, y: -1 };
      return;
    }
    food = free[Math.floor(Math.random() * free.length)];
  }

  function stepMs() {
    var level = Math.floor(score / POINTS_PER_FOOD);
    return Math.max(MIN_STEP_MS, BASE_STEP_MS - level * 6);
  }

  function clearOverlayActions() {
    if (!overlayActions) return;
    overlayActions.innerHTML = "";
  }

  function addOverlayButton(label, className, onClick, primary) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ws-button " + (primary ? "ws-button--primary" : "ws-button--ghost");
    if (className) button.className += " " + className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    overlayActions.appendChild(button);
    return button;
  }

  function showOverlay(title, body, buildActions) {
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    clearOverlayActions();
    if (typeof buildActions === "function") buildActions();
    var firstBtn = overlayActions && overlayActions.querySelector("button");
    if (firstBtn) {
      window.setTimeout(function () {
        try {
          firstBtn.focus();
        } catch (_) {}
      }, 0);
    }
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function showStartOverlay() {
    setMode("idle");
    showOverlay(t("snake.overlay_title"), t("snake.overlay_body"), function () {
      addOverlayButton(t("snake.start"), "js-start", start, true);
    });
  }

  function showPauseOverlay() {
    setMode("paused");
    showOverlay(t("snake.paused_title"), t("snake.paused_body"), function () {
      addOverlayButton(t("snake.resume"), "js-resume", resume, true);
      addOverlayButton(t("snake.leave_quit"), "js-leave", requestLeave, false);
    });
    if (pauseButton) pauseButton.textContent = t("snake.resume");
  }

  function showLeaveConfirm() {
    showOverlay(t("snake.leave_confirm"), t("snake.leave_confirm"), function () {
      addOverlayButton(t("snake.leave_stay"), "js-stay", resume, true);
      addOverlayButton(t("snake.leave_quit"), "js-quit", function () {
        window.location.href = "/";
      }, false);
    });
  }

  function endGame() {
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    if (score > best) {
      best = score;
      if (bestEl) bestEl.textContent = String(best);
      try {
        localStorage.setItem("ws-snake-best", String(best));
      } catch (_) {}
    }
    setScoreDisplay(score);
    setMode("result");
    if (resultBody) {
      resultBody.textContent = t("snake.result_body", { score: String(score) });
    }
    showOverlay(
      t("snake.overlay_go"),
      t("snake.overlay_go_body", { score: String(score) }),
      function () {
        addOverlayButton(t("snake.again"), "js-again", start, true);
        addOverlayButton(t("snake.submit_score"), "js-submit-focus", function () {
          hideOverlay();
          if (resultSheet) {
            try {
              resultSheet.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (_) {}
            var input = document.getElementById("player-name");
            if (input) input.focus();
          }
        }, false);
      }
    );
  }

  function setDirection(nx, ny) {
    if (!running) return;
    if (nx === -dir.x && ny === -dir.y) return;
    if (nx === 0 && ny === 0) return;
    pendingDir = { x: nx, y: ny };
  }

  function step() {
    dir = pendingDir;
    var head = snake[0];
    var next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      endGame();
      return false;
    }

    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === next.x && snake[i].y === next.y) {
        endGame();
        return false;
      }
    }

    snake.unshift(next);

    if (next.x === food.x && next.y === food.y) {
      score += POINTS_PER_FOOD;
      setScoreDisplay(score);
      placeFood();
      if (food.x < 0) {
        endGame();
        return false;
      }
    } else {
      snake.pop();
    }

    return true;
  }

  function draw(width, height) {
    var size = cellSize(width, height);
    var origin = boardOrigin(width, height, size);
    var pad = Math.max(1, Math.floor(size * 0.08));

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(origin.x, origin.y, size * COLS, size * ROWS);

    ctx.strokeStyle = "rgba(180,109,255,0.12)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(origin.x + gx * size + 0.5, origin.y);
      ctx.lineTo(origin.x + gx * size + 0.5, origin.y + ROWS * size);
      ctx.stroke();
    }
    for (var gy = 0; gy <= ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y + gy * size + 0.5);
      ctx.lineTo(origin.x + COLS * size, origin.y + gy * size + 0.5);
      ctx.stroke();
    }

    if (food.x >= 0) {
      var fx = origin.x + food.x * size + pad;
      var fy = origin.y + food.y * size + pad;
      var fs = size - pad * 2;
      var grad = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs);
      grad.addColorStop(0, "#c084ff");
      grad.addColorStop(1, "#8a2be2");
      ctx.fillStyle = grad;
      ctx.fillRect(fx, fy, fs, fs);
    }

    for (var i = 0; i < snake.length; i++) {
      var seg = snake[i];
      var sx = origin.x + seg.x * size + pad;
      var sy = origin.y + seg.y * size + pad;
      var ss = size - pad * 2;
      if (i === 0) {
        ctx.fillStyle = "#f4f3fb";
      } else {
        var tSeg = i / Math.max(1, snake.length - 1);
        ctx.fillStyle = "rgba(180,109,255," + (0.95 - tSeg * 0.35).toFixed(2) + ")";
      }
      ctx.fillRect(sx, sy, ss, ss);
    }
  }

  function tick(ts) {
    if (!running || paused) return;
    if (!lastStepTs) lastStepTs = ts;
    var dt = Math.min(48, ts - lastStepTs);
    lastStepTs = ts;
    accum += dt;

    var interval = stepMs();
    while (accum >= interval && running && !paused) {
      accum -= interval;
      if (!step()) break;
    }

    draw(canvas.clientWidth, canvas.clientHeight);
    if (running && !paused) raf = requestAnimationFrame(tick);
  }

  function start() {
    resetGame();
    hideOverlay();
    running = true;
    paused = false;
    leaveArmed = true;
    lastStepTs = 0;
    accum = 0;
    setMode("playing");
    if (pauseButton) pauseButton.textContent = t("snake.pause");
    try {
      canvas.focus({ preventScroll: true });
    } catch (_) {
      try {
        canvas.focus();
      } catch (__) {}
    }
    raf = requestAnimationFrame(tick);
  }

  function pause(options) {
    options = options || {};
    if (!running || paused) return;
    paused = true;
    cancelAnimationFrame(raf);
    accum = 0;
    lastStepTs = 0;
    if (!options.silent) showPauseOverlay();
    else setMode("paused");
  }

  function resume() {
    if (!running) {
      start();
      return;
    }
    paused = false;
    hideOverlay();
    setMode("playing");
    if (pauseButton) pauseButton.textContent = t("snake.pause");
    lastStepTs = 0;
    accum = 0;
    raf = requestAnimationFrame(tick);
  }

  function requestLeave() {
    if (!running) {
      window.location.href = "/";
      return;
    }
    if (!paused) pause({ silent: true });
    showLeaveConfirm();
  }

  function applySwipe(dx, dy) {
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerMoved = false;
    try {
      canvas.setPointerCapture(pointerId);
    } catch (_) {}
  }

  function onPointerMove(event) {
    if (pointerId !== event.pointerId) return;
    var dx = event.clientX - pointerStartX;
    var dy = event.clientY - pointerStartY;
    if (!pointerMoved && (Math.abs(dx) >= SWIPE_THRESHOLD || Math.abs(dy) >= SWIPE_THRESHOLD)) {
      pointerMoved = true;
      applySwipe(dx, dy);
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    } else if (pointerMoved && (Math.abs(dx) >= SWIPE_THRESHOLD || Math.abs(dy) >= SWIPE_THRESHOLD)) {
      applySwipe(dx, dy);
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    }
    if (running && !paused && event.cancelable) event.preventDefault();
  }

  function onPointerUp(event) {
    if (pointerId !== event.pointerId) return;
    if (!pointerMoved) {
      var dx = event.clientX - pointerStartX;
      var dy = event.clientY - pointerStartY;
      applySwipe(dx, dy);
    }
    pointerId = null;
    pointerMoved = false;
  }

  function bindTouchPad() {
    if (!touchPad) return;
    var buttons = touchPad.querySelectorAll("[data-dir]");
    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        var dirName = button.getAttribute("data-dir");
        function press(event) {
          if (event) event.preventDefault();
          button.classList.add("is-pressed");
          if (dirName === "up") setDirection(0, -1);
          else if (dirName === "down") setDirection(0, 1);
          else if (dirName === "left") setDirection(-1, 0);
          else if (dirName === "right") setDirection(1, 0);
        }
        function release() {
          button.classList.remove("is-pressed");
        }
        button.addEventListener("pointerdown", press);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("pointerleave", release);
      })(buttons[i]);
    }
  }

  if (startButton) {
    startButton.addEventListener("click", start);
  }
  if (pauseButton) {
    pauseButton.addEventListener("click", function () {
      if (paused) resume();
      else pause();
    });
  }
  if (backButton) {
    backButton.addEventListener("click", function (event) {
      event.preventDefault();
      requestLeave();
    });
  }
  if (againButton) {
    againButton.addEventListener("click", start);
  }
  if (viewBoardButton && boardPanel) {
    viewBoardButton.addEventListener("click", function () {
      try {
        boardPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {}
    });
  }

  bindTouchPad();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  window.addEventListener("keydown", function (event) {
    var key = event.key;
    if (key === "Escape" && running) {
      event.preventDefault();
      if (paused) resume();
      else pause();
      return;
    }
    if (key === "ArrowUp" || key === "w" || key === "W") {
      event.preventDefault();
      setDirection(0, -1);
    } else if (key === "ArrowDown" || key === "s" || key === "S") {
      event.preventDefault();
      setDirection(0, 1);
    } else if (key === "ArrowLeft" || key === "a" || key === "A") {
      event.preventDefault();
      setDirection(-1, 0);
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      event.preventDefault();
      setDirection(1, 0);
    } else if (key === " " || key === "Enter") {
      if (!running) {
        event.preventDefault();
        start();
      } else if (paused) {
        event.preventDefault();
        resume();
      }
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running && !paused) pause();
  });

  window.addEventListener("pagehide", function () {
    if (running && !paused) pause({ silent: true });
  });

  window.addEventListener("beforeunload", function (event) {
    if (leaveArmed && running) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function handleResize() {
    resize();
    draw(canvas.clientWidth, canvas.clientHeight);
  }

  window.addEventListener("resize", handleResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
  }
  if (typeof ResizeObserver !== "undefined") {
    var stage = canvas.parentElement;
    if (stage) {
      var observer = new ResizeObserver(handleResize);
      observer.observe(stage);
    }
  }

  if (window.WhiteStudioI18n && window.WhiteStudioI18n.onChange) {
    window.WhiteStudioI18n.onChange(function () {
      if (pauseButton) {
        pauseButton.textContent = t(paused ? "snake.resume" : "snake.pause");
      }
      if (!running && !overlay.hidden) {
        if (score > 0 && page.classList.contains("is-result")) {
          endGame();
        } else if (paused) {
          showPauseOverlay();
        } else {
          showStartOverlay();
        }
      }
    });
  }

  resize();
  resetGame();
  draw(canvas.clientWidth, canvas.clientHeight);
  showStartOverlay();
})();
