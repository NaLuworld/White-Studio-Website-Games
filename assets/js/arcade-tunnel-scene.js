/**
 * Pseudo-3D wireframe corridor prototype (backup of the hub tunnel loading look).
 * Reusable for future music / dodge-block games — NOT loaded by hub intro by default.
 * Perspective rings + floor grid lights + particles + neon core pulse.
 * Exposed as WhiteStudioArcadeTunnel.create(canvas, options) → { start, stop, resize }.
 */
(function (global) {
  "use strict";

  var DEFAULT_DURATION_MS = 3200;
  var SETTLE_MS = 280;

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

  /** Double-peak heartbeat (short-short, long rest). Returns 0–1 amplitude. */
  function heartbeat(tSec) {
    var cycle = 1.15;
    var phase = ((tSec % cycle) + cycle) % cycle;
    var amp = 0;
    if (phase < 0.12) {
      amp = Math.sin((phase / 0.12) * Math.PI);
    } else if (phase < 0.28) {
      amp = 0.15 * Math.sin(((phase - 0.12) / 0.16) * Math.PI);
    } else if (phase < 0.42) {
      amp = 0.85 * Math.sin(((phase - 0.28) / 0.14) * Math.PI);
    }
    return amp;
  }

  function createArcadeTunnelScene(canvas, options) {
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
    var particleCount = 48;
    var particles = [];
    var scrollZ = 0;

    // Camera / projection
    var camZ = 0;
    var focal = 420;
    var horizonY = 0.6;
    var tunnelHalfW = 2.4;
    var tunnelHalfH = 1.55;

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
      particleCount = mobile ? 28 : 48;
      focal = mobile ? 340 : 420;
      horizonY = mobile ? 0.58 : 0.6;
      ensureParticles();
    }

    function ensureParticles() {
      while (particles.length < particleCount) {
        particles.push(spawnParticle(true));
      }
      if (particles.length > particleCount) {
        particles.length = particleCount;
      }
    }

    function spawnParticle(scatter) {
      return {
        x: (Math.random() - 0.5) * tunnelHalfW * 1.7,
        y: (Math.random() - 0.5) * tunnelHalfH * 1.5,
        z: scatter ? 2 + Math.random() * 22 : 18 + Math.random() * 8,
        speed: 2.2 + Math.random() * 3.4,
        size: 0.8 + Math.random() * 1.8,
        hue: Math.random() > 0.55 ? "tip" : "accent"
      };
    }

    /**
     * Project world (x,y,z) with camera at z=camZ looking +Z into depth.
     * World Z increases away from camera; we treat ringZ as distance ahead.
     */
    function project(wx, wy, wz) {
      var depth = wz - camZ;
      if (depth <= 0.45) {
        return { x: 0, y: 0, depth: depth, scale: 0, visible: false };
      }
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      var scale = focal / depth;
      return {
        x: width * 0.5 + wx * scale,
        y: height * horizonY - wy * scale,
        depth: depth,
        scale: scale,
        visible: true
      };
    }

    function fogAlpha(depth) {
      return clamp(1 - (depth - 1.2) / 20, 0.05, 1);
    }

    function drawBackground(width, height) {
      var g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, colors.page);
      g.addColorStop(0.45, colors.surface);
      g.addColorStop(1, colors.page);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      var wash = ctx.createRadialGradient(
        width * 0.5,
        height * horizonY,
        20,
        width * 0.5,
        height * (horizonY + 0.08),
        width * 0.72
      );
      wash.addColorStop(0, "rgba(138,43,226,0.18)");
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    function drawVignette(width, height) {
      var v = ctx.createRadialGradient(
        width * 0.5,
        height * 0.55,
        height * 0.2,
        width * 0.5,
        height * 0.55,
        Math.max(width, height) * 0.72
      );
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);
    }

    function drawFloor(curveProgress) {
      var lines = [];
      var zBase = scrollZ;
      var zMin = 1.2;
      var zMax = 22;
      var stepZ = mobile ? 0.85 : 0.65;
      var stepX = mobile ? 0.55 : 0.42;

      for (var zi = 0; zi < 36; zi++) {
        var z = zMin + ((zi * stepZ + zBase) % (zMax - zMin));
        for (var xi = -8; xi <= 8; xi++) {
          var x0 = xi * stepX;
          var x1 = (xi + 1) * stepX;
          var y = -tunnelHalfH;
          var a = project(x0, y, z);
          var b = project(x1, y, z);
          if (a.visible && b.visible) {
            lines.push({ a: a, b: b, d: (a.depth + b.depth) * 0.5, kind: "x" });
          }
        }
      }

      for (var xj = -8; xj <= 8; xj++) {
        var x = xj * stepX;
        var pNear = project(x, -tunnelHalfH, zMin + 0.2);
        var pFar = project(x, -tunnelHalfH, zMax);
        if (pNear.visible && pFar.visible) {
          lines.push({
            a: pNear,
            b: pFar,
            d: (pNear.depth + pFar.depth) * 0.5,
            kind: "z"
          });
        }
      }

      lines.sort(function (a, b) {
        return b.d - a.d;
      });

      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        var alpha = fogAlpha(L.d) * (L.kind === "x" ? 0.38 : 0.22);
        ctx.strokeStyle = "rgba(180,109,255," + alpha.toFixed(3) + ")";
        ctx.lineWidth = L.kind === "x" ? 1.15 : 1;
        ctx.beginPath();
        ctx.moveTo(L.a.x, L.a.y);
        ctx.lineTo(L.b.x, L.b.y);
        ctx.stroke();
      }

      // Sweeping floor light bands
      var bandCount = 2;
      for (var bi = 0; bi < bandCount; bi++) {
        var phase = (curveProgress * 1.4 + bi * 0.37 + scrollZ * 0.04) % 1;
        var bz = lerp(zMax, zMin + 0.8, phase);
        var left = project(-tunnelHalfW * 1.05, -tunnelHalfH, bz);
        var right = project(tunnelHalfW * 1.05, -tunnelHalfH, bz);
        if (!left.visible || !right.visible) continue;
        var ba = fogAlpha(bz) * (0.35 + 0.45 * (1 - Math.abs(phase - 0.5) * 2));
        ctx.save();
        ctx.strokeStyle = "rgba(98,231,255," + ba.toFixed(3) + ")";
        ctx.shadowColor = colors.tip;
        ctx.shadowBlur = 18;
        ctx.lineWidth = Math.max(2, 4 * (left.scale / 180));
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    function ringPoints(z, inflate) {
      var hw = tunnelHalfW * inflate;
      var hh = tunnelHalfH * inflate;
      return [
        project(-hw, -hh, z),
        project(hw, -hh, z),
        project(hw, hh, z),
        project(-hw, hh, z)
      ];
    }

    function drawRing(pts, stroke, width, glow) {
      var all = true;
      for (var i = 0; i < pts.length; i++) {
        if (!pts[i].visible) {
          all = false;
          break;
        }
      }
      if (!all) return false;
      ctx.save();
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 16;
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return true;
    }

    function drawTunnel(curveProgress) {
      var zBase = scrollZ;
      var rings = [];
      var count = mobile ? 14 : 18;
      for (var i = 0; i < count; i++) {
        var span = 20;
        var z = 1.4 + ((i * (span / count) + zBase * 0.85) % span);
        rings.push(z);
      }
      rings.sort(function (a, b) {
        return b - a;
      });

      var waveZ = lerp(22, 1.6, easeInOutCubic(curveProgress));

      for (var r = 0; r < rings.length; r++) {
        var z = rings[r];
        var pts = ringPoints(z, 1);
        var alpha = fogAlpha(z) * 0.55;
        drawRing(
          pts,
          "rgba(138,43,226," + alpha.toFixed(3) + ")",
          Math.max(1, 1.6 * (focal / (z * 90))),
          null
        );

        // Soft side ribs
        var midL0 = project(-tunnelHalfW, -tunnelHalfH * 0.2, z);
        var midL1 = project(-tunnelHalfW, tunnelHalfH * 0.2, z);
        var midR0 = project(tunnelHalfW, -tunnelHalfH * 0.2, z);
        var midR1 = project(tunnelHalfW, tunnelHalfH * 0.2, z);
        if (midL0.visible && midL1.visible) {
          ctx.strokeStyle = "rgba(192,132,255," + (alpha * 0.35).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midL0.x, midL0.y);
          ctx.lineTo(midL1.x, midL1.y);
          ctx.stroke();
        }
        if (midR0.visible && midR1.visible) {
          ctx.strokeStyle = "rgba(192,132,255," + (alpha * 0.35).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midR0.x, midR0.y);
          ctx.lineTo(midR1.x, midR1.y);
          ctx.stroke();
        }
      }

      // Energy wave ring
      var wavePts = ringPoints(waveZ, 1.02);
      var waveAlpha = fogAlpha(waveZ) * (0.55 + 0.45 * curveProgress);
      drawRing(
        wavePts,
        "rgba(98,231,255," + waveAlpha.toFixed(3) + ")",
        Math.max(2, 3.2 * (focal / (waveZ * 70))),
        colors.tip
      );
      var innerWave = ringPoints(waveZ, 0.92);
      drawRing(
        innerWave,
        "rgba(192,132,255," + (waveAlpha * 0.7).toFixed(3) + ")",
        Math.max(1.2, 2 * (focal / (waveZ * 90))),
        colors.accent2
      );
    }

    function updateParticles(dt, speedBoost) {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.z -= p.speed * dt * (1.6 + speedBoost);
        if (p.z < camZ + 0.6) {
          particles[i] = spawnParticle(false);
        }
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var s = project(p.x, p.y, p.z);
        if (!s.visible) continue;
        var alpha = fogAlpha(p.depth) * 0.9;
        var r = Math.max(0.8, Math.min(3.2, p.size * (s.scale / 140)));
        ctx.beginPath();
        if (p.hue === "tip") {
          ctx.fillStyle = "rgba(98,231,255," + alpha.toFixed(3) + ")";
        } else {
          ctx.fillStyle = "rgba(192,132,255," + alpha.toFixed(3) + ")";
        }
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawCorePulse(curveProgress, tSec) {
      var coreZ = 18.5;
      var c = project(0, 0.05, coreZ);
      if (!c.visible) return;

      var beat = heartbeat(tSec);
      var finale = curveProgress >= 0.88 ? easeInOutCubic((curveProgress - 0.88) / 0.12) : 0;
      var amp = Math.max(beat * 0.85, finale * 1.15);
      var baseR = Math.max(6, Math.min(42, 18 * (c.scale / 28)));
      var r = baseR * (0.55 + amp * 0.9);
      var alpha = fogAlpha(c.depth);

      ctx.save();
      ctx.globalAlpha = alpha * (0.35 + amp * 0.65);

      var glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 2.8);
      glow.addColorStop(0, "rgba(98,231,255,0.55)");
      glow.addColorStop(0.35, "rgba(192,132,255,0.35)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = colors.accent2;
      ctx.shadowBlur = 22 + amp * 28;
      ctx.beginPath();
      ctx.strokeStyle = colors.accent2;
      ctx.lineWidth = 2 + amp * 2.5;
      ctx.arc(c.x, c.y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.shadowColor = colors.tip;
      ctx.shadowBlur = 18 + amp * 20;
      ctx.arc(c.x, c.y, r * (0.28 + amp * 0.12), 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * (0.5 + amp * 0.5);
      ctx.arc(c.x, c.y, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function renderFrame(curveProgress, tSec) {
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      drawBackground(width, height);
      drawFloor(curveProgress);
      drawTunnel(curveProgress);
      drawParticles();
      drawCorePulse(curveProgress, tSec);
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

      var speedBoost = 0.35 + progress * 1.1;
      scrollZ += dt * (2.8 + progress * 4.5);
      updateParticles(dt, speedBoost);

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
      particles = [];
      ensureParticles();

      if (reducedMotion) {
        scrollZ = 4;
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

  global.WhiteStudioArcadeTunnel = {
    create: createArcadeTunnelScene,
    DEFAULT_DURATION_MS: DEFAULT_DURATION_MS
  };
})(window);
