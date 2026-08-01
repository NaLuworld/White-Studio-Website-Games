/**
 * Hub entrance overlay controller.
 * Canvas path opens on black with the title, then dips into
 * WhiteStudioArcadeCurrent (first-person cable / data-stream loading)
 * on both desktop and phone (phone retunes quality / portrait framing).
 * Plays on every hub load / reconnect (no session skip).
 * reduced-motion falls back to lobby still + short hold.
 * Skip: pointer / click / Enter / Space / Escape.
 * Wireframe corridor prototype lives in arcade-tunnel-scene.js (not loaded here).
 */
(function (global) {
  "use strict";

  var HOLD_MS = 3200;
  var FADE_MS = 350;
  var REDUCED_HOLD_MS = 120;
  var CABLE_LEAD_MS = 700;
  var SAFETY_PAD_MS = 1200;
  var LEGACY_INTRO_SKIP_KEY = "ws_arcade_intro_skip_v1";

  function prefersReducedMotion() {
    try {
      return Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_) {
      return false;
    }
  }

  function prefersPhoneLayout() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    } catch (_) {
      return window.innerWidth <= 768;
    }
  }

  function clearLegacyIntroSkip() {
    try {
      sessionStorage.removeItem(LEGACY_INTRO_SKIP_KEY);
    } catch (_) {}
  }

  function mountArcadeIntro(root) {
    var el = root || document.getElementById("arcade-intro");
    if (!el || el.dataset.arcadeIntroBound === "1") {
      return Promise.resolve(false);
    }
    el.dataset.arcadeIntroBound = "1";
    clearLegacyIntroSkip();

    var html = document.documentElement;
    var finished = false;
    var holdTimer = null;
    var safetyTimer = null;
    var resolveDone = null;
    var scene = null;
    var streamStarted = false;
    var reduced = prefersReducedMotion();
    var phone = prefersPhoneLayout();
    var canvas = el.querySelector(".arcade-intro__canvas");
    var media = el.querySelector(".arcade-intro__media");

    var done = new Promise(function (resolve) {
      resolveDone = resolve;
    });

    function cleanupListeners() {
      el.removeEventListener("pointerup", onSkip);
      el.removeEventListener("click", onSkip);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
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
        "is-phone",
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
      cleanupListeners();
      window.clearTimeout(holdTimer);
      window.clearTimeout(safetyTimer);
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

    function kickScene() {
      if (finished || !scene) return;
      try {
        scene.resize();
        if (typeof scene.nudge === "function") scene.nudge();
      } catch (_) {}
    }

    function onVisibility() {
      if (document.visibilityState === "visible") kickScene();
    }

    function onPageShow(event) {
      // Soft reconnect (bfcache / tab restore): keep the overlay alive and re-kick canvas.
      if (event && event.persisted) kickScene();
    }

    function beginStream() {
      if (finished || streamStarted || !scene) return;
      streamStarted = true;
      el.classList.add("is-streaming");
      kickScene();
      scene.start().then(function () {
        if (!finished) finish();
      });
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
      if (phone) el.classList.add("is-phone");
      if (media) media.hidden = true;
      if (canvas) canvas.hidden = false;
      scene = global.WhiteStudioArcadeCurrent.create(canvas, {
        reducedMotion: false,
        quality: phone ? "phone" : "desktop",
        portrait: phone,
        durationMs:
          (global.WhiteStudioArcadeCurrent &&
            global.WhiteStudioArcadeCurrent.DEFAULT_DURATION_MS) ||
          HOLD_MS
      });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pageshow", onPageShow);
      holdTimer = window.setTimeout(beginStream, CABLE_LEAD_MS);
      safetyTimer = window.setTimeout(function () {
        if (!finished) finish();
      }, CABLE_LEAD_MS + HOLD_MS + SAFETY_PAD_MS);
    } else {
      el.classList.add("is-fallback-media");
      if (canvas) canvas.hidden = true;
      if (media) media.hidden = false;
      var hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
      holdTimer = window.setTimeout(finish, hold);
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!finished) {
          el.classList.add("is-ready");
          kickScene();
        }
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
