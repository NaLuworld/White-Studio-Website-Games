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
  var running = false;
  var raf = 0;
  var lane = 1;
  var score = 0;
  var best = 0;
  var speed = 220;
  var obstacles = [];
  var lastTs = 0;
  var spawnTimer = 0;

  try {
    best = Number(localStorage.getItem("ws-demo-runner-best") || 0) || 0;
  } catch (_) {}
  bestEl.textContent = String(best);

  function resize() {
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetGame() {
    lane = 1;
    score = 0;
    speed = 220;
    obstacles = [];
    spawnTimer = 0;
    lastTs = 0;
    scoreEl.textContent = "0";
    submitScoreEl.textContent = "0";
  }

  function showOverlay(title, body, buttonLabel) {
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    startButton.textContent = buttonLabel || "Play";
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function spawnObstacle() {
    var targetLane = Math.floor(Math.random() * 3);
    obstacles.push({
      lane: targetLane,
      y: -40,
      h: 28 + Math.random() * 18
    });
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      try {
        localStorage.setItem("ws-demo-runner-best", String(best));
      } catch (_) {}
    }
    submitScoreEl.textContent = String(score);
    showOverlay("Run over", "Score " + score + ". Submit below or try again.", "Play again");
  }

  function draw(width, height) {
    var pad = 24;
    var roadW = width - pad * 2;
    var laneW = roadW / 3;
    var playerY = height - 78;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(pad, 0, roadW, height);

    for (var i = 1; i < 3; i++) {
      ctx.strokeStyle = "rgba(180,109,255,0.28)";
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(pad + laneW * i, 0);
      ctx.lineTo(pad + laneW * i, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    obstacles.forEach(function (ob) {
      var x = pad + ob.lane * laneW + 12;
      var w = laneW - 24;
      var grad = ctx.createLinearGradient(x, ob.y, x, ob.y + ob.h);
      grad.addColorStop(0, "#b46dff");
      grad.addColorStop(1, "#8a2be2");
      ctx.fillStyle = grad;
      ctx.fillRect(x, ob.y, w, ob.h);
    });

    var px = pad + lane * laneW + laneW / 2;
    ctx.fillStyle = "#f4f3fb";
    ctx.beginPath();
    ctx.roundRect(px - 18, playerY, 36, 36, 10);
    ctx.fill();
    ctx.fillStyle = "#8a2be2";
    ctx.fillRect(px - 8, playerY + 10, 16, 16);
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;

    var width = canvas.clientWidth;
    var height = canvas.clientHeight;

    speed += dt * 8;
    score += Math.floor(dt * speed * 0.35);
    scoreEl.textContent = String(score);
    submitScoreEl.textContent = String(score);

    spawnTimer += dt;
    if (spawnTimer > Math.max(0.45, 1.1 - speed / 900)) {
      spawnTimer = 0;
      spawnObstacle();
    }

    var playerY = height - 78;
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var ob = obstacles[i];
      ob.y += speed * dt;
      if (ob.y > height + 40) {
        obstacles.splice(i, 1);
        continue;
      }
      if (ob.lane === lane && ob.y + ob.h > playerY && ob.y < playerY + 36) {
        endGame();
        draw(width, height);
        return;
      }
    }

    draw(width, height);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    resetGame();
    hideOverlay();
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function move(dir) {
    if (!running) return;
    lane = Math.max(0, Math.min(2, lane + dir));
  }

  startButton.addEventListener("click", start);
  window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      event.preventDefault();
      move(1);
    } else if (event.key === " " || event.key === "Enter") {
      if (!running) {
        event.preventDefault();
        start();
      }
    }
  });

  var touchStartX = 0;
  canvas.addEventListener(
    "touchstart",
    function (event) {
      if (event.changedTouches[0]) touchStartX = event.changedTouches[0].clientX;
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    function (event) {
      if (!event.changedTouches[0]) return;
      var dx = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 24) return;
      move(dx > 0 ? 1 : -1);
    },
    { passive: true }
  );

  window.addEventListener("resize", function () {
    resize();
    draw(canvas.clientWidth, canvas.clientHeight);
  });

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
      this.rect(x, y, w, h);
    };
  }

  resize();
  draw(canvas.clientWidth, canvas.clientHeight);
  showOverlay("Neon Runner", "← → or A/D to dodge. Survive and climb the board.", "Start");
})();
