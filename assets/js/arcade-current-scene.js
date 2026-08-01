/**
 * Hub intro: first-person cable / data-stream loading (quality pass).
 * Layered tube, tiered streaks, dust, fake bloom / chroma / grain.
 * Player POV = riding current inside a transmission cable (SAO-inspired colors;
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
    var frameIndex = 0;

    var camZ = 0;
    var baseFocal = 480;
    var focal = 480;
    var centerY = 0.58;
    var tubeRadius = 1.35;
    var tubeInner = 1.18;
    var scrollZ = 0;

    var streakCount = 90;
    var packetCount = 32;
    var dustCount = 80;
    var streaks = [];
    var packets = [];
    var dust = [];
    var ribCount = 12;
    var bloomStreaks = [];

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
      streakCount = mobile ? 48 : 90;
      packetCount = mobile ? 18 : 32;
      dustCount = mobile ? 40 : 80;
      baseFocal = mobile ? 380 : 480;
      focal = baseFocal;
      centerY = mobile ? 0.56 : 0.58;
      ribCount = mobile ? 10 : 12;
      ensureActors();
    }

    function ensureActors() {
      while (streaks.length < streakCount) streaks.push(spawnStreak(true));
      if (streaks.length > streakCount) streaks.length = streakCount;
      while (packets.length < packetCount) packets.push(spawnPacket(true));
      if (packets.length > packetCount) packets.length = packetCount;
      while (dust.length < dustCount) dust.push(spawnDust(true));
      if (dust.length > dustCount) dust.length = dustCount;
    }

    function spawnStreak(scatter) {
      var roll = Math.random();
      var tier = roll < 0.22 ? "long" : roll < 0.55 ? "mid" : "short";
      var ang = Math.random() * TWO_PI;
      var radial = tubeRadius * (0.42 + Math.random() * 0.52);
      var len =
        tier === "long" ? 1.6 + Math.random() * 1.8 : tier === "mid" ? 0.7 + Math.random() * 1.0 : 0.25 + Math.random() * 0.45;
      var widthMul = tier === "long" ? 1.55 : tier === "mid" ? 1.1 : 0.7;
      var speed =
        tier === "long" ? 7 + Math.random() * 9 : tier === "mid" ? 8 + Math.random() * 11 : 10 + Math.random() * 12;
      return {
        ang: ang,
        radial: radial,
        z: scatter ? 1.2 + Math.random() * 24 : 20 + Math.random() * 10,
        len: len,
        speed: speed,
        tip: Math.random() > 0.42,
        tier: tier,
        widthMul: widthMul,
        spiral: (Math.random() - 0.5) * 0.045,
        chroma: Math.random() > 0.72
      };
    }

    function spawnPacket(scatter) {
      var ang = Math.random() * TWO_PI;
      var radial = tubeRadius * (0.15 + Math.random() * 0.75);
      return {
        ang: ang,
        radial: radial,
        z: scatter ? 2 + Math.random() * 22 : 18 + Math.random() * 8,
        speed: 5 + Math.random() * 8,
        size: 0.055 + Math.random() * 0.11,
        tip: Math.random() > 0.48,
        trail: 0.35 + Math.random() * 0.55
      };
    }

    function spawnDust(scatter) {
      var ang = Math.random() * TWO_PI;
      var radial = tubeRadius * (0.1 + Math.random() * 0.85);
      return {
        ang: ang,
        radial: radial,
        z: scatter ? 1.5 + Math.random() * 23 : 19 + Math.random() * 8,
        speed: 1.6 + Math.random() * 3.2,
        size: 0.4 + Math.random() * 1.2,
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
      return clamp(1 - (depth - 0.85) / 21, 0.04, 1);
    }

    function tubePoint(ang, radial, z) {
      return project(Math.cos(ang) * radial, Math.sin(ang) * radial * 0.72, z);
    }

    function strokeRing(z, radius, stroke, lineW, glow) {
      var segs = mobile ? 22 : 32;
      ctx.beginPath();
      var started = false;
      for (var s = 0; s <= segs; s++) {
        var ang = (s / segs) * TWO_PI;
        var p = tubePoint(ang, radius, z);
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
      if (!started) return;
      ctx.save();
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 12;
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.restore();
    }

    function drawBackground(width, height) {
      var g = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        8,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.9
      );
      g.addColorStop(0, "#1a1428");
      g.addColorStop(0.35, colors.surface);
      g.addColorStop(0.7, colors.page);
      g.addColorStop(1, "#020106");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    function drawColorWash(width, height, curveProgress, tSec) {
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
      var a = 0.1 + curveProgress * 0.12;
      var wash = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        height * 0.04,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.7
      );
      wash.addColorStop(
        0,
        "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + (a * 1.55).toFixed(3) + ")"
      );
      wash.addColorStop(
        0.4,
        "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + (a * 0.45).toFixed(3) + ")"
      );
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    function drawTube() {
      var rings = [];
      var count = mobile ? 18 : 28;
      var span = 20;
      for (var i = 0; i < count; i++) {
        rings.push(1.05 + ((i * (span / count) + scrollZ * 0.95) % span));
      }
      rings.sort(function (a, b) {
        return b - a;
      });

      for (var r = 0; r < rings.length; r++) {
        var z = rings[r];
        var alpha = fogAlpha(z);
        var coreW = Math.max(1.1, 2.1 * (focal / (z * 95)));
        var haloW = coreW * 3.2;

        // Outer soft halo
        strokeRing(
          z,
          tubeRadius,
          "rgba(138,43,226," + (alpha * 0.22).toFixed(3) + ")",
          haloW,
          null
        );
        // Outer bright core
        strokeRing(
          z,
          tubeRadius,
          "rgba(180,109,255," + (alpha * 0.62).toFixed(3) + ")",
          coreW,
          colors.accent
        );
        // Inner wall (thickness)
        strokeRing(
          z,
          tubeInner,
          "rgba(98,80,160," + (alpha * 0.28).toFixed(3) + ")",
          Math.max(0.8, coreW * 0.55),
          null
        );
      }

      // Longitudinal ribs — thicker near, fogged far
      for (var rib = 0; rib < ribCount; rib++) {
        var angR = (rib / ribCount) * TWO_PI + scrollZ * 0.025;
        ctx.beginPath();
        var ribStarted = false;
        var lastDepth = 12;
        for (var zi = 0; zi < 22; zi++) {
          var zz = 1.15 + zi * 1.05;
          var pr = tubePoint(angR, tubeRadius * 0.99, zz);
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
          lastDepth = pr.depth;
        }
        if (!ribStarted) continue;
        var ra = fogAlpha(lastDepth) * 0.32;
        ctx.strokeStyle = "rgba(192,132,255," + ra.toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, Math.min(2.4, 180 / (lastDepth * 14)));
        ctx.stroke();
      }
    }

    function updateActors(dt, speedBoost) {
      var mul = 1.9 + speedBoost;
      for (var i = 0; i < streaks.length; i++) {
        streaks[i].z -= streaks[i].speed * dt * mul;
        if (streaks[i].z < camZ + 0.5) streaks[i] = spawnStreak(false);
      }
      for (var j = 0; j < packets.length; j++) {
        packets[j].z -= packets[j].speed * dt * mul;
        if (packets[j].z < camZ + 0.5) packets[j] = spawnPacket(false);
      }
      var dustMul = 1.2 + speedBoost * 0.55;
      for (var d = 0; d < dust.length; d++) {
        dust[d].z -= dust[d].speed * dt * dustMul;
        if (dust[d].z < camZ + 0.5) dust[d] = spawnDust(false);
      }
    }

    function drawDust() {
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i];
        var s = tubePoint(p.ang, p.radial, p.z);
        if (!s.visible) continue;
        var alpha = fogAlpha(p.depth) * 0.45;
        var r = Math.max(0.5, Math.min(2.2, p.size * (s.scale / 180)));
        ctx.beginPath();
        ctx.fillStyle = p.tip
          ? "rgba(98,231,255," + alpha.toFixed(3) + ")"
          : "rgba(180,120,255," + alpha.toFixed(3) + ")";
        ctx.arc(s.x, s.y, r, 0, TWO_PI);
        ctx.fill();
      }
    }

    function drawDataStreaks() {
      bloomStreaks = [];
      var ordered = streaks.slice().sort(function (a, b) {
        return b.z - a.z;
      });
      for (var i = 0; i < ordered.length; i++) {
        var s = ordered[i];
        var angNear = s.ang + s.spiral * s.z;
        var angFar = s.ang + s.spiral * (s.z + s.len);
        var near = tubePoint(angNear, s.radial, s.z);
        var far = tubePoint(angFar, s.radial, s.z + s.len);
        if (!near.visible || !far.visible) continue;
        var alpha = fogAlpha(s.z) * (s.tier === "long" ? 1 : s.tier === "mid" ? 0.85 : 0.65);
        var lw = Math.max(1, Math.min(6.5, 2.4 * s.widthMul * (near.scale / 150)));

        if (s.chroma && s.z < 8) {
          ctx.save();
          ctx.globalAlpha = alpha * 0.35;
          ctx.strokeStyle = "rgba(98,231,255,0.9)";
          ctx.lineWidth = lw;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(far.x - 1.2, far.y);
          ctx.lineTo(near.x - 1.2, near.y);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,90,200,0.75)";
          ctx.beginPath();
          ctx.moveTo(far.x + 1.2, far.y);
          ctx.lineTo(near.x + 1.2, near.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = s.tip
          ? "rgba(98,231,255," + alpha.toFixed(3) + ")"
          : "rgba(192,132,255," + alpha.toFixed(3) + ")";
        ctx.shadowColor = s.tip ? colors.tip : colors.accent2;
        ctx.shadowBlur = s.tier === "long" ? 16 : 9;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(far.x, far.y);
        ctx.lineTo(near.x, near.y);
        ctx.stroke();
        ctx.restore();

        if (s.tier === "long" && s.z < 10) {
          bloomStreaks.push({ near: near, far: far, tip: s.tip, lw: lw });
        }
      }

      var pk = packets.slice().sort(function (a, b) {
        return b.z - a.z;
      });
      for (var p = 0; p < pk.length; p++) {
        var pkt = pk[p];
        var c = tubePoint(pkt.ang, pkt.radial, pkt.z);
        var trail = tubePoint(pkt.ang, pkt.radial, pkt.z + pkt.trail);
        if (!c.visible) continue;
        var hs = Math.max(2, Math.min(11, pkt.size * c.scale));
        var alphaP = fogAlpha(pkt.z);

        if (trail.visible) {
          ctx.save();
          ctx.strokeStyle = pkt.tip
            ? "rgba(98,231,255," + (alphaP * 0.45).toFixed(3) + ")"
            : "rgba(192,132,255," + (alphaP * 0.4).toFixed(3) + ")";
          ctx.lineWidth = Math.max(1, hs * 0.28);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(trail.x, trail.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(0.785);
        ctx.fillStyle = pkt.tip
          ? "rgba(98,231,255," + (alphaP * 0.92).toFixed(3) + ")"
          : "rgba(192,132,255," + (alphaP * 0.88).toFixed(3) + ")";
        ctx.shadowColor = pkt.tip ? colors.tip : colors.accent2;
        ctx.shadowBlur = 10;
        ctx.fillRect(-hs * 0.5, -hs * 0.35, hs, hs * 0.7);
        ctx.restore();
      }
    }

    function drawCurrentSelf(curveProgress) {
      var selfZ = 2.4;
      var c = project(0, 0, selfZ);
      if (!c.visible) return;
      var pulse = 0.65 + 0.35 * Math.sin(elapsedSec * 14);
      var finale = curveProgress >= 0.88 ? easeInOutCubic((curveProgress - 0.88) / 0.12) : 0;
      var amp = Math.max(pulse, finale);
      var r = Math.max(4, Math.min(16, 9 * amp * (c.scale / 200)));

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var bloom = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 4.2);
      bloom.addColorStop(0, "rgba(98,231,255,0.45)");
      bloom.addColorStop(0.45, "rgba(192,132,255,0.18)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 4.2, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = colors.tip;
      ctx.shadowBlur = 24 + amp * 20;
      var glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 3.0);
      glow.addColorStop(0, "rgba(98,231,255,0.6)");
      glow.addColorStop(0.4, "rgba(192,132,255,0.24)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 3.0, 0, TWO_PI);
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

      var trailA = project(0, 0, 1.1);
      var trailB = project(0, 0, selfZ);
      if (trailA.visible && trailB.visible) {
        ctx.save();
        ctx.strokeStyle = "rgba(98,231,255,0.58)";
        ctx.shadowColor = colors.tip;
        ctx.shadowBlur = 16;
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
      var finale = curveProgress >= 0.88 ? easeInOutCubic((curveProgress - 0.88) / 0.12) : curveProgress * 0.28;
      var base = Math.max(8, Math.min(90, 30 * (e.scale / 24)));
      var r = base * (0.4 + finale * 1.7);
      var alpha = fogAlpha(exitZ) * (0.22 + finale * 0.88);

      // Chromatic fringe
      ctx.save();
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = "rgba(98,231,255,0.7)";
      ctx.beginPath();
      ctx.arc(e.x - 1.5, e.y, r * 0.92, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "rgba(255,90,200,0.55)";
      ctx.beginPath();
      ctx.arc(e.x + 1.5, e.y, r * 0.92, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 1.15);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.22, "rgba(98,231,255,0.75)");
      g.addColorStop(0.5, "rgba(192,132,255,0.4)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.15, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    function drawBloomPass() {
      if (!bloomStreaks.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.28;
      for (var i = 0; i < bloomStreaks.length; i++) {
        var b = bloomStreaks[i];
        ctx.strokeStyle = b.tip ? "rgba(98,231,255,0.9)" : "rgba(192,132,255,0.85)";
        ctx.lineWidth = b.lw * 2.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.far.x, b.far.y);
        ctx.lineTo(b.near.x, b.near.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawGrain(width, height) {
      if (mobile && frameIndex % 2 === 1) return;
      var count = mobile ? 90 : 160;
      ctx.save();
      ctx.globalAlpha = 0.045;
      for (var i = 0; i < count; i++) {
        var x = Math.random() * width;
        var y = Math.random() * height;
        var a = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255," + a + ")" : "rgba(180,140,255," + a + ")";
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      ctx.restore();
    }

    function drawVignette(width, height) {
      var v = ctx.createRadialGradient(
        width * 0.5,
        height * centerY,
        height * 0.1,
        width * 0.5,
        height * centerY,
        Math.max(width, height) * 0.8
      );
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.45, "rgba(0,0,0,0.12)");
      v.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);
    }

    function renderFrame(curveProgress, tSec) {
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      drawBackground(width, height);
      drawTube();
      drawDust();
      drawDataStreaks();
      drawBloomPass();
      drawExitFlare(curveProgress);
      drawCurrentSelf(curveProgress);
      drawColorWash(width, height, curveProgress, tSec);
      drawGrain(width, height);
      drawVignette(width, height);
    }

    function frame(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      if (!lastFrameTs) lastFrameTs = ts;
      var dt = clamp((ts - lastFrameTs) / 1000, 0.001, 0.05);
      lastFrameTs = ts;
      frameIndex++;

      var elapsed = ts - startTs;
      elapsedSec = elapsed / 1000;
      var rawT = reducedMotion ? 1 : clamp(elapsed / durationMs, 0, 1);
      progress = progressEase(rawT);

      // Mild FOV punch toward exit (no camera shake)
      focal = baseFocal * (1 + progress * 0.09);

      var speedBoost = 0.55 + progress * 2.35;
      scrollZ += dt * (4.2 + progress * 9.5);
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
      frameIndex = 0;
      streaks = [];
      packets = [];
      dust = [];
      ensureActors();

      if (reducedMotion) {
        scrollZ = 3;
        focal = baseFocal * 1.09;
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
