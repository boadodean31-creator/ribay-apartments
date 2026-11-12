/* "Location" pop-up on the room page. The "Location" button in the top bar (marked data-open-location) opens it. */
(function () {
  var dlg = document.getElementById("locdlg");
  if (!dlg || typeof dlg.showModal !== "function") return;   // old browser: the links keep scrolling to #location as before

  var card = dlg.querySelector(".loc-card");
  var frame = dlg.querySelector("iframe[data-src]");
  var opener = null, closing = false;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function openDialog(trigger) {
    if (dlg.open) return;
    opener = trigger || null;
    if (frame && !frame.src) frame.src = frame.dataset.src;           // load the map only the first time it is needed
    document.documentElement.classList.add("loc-lock");
    dlg.showModal();
    dlg.scrollTop = 0;
    var body = dlg.querySelector(".loc-body"); if (body) body.scrollTop = 0;
    card.scrollTop = 0;

    // zoom out of the button that was clicked
    var r = card.getBoundingClientRect();
    var t = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
    var ox = t ? t.left + t.width / 2 - r.left : r.width / 2;
    var oy = t ? t.top + t.height / 2 - r.top : r.height / 2;
    card.style.transformOrigin = Math.max(0, Math.min(r.width, ox)) + "px " + Math.max(0, Math.min(r.height, oy)) + "px";
    requestAnimationFrame(function () { requestAnimationFrame(function () { dlg.classList.add("is-open"); }); });
  }

  function closeDialog() {
    if (!dlg.open || closing) return;
    closing = true;
    dlg.classList.remove("is-open");
    setTimeout(function () {
      dlg.close();
      document.documentElement.classList.remove("loc-lock");
      closing = false;
      if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
    }, reduce ? 0 : 280);
  }

  // Capture phase: runs before the room page's own "scroll down to the map" handler, so only the pop-up opens.
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-open-location]");
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) {
      e.preventDefault();
      e.stopPropagation();
      openDialog(a);
    }
  }, true);

  document.addEventListener("click", function (e) {
    if (!dlg.open) return;
    if (e.target === dlg || e.target.closest("[data-loc-close]")) { closeDialog(); return; }   // backdrop or X

    var cp = e.target.closest("[data-loc-copy]");
    if (cp) {
      var txt = cp.dataset.locCopy;
      var done = function (ok) {
        var o = document.getElementById("toast");
        if (o) { o.textContent = ok ? "Address copied" : "Could not copy, please select it by hand"; o.classList.add("on"); clearTimeout(o._t); o._t = setTimeout(function () { o.classList.remove("on"); }, 2200); }
        if (ok) { cp.classList.add("done"); setTimeout(function () { cp.classList.remove("done"); }, 1600); }
      };
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); }); }
      else {
        var ta = document.createElement("textarea"); ta.value = txt; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); done(ok);
      }
    }
  });

  dlg.addEventListener("cancel", function (e) { e.preventDefault(); closeDialog(); });   // Esc key
})();
