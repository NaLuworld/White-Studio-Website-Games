(function () {
  var canvas = document.getElementById("game-canvas");
  var overlay = document.getElementById("game-overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var overlayBody = document.getElementById("overlay-body");
  var startButton = document.getElementById("start-button");
  var scoreEl = document.getElementById("live-score");
  var bestEl = document.getElementById("best-score");
  var submitScoreEl = document.getElementById("submit-score-value");

  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  var COLS = 17;
  var ROWS = 17;
  var POINTS_PER_FOOD = 10;
  var BASE_STEP_MS = 160;
  var MIN_STEP_MS = 70;

  var running = false;
  var raf = 0;
  var score = 0;
  var best = 0;
  var snake = [];
  var dir = { x: 1, y: 0 };
  var pendingDir = { x: 1, y: 0 };
  var food = { x: 8, y: 8 };
  var lastStepTs = 0;
  var accum = 0;

  try {
    best = Number(localStorage.getItem("ws-snake-best") || 0) || 0;
  } catch (_) {}
  bestEl.textContent = String(best);

  function t(key, vars) {
    if (window.WhiteStudioI18n && typeof window.WhiteStudioI18n.t === "function") {
      return window.WhiteStudioI18n.t(key, vars);
    }
    return key;
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
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
    scoreEl.textContent = "0";
    submitScoreEl.textContent = "0";
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

  function showOverlay(title, body, buttonLabel) {
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    startButton.textContent = buttonLabel || t("snake.start");
  }

  function showStartOverlay() {
    showOverlay(t("snake.overlay_title"), t("snake.overlay_body"), t("snake.start"));
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      try {
        localStorage.setItem("ws-snake-best", String(best));
      } catch (_) {}
    }
    submitScoreEl.textContent = String(score);
    showOverlay(
      t("snake.overlay_go"),
      t("snake.overlay_go_body", { score: String(score) }),
      t("snake.again")
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
      scoreEl.textContent = String(score);
      submitScoreEl.textContent = String(score);
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
    if (!running) return;
    if (!lastStepTs) lastStepTs = ts;
    var dt = Math.min(48, ts - lastStepTs);
    lastStepTs = ts;
    accum += dt;

    var interval = stepMs();
    while (accum >= interval && running) {
      accum -= interval;
      if (!step()) break;
    }

    draw(canvas.clientWidth, canvas.clientHeight);
    if (running) raf = requestAnimationFrame(tick);
  }

  function start() {
    resetGame();
    hideOverlay();
    running = true;
    lastStepTs = 0;
    accum = 0;
    raf = requestAnimationFrame(tick);
  }

  startButton.addEventListener("click", start);

  window.addEventListener("keydown", function (event) {
    var key = event.key;
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
      }
    }
  });

  var touchStartX = 0;
  var touchStartY = 0;
  canvas.addEventListener(
    "touchstart",
    function (event) {
      if (!event.changedTouches[0]) return;
      touchStartX = event.changedTouches[0].clientX;
      touchStartY = event.changedTouches[0].clientY;
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    function (event) {
      if (!event.changedTouches[0]) return;
      var dx = event.changedTouches[0].clientX - touchStartX;
      var dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        setDirection(dx > 0 ? 1 : -1, 0);
      } else {
        setDirection(0, dy > 0 ? 1 : -1);
      }
    },
    { passive: true }
  );

  window.addEventListener("resize", function () {
    resize();
    draw(canvas.clientWidth, canvas.clientHeight);
  });

  if (window.WhiteStudioI18n && window.WhiteStudioI18n.onChange) {
    window.WhiteStudioI18n.onChange(function () {
      if (!running && !overlay.hidden) {
        if (score > 0) {
          showOverlay(
            t("snake.overlay_go"),
            t("snake.overlay_go_body", { score: String(score) }),
            t("snake.again")
          );
        } else {
          showStartOverlay();
        }
      }
    });
  }

  resize();
  resetGame();
  draw(canvas.clientWidth, canvas.clientHeight);
  // Initial overlay copy comes from HTML data-i18n; bootChrome applyAll fills locale.
})();
