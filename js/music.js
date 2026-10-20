/* G3 Summit 2.0 - site-wide background music.
   One <audio id="bg-music"> lives outside the routed views, so hash-route changes never touch it.
   - Tries to autoplay on load; if the browser blocks it, the first real user gesture anywhere
     (pointerdown / keydown / touchend / click, capture phase) starts it, called synchronously
     inside the handler so iOS Safari accepts it.
   - Nav button toggles; an explicit pause is remembered in localStorage (g3-music-muted=1).
   - Playback position is kept in sessionStorage so a refresh resumes mid-song.
   - Ducks under the ski-clip video (window "g3:video" CustomEvent, detail.playing).
   No dependencies on other scripts. */
(function () {
  "use strict";

  var audio = document.getElementById("bg-music");
  if (!audio || typeof audio.play !== "function") return;

  var btn = document.getElementById("music-btn");
  var label = document.getElementById("music-label");

  var BASE_VOL = 0.6;
  var DUCK_VOL = 0.15;
  var FADE_MS = 400;
  var KEY_MUTED = "g3-music-muted";
  var KEY_POS = "g3-music-pos";
  var KEY_HINT = "g3-music-hint";
  var GESTURES = ["pointerdown", "keydown", "touchend", "click"];

  /* ---------- storage helpers (private mode / disabled storage must not throw) ---------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) {} }

  var userMuted = lsGet(KEY_MUTED) === "1";
  var gesturesArmed = false;
  var lastUnlockFromBtn = 0;   // timestamp of a gesture on the button that started playback
  var ducked = false;
  var duckPaused = false;      // iOS path: we paused instead of lowering volume
  var fadeRaf = 0;

  audio.loop = true;
  audio.preload = "auto";

  /* ---------- volume support detection (iOS volume is read-only, always 1) ---------- */
  var volumeWorks = (function () {
    try {
      audio.volume = 0.31;
      var ok = Math.abs(audio.volume - 0.31) < 0.01;
      audio.volume = BASE_VOL;
      return ok;
    } catch (e) { return false; }
  })();

  /* ---------- button state ---------- */
  function isPlaying() { return !audio.paused; }

  function syncUI() {
    var on = isPlaying();
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Turn music off" : "Turn music on");
    }
    if (label) label.textContent = on ? "Music on" : "Music off";
  }

  /* ---------- position persistence ---------- */
  function savePos() {
    var t = audio.currentTime, d = audio.duration;
    if (!isFinite(t) || t <= 0) return;
    if (isFinite(d) && d > 0 && t > d - 2) { ssDel(KEY_POS); return; }
    ssSet(KEY_POS, t.toFixed(2));
  }

  var restorePos = parseFloat(ssGet(KEY_POS) || "");
  if (!isFinite(restorePos) || restorePos <= 0) restorePos = 0;

  function applyRestore() {
    if (!restorePos) return;
    var d = audio.duration;
    if (isFinite(d) && d > 0) {
      var target = restorePos;
      restorePos = 0; // apply once, with metadata known
      if (target > d - 2) { ssDel(KEY_POS); return; }
      if (Math.abs(audio.currentTime - target) > 1) {
        try { audio.currentTime = target; } catch (e) {}
      }
    } else {
      // Before metadata: spec treats this as the default start position (Chrome/Firefox honor it).
      // Re-applied on loadedmetadata for Safari, which may ignore it.
      try { audio.currentTime = restorePos; } catch (e) {}
    }
  }
  applyRestore();
  audio.addEventListener("loadedmetadata", applyRestore);

  setInterval(function () { if (isPlaying()) savePos(); }, 3000);
  window.addEventListener("pagehide", savePos);
  audio.addEventListener("pause", savePos);

  /* ---------- playing ---------- */
  // Calls play() synchronously (important inside gesture handlers for iOS).
  // fromAutoplay: rejection means "blocked" -> show hint and wait for a gesture.
  function startPlayback(fromAutoplay) {
    if (audio.error) return;
    if (volumeWorks) audio.volume = ducked ? DUCK_VOL : BASE_VOL;
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    if (ducked && !volumeWorks) {
      // iOS while the clip is playing: play()+pause() inside the gesture unlocks the element
      // without talking over the clip; the un-duck handler resumes it.
      duckPaused = true;
      audio.pause();
    }
    if (p && typeof p.then === "function") {
      p.then(null, function (err) {
        // A later gesture may already have started playback while this promise was pending.
        if (isPlaying()) return;
        if (err && err.name === "AbortError") return; // interrupted by a pause() - not a block
        if (fromAutoplay && !userMuted) armGestures(); // any tap or key starts it, no prompt
      });
    }
  }

  /* ---------- first-gesture unlock ---------- */
  function onGesture(e) {
    if (userMuted || isPlaying()) { disarmGestures(); return; }
    var t = e.target;
    if (t && t.closest && t.closest(".music-hint-x")) return; // dismissing the hint is not a request for music
    if (btn && t && btn.contains && btn.contains(t)) lastUnlockFromBtn = Date.now();
    // Not disarmed here: a gesture that isn't valid activation (e.g. pointerdown on iOS, Escape)
    // rejects, and the next one (touchend / click) must get its own synchronous play() call.
    startPlayback(false);
  }

  function armGestures() {
    if (gesturesArmed) return;
    gesturesArmed = true;
    for (var i = 0; i < GESTURES.length; i++) {
      window.addEventListener(GESTURES[i], onGesture, { capture: true, passive: true });
    }
  }

  function disarmGestures() {
    if (!gesturesArmed) return;
    gesturesArmed = false;
    for (var i = 0; i < GESTURES.length; i++) {
      window.removeEventListener(GESTURES[i], onGesture, { capture: true, passive: true });
    }
  }

  /* ---------- hint bubble ---------- */
  var hintEl = null;

  function showHint() {
    if (hintEl || isPlaying() || ssGet(KEY_HINT) === "1" || !document.body) return;
    ssSet(KEY_HINT, "1"); // at most once per tab session
    hintEl = document.createElement("div");
    hintEl.className = "music-hint";
    hintEl.setAttribute("role", "status");
    var txt = document.createElement("span");
    txt.className = "music-hint-text";
    txt.textContent = "Tap anywhere for the soundtrack";
    var x = document.createElement("button");
    x.type = "button";
    x.className = "music-hint-x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "x";
    x.addEventListener("click", function (e) { e.stopPropagation(); hideHint(); });
    hintEl.appendChild(txt);
    hintEl.appendChild(x);
    document.body.appendChild(hintEl);
  }

  function hideHint() {
    if (hintEl && hintEl.parentNode) hintEl.parentNode.removeChild(hintEl);
    hintEl = null;
  }

  /* ---------- button ---------- */
  if (btn) {
    btn.addEventListener("click", function () {
      // This click is the tail of the gesture that just unlocked playback - don't toggle it off.
      if (lastUnlockFromBtn && Date.now() - lastUnlockFromBtn < 1500 && isPlaying()) {
        lastUnlockFromBtn = 0;
        return;
      }
      lastUnlockFromBtn = 0;
      if (isPlaying()) {
        userMuted = true;
        lsSet(KEY_MUTED, "1");
        duckPaused = false;
        disarmGestures();
        audio.pause();
      } else {
        userMuted = false;
        lsDel(KEY_MUTED);
        duckPaused = false;
        if (volumeWorks) audio.volume = ducked ? DUCK_VOL : BASE_VOL;
        var p;
        try { p = audio.play(); } catch (e) { p = null; }
        if (p && p.then) p.then(null, function () {});
      }
    });
  }

  /* ---------- audio events ---------- */
  audio.addEventListener("play", function () {
    disarmGestures();
    hideHint();
    syncUI();
  });
  audio.addEventListener("pause", syncUI);

  /* ---------- ducking under the ski clip ---------- */
  function fadeTo(target) {
    if (fadeRaf) { cancelAnimationFrame(fadeRaf); fadeRaf = 0; }
    var from = audio.volume;
    if (document.hidden || typeof requestAnimationFrame !== "function" || Math.abs(from - target) < 0.005) {
      audio.volume = target; // rAF is paused in hidden tabs - jump instead of stalling
      return;
    }
    var t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / FADE_MS);
      k = k * (2 - k); // ease-out
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      fadeRaf = k < 1 ? requestAnimationFrame(step) : 0;
    }
    fadeRaf = requestAnimationFrame(step);
  }

  window.addEventListener("g3:video", function (e) {
    var playing = !!(e && e.detail && e.detail.playing);
    if (playing === ducked) return;
    ducked = playing;
    if (volumeWorks) {
      fadeTo(playing ? DUCK_VOL : BASE_VOL);
      return;
    }
    // iOS: volume is read-only, so step aside entirely and come back afterwards.
    if (playing) {
      if (isPlaying()) { duckPaused = true; audio.pause(); }
    } else if (duckPaused) {
      duckPaused = false;
      if (!userMuted) startPlayback(false);
    }
  });

  /* ---------- back/forward cache restore ---------- */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && !userMuted && !isPlaying()) { armGestures(); startPlayback(true); }
    syncUI();
  });

  /* ---------- go ---------- */
  syncUI();
  if (!userMuted) {
    // Arm before calling play(): a gesture may land before the autoplay promise settles.
    armGestures();
    startPlayback(true);
  }

  // Media Session metadata (lock screen / OS media controls), best-effort.
  try {
    if ("mediaSession" in navigator && typeof MediaMetadata === "function") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "If I Die Young", artist: "The Band Perry", album: "G3 Summit 2.0"
      });
    }
  } catch (e) {}
})();
