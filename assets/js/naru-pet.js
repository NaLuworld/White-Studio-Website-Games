(function (global) {
  "use strict";

  var CELL = 96;
  var COLS = 8;
  var STORAGE_TIPS = "ws_naru_tips_v1";

  var ATLASES = {
    core: {
      url: "/assets/images/naru/naru-core-c8r4-96.webp",
      fallback: "/assets/images/naru/naru-core-c8r4-96.png",
      rows: 4,
      width: 768,
      height: 384
    },
    guide: {
      url: "/assets/images/naru/naru-guide-c8r4-96.webp",
      fallback: "/assets/images/naru/naru-guide-c8r4-96.png",
      rows: 4,
      width: 768,
      height: 384
    },
    react: {
      url: "/assets/images/naru/naru-react-c8r3-96.webp",
      fallback: "/assets/images/naru/naru-react-c8r3-96.png",
      rows: 3,
      width: 768,
      height: 288
    }
  };

  var ANIMS = {
    idle: { atlas: "core", row: 0, frames: 8, fps: 7, loop: true },
    blink: { atlas: "core", row: 1, frames: 8, fps: 10, loop: false },
    wave: { atlas: "core", row: 2, frames: 8, fps: 10, loop: false },
    point_right: { atlas: "core", row: 3, frames: 8, fps: 10, loop: false },
    point_left: { atlas: "guide", row: 0, frames: 8, fps: 10, loop: false },
    point_up: { atlas: "guide", row: 1, frames: 8, fps: 10, loop: false },
    point_down: { atlas: "guide", row: 2, frames: 8, fps: 10, loop: false },
    look_user: { atlas: "guide", row: 3, frames: 8, fps: 7, loop: true },
    celebrate: { atlas: "react", row: 0, frames: 8, fps: 10, loop: false },
    think: { atlas: "react", row: 1, frames: 8, fps: 7, loop: true },
    sad: { atlas: "react", row: 2, frames: 8, fps: 6, loop: false }
  };

  var rootEl = null;
  var spriteEl = null;
  var bubbleEl = null;
  var textEl = null;
  var dismissBtn = null;
  var timer = null;
  var blinkTimer = null;
  var frame = 0;
  var currentAnim = "idle";
  var tipQueue = [];
  var tipBusy = false;
  var highlightEl = null;
  var onceDone = null;

  function t(key) {
    if (global.WhiteStudioI18n && typeof global.WhiteStudioI18n.t === "function") {
      return global.WhiteStudioI18n.t(key);
    }
    return key;
  }

  function prefersReducedMotion() {
    try {
      return Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (_) {
      return false;
    }
  }

  function tipsSeen() {
    try {
      return localStorage.getItem(STORAGE_TIPS) === "1";
    } catch (_) {
      return false;
    }
  }

  function markTipsSeen() {
    try {
      localStorage.setItem(STORAGE_TIPS, "1");
    } catch (_) {}
  }

  function clearHighlight() {
    if (highlightEl) {
      highlightEl.classList.remove("naru-target-glow");
      highlightEl = null;
    }
  }

  function setHighlight(selector) {
    clearHighlight();
    if (!selector) return;
    var el = document.querySelector(selector);
    if (!el) return;
    el.classList.add("naru-target-glow");
    highlightEl = el;
    try {
      var narrow = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
      el.scrollIntoView({
        behavior: prefersReducedMotion() || narrow ? "auto" : "smooth",
        block: narrow ? "nearest" : "center"
      });
    } catch (_) {}
  }

  function applyFrame() {
    if (!spriteEl) return;
    var def = ANIMS[currentAnim] || ANIMS.idle;
    var atlas = ATLASES[def.atlas];
    var col = frame % def.frames;
    var x = -(col * CELL);
    var y = -(def.row * CELL);
    spriteEl.style.backgroundImage = 'url("' + atlas.url + '"), url("' + atlas.fallback + '")';
    spriteEl.style.backgroundSize = atlas.width + "px " + atlas.height + "px";
    spriteEl.style.backgroundPosition = x + "px " + y + "px";
  }

  function stopTimer() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function play(name, options) {
    options = options || {};
    var def = ANIMS[name] || ANIMS.idle;
    currentAnim = name in ANIMS ? name : "idle";
    frame = 0;
    applyFrame();
    stopTimer();

    if (onceDone) {
      onceDone = null;
    }

    if (prefersReducedMotion() && !def.loop) {
      frame = Math.min(3, def.frames - 1);
      applyFrame();
      if (options.once) {
        return Promise.resolve(currentAnim);
      }
      return Promise.resolve(currentAnim);
    }

    var ms = Math.max(40, Math.round(1000 / def.fps));
    if (options.once || !def.loop) {
      return new Promise(function (resolve) {
        onceDone = resolve;
        timer = window.setInterval(function () {
          frame += 1;
          if (frame >= def.frames) {
            stopTimer();
            var done = onceDone;
            onceDone = null;
            if (!options.hold) play("idle");
            if (done) done(currentAnim);
            return;
          }
          applyFrame();
        }, ms);
      });
    }

    timer = window.setInterval(function () {
      frame = (frame + 1) % def.frames;
      applyFrame();
    }, ms);
    return Promise.resolve(currentAnim);
  }

  function scheduleBlink() {
    if (blinkTimer) window.clearTimeout(blinkTimer);
    if (prefersReducedMotion()) return;
    blinkTimer = window.setTimeout(function () {
      if (tipBusy || currentAnim !== "idle") {
        scheduleBlink();
        return;
      }
      play("blink", { once: true }).then(function () {
        scheduleBlink();
      });
    }, 3200 + Math.floor(Math.random() * 2800));
  }

  function hideBubble() {
    if (!bubbleEl) return;
    bubbleEl.hidden = true;
    bubbleEl.setAttribute("aria-hidden", "true");
    clearHighlight();
  }

  function showBubble(tip) {
    if (!bubbleEl || !textEl) return;
    textEl.dataset.tipKey = tip.key;
    textEl.textContent = t(tip.key);
    if (dismissBtn) dismissBtn.textContent = t("naru.dismiss");
    bubbleEl.hidden = false;
    bubbleEl.setAttribute("aria-hidden", "false");
    setHighlight(tip.target || null);
  }

  function runNextTip() {
    if (tipBusy) return;
    if (!tipQueue.length) {
      hideBubble();
      play("idle");
      scheduleBlink();
      return;
    }
    tipBusy = true;
    var tip = tipQueue.shift();
    var anim = tip.anim || "look_user";
    Promise.resolve(play(anim, { once: !ANIMS[anim].loop }))
      .then(function () {
        if (ANIMS[anim] && ANIMS[anim].loop) {
          /* keep looping while bubble is open */
        } else if (tip.holdAnim) {
          play(tip.holdAnim);
        } else if (anim.indexOf("point_") === 0) {
          /* freeze near end of point by replaying last hold via look_user soft */
          play("look_user");
        } else {
          play("idle");
        }
        showBubble(tip);
      })
      .catch(function () {
        showBubble(tip);
      });
  }

  function dismissTip() {
    if (!tipBusy) return;
    tipBusy = false;
    hideBubble();
    if (!tipQueue.length) markTipsSeen();
    play("idle");
    runNextTip();
  }

  function queueTips(tips) {
    if (!Array.isArray(tips) || !tips.length) return;
    tipQueue = tipQueue.concat(tips);
    if (!tipBusy) runNextTip();
  }

  function buildDom(host) {
    var wrap = document.createElement("div");
    wrap.className = "naru-pet";
    wrap.setAttribute("data-naru-pet", "");
    wrap.setAttribute("data-i18n-skip", "true");

    var bubble = document.createElement("div");
    bubble.className = "naru-pet__bubble";
    bubble.hidden = true;
    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");
    bubble.setAttribute("aria-hidden", "true");

    var text = document.createElement("p");
    text.className = "naru-pet__text";

    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "naru-pet__dismiss";
    dismiss.textContent = t("naru.dismiss");

    bubble.appendChild(text);
    bubble.appendChild(dismiss);

    var sprite = document.createElement("button");
    sprite.type = "button";
    sprite.className = "naru-pet__sprite";
    sprite.setAttribute("aria-label", t("naru.aria"));
    sprite.title = t("naru.aria");

    wrap.appendChild(bubble);
    wrap.appendChild(sprite);
    host.appendChild(wrap);

    dismiss.addEventListener("click", function (event) {
      event.stopPropagation();
      dismissTip();
    });
    sprite.addEventListener("click", function () {
      if (tipBusy) {
        dismissTip();
        return;
      }
      play("wave", { once: true });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && tipBusy) dismissTip();
    });

    return {
      root: wrap,
      bubble: bubble,
      text: text,
      dismiss: dismiss,
      sprite: sprite
    };
  }

  function syncLabels() {
    if (!rootEl) return;
    if (dismissBtn) dismissBtn.textContent = t("naru.dismiss");
    if (spriteEl) {
      spriteEl.setAttribute("aria-label", t("naru.aria"));
      spriteEl.title = t("naru.aria");
    }
    if (tipBusy && textEl && textEl.dataset.tipKey) {
      textEl.textContent = t(textEl.dataset.tipKey);
    }
  }

  function defaultHubTips() {
    return [
      { key: "naru.tip_welcome", anim: "wave" },
      { key: "naru.tip_cabinets", anim: "point_left", target: "#arcade-cabinets", holdAnim: "look_user" },
      { key: "naru.tip_party", anim: "point_left", target: "#party-cabinets", holdAnim: "look_user" },
      { key: "naru.tip_discord", anim: "point_up", target: "[data-games-auth-controls]", holdAnim: "look_user" }
    ];
  }

  function mount(options) {
    options = options || {};
    if (rootEl) return rootEl;

    var host = options.host || document.body;
    var parts = buildDom(host);
    rootEl = parts.root;
    bubbleEl = parts.bubble;
    textEl = parts.text;
    dismissBtn = parts.dismiss;
    spriteEl = parts.sprite;

    rootEl.classList.add("is-visible");
    play("idle");
    scheduleBlink();

    if (global.WhiteStudioI18n && global.WhiteStudioI18n.onChange) {
      global.WhiteStudioI18n.onChange(function () {
        syncLabels();
      });
    }

    var tips = options.tips;
    if (tips === false) {
      /* idle only */
    } else if (Array.isArray(tips)) {
      queueTips(tips);
    } else if (!tipsSeen()) {
      queueTips(defaultHubTips());
    } else {
      play("wave", { once: true });
    }

    return rootEl;
  }

  function destroy() {
    stopTimer();
    if (blinkTimer) window.clearTimeout(blinkTimer);
    clearHighlight();
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    rootEl = null;
    spriteEl = null;
    bubbleEl = null;
    tipQueue = [];
    tipBusy = false;
  }

  global.WhiteStudioNaru = {
    mount: mount,
    destroy: destroy,
    play: play,
    queueTips: queueTips,
    dismissTip: dismissTip
  };
})(window);
