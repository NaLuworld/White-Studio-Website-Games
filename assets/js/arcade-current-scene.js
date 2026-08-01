/**
 * Hub intro: Canvas2D pseudo-3D current path.
 * One Catmull–Rom spline drives the subject, tangent, trailing camera rig, and look-ahead.
 * Exposed as WhiteStudioArcadeCurrent.create(canvas, options) → { start, stop, resize }.
 */
(function (global) {
  "use strict";

  var DEFAULT_DURATION_MS = 3200;
  var SETTLE_MS = 320;
  var SPLINE_SAMPLES = 256;
  var WORLD_UP = { x: 0, y: 1, z: 0 };

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

  /** Ease that slows in the last ~15% so the tip settles on the hub. */
  function progressEase(t) {
    var u = clamp(t, 0, 1);
    if (u < 0.85) return easeInOutCubic(u / 0.85) * 0.92;
    var local = (u - 0.85) / 0.15;
    return 0.92 + easeInOutCubic(local) * 0.08;
  }

  function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
  }

  function vec3(x, y, z) {
    return { x: x, y: y, z: z };
  }

  function vAdd(a, b) {
    return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function vSub(a, b) {
    return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function vScale(a, s) {
    return vec3(a.x * s, a.y * s, a.z * s);
  }

  function vDot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function vLen(a) {
    return Math.sqrt(vDot(a, a));
  }

  function vNormalize(a) {
    var len = vLen(a);
    if (len < 1e-6) return vec3(0, 0, 1);
    return vScale(a, 1 / len);
  }

  function vCross(a, b) {
    return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }

  function vLerp(a, b, t) {
    return vec3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }

  function vDamp(current, target, lambda, dt) {
    return vec3(
      damp(current.x, target.x, lambda, dt),
      damp(current.y, target.y, lambda, dt),
      damp(current.z, target.z, lambda, dt)
    );
  }

  /** Far entry → gentle S → central hub. */
  function buildControlPoints() {
    return [
      vec3(-2.2, 0.22, 15.5),
      vec3(-1.4, 0.28, 12.8),
      vec3(0.2, 0.34, 10.2),
      vec3(1.4, 0.4, 7.6),
      vec3(0.6, 0.48, 5.2),
      vec3(-0.4, 0.58, 3.2),
      vec3(0.0, 0.72, 1.5),
      vec3(0.0, 0.9, 0.35)
    ];
  }

  function catmullRomPoint(points, t) {
    var n = points.length;
    var maxSeg = n - 1;
    var u = clamp(t, 0, 1) * maxSeg;
    var i = Math.min(Math.floor(u), maxSeg - 1);
    var local = u - i;
    var p0 = points[Math.max(0, i - 1)];
    var p1 = points[i];
    var p2 = points[i + 1];
    var p3 = points[Math.min(n - 1, i + 2)];
    var t2 = local * local;
    var t3 = t2 * local;
    return vec3(
      0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * local +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * local +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * local +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    );
  }

  function catmullRomTangent(points, t) {
    var eps = 0.002;
    var a = catmullRomPoint(points, clamp(t - eps, 0, 1));
    var b = catmullRomPoint(points, clamp(t + eps, 0, 1));
    return vNormalize(vSub(b, a));
  }

  function buildArcLengthTable(points, samples) {
    var table = [{ t: 0, dist: 0 }];
    var prev = catmullRomPoint(points, 0);
    var total = 0;
    for (var i = 1; i <= samples; i++) {
      var t = i / samples;
      var p = catmullRomPoint(points, t);
      total += vLen(vSub(p, prev));
      table.push({ t: t, dist: total });
      prev = p;
    }
    return { table: table, total: total };
  }

  function distanceToCurveT(arc, distance) {
    var table = arc.table;
    var total = arc.total;
    if (distance <= 0) return 0;
    if (distance >= total) return 1;
    for (var i = 1; i < table.length; i++) {
      if (table[i].dist >= distance) {
        var a = table[i - 1];
        var b = table[i];
        var span = Math.max(1e-6, b.dist - a.dist);
        return lerp(a.t, b.t, (distance - a.dist) / span);
      }
    }
    return 1;
  }

  function progressToCurveT(arc, progress) {
    return distanceToCurveT(arc, arc.total * clamp(progress, 0, 1));
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
    var settled = false;
    var resolveDone = null;
    var colors = readThemeColors();
    var camSnapped = false;

    var controls = buildControlPoints();
    var arc = buildArcLengthTable(controls, SPLINE_SAMPLES);

    var nodeSpecs = [
      { kind: "bus", p: 0.0 },
      { kind: "cabinet", p: 0.18 },
      { kind: "bus", p: 0.36 },
      { kind: "cabinet", p: 0.52 },
      { kind: "bus", p: 0.68 },
      { kind: "cabinet", p: 0.84 },
      { kind: "hub", p: 1.0 }
    ];
    var nodes = nodeSpecs.map(function (spec) {
      var p = catmullRomPoint(controls, progressToCurveT(arc, spec.p));
      return {
        kind: spec.kind,
        x: p.x,
        y: p.y,
        z: p.z,
        progress: spec.p,
        lit: 0
      };
    });

    var trailDistance = 4.2;
    var cameraHeight = 2.35;
    var lookAheadFrac = 0.1;
    var baseFov = 1.18;
    var camDamp = 6.5;
    var lookDamp = 8.5;
    var tangentDamp = 7.0;

    var cam = {
      x: 0,
      y: 4,
      z: 12,
      lookX: 0,
      lookY: 0.4,
      lookZ: 6,
      fov: baseFov
    };
    var camPos = vec3(cam.x, cam.y, cam.z);
    var lookPos = vec3(cam.lookX, cam.lookY, cam.lookZ);
    var camTangent = vec3(0, 0, -1);

    var sparks = [];
    var conduitSamples = [];

    function rebuildConduitSamples() {
      conduitSamples = [];
      var steps = 96;
      for (var i = 0; i <= steps; i++) {
        var p = i / steps;
        var curveT = progressToCurveT(arc, p);
        conduitSamples.push({
          progress: p,
          point: catmullRomPoint(controls, curveT)
        });
      }
    }

    function updateViewportRig() {
      var w = Math.max(1, canvas.clientWidth);
      var mobile = w < 720;
      trailDistance = mobile ? 5.1 : 4.2;
      cameraHeight = mobile ? 2.8 : 2.35;
      baseFov = mobile ? 1.28 : 1.18;
      lookAheadFrac = mobile ? 0.12 : 0.1;
    }

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
      updateViewportRig();
    }

    function project(wx, wy, wz) {
      var world = vec3(wx, wy, wz);
      var eye = vec3(cam.x, cam.y, cam.z);
      var look = vec3(cam.lookX, cam.lookY, cam.lookZ);
      var forward = vNormalize(vSub(look, eye));
      var right = vNormalize(vCross(forward, WORLD_UP));
      // Degenerate if looking nearly straight up/down
      if (vLen(right) < 1e-4) right = vec3(1, 0, 0);
      var up = vCross(right, forward);

      var rel = vSub(world, eye);
      var camX = vDot(rel, right);
      var camY = vDot(rel, up);
      var camZ = vDot(rel, forward);

      if (camZ <= 0.35) {
        return { x: 0, y: 0, depth: camZ, scale: 0, visible: false };
      }

      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      var scale = (height * 0.62) / (cam.fov * camZ);
      return {
        x: width * 0.5 + camX * scale,
        // Lens shift: look target lands in lower focus band (~72%) under brand copy
        y: height * 0.72 - camY * scale,
        depth: camZ,
        scale: scale,
        visible: true
      };
    }

    function fogAlpha(depth) {
      return clamp(1 - (depth - 1.6) / 18, 0.1, 1);
    }

    function sampleSubject(curveProgress) {
      var curveT = progressToCurveT(arc, curveProgress);
      var subject = catmullRomPoint(controls, curveT);
      var tangent = catmullRomTangent(controls, curveT);
      var lookT = progressToCurveT(arc, clamp(curveProgress + lookAheadFrac, 0, 1));
      var look = catmullRomPoint(controls, lookT);
      return {
        subject: subject,
        tangent: tangent,
        look: look,
        curveT: curveT,
        dist: arc.total * curveProgress
      };
    }

    function updateCamera(curveProgress, dt, snap) {
      var sample = sampleSubject(curveProgress);
      var desiredCam = vAdd(
        vSub(sample.subject, vScale(sample.tangent, trailDistance)),
        vScale(WORLD_UP, cameraHeight)
      );
      // Keep a minimum distance so tip never sits inside the lens
      var toSubject = vSub(sample.subject, desiredCam);
      if (vLen(toSubject) < 2.4) {
        desiredCam = vSub(sample.subject, vScale(sample.tangent, 2.8));
        desiredCam = vAdd(desiredCam, vScale(WORLD_UP, cameraHeight * 0.85));
      }

      if (snap || reducedMotion) {
        camPos = desiredCam;
        lookPos = sample.look;
        camTangent = sample.tangent;
        camSnapped = true;
      } else {
        camPos = vDamp(camPos, desiredCam, camDamp, dt);
        lookPos = vDamp(lookPos, sample.look, lookDamp, dt);
        camTangent = vNormalize(vDamp(camTangent, sample.tangent, tangentDamp, dt));
      }

      cam.x = camPos.x;
      cam.y = camPos.y;
      cam.z = camPos.z;
      cam.lookX = lookPos.x;
      cam.lookY = lookPos.y + 0.12;
      cam.lookZ = lookPos.z;
      cam.fov = baseFov * (1 - curveProgress * 0.08);
      return sample;
    }

    function drawBackground(width, height) {
      var g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, colors.page);
      g.addColorStop(0.48, colors.surface);
      g.addColorStop(1, colors.page);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      var wash = ctx.createRadialGradient(
        width * 0.5,
        height * 0.62,
        30,
        width * 0.5,
        height * 0.7,
        width * 0.75
      );
      wash.addColorStop(0, "rgba(138,43,226,0.2)");
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    function drawGrid() {
      var lines = [];
      for (var x = -10; x <= 10; x += 1) {
        for (var z = -1; z <= 18; z += 1) {
          var p0 = project(x, 0, z);
          var p1 = project(x + 1, 0, z);
          var p2 = project(x, 0, z + 1);
          if (p0.visible && p1.visible) {
            lines.push({ a: p0, b: p1, d: (p0.depth + p1.depth) * 0.5 });
          }
          if (p0.visible && p2.visible) {
            lines.push({ a: p0, b: p2, d: (p0.depth + p2.depth) * 0.5 });
          }
        }
      }
      lines.sort(function (a, b) {
        return b.d - a.d;
      });
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        var alpha = fogAlpha(L.d) * 0.32;
        ctx.strokeStyle = "rgba(180,109,255," + alpha.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L.a.x, L.a.y);
        ctx.lineTo(L.b.x, L.b.y);
        ctx.stroke();
      }
    }

    function drawPolyline(samples, fromIdx, toIdx, styleFn) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      var started = false;
      var lastVisible = null;
      for (var i = fromIdx; i <= toIdx; i++) {
        var pt = samples[i].point;
        var p = project(pt.x, pt.y, pt.z);
        if (!p.visible) {
          if (started) {
            ctx.stroke();
            started = false;
          }
          lastVisible = null;
          continue;
        }
        styleFn(p);
        if (!started) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
        lastVisible = p;
      }
      if (started) ctx.stroke();
      return lastVisible;
    }

    /** Full dim conduit — shows destination before current arrives. */
    function drawConduit() {
      if (!conduitSamples.length) return;
      drawPolyline(conduitSamples, 0, conduitSamples.length - 1, function (p) {
        var alpha = fogAlpha(p.depth) * 0.42;
        ctx.strokeStyle = "rgba(90,60,140," + alpha.toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.2, 2.4 * (p.scale / 100));
        ctx.shadowBlur = 0;
      });
    }

    /** Energized segment only. */
    function drawCurrentTrail(curveProgress) {
      if (!conduitSamples.length) return;
      var endIdx = Math.max(1, Math.floor(curveProgress * (conduitSamples.length - 1)));
      ctx.save();
      drawPolyline(conduitSamples, 0, endIdx, function (p) {
        var alpha = fogAlpha(p.depth) * 0.95;
        ctx.strokeStyle = "rgba(192,132,255," + alpha.toFixed(3) + ")";
        ctx.shadowColor = colors.accent2;
        ctx.shadowBlur = 14;
        ctx.lineWidth = Math.max(1.8, 3.4 * (p.scale / 100));
      });
      ctx.shadowBlur = 0;
      drawPolyline(conduitSamples, 0, endIdx, function (p) {
        var alpha = fogAlpha(p.depth) * 0.9;
        ctx.strokeStyle = "rgba(98,231,255," + alpha.toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, 1.5 * (p.scale / 100));
      });
      ctx.restore();
    }

    function drawCabinet(node) {
      var base = project(node.x, 0, node.z);
      var top = project(node.x, 1.55, node.z);
      if (!base.visible || !top.visible) return;
      var w = Math.max(6, Math.min(22, 18 * (base.scale / 80)));
      var h = Math.max(10, base.y - top.y);
      var alpha = fogAlpha(base.depth);
      var lit = node.lit;
      ctx.save();
      ctx.globalAlpha = alpha * (0.32 + lit * 0.68);
      ctx.fillStyle = lit > 0.05 ? colors.accent : "rgba(28,22,40,0.9)";
      ctx.fillRect(base.x - w * 0.35, top.y, w * 0.7, h);
      ctx.fillStyle = lit > 0.2 ? colors.tip : "rgba(16,14,24,0.9)";
      ctx.globalAlpha = alpha * (0.18 + lit * 0.82);
      ctx.fillRect(base.x - w * 0.22, top.y + h * 0.12, w * 0.44, h * 0.28);
      if (lit > 0.15) {
        ctx.shadowColor = colors.accent2;
        ctx.shadowBlur = 12 + lit * 16;
        ctx.strokeStyle = colors.accent2;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(base.x - w * 0.35, top.y, w * 0.7, h);
      }
      ctx.restore();
    }

    function drawBus(node) {
      var p = project(node.x, node.y, node.z);
      if (!p.visible) return;
      var r = Math.max(2, Math.min(8, 5 * (p.scale / 90)));
      var alpha = fogAlpha(p.depth);
      ctx.beginPath();
      ctx.fillStyle = "rgba(180,109,255," + (alpha * (0.22 + node.lit * 0.78)).toFixed(3) + ")";
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (node.lit > 0.2) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(98,231,255," + (alpha * node.lit * 0.85).toFixed(3) + ")";
        ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawHub(node, curveProgress) {
      var p = project(node.x, node.y + 0.15, node.z);
      if (!p.visible) return;
      var arrived = curveProgress >= 0.97;
      var pulse = arrived ? 1 : 0.35 + node.lit * 0.4;
      var r = Math.max(8, Math.min(28, 20 * (p.scale / 90)));
      var alpha = fogAlpha(p.depth);
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.beginPath();
      ctx.strokeStyle = colors.accent2;
      ctx.lineWidth = arrived ? 2.5 : 1.6;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = arrived ? 28 : 12 + node.lit * 18;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.globalAlpha = alpha * (arrived ? 0.95 : 0.35 + node.lit * 0.45);
      ctx.arc(p.x, p.y, r * (arrived ? 0.34 : 0.26), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawNodes(curveProgress) {
      var order = nodes
        .map(function (n) {
          return { n: n, d: project(n.x, n.y, n.z).depth };
        })
        .sort(function (a, b) {
          return b.d - a.d;
        });
      for (var i = 0; i < order.length; i++) {
        var node = order[i].n;
        if (node.kind === "cabinet") drawCabinet(node);
        else if (node.kind === "hub") drawHub(node, curveProgress);
        else drawBus(node);
      }
    }

    function spawnSpark(tip) {
      if (sparks.length > 40) return;
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.012 + Math.random() * 0.035;
      sparks.push({
        x: tip.x,
        y: tip.y,
        z: tip.z,
        vx: Math.cos(ang) * spd,
        vy: 0.015 + Math.random() * 0.03,
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
        s.vy -= 0.0022 * dt * 60;
        s.life -= dt * 1.7;
        if (s.life <= 0) sparks.splice(i, 1);
      }
    }

    function drawSparks() {
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        var p = project(s.x, s.y, s.z);
        if (!p.visible) continue;
        var alpha = fogAlpha(p.depth) * s.life;
        ctx.beginPath();
        ctx.fillStyle = "rgba(98,231,255," + alpha.toFixed(3) + ")";
        ctx.arc(p.x, p.y, Math.max(1, Math.min(3.2, 2.1 * (p.scale / 100))), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawTip(subject, curveProgress) {
      var p = project(subject.x, subject.y, subject.z);
      if (!p.visible) return;
      var grow = 1 + curveProgress * 0.45;
      var r = Math.max(3.2, Math.min(14, 7.5 * grow * (p.scale / 95)));
      ctx.save();
      ctx.shadowColor = colors.tip;
      ctx.shadowBlur = 26 + curveProgress * 16;
      ctx.beginPath();
      ctx.fillStyle = "rgba(98,231,255,0.26)";
      ctx.arc(p.x, p.y, r * 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = colors.tip;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(p.x, p.y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function lightNodes(curveProgress) {
      for (var i = 0; i < nodes.length; i++) {
        var target = curveProgress >= nodes[i].progress - 0.02 ? 1 : 0;
        nodes[i].lit = lerp(nodes[i].lit, target, reducedMotion ? 1 : 0.18);
      }
    }

    function renderFrame(curveProgress, sample) {
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      drawBackground(width, height);
      drawGrid();
      drawConduit();
      drawCurrentTrail(curveProgress);
      drawNodes(curveProgress);
      drawSparks();
      if (curveProgress < 1 || !settled) drawTip(sample.subject, curveProgress);
    }

    function frame(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      if (!lastFrameTs) lastFrameTs = ts;
      var dt = clamp((ts - lastFrameTs) / 1000, 0.001, 0.05);
      lastFrameTs = ts;

      var elapsed = ts - startTs;
      var rawT = reducedMotion ? 1 : clamp(elapsed / durationMs, 0, 1);
      progress = progressEase(rawT);

      var sample = updateCamera(progress, dt, !camSnapped);
      lightNodes(progress);

      if (!reducedMotion && progress < 0.98 && Math.random() < 0.5) {
        spawnSpark(sample.subject);
      }
      updateSparks(dt);

      renderFrame(progress, sample);

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
      rebuildConduitSamples();
      running = true;
      startTs = 0;
      lastFrameTs = 0;
      progress = reducedMotion ? 1 : 0;
      settled = false;
      camSnapped = false;
      sparks.length = 0;
      for (var i = 0; i < nodes.length; i++) nodes[i].lit = reducedMotion ? 1 : 0;

      if (reducedMotion) {
        var sample = updateCamera(1, 1, true);
        lightNodes(1);
        renderFrame(1, sample);
        return new Promise(function (resolve) {
          resolveDone = resolve;
          window.setTimeout(finishScene, 0);
        });
      }

      // Snap first frame so the rig is legal before motion starts
      updateCamera(0, 1, true);

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
