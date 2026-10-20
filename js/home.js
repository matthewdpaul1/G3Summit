/* G3 Summit 2.0 home view: lift-ticket countdown, tape video events, trail-map tabs, lightbox. */
(function () {
  var root = document.getElementById("view-home");
  if (!root) return;

  var TRIP = {
    firstChair: "2027-02-13T08:30:00-07:00", // Saturday first chair, Mountain Time
    tripEnd: "2027-02-16T00:00:00-07:00"      // midnight after Presidents' Day, Mountain Time
  };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- countdown on the ticket ---------- */
  var cd = document.getElementById("h-cd"), label = document.getElementById("h-cd-label");
  var target = new Date(TRIP.firstChair).getTime(), tripEnd = new Date(TRIP.tripEnd).getTime();
  var units = [["days", 864e5], ["hrs", 36e5], ["min", 6e4], ["sec", 1e3]];
  var cells = units.map(function (u) {
    var box = el("span", "h-cd-unit"), n = el("span", "h-cd-n", "--");
    box.appendChild(n);
    box.appendChild(el("span", "h-cd-l", u[0]));
    cd.appendChild(box);
    return n;
  });
  var state = "count";
  function setState(s, text) {
    if (state === s) return;
    state = s;
    cd.textContent = "";
    cd.classList.add("h-cd-done");
    label.textContent = text;
    var big = el("span", "h-cd-msg", s === "live" ? "On the mountain" : "That's a wrap. Same time next year?");
    cd.appendChild(big);
  }
  function tick() {
    var now = Date.now(), left = target - now;
    if (left > 0) {
      units.forEach(function (u, i) {
        var v = Math.floor(left / u[1]);
        left -= v * u[1];
        var s = i === 0 ? String(v) : (v < 10 ? "0" : "") + v;
        if (cells[i].textContent !== s) cells[i].textContent = s;
      });
      return true;
    }
    if (now < tripEnd) { setState("live", "Lifts are open"); return true; }
    setState("done", "Year two is in the books");
    return false;
  }
  if (tick()) var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);

  /* ---------- hero video: always muted; respect reduced motion ---------- */
  var hv = document.getElementById("h-hero-video");
  if (hv) {
    hv.muted = true;
    hv.addEventListener("volumechange", function () { if (!hv.muted) hv.muted = true; });
    if (reduceMotion) { hv.removeAttribute("autoplay"); hv.pause(); }
  }

  /* ---------- tape video: tell the music to duck ---------- */
  var tv = document.getElementById("h-shot-video");
  function say(playing) { window.dispatchEvent(new CustomEvent("g3:video", { detail: { playing: playing } })); }
  if (tv) {
    tv.addEventListener("play", function () { say(true); });
    tv.addEventListener("pause", function () { say(false); });
    tv.addEventListener("ended", function () { say(false); });
  }
  function onRoute(route) {
    var home = route === "home";
    if (!home) {
      if (tv && !tv.paused) tv.pause();
      if (hv) hv.pause();
      closeLb();
    } else if (hv) {
      if (!hv.getAttribute("src") && heroSrc) hv.src = heroSrc; // detached on a direct #/book load
      if (reduceMotion) return;
      var p = hv.play(); if (p && p.catch) p.catch(function () {});
    }
  }
  window.addEventListener("g3:route", function (e) { onRoute(e.detail && e.detail.route); });
  /* router.js fired the initial g3:route before this script loaded: on a direct #/book load,
     keep the hidden hero video from autoplaying/downloading until home is shown. */
  var heroSrc = hv && hv.getAttribute("src");
  if (document.body.dataset.route !== "home" && hv) { hv.removeAttribute("autoplay"); hv.pause(); hv.removeAttribute("src"); hv.load(); }

  /* ---------- trail map tabs ---------- */
  var mapImg = document.getElementById("h-map-img"), mapLink = document.getElementById("h-map-link");
  var mapBtn = document.getElementById("h-map-btn"), panel = document.getElementById("h-map-panel");
  var names = { "front-side": "Front Side", "back-bowls": "Back Bowls" };
  var sizes = { "front-side": [1800, 1111], "back-bowls": [1800, 900] };
  var tabs = Array.prototype.slice.call(root.querySelectorAll(".h-tabs [role=tab]"));
  function selectTab(b, focus) {
    tabs.forEach(function (o) {
      var on = o === b;
      o.setAttribute("aria-selected", on ? "true" : "false");
      o.tabIndex = on ? 0 : -1;
    });
    var m = b.dataset.map;
    mapImg.src = "maps/" + m + "-sm.jpg";
    mapImg.width = sizes[m][0]; mapImg.height = sizes[m][1];
    mapImg.alt = "Vail " + names[m] + " trail map";
    mapLink.href = "maps/" + m + ".jpg";
    mapBtn.setAttribute("aria-label", "Open the " + names[m] + " trail map at full size");
    panel.setAttribute("aria-labelledby", b.id);
    if (focus) b.focus();
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () { selectTab(b); });
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- lightbox: maps at natural size (pan by scrolling), photos fit to screen ---------- */
  var lb = document.getElementById("h-lb"), lbImg = document.getElementById("h-lb-img"), lbClose = document.getElementById("h-lb-close");
  var lastFocus = null;
  function openLb(src, fit, alt) {
    lastFocus = document.activeElement;
    lb.classList.toggle("h-lb-fit", fit);
    lb.classList.toggle("h-lb-pan", !fit);
    lbImg.alt = alt || "";
    lbImg.onload = null;
    if (!fit) {
      lbImg.onload = function () {
        lb.scrollLeft = Math.max(0, (lb.scrollWidth - lb.clientWidth) / 2);
        lb.scrollTop = Math.max(0, (lb.scrollHeight - lb.clientHeight) / 2);
      };
    }
    lbImg.src = src;
    lb.hidden = false;
    document.documentElement.classList.add("h-lb-lock");
    lbClose.focus();
    if (!fit && lbImg.complete && lbImg.naturalWidth) lbImg.onload();
  }
  function closeLb() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    lbImg.onload = null;
    lbImg.removeAttribute("src");
    document.documentElement.classList.remove("h-lb-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  mapBtn.addEventListener("click", function () { openLb(mapLink.getAttribute("href"), false, mapImg.alt); });
  root.querySelectorAll(".h-photo[data-full]").forEach(function (b) {
    b.addEventListener("click", function () {
      var img = b.querySelector("img");
      openLb(b.dataset.full, true, img ? img.alt : "");
    });
  });
  lbClose.addEventListener("click", closeLb);
  lb.addEventListener("click", function (e) {
    if (e.target === lb || lb.classList.contains("h-lb-fit")) closeLb();
  });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeLb(); }
    else if (e.key === "Tab") { e.preventDefault(); lbClose.focus(); }
  });
})();
