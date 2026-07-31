/**
 * Hub intro: Canvas2D pseudo-3D current / connection path with camera follow.
 * Exposed as WhiteStudioArcadeCurrent.create(canvas, options) → { start, stop, resize }.
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
      text: parseColor(style.getPropertyValue("--ws-text-primary"), "#f4f3fb"),
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

  /** Fixed world path on the arcade floor (x, z); y is height. */
  function buildPath() {
    return [
      { x: -7.5, y: 0.15, z: 14 },
      { x: -4.2, y: 0.2, z: 11.5 },
      { x: -5.5, y: 0.35, z: 8.2 },
      { x: -1.8, y: 0.25, z: 7.4 },
      { x: 0.4, y: 0.45, z: 5.6 },
      { x: 2.8, y: 0.3, z: 6.8 },
      { x: 4.6, y: 0.55, z: 4.2 },
      { x: 1.2, y: 0.4, z: 3.1 },
      { x: -0.2, y: 0.7, z: 1.4 },
      { x: 0.0, y: 0.9, z: 0.2 }
    ];
  }

  function buildNodes(path) {
    return path.map(function (p, i) {
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        kind: i === path.length - 1 ? "hub" : i % 3 === 0 ? "cabinet" : "bus",
        lit: 0
      };
    });
  }

  function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1];
      var b = path[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dz = b.z - a.z;
      len += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return len;
  }

  function pointOnPath(path, lengths, total, distance) {
    if (distance <= 0) return { x: path[0].x, y: path[0].y, z: path[0].z, seg: 0 };
    if (distance >= total) {
      var last = path[path.length - 1];
      return { x: last.x, y: last.y, z: last.z, seg: path.length - 2 };
    }
    var acc = 0;
    for (var i = 0; i < lengths.length; i++) {
      var segLen = lengths[i];
      if (acc + segLen >= distance) {
        var t = (distance - acc) / segLen;
        var a = path[i];
        var b = path[i + 1];
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          z: lerp(a.z, b.z, t),
          seg: i
        };
      }
      acc += segLen;
    }
    var end = path[path.length - 1];
    return { x: end.x, y: end.y, z: end.z, seg: path.length - 2 };
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
    var progress = 0;
    var settled = false;
    var resolveDone = null;
    var colors = readThemeColors();

    var path = buildPath();
    var nodes = buildNodes(path);
    var segLens = [];
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1];
      var b = path[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dz = b.z - a.z;
      segLens.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    var totalLen = pathLength(path);

    var cam = {
      x: path[0].x,
      y: 2.4,
      z: path[0].z + 4.2,
      lookX: path[0].x,
      lookY: path[0].y,
      lookZ: path[0].z,
      fov: 1.15
    };

    var sparks = [];
    var trail = [];

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
    }

    function project(wx, wy, wz) {
      var relX = wx - cam.x;
      var relY = wy - cam.y;
      var relZ = wz - cam.z;

      // Yaw toward look target (XZ plane)
      var lx = cam.lookX - cam.x;
      var lz = cam.lookZ - cam.z;
      var yaw = Math.atan2(lx, lz);
      var cos = Math.cos(-yaw);
      var sin = Math.sin(-yaw);
      var rx = relX * cos - relZ * sin;
      var rz = relX * sin + relZ * cos;
      var ry = relY;

      // Slight pitch down
      var pitch = 0.38;
      var cp = Math.cos(pitch);
      var sp = Math.sin(pitch);
      var py = ry * cp - rz * sp;
      var pz = ry * sp + rz * cp;

      var depth = Math.max(0.35, pz);
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      var scale = (height * 0.55) / (cam.fov * depth);
      return {
        x: width * 0.5 + rx * scale,
        y: height * 0.58 - py * scale,
        depth: depth,
        scale: scale
      };
    }

    function fogAlpha(depth) {
      return clamp(1 - (depth - 1.2) / 16, 0.08, 1);
    }

    function updateCamera(tip, t) {
      var lookAhead = pointOnPath(path, segLens, totalLen, tip.dist + 1.4);
      var targetLookX = lookAhead.x;
      var targetLookY = lookAhead.y + 0.2;
      var targetLookZ = lookAhead.z;

      var behind = 3.6 - t * 0.8;
      var height = 2.1 + t * 0.55;
      // Pull camera behind tip along last segment direction
      var seg = Math.min(tip.seg, path.length - 2);
      var a = path[seg];
      var b = path[seg + 1];
      var dirX = b.x - a.x;
      var dirZ = b.z - a.z;
      var dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      dirX /= dirLen;
      dirZ /= dirLen;

      var targetCamX = tip.x - dirX * behind + dirZ * 0.35;
      var targetCamZ = tip.z - dirZ * behind - dirX * 0.35;
      var targetCamY = tip.y + height;

      // End settle: pull back toward hub overview
      if (t > 0.88) {
        var u = (t - 0.88) / 0.12;
        targetCamX = lerp(targetCamX, 0.2, u);
        targetCamY = lerp(targetCamY, 3.4, u);
        targetCamZ = lerp(targetCamZ, 6.5, u);
        targetLookX = lerp(targetLookX, 0, u);
        targetLookY = lerp(targetLookY, 0.6, u);
        targetLookZ = lerp(targetLookZ, 0.4, u);
      }

      var smooth = reducedMotion ? 1 : 0.12;
      cam.x = lerp(cam.x, targetCamX, smooth);
      cam.y = lerp(cam.y, targetCamY, smooth);
      cam.z = lerp(cam.z, targetCamZ, smooth);
      cam.lookX = lerp(cam.lookX, targetLookX, smooth);
      cam.lookY = lerp(cam.lookY, targetLookY, smooth);
      cam.lookZ = lerp(cam.lookZ, targetLookZ, smooth);
    }

    function drawBackground(width, height) {
      var g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, colors.page);
      g.addColorStop(0.45, colors.surface);
      g.addColorStop(1, colors.page);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Soft neon wash
      var wash = ctx.createRadialGradient(
        width * 0.55,
        height * 0.35,
        20,
        width * 0.5,
        height * 0.5,
        width * 0.7
      );
      wash.addColorStop(0, "rgba(138,43,226,0.18)");
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    function drawGrid() {
      var lines = [];
      for (var x = -12; x <= 12; x += 1) {
        for (var z = 0; z <= 16; z += 1) {
          var p0 = project(x, 0, z);
          var p1 = project(x + 1, 0, z);
          var p2 = project(x, 0, z + 1);
          if (p0.depth < 18) {
            lines.push({ a: p0, b: p1, d: (p0.depth + p1.depth) * 0.5 });
            lines.push({ a: p0, b: p2, d: (p0.depth + p2.depth) * 0.5 });
          }
        }
      }
      lines.sort(function (u, v) {
        return v.d - u.d;
      });
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        var alpha = fogAlpha(L.d) * 0.22;
        ctx.strokeStyle = "rgba(180,109,255," + alpha.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L.a.x, L.a.y);
        ctx.lineTo(L.b.x, L.b.y);
        ctx.stroke();
      }
    }

    function drawCabinet(node) {
      var base = project(node.x, 0, node.z);
      var top = project(node.x, 1.6, node.z);
      var w = Math.max(6, 18 * (base.scale / 80));
      var h = Math.max(10, base.y - top.y);
      var alpha = fogAlpha(base.depth);
      var lit = node.lit;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = lit > 0.05 ? colors.accent : "rgba(40,32,58,0.95)";
      ctx.fillRect(base.x - w * 0.35, top.y, w * 0.7, h);
      ctx.fillStyle = lit > 0.2 ? colors.tip : "rgba(20,18,30,0.9)";
      ctx.globalAlpha = alpha * (0.35 + lit * 0.65);
      ctx.fillRect(base.x - w * 0.22, top.y + h * 0.12, w * 0.44, h * 0.28);
      if (lit > 0.15) {
        ctx.shadowColor = colors.accent2;
        ctx.shadowBlur = 12 + lit * 18;
        ctx.strokeStyle = colors.accent2;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(base.x - w * 0.35, top.y, w * 0.7, h);
      }
      ctx.restore();
    }

    function drawBus(node) {
      var p = project(node.x, node.y, node.z);
      var r = Math.max(2, 5 * (p.scale / 90));
      var alpha = fogAlpha(p.depth);
      ctx.beginPath();
      ctx.fillStyle =
        "rgba(180,109,255," + (alpha * (0.25 + node.lit * 0.75)).toFixed(3) + ")";
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (node.lit > 0.2) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(98,231,255," + (alpha * node.lit * 0.85).toFixed(3) + ")";
        ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawHub(node) {
      var p = project(node.x, node.y + 0.2, node.z);
      var r = Math.max(8, 22 * (p.scale / 90));
      var alpha = fogAlpha(p.depth);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.strokeStyle = colors.accent2;
      ctx.lineWidth = 2;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 20 + node.lit * 30;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.globalAlpha = alpha * (0.4 + node.lit * 0.6);
      ctx.arc(p.x, p.y, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawNodes() {
      var order = nodes
        .map(function (n, i) {
          return { n: n, i: i, d: project(n.x, n.y, n.z).depth };
        })
        .sort(function (a, b) {
          return b.d - a.d;
        });
      for (var i = 0; i < order.length; i++) {
        var node = order[i].n;
        if (node.kind === "cabinet") drawCabinet(node);
        else if (node.kind === "hub") drawHub(node);
        else drawBus(node);
      }
    }

    function drawWiredPath(uptoDist) {
      var drawn = 0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (var i = 0; i < segLens.length; i++) {
        var segLen = segLens[i];
        var a = path[i];
        var b = path[i + 1];
        var pa = project(a.x, a.y, a.z);
        var pb = project(b.x, b.y, b.z);
        var remain = uptoDist - drawn;
        if (remain <= 0) break;
        var t = Math.min(1, remain / segLen);
        var mx = lerp(a.x, b.x, t);
        var my = lerp(a.y, b.y, t);
        var mz = lerp(a.z, b.z, t);
        var pm = project(mx, my, mz);
        var alpha = fogAlpha((pa.depth + pm.depth) * 0.5);

        // Dim conduit
        ctx.strokeStyle = "rgba(90,60,140," + (alpha * 0.35).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, 2.2 * (pa.scale / 100));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();

        // Live current
        ctx.strokeStyle = "rgba(192,132,255," + (alpha * 0.95).toFixed(3) + ")";
        ctx.shadowColor = colors.accent2;
        ctx.shadowBlur = 12;
        ctx.lineWidth = Math.max(1.5, 3.2 * (pa.scale / 100));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pm.x, pm.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cyan core
        ctx.strokeStyle = "rgba(98,231,255," + (alpha * 0.85).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, 1.4 * (pa.scale / 100));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pm.x, pm.y);
        ctx.stroke();

        drawn += segLen * t;
        if (t < 1) break;
      }
    }

    function spawnSpark(tip) {
      if (sparks.length > 48) return;
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.015 + Math.random() * 0.04;
      sparks.push({
        x: tip.x,
        y: tip.y,
        z: tip.z,
        vx: Math.cos(ang) * spd,
        vy: 0.02 + Math.random() * 0.04,
        vz: Math.sin(ang) * spd,
        life: 1
      });
    }

    function updateSparks(dt) {
      for (var i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.x += s.vx * dt * 60;
        s.y += s.vy * dt * 60;
        s.z += s.vz * dt * 60;
        s.vy -= 0.0025 * dt * 60;
        s.life -= dt * 1.8;
        if (s.life <= 0) sparks.splice(i, 1);
      }
    }

    function drawSparks() {
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        var p = project(s.x, s.y, s.z);
        var alpha = fogAlpha(p.depth) * s.life;
        ctx.beginPath();
        ctx.fillStyle = "rgba(98,231,255," + alpha.toFixed(3) + ")";
        ctx.arc(p.x, p.y, Math.max(1, 2.2 * (p.scale / 100)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawTip(tip) {
      var p = project(tip.x, tip.y, tip.z);
      var r = Math.max(3, 7 * (p.scale / 90));
      ctx.save();
      ctx.shadowColor = colors.tip;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function lightNodes(uptoDist) {
      var acc = 0;
      for (var i = 0; i < nodes.length; i++) {
        if (i === 0) {
          nodes[i].lit = clamp(uptoDist / 0.4, 0, 1);
          continue;
        }
        acc += segLens[i - 1];
        var target = uptoDist >= acc - 0.05 ? 1 : 0;
        nodes[i].lit = lerp(nodes[i].lit, target, reducedMotion ? 1 : 0.2);
      }
    }

    function frame(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      var elapsed = ts - startTs;
      var rawT = reducedMotion ? 1 : clamp(elapsed / durationMs, 0, 1);
      progress = easeInOutCubic(rawT);

      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      var uptoDist = totalLen * progress;
      var tip = pointOnPath(path, segLens, totalLen, uptoDist);
      tip.dist = uptoDist;

      updateCamera(tip, progress);
      lightNodes(uptoDist);

      if (!reducedMotion && progress < 1 && Math.random() < 0.55) {
        spawnSpark(tip);
      }
      updateSparks(1 / 60);

      trail.push({ x: tip.x, y: tip.y, z: tip.z, life: 1 });
      if (trail.length > 40) trail.shift();

      drawBackground(width, height);
      drawGrid();
      drawWiredPath(uptoDist);
      drawNodes();
      drawSparks();
      if (progress < 1 || !settled) drawTip(tip);

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
      progress = reducedMotion ? 1 : 0;
      settled = false;
      sparks.length = 0;
      trail.length = 0;
      for (var i = 0; i < nodes.length; i++) nodes[i].lit = reducedMotion ? 1 : 0;

      if (reducedMotion) {
        var tip = pointOnPath(path, segLens, totalLen, totalLen);
        tip.dist = totalLen;
        tip.seg = path.length - 2;
        updateCamera(tip, 1);
        lightNodes(totalLen);
        drawBackground(canvas.clientWidth, canvas.clientHeight);
        drawGrid();
        drawWiredPath(totalLen);
        drawNodes();
        return new Promise(function (resolve) {
          resolveDone = resolve;
          window.setTimeout(finishScene, 0);
        });
      }

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
