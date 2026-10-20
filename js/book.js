/* G3 Sportsbook. Renders the whole #/book view into #view-book. No libs, no modules.
   Math helpers are pure and exported for a node check when `module` exists. */
(function () {
  "use strict";

  /* ---------- odds math ---------- */
  function implied(odds) { return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100); }
  function profitPerUnit(odds) { return odds > 0 ? odds / 100 : 100 / Math.abs(odds); }
  function toWin(stake, odds) { return stake * profitPerUnit(odds); }
  function decimal(odds) { return 1 + profitPerUnit(odds); }
  function decToAmerican(d) {
    if (d >= 2) return Math.round((d - 1) * 100);
    return -Math.round(100 / (d - 1));
  }
  function parlayDecimal(list) { return list.reduce(function (acc, o) { return acc * decimal(o); }, 1); }
  function fmtOdds(o) { return o > 0 ? "+" + o : String(o); }
  function fmtPct(p) { return (p * 100).toFixed(1) + "%"; }
  function fmtMoney(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  var math = { implied: implied, toWin: toWin, decimal: decimal, decToAmerican: decToAmerican, parlayDecimal: parlayDecimal, fmtPct: fmtPct };
  if (typeof module !== "undefined" && module.exports) module.exports = math;
  if (typeof document === "undefined") return;

  /* ---------- markets ---------- */
  var MARKETS = [
    {
      id: "show", title: "Will they show?", nav: "Attendance", type: "list",
      note: "Settles in the lift line.",
      rows: [
        { id: "daniel", group: "show-daniel", name: "Daniel shows up", joke: "", odds: 300, slip: "Daniel shows up" },
        { id: "caroline", group: "show-caroline", name: "Caroline shows up", joke: "", odds: 150, slip: "Caroline shows up" }
      ]
    },
    {
      id: "anytime", title: "Anytime wipeout", nav: "Anytime wipeout", type: "list",
      note: "Any fall counts.",
      rows: [
        { id: "spencer", group: "any-spencer", name: "Spencer", joke: "", odds: -200 },
        { id: "matthew", group: "any-matthew", name: "Matthew", joke: "", odds: -100 },
        { id: "william", group: "any-william", name: "William", joke: "", odds: 150 },
        { id: "jonathan", group: "any-jonathan", name: "Jonathan", joke: "", odds: 200 },
        { id: "poppy", group: "any-poppy", name: "Poppy", joke: "", odds: 500 }
      ],
      slipSuffix: " - anytime wipeout"
    },
    {
      id: "first", title: "First wipeout of the weekend", nav: "First wipeout", type: "list", total: true,
      note: "One winner.",
      rows: [
        { id: "spencer", group: "first", name: "Spencer", joke: "", odds: 200 },
        { id: "matthew", group: "first", name: "Matthew", joke: "", odds: 300 },
        { id: "william", group: "first", name: "William", joke: "", odds: 400 },
        { id: "jonathan", group: "first", name: "Jonathan", joke: "", odds: 500 },
        { id: "poppy", group: "first", name: "Poppy", joke: "", odds: 1900 }
      ],
      slipSuffix: " - first wipeout"
    },
    {
      id: "ou", title: "Over/unders", nav: "Over/unders", type: "ou",
      note: "Both sides -110.",
      rows: [
        { id: "vert", name: "Total vertical feet skied", sub: "2 days, per person", line: 30000, unit: "vertical ft", joke: "" },
        { id: "lostboy", name: "Lost Boy laps", line: 7.5, unit: "Lost Boy laps", joke: "" },
        { id: "avanti", name: "Avanti chairlift rides", line: 10.5, unit: "Avanti rides", joke: "" },
        { id: "andrew", name: "Andrew ski runs", line: 0.5, unit: "Andrew runs", joke: "" },
        { id: "beers", name: "Beers consumed at the Red Lion", line: 30.5, unit: "Red Lion beers", joke: "" },
        { id: "wings", name: "Wings consumed over the weekend", line: 60.5, unit: "wings", joke: "" }
      ],
      price: -110
    },
    {
      id: "karaoke", title: "Jonathan Taylor Swift karaoke in the lift line", nav: "Karaoke", type: "ladder",
      note: "Songs sung. Pick one.",
      group: "karaoke",
      rungs: [
        { n: 1, odds: -500 }, { n: 2, odds: -300 }, { n: 3, odds: -100 }, { n: 4, odds: 300 }, { n: 5, odds: 500 }
      ]
    }
  ];

  /* ---------- state ---------- */
  var KEY = "g3book.slip.v1";
  var state = { picks: [], stake: 10, parlay: true, placedAt: null, name: "" };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && Array.isArray(saved.picks)) {
      state.picks = saved.picks.filter(function (p) { return p && p.group && p.sel && typeof p.odds === "number"; });
      if (typeof saved.stake === "number" && saved.stake >= 0) state.stake = saved.stake;
      if (typeof saved.parlay === "boolean") state.parlay = saved.parlay;
      state.placedAt = saved.placedAt || null;
      if (typeof saved.name === "string") state.name = saved.name.slice(0, 60);
    }
  } catch (e) { /* private mode or bad JSON: start clean */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function oddsBtn(o) {
    var label = o.aria + ", " + fmtOdds(o.odds) + ", implied probability " + fmtPct(implied(o.odds));
    return '<button type="button" class="bk-odds' + (o.cls ? " " + o.cls : "") + '" aria-pressed="false"' +
      ' data-group="' + esc(o.group) + '" data-sel="' + esc(o.sel) + '" data-odds="' + o.odds + '"' +
      ' data-label="' + esc(o.slip) + '" data-market="' + esc(o.market) + '" aria-label="' + esc(label) + '">' +
      (o.top ? '<span class="bk-top">' + o.top + "</span>" : "") +
      '<span class="bk-price">' + fmtOdds(o.odds) + "</span>" +
      (o.imp ? '<span class="bk-imp">' + fmtPct(implied(o.odds)) + "</span>" : "") + "</button>";
  }

  function renderList(m) {
    var h = '<div class="bk-rows">';
    m.rows.forEach(function (r) {
      h += '<div class="bk-row"><div class="bk-who"><span class="bk-name">' + esc(r.name) + "</span>" +
        (r.joke ? '<span class="bk-joke">' + esc(r.joke) + "</span>" : "") + "</div>" +
        oddsBtn({ group: r.group, sel: m.id + "-" + r.id, odds: r.odds, slip: r.slip || r.name, market: m.title, aria: r.name + (m.slipSuffix || ""), imp: m.total }) +
        "</div>";
    });
    if (m.total) {
      var sum = m.rows.reduce(function (a, r) { return a + implied(r.odds); }, 0);
      h += '<div class="bk-total"><span>Total implied probability: <strong>' + fmtPct(sum) + "</strong></span>" +
        '<span class="bk-total-note">No vig.</span></div>';
    }
    return h + "</div>";
  }

  function renderOU(m) {
    var h = '<div class="bk-rows bk-ou" role="table" aria-label="' + esc(m.title) + '">' +
      '<div class="bk-ou-head" role="row"><span class="bk-ou-mk" role="columnheader">Market</span>' +
      '<span role="columnheader">Line</span><span role="columnheader">Over</span><span role="columnheader">Under</span></div>';
    m.rows.forEach(function (r) {
      var line = r.line.toLocaleString("en-US");
      h += '<div class="bk-row bk-row-ou" role="row"><div class="bk-who" role="rowheader"><span class="bk-name">' + esc(r.name) + "</span>" +
        (r.sub ? '<span class="bk-subname">' + esc(r.sub) + "</span>" : "") +
        (r.joke ? '<span class="bk-joke">' + esc(r.joke) + "</span>" : "") + "</div>" +
        '<span class="bk-line" role="cell">' + line + "</span>";
      ["Over", "Under"].forEach(function (side) {
        h += '<span class="bk-cell" role="cell">' + oddsBtn({ group: "ou-" + r.id, sel: "ou-" + r.id + "-" + side.toLowerCase(), odds: m.price, cls: "bk-odds-ou",
          slip: side + " " + line + " " + r.unit, market: m.title, aria: side + " " + line + " " + r.name }) + "</span>";
      });
      h += "</div>";
    });
    return h + "</div>";
  }

  function renderLadder(m) {
    var h = '<div class="bk-ladder" role="group" aria-label="Songs sung, alternate lines">';
    m.rungs.forEach(function (r) {
      var songs = r.n + "+";
      h += oddsBtn({ group: m.group, sel: "karaoke-" + r.n, odds: r.odds, cls: "bk-rung",
        top: songs,
        slip: "Jonathan " + songs + " Swift song" + (r.n > 1 ? "s" : ""), market: m.title, aria: "Jonathan " + songs + " Taylor Swift songs" });
    });
    return h + "</div>";
  }

  function render() {
    var root = document.getElementById("view-book");
    if (!root) return null;
    var nav = MARKETS.map(function (m) { return '<button type="button" class="bk-chip" data-jump="bk-' + m.id + '">' + esc(m.nav) + "</button>"; }).join("");
    var markets = MARKETS.map(function (m) {
      var body = m.type === "ou" ? renderOU(m) : m.type === "ladder" ? renderLadder(m) : renderList(m);
      return '<section class="bk-market" id="bk-' + m.id + '" aria-labelledby="bk-' + m.id + '-h">' +
        '<header class="bk-mhead"><h2 id="bk-' + m.id + '-h">' + esc(m.title) + "</h2>" +
        (m.note ? '<p class="bk-note">' + esc(m.note) + "</p>" : "") + "</header>" + body + "</section>";
    }).join("");

    root.innerHTML =
      '<div class="bk">' +
      '<header class="bk-head"><div class="bk-wrap">' +
        "<h1>G3 Sportsbook</h1>" +
        '<p class="bk-dek">G3 Summit 2.0 - Vail, Feb 12-15, 2027</p>' +
      "</div></header>" +
      '<div class="bk-wrap bk-grid">' +
        '<div class="bk-board">' +
          '<nav class="bk-chips" aria-label="Markets">' + nav + "</nav>" +
          markets +
          '<p class="bk-fine">For fun only. No real money.</p>' +
        "</div>" +
        '<div class="bk-scrim" hidden></div>' +
        '<aside class="bk-slip" aria-label="Bet slip">' +
          '<button type="button" class="bk-slipbar" aria-expanded="false" aria-controls="bk-slip-panel">' +
            '<span class="bk-slipbar-t">Bet slip <span class="bk-count">0</span></span>' +
            '<span class="bk-slipbar-s"></span><span class="bk-chev" aria-hidden="true"></span>' +
          "</button>" +
          '<div class="bk-panel" id="bk-slip-panel" tabindex="-1">' +
            '<div class="bk-panel-head"><h2 class="bk-panel-title">Bet slip</h2>' +
              '<button type="button" class="bk-clear">Clear</button>' +
              '<button type="button" class="bk-close" aria-label="Close bet slip"><span aria-hidden="true">&times;</span></button></div>' +
            '<label class="bk-field bk-bettor"><span>Your name</span>' +
              '<input type="text" autocomplete="given-name" maxlength="60" placeholder="Name" value="' + esc(state.name) + '"></label>' +
            '<label class="bk-field bk-amount"><span>Stake <em>Poppy Bucks</em></span>' +
              '<input type="number" inputmode="decimal" min="0" step="1" value="' + state.stake + '"></label>' +
            '<ul class="bk-picks" aria-live="polite"></ul>' +
            '<div class="bk-parlay"></div>' +
            '<div class="bk-sum"></div>' +
            '<button type="button" class="bk-place">Place bet</button>' +
            '<p class="bk-placed" aria-live="polite"></p>' +
          "</div>" +
        "</aside>" +
      "</div>" +
      '<div class="bk-toast" role="status" aria-live="polite"></div>' +
      "</div>";
    return root;
  }

  var root = render();
  if (!root) return;
  /* rebuild saved picks from the current board so stale odds/labels in localStorage never survive */
  var board = {};
  root.querySelectorAll(".bk-odds").forEach(function (b) { board[b.dataset.sel] = b; });
  state.picks = state.picks.reduce(function (out, p) {
    var b = Object.prototype.hasOwnProperty.call(board, p.sel) ? board[p.sel] : null;
    var odds = b ? Number(b.dataset.odds) : NaN;
    if (b && isFinite(odds) && odds !== 0 && !out.some(function (q) { return q.group === b.dataset.group; }))
      out.push({ group: b.dataset.group, sel: b.dataset.sel, odds: odds, label: b.dataset.label, market: b.dataset.market });
    return out;
  }, []);
  var slip = root.querySelector(".bk-slip");
  var bar = root.querySelector(".bk-slipbar");
  var panel = root.querySelector(".bk-panel");
  var scrim = root.querySelector(".bk-scrim");
  var stakeInput = root.querySelector(".bk-amount input");
  var picksEl = root.querySelector(".bk-picks");
  var parlayEl = root.querySelector(".bk-parlay");
  var sumEl = root.querySelector(".bk-sum");
  var placeBtn = root.querySelector(".bk-place");
  var placedEl = root.querySelector(".bk-placed");
  var toastEl = root.querySelector(".bk-toast");
  var mq = window.matchMedia("(min-width: 960px)");

  var sending = false;
  var nameInput = root.querySelector(".bk-bettor input");
  nameInput.addEventListener("input", function () { state.name = nameInput.value.trim(); nameInput.removeAttribute("aria-invalid"); save(); });

  /* email the ticket via FormSubmit (same inbox as the firstdate form) */
  function sendTicket() {
    var s = stake(), n = state.picks.length, lines = [];
    state.picks.forEach(function (p) {
      lines.push(p.label + " (" + p.market + ") " + fmtOdds(p.odds) + " - risk " + fmtMoney(s) + " to win " + fmtMoney(toWin(s, p.odds)));
    });
    var body = { _subject: "G3 Sportsbook: " + state.name + " placed " + n + (n === 1 ? " bet" : " bets"), _template: "table", _captcha: "false", Bettor: state.name };
    lines.forEach(function (l, i) { body["Pick " + (i + 1)] = l; });
    if (n >= 2 && state.parlay) {
      var d = parlayDecimal(state.picks.map(function (p) { return p.odds; }));
      body.Parlay = n + "-leg parlay " + fmtOdds(decToAmerican(d)) + " - risk " + fmtMoney(s) + " to win " + fmtMoney(s * d - s);
    }
    body["Stake per bet"] = fmtMoney(s) + " Poppy Bucks";
    body.Placed = new Date().toLocaleString("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" }) + " MT";
    return fetch("https://formsubmit.co/ajax/matthewdpaul1@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        if (!res.ok || String(out.success) !== "true") throw new Error(out.message || "Send failed");
      });
    });
  }

  function stake() { return state.stake > 0 ? state.stake : 0; }

  function update() {
    // odds buttons
    var sel = {};
    state.picks.forEach(function (p) { sel[p.sel] = true; });
    root.querySelectorAll(".bk-odds").forEach(function (b) {
      var on = !!sel[b.dataset.sel];
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var n = state.picks.length, s = stake();
    root.querySelector(".bk-count").textContent = n;
    // the slip is rebuilt with innerHTML below: remember keyboard focus inside it so it can be restored
    var ae = document.activeElement, refocus = null;
    if (ae && parlayEl.contains(ae)) refocus = "parlay";
    else if (ae && picksEl.contains(ae) && ae.classList.contains("bk-x")) refocus = Array.prototype.indexOf.call(picksEl.querySelectorAll(".bk-x"), ae);

    if (!n) {
      picksEl.innerHTML = '<li class="bk-empty">Tap a price to add a pick.</li>';
    } else {
      picksEl.innerHTML = state.picks.map(function (p) {
        var w = toWin(s, p.odds);
        return '<li class="bk-pick"><div class="bk-pick-main"><span class="bk-pick-l">' + esc(p.label) + "</span>" +
          '<span class="bk-pick-m">' + esc(p.market) + "</span></div>" +
          '<span class="bk-pick-o">' + fmtOdds(p.odds) + "</span>" +
          '<button type="button" class="bk-x" data-sel="' + esc(p.sel) + '" aria-label="Remove ' + esc(p.label) + '"><span aria-hidden="true">&times;</span></button>' +
          '<div class="bk-pick-pay"><span>To win <strong>' + fmtMoney(w) + "</strong></span><span>Payout <strong>" + fmtMoney(s + w) + "</strong></span></div></li>";
      }).join("");
    }

    var parlayWin = 0, parlayOn = n >= 2 && state.parlay;
    if (n >= 2) {
      var d = parlayDecimal(state.picks.map(function (p) { return p.odds; }));
      parlayWin = s * d - s;
      parlayEl.hidden = false;
      parlayEl.innerHTML = '<label class="bk-parlay-l"><input type="checkbox"' + (state.parlay ? " checked" : "") + '>' +
        "<span>" + n + "-leg parlay <span class=\"bk-pick-o\">" + fmtOdds(decToAmerican(d)) + "</span></span></label>" +
        '<div class="bk-pick-pay"><span>To win <strong>' + fmtMoney(parlayWin) + "</strong></span><span>Payout <strong>" + fmtMoney(s + parlayWin) + "</strong></span></div>";
    } else {
      parlayEl.hidden = true;
      parlayEl.innerHTML = "";
    }

    var bets = n + (parlayOn ? 1 : 0);
    var risk = s * bets;
    var maxWin = state.picks.reduce(function (a, p) { return a + toWin(s, p.odds); }, 0) + (parlayOn ? parlayWin : 0);
    sumEl.innerHTML = n ? '<span>Total risk <strong>' + fmtMoney(risk) + "</strong></span><span>Best case <strong>" + fmtMoney(risk + maxWin) + "</strong></span>" : "";
    placeBtn.disabled = sending || !n || s <= 0 || !!state.placedAt;
    placeBtn.textContent = sending ? "Placing..." : state.placedAt && n ? "Bet placed" : n ? (bets === 1 ? "Place bet" : "Place " + bets + " bets") : "Place bet";
    placedEl.textContent = state.placedAt ? "Placed " + state.placedAt : "";
    root.querySelector(".bk-slipbar-s").textContent = n ? "To win up to " + fmtMoney(maxWin) + " PB" : "Tap a price to add a pick";
    root.querySelector(".bk-clear").hidden = !n;
    if (refocus === "parlay") { var cb = parlayEl.querySelector("input"); (cb || panel).focus({ preventScroll: true }); }
    else if (typeof refocus === "number" && refocus > -1) {
      var xs = picksEl.querySelectorAll(".bk-x");
      (xs.length ? xs[Math.min(refocus, xs.length - 1)] : (mq.matches ? stakeInput : panel)).focus({ preventScroll: true });
    }
    save();
  }

  function toggle(btn) {
    var g = btn.dataset.group, id = btn.dataset.sel;
    var existing = -1;
    state.picks.forEach(function (p, i) { if (p.group === g) existing = i; });
    if (existing > -1 && state.picks[existing].sel === id) {
      state.picks.splice(existing, 1);
    } else {
      var pick = { group: g, sel: id, odds: Number(btn.dataset.odds), label: btn.dataset.label, market: btn.dataset.market };
      if (existing > -1) state.picks.splice(existing, 1, pick); // same-market conflict: replace in place
      else state.picks.push(pick);
    }
    state.placedAt = null;
    update();
  }

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 3200);
  }

  function setOpen(open, restoreFocus) {
    if (mq.matches) open = false;
    slip.classList.toggle("is-open", open);
    bar.setAttribute("aria-expanded", open ? "true" : "false");
    scrim.hidden = !open;
    document.documentElement.classList.toggle("bk-lock", open);
    if (open) panel.focus({ preventScroll: true });
    else if (restoreFocus) bar.focus();
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button, .bk-scrim");
    if (!t || !root.contains(t)) return;
    if (t.classList.contains("bk-odds")) toggle(t);
    else if (t.classList.contains("bk-x")) {
      state.picks = state.picks.filter(function (p) { return p.sel !== t.dataset.sel; });
      state.placedAt = null;
      update();
      if (!state.picks.length) (mq.matches ? stakeInput : panel).focus();
    } else if (t.classList.contains("bk-chip")) {
      var el = document.getElementById(t.dataset.jump);
      if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } else if (t === bar) setOpen(!slip.classList.contains("is-open"));
    else if (t.classList.contains("bk-close") || t === scrim) setOpen(false, true);
    else if (t.classList.contains("bk-clear")) { state.picks = []; state.placedAt = null; update(); panel.focus(); }
    else if (t === placeBtn && state.picks.length && !sending) {
      if (!state.name) { nameInput.setAttribute("aria-invalid", "true"); nameInput.focus(); toast("Add your name first."); return; }
      sending = true; update();
      sendTicket().then(function () {
        sending = false;
        state.placedAt = new Date().toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }) + " MT";
        update();
        toast("Bet placed.");
      }, function () {
        sending = false; update();
        toast("That bet didn't go through. Check your connection and try again.");
      });
    }
  });
  root.addEventListener("change", function (e) {
    if (e.target.matches(".bk-parlay input")) { state.parlay = e.target.checked; state.placedAt = null; update(); }
  });
  stakeInput.addEventListener("input", function () {
    var v = parseFloat(stakeInput.value);
    state.stake = isFinite(v) && v >= 0 ? v : 0;
    state.placedAt = null;
    update();
  });
  stakeInput.addEventListener("blur", function () { stakeInput.value = state.stake; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && slip.classList.contains("is-open")) setOpen(false, true);
  });
  var onMq = function () { if (mq.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  window.addEventListener("g3:route", function (e) { if (!e.detail || e.detail.route !== "book") setOpen(false); });

  update();
})();
