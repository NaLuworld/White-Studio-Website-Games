/**
 * Hub entrance overlay controller.
 * Canvas path uses WhiteStudioArcadeCurrent (procedural tunnel loading);
 * reduced-motion falls back to lobby still + short hold.
 * Skip: click / Enter / Space / Escape.
 */
(function (global) {
  "use strict";

  var HOLD_MS = 3200;
  var FADE_MS = 350;
  var REDUCED_HOLD_MS = 120;

  function prefersReducedMotion() {
    try {
      return Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_) {
      return false;
    }
  }

  function mountArcadeIntro(root) {
    var el = root || document.getElementById("arcade-intro");
    if (!el || el.dataset.arcadeIntroBound === "1") {
      return Promise.resolve(false);
    }
    el.dataset.arcadeIntroBound = "1";

    var html = document.documentElement;
    var finished = false;
    var holdTimer = null;
    var resolveDone = null;
    var scene = null;
    var reduced = prefersReducedMotion();
    var canvas = el.querySelector(".arcade-intro__canvas");
    var media = el.querySelector(".arcade-intro__media");

    var done = new Promise(function (resolve) {
      resolveDone = resolve;
    });

    function cleanupListeners() {
      el.removeEventListener("click", onSkip);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    }

    function unlock() {
      if (scene) {
        scene.stop();
        scene = null;
      }
      html.classList.remove("is-arcade-intro");
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("aria-busy", "false");
      el.classList.remove("is-leaving", "is-ready", "is-canvas", "is-fallback-media");
      if (el.parentNode) el.parentNode.removeChild(el);
      if (resolveDone) {
        resolveDone(true);
        resolveDone = null;
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      cleanupListeners();
      window.clearTimeout(holdTimer);
      if (scene) scene.stop();
      el.classList.add("is-leaving");
      var fade = reduced ? 0 : FADE_MS;
      window.setTimeout(unlock, fade);
    }

    function onSkip(event) {
      if (event) event.preventDefault();
      finish();
    }

    function onKey(event) {
      var key = event.key;
      if (key === "Escape" || key === "Enter" || key === " " || key === "Spacebar") {
        event.preventDefault();
        finish();
      }
    }

    function onResize() {
      if (scene) scene.resize();
    }

    html.classList.add("is-arcade-intro");
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    el.setAttribute("aria-busy", "true");

    var useCanvas =
      canvas &&
      !reduced &&
      global.WhiteStudioArcadeCurrent &&
      typeof global.WhiteStudioArcadeCurrent.create === "function";

    if (useCanvas) {
      el.classList.add("is-canvas");
      if (media) media.hidden = true;
      scene = global.WhiteStudioArcadeCurrent.create(canvas, {
        reducedMotion: false,
        durationMs:
          (global.WhiteStudioArcadeCurrent &&
            global.WhiteStudioArcadeCurrent.DEFAULT_DURATION_MS) ||
          HOLD_MS
      });
      window.addEventListener("resize", onResize);
      scene.start().then(function () {
        if (!finished) finish();
      });
    } else {
      el.classList.add("is-fallback-media");
      if (canvas) canvas.hidden = true;
      if (media) media.hidden = false;
      var hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
      holdTimer = window.setTimeout(finish, hold);
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!finished) el.classList.add("is-ready");
      });
    });

    el.addEventListener("click", onSkip);
    document.addEventListener("keydown", onKey);

    return done;
  }

  global.WhiteStudioArcadeIntro = {
    mount: mountArcadeIntro
  };
})(window);
