/**
 * Hub entrance overlay controller.
 * Canvas path opens on black with the title, then dips into
 * WhiteStudioArcadeCurrent (first-person cable / data-stream loading);
 * mobile uses a dedicated portrait signal-link sequence;
 * reduced-motion falls back to lobby still + short hold.
 * Skip: click / Enter / Space / Escape.
 * Wireframe corridor prototype lives in arcade-tunnel-scene.js (not loaded here).
 */
(function (global) {
  "use strict";

  var HOLD_MS = 3200;
  var FADE_MS = 350;
  var REDUCED_HOLD_MS = 120;
  var CABLE_LEAD_MS = 700;
  var MOBILE_HOLD_MS = 1800;
  var INTRO_SKIP_KEY = "ws_arcade_intro_skip_v1";

  function prefersReducedMotion() {
    try {
      return Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_) {
      return false;
    }
  }

  function prefersMobileIntro() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    } catch (_) {
      return window.innerWidth <= 768;
    }
  }

  function shouldSkipIntro() {
    try {
      var raw = sessionStorage.getItem(INTRO_SKIP_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at) return false;
      return Date.now() - Number(parsed.at) < 1000 * 60 * 60 * 12;
    } catch (_) {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      sessionStorage.setItem(INTRO_SKIP_KEY, JSON.stringify({ at: Date.now() }));
    } catch (_) {}
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
    var mobile = !reduced && prefersMobileIntro();
    var canvas = el.querySelector(".arcade-intro__canvas");
    var media = el.querySelector(".arcade-intro__media");
    var mobileSignal = el.querySelector(".arcade-intro__mobile-signal");

    var done = new Promise(function (resolve) {
      resolveDone = resolve;
    });

    function cleanupListeners() {
      el.removeEventListener("pointerup", onSkip);
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
      el.classList.remove(
        "is-leaving",
        "is-ready",
        "is-streaming",
        "is-canvas",
        "is-mobile",
        "is-fallback-media"
      );
      if (el.parentNode) el.parentNode.removeChild(el);
      if (resolveDone) {
        resolveDone(true);
        resolveDone = null;
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      markIntroSeen();
      cleanupListeners();
      window.clearTimeout(holdTimer);
      if (scene) scene.stop();
      el.classList.add("is-leaving");
      var fade = reduced ? 0 : FADE_MS;
      window.setTimeout(unlock, fade);
    }

    function onSkip(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
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

    if (shouldSkipIntro()) {
      html.classList.remove("is-arcade-intro");
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("aria-busy", "false");
      if (el.parentNode) el.parentNode.removeChild(el);
      if (resolveDone) resolveDone(false);
      return done;
    }

    html.classList.add("is-arcade-intro");
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    el.setAttribute("aria-busy", "true");

    var useCanvas =
      canvas &&
      !mobile &&
      !reduced &&
      global.WhiteStudioArcadeCurrent &&
      typeof global.WhiteStudioArcadeCurrent.create === "function";

    if (mobile) {
      el.classList.add("is-mobile");
      if (canvas) canvas.hidden = true;
      if (media) media.hidden = true;
      if (mobileSignal) mobileSignal.hidden = false;
      holdTimer = window.setTimeout(finish, MOBILE_HOLD_MS);
    } else if (useCanvas) {
      el.classList.add("is-canvas");
      if (media) media.hidden = true;
      if (mobileSignal) mobileSignal.hidden = true;
      scene = global.WhiteStudioArcadeCurrent.create(canvas, {
        reducedMotion: false,
        durationMs:
          (global.WhiteStudioArcadeCurrent &&
            global.WhiteStudioArcadeCurrent.DEFAULT_DURATION_MS) ||
          HOLD_MS
      });
      window.addEventListener("resize", onResize);
      holdTimer = window.setTimeout(function () {
        if (finished) return;
        el.classList.add("is-streaming");
        scene.start().then(function () {
          if (!finished) finish();
        });
      }, CABLE_LEAD_MS);
    } else {
      el.classList.add("is-fallback-media");
      if (canvas) canvas.hidden = true;
      if (media) media.hidden = false;
      if (mobileSignal) mobileSignal.hidden = true;
      var hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
      holdTimer = window.setTimeout(finish, hold);
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!finished) el.classList.add("is-ready");
      });
    });

    el.addEventListener("pointerup", onSkip);
    el.addEventListener("click", onSkip);
    document.addEventListener("keydown", onKey);

    return done;
  }

  global.WhiteStudioArcadeIntro = {
    mount: mountArcadeIntro
  };
})(window);
