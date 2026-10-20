/* hash router: #/ = home, #/book = sportsbook. Views share one page so the music keeps playing.
   Fires "g3:route" on window with detail.route after each switch. */
(function () {
  var views = document.querySelectorAll(".view");
  function current() { return location.hash.indexOf("#/book") === 0 ? "book" : "home"; }
  function go() {
    var r = current();
    views.forEach(function (v) { v.hidden = v.dataset.view !== r; });
    document.querySelectorAll("a[data-route]").forEach(function (a) {
      if (a.dataset.route === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.body.dataset.route = r;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }); // html has scroll-behavior: smooth
    window.dispatchEvent(new CustomEvent("g3:route", { detail: { route: r } }));
  }
  window.addEventListener("hashchange", go);
  /* in-page anchors (e.g. #maps) are not routes: let them scroll within home */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute("href");
    if (href.indexOf("#/") === 0 || href === "#") return;
    var el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    if (el.id === "main") { /* skip link: focus the visible view, stay on the current route */
      var v = document.querySelector(".view:not([hidden])");
      if (v) { v.focus({ preventScroll: true }); v.scrollIntoView(); }
      return;
    }
    var hiddenView = el.closest(".view[hidden]");
    if (hiddenView) { location.hash = "#/" + (hiddenView.dataset.view === "home" ? "" : hiddenView.dataset.view); setTimeout(function () { el.scrollIntoView(); }, 30); }
    else el.scrollIntoView();
  });
  /* solid nav once past the hero */
  var bar = document.querySelector(".topbar");
  function onScroll() { bar.classList.toggle("solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  /* every fresh load opens on The Summit, even from a copied #/book link */
  if (location.hash && location.hash !== "#/") history.replaceState(null, "", location.pathname + location.search);
  go();
})();
