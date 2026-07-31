(function (global) {
  "use strict";

  var HOLD_MS = 2800;
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

    var done = new Promise(function (resolve) {
      resolveDone = resolve;
    });

    function cleanupListeners() {
      el.removeEventListener("click", onSkip);
      document.removeEventListener("keydown", onKey);
    }

    function unlock() {
      html.classList.remove("is-arcade-intro");
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("aria-busy", "false");
      el.classList.remove("is-leaving", "is-ready");
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
      el.classList.add("is-leaving");
      var fade = prefersReducedMotion() ? 0 : FADE_MS;
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

    html.classList.add("is-arcade-intro");
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    el.setAttribute("aria-busy", "true");

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!finished) el.classList.add("is-ready");
      });
    });

    el.addEventListener("click", onSkip);
    document.addEventListener("keydown", onKey);

    var hold = prefersReducedMotion() ? REDUCED_HOLD_MS : HOLD_MS;
    holdTimer = window.setTimeout(finish, hold);

    return done;
  }

  global.WhiteStudioArcadeIntro = {
    mount: mountArcadeIntro
  };
})(window);
