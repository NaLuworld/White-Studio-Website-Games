/**
 * Hub intro: first-person cable / data-stream loading.
 * Player POV = riding current inside a transmission cable (SAO-inspired tunnel-vision colors;
 * White Studio neon only — no SAO trademarks or "Link Start" copy).
 * Exposed as WhiteStudioArcadeCurrent.create(canvas, options) → { start, stop, resize }.
 */
(function (global) {
  "use strict";

  var DEFAULT_DURATION_MS = 3200;
  var SETTLE_MS = 280;
  var TWO_PI = Math.PI * 2;

  function parseColor(value, fallback) {
    var v = String(value || "").trim();
    return v || fallback;
  }

  function readThemeColors() {
    var style = getComputedStyle(document.documentElement);
    return {
      page: parseColor(style.getPropertyValue("--ws-bg-page"), "#07060c"),
      accent: parseColor(style.getPropertyValue("--ws-accent"), "#8a2be2"),
      accent2: parseColor(style.getPropertyValue("--ws-accent-2"), "#c084ff"),
      surface: parseColor(style.getPropertyValue("--ws-bg-surface"), "#14121c"),
      tip: "#62e7ff"
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function progressEase(t) {
    var u = clamp(t, 0, 1);
    if (u < 0.88) return easeInOutCubic(u / 0.88) * 0.92;
    var local = (u - 0.88) / 0.12;
    return 0.92 + easeInOutCubic(local) * 0.08;
  }

  function createArcadeCurrentScene(canvas, options) {
    options = options || {};
    var reducedMotion = Boolean(options.reducedMotion);
    var durationMs = Number(options.durationMs) || DEFAULT_DURATION_MS;
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        start: function () {
          return Promise.resolve();
        },
        stop: function () {},
        resize: function () {}
      };
    }

    var dpr = 1;
    var running = false;
    var raf = 0;
    var startTs = 0;
    var lastFrameTs = 0;
    var progress = 0;
    var elapsedSec = 0;
    var settled = false;
    var resolveDone = null;
    var colors = readThemeColors();
    var mobile = false;

    var camZ = 0;
    var focal = 480;
    var centerY = 0.58;
    var tubeRadius = 1.35;
    var scrollZ = 0;

    var streakCount = 56;
    var packetCount = 22;
    var streaks = [];
    var packets = [];
    var ribCount = 8;

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.floor(rect.width * dpr));
      var h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var cw = Math.max(1, canvas.clientWidth);
      mobile = cw < 720;
      streakCount = mobile ? 32 : 56;
      packetCount = mobile ? 14 : 22;
      focal = mobile ? 380 : 480;
      centerY = mobile ? 0.56 : 0.58;
      ensureActors();
    }

    function ensureActors() {
      while (streaks.length < streakCount) streaks.push(spawnStreak(true));
      if (streaks.length > streakCount) streaks.length = streakCount;
      while (packets.length < packetCount) packets.push(spawnPacket(true));
      if (packets.length > packetCount) packets.length = packetCount;
    }

    function spawnStreak(scatter) {
      var ang = Math.random() * TWO_PI;
      var radial = tubeRadius * (0.55 + Math.random() * 0.42);
      return {
        ang: ang,
        radial: radial,
        z: scatter ? 1.2 + Math.random() * 24 : 20 + Math.random() * 10,
        len: 0.35 + Math.random() * 1.4,
        speed: 6 + Math.random() * 10,
        tip: Math.random() > 0.45
      };
    }

    function spawnPacket(scatter) {
      var ang = Math.random() * TWO_PI;
      var radial = tubeRadius * (0.2 + Math.random() * 0.7);
      return {
        ang: ang,
        radial: radial,
        z: scatter ? 2 + Math.random() * 22 : 18 + Math.random() * 8,
        speed: 4.5 + Math.random() * 7,
        size: 0.06 + Math.random() * 0.1,
        tip: Math.random() > 0.5
      };
    }

    function project(wx, wy, wz) {
      var depth = wz - camZ;
      if (depth <= 0.4) {
        return { x: 0, y: 0, depth: depth, scale: 0, visible: false };
      }
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      var scale = focal / depth;
      return {
        x: width * 0.5 + wx * scale,
        y: height * centerY - wy * scale,
        depth: depth,
        scale: scale,
        visible: true
      };
    }

    function fogAlpha(depth) {
      return clamp(1 - (depth - 0.9) / 22, 0.04, 1);
    }

    function tubePoint(ang, radial, z) {
      return project(Math.cos(ang) * radial, Math.sin(ang) * radial * 0.72, z);
    }

    function drawBackground(width, height) {
      var g = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        10,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.85
      );
      g.addColorStop(0, colors.surface);
      g.addColorStop(0.45, colors.page);
      g.addColorStop(1, "#030208");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    function drawColorWash(width, height, curveProgress, tSec) {
      // SAO-inspired tunnel-vision color shifts — low opacity brand hues only
      var phase = (curveProgress * 1.8 + tSec * 0.35) % 1;
      var r;
      var g;
      var b;
      if (phase < 0.33) {
        var u = phase / 0.33;
        r = lerp(138, 98, u);
        g = lerp(43, 231, u);
        b = lerp(226, 255, u);
      } else if (phase < 0.66) {
        var u2 = (phase - 0.33) / 0.33;
        r = lerp(98, 220, u2);
        g = lerp(231, 80, u2);
        b = lerp(255, 200, u2);
      } else {
        var u3 = (phase - 0.66) / 0.34;
        r = lerp(220, 138, u3);
        g = lerp(80, 43, u3);
        b = lerp(200, 226, u3);
      }
      var a = 0.07 + curveProgress * 0.08;
      var wash = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        height * 0.05,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.65
      );
      wash.addColorStop(
        0,
        "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + (a * 1.4).toFixed(3) + ")"
      );
      wash.addColorStop(0.55, "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + (a * 0.35).toFixed(3) + ")");
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    function drawTube() {
      var rings = [];
      var count = mobile ? 16 : 22;
      var span = 22;
      for (var i = 0; i < count; i++) {
        rings.push(1.1 + ((i * (span / count) + scrollZ * 0.9) % span));
      }
      rings.sort(function (a, b) {
        return b - a;
      });

      var segs = mobile ? 20 : 28;

      for (var r = 0; r < rings.length; r++) {
        var z = rings[r];
        var alpha = fogAlpha(z) * 0.5;
        ctx.beginPath();
        var started = false;
        for (var s = 0; s <= segs; s++) {
          var ang = (s / segs) * TWO_PI;
          var p = tubePoint(ang, tubeRadius, z);
          if (!p.visible) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = "rgba(138,43,226," + alpha.toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, 1.4 * (focal / (z * 100)));
        ctx.stroke();
      }

      // Longitudinal ribs
      for (var rib = 0; rib < ribCount; rib++) {
        var angR = (rib / ribCount) * TWO_PI + scrollZ * 0.02;
        ctx.beginPath();
        var ribStarted = false;
        for (var zi = 0; zi < 18; zi++) {
          var zz = 1.2 + zi * 1.25;
          var pr = tubePoint(angR, tubeRadius * 0.98, zz);
          if (!pr.visible) {
            ribStarted = false;
            continue;
          }
          if (!ribStarted) {
            ctx.moveTo(pr.x, pr.y);
            ribStarted = true;
          } else {
            ctx.lineTo(pr.x, pr.y);
          }
        }
        ctx.strokeStyle = "rgba(192,132,255," + (0.18).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function updateActors(dt, speedBoost) {
      var mul = 1.8 + speedBoost;
      for (var i = 0; i < streaks.length; i++) {
        streaks[i].z -= streaks[i].speed * dt * mul;
        if (streaks[i].z < camZ + 0.5) streaks[i] = spawnStreak(false);
      }
      for (var j = 0; j < packets.length; j++) {
        packets[j].z -= packets[j].speed * dt * mul;
        if (packets[j].z < camZ + 0.5) packets[j] = spawnPacket(false);
      }
    }

    function drawDataStreaks() {
      var ordered = streaks.slice().sort(function (a, b) {
        return b.z - a.z;
      });
      for (var i = 0; i < ordered.length; i++) {
        var s = ordered[i];
        var near = tubePoint(s.ang, s.radial, s.z);
        var far = tubePoint(s.ang, s.radial, s.z + s.len);
        if (!near.visible || !far.visible) continue;
        var alpha = fogAlpha(s.z) * 0.95;
        ctx.save();
        ctx.strokeStyle = s.tip
          ? "rgba(98,231,255," + alpha.toFixed(3) + ")"
          : "rgba(192,132,255," + alpha.toFixed(3) + ")";
        ctx.shadowColor = s.tip ? colors.tip : colors.accent2;
        ctx.shadowBlur = 10;
        ctx.lineWidth = Math.max(1.2, Math.min(4.5, 2.2 * (near.scale / 160)));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(far.x, far.y);
        ctx.lineTo(near.x, near.y);
        ctx.stroke();
        ctx.restore();
      }

      var pk = packets.slice().sort(function (a, b) {
        return b.z - a.z;
      });
      for (var p = 0; p < pk.length; p++) {
        var pkt = pk[p];
        var c = tubePoint(pkt.ang, pkt.radial, pkt.z);
        if (!c.visible) continue;
        var hs = Math.max(2, Math.min(10, pkt.size * c.scale));
        var alphaP = fogAlpha(pkt.z);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(0.785);
        ctx.fillStyle = pkt.tip
          ? "rgba(98,231,255," + (alphaP * 0.9).toFixed(3) + ")"
          : "rgba(192,132,255," + (alphaP * 0.85).toFixed(3) + ")";
        ctx.shadowColor = pkt.tip ? colors.tip : colors.accent2;
        ctx.shadowBlur = 8;
        ctx.fillRect(-hs * 0.5, -hs * 0.35, hs, hs * 0.7);
        ctx.restore();
      }
    }

    /** Player is the current: bright core just ahead on the tube axis. */
    function drawCurrentSelf(curveProgress) {
      var selfZ = 2.4;
      var c = project(0, 0, selfZ);
      if (!c.visible) return;
      var pulse = 0.65 + 0.35 * Math.sin(elapsedSec * 14);
      var finale = curveProgress >= 0.88 ? easeInOutCubic((curveProgress - 0.88) / 0.12) : 0;
      var amp = Math.max(pulse, finale);
      var r = Math.max(4, Math.min(16, 9 * amp * (c.scale / 200)));

      ctx.save();
      ctx.shadowColor = colors.tip;
      ctx.shadowBlur = 22 + amp * 18;
      var glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 3.2);
      glow.addColorStop(0, "rgba(98,231,255,0.55)");
      glow.addColorStop(0.4, "rgba(192,132,255,0.22)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 3.2, 0, TWO_PI);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.arc(c.x, c.y, r, 0, TWO_PI);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.arc(c.x, c.y, r * 0.35, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      // Short trailing current body behind the core (toward camera / past player)
      var trailA = project(0, 0, 1.1);
      var trailB = project(0, 0, selfZ);
      if (trailA.visible && trailB.visible) {
        ctx.save();
        ctx.strokeStyle = "rgba(98,231,255,0.55)";
        ctx.shadowColor = colors.tip;
        ctx.shadowBlur = 14;
        ctx.lineWidth = Math.max(2, Math.min(8, 4 * amp));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(trailA.x, trailA.y);
        ctx.lineTo(trailB.x, trailB.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawExitFlare(curveProgress) {
      var exitZ = 20;
      var e = project(0, 0, exitZ);
      if (!e.visible) return;
      var finale = curveProgress >= 0.88 ? easeInOutCubic((curveProgress - 0.88) / 0.12) : curveProgress * 0.25;
      var base = Math.max(8, Math.min(80, 28 * (e.scale / 24)));
      var r = base * (0.4 + finale * 1.6);
      var alpha = fogAlpha(exitZ) * (0.2 + finale * 0.85);

      ctx.save();
      ctx.globalAlpha = alpha;
      var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.25, "rgba(98,231,255,0.7)");
      g.addColorStop(0.55, "rgba(192,132,255,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    function drawVignette(width, height) {
      var v = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        height * 0.12,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.78
      );
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.55, "rgba(0,0,0,0.15)");
      v.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);
    }

    function renderFrame(curveProgress, tSec) {
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      drawBackground(width, height);
      drawTube();
      drawDataStreaks();
      drawExitFlare(curveProgress);
      drawCurrentSelf(curveProgress);
      drawColorWash(width, height, curveProgress, tSec);
      drawVignette(width, height);
    }

    function frame(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      if (!lastFrameTs) lastFrameTs = ts;
      var dt = clamp((ts - lastFrameTs) / 1000, 0.001, 0.05);
      lastFrameTs = ts;

      var elapsed = ts - startTs;
      elapsedSec = elapsed / 1000;
      var rawT = reducedMotion ? 1 : clamp(elapsed / durationMs, 0, 1);
      progress = progressEase(rawT);

      var speedBoost = 0.5 + progress * 1.8;
      scrollZ += dt * (4 + progress * 7);
      updateActors(dt, speedBoost);

      renderFrame(progress, elapsedSec);

      if (rawT >= 1 && !settled) {
        settled = true;
        window.setTimeout(function () {
          if (resolveDone) finishScene();
        }, reducedMotion ? 0 : SETTLE_MS);
      }

      if (running) raf = requestAnimationFrame(frame);
    }

    function finishScene() {
      if (!running && !resolveDone) return;
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (resolveDone) {
        var r = resolveDone;
        resolveDone = null;
        r();
      }
    }

    function start() {
      colors = readThemeColors();
      resize();
      running = true;
      startTs = 0;
      lastFrameTs = 0;
      progress = reducedMotion ? 1 : 0;
      elapsedSec = 0;
      settled = false;
      scrollZ = 0;
      streaks = [];
      packets = [];
      ensureActors();

      if (reducedMotion) {
        scrollZ = 3;
        renderFrame(1, 0);
        return new Promise(function (resolve) {
          resolveDone = resolve;
          window.setTimeout(finishScene, 0);
        });
      }

      renderFrame(0, 0);

      return new Promise(function (resolve) {
        resolveDone = resolve;
        raf = requestAnimationFrame(frame);
      });
    }

    function stop() {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (resolveDone) {
        var r = resolveDone;
        resolveDone = null;
        r();
      }
    }

    return {
      start: start,
      stop: stop,
      resize: resize
    };
  }

  global.WhiteStudioArcadeCurrent = {
    create: createArcadeCurrentScene,
    DEFAULT_DURATION_MS: DEFAULT_DURATION_MS
  };
})(window);
