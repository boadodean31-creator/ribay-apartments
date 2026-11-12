/* Headline that scrolls by itself: one phrase every few seconds, looping forever */
(function () {
  "use strict";
  var track = document.querySelector(".roll-track");
  if (!track) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;   // stays on the first phrase
  var n = track.children.length;
  if (n < 2) return;
  track.appendChild(track.children[0].cloneNode(true));                        // copy of the first phrase for a seamless loop
  var i = 0, paused = false, wrap = track.parentNode;
  function go() {
    if (paused || document.hidden) return;
    i += 1;
    track.style.setProperty("--i", i);
    if (i === n) {                                                              // reached the copy: jump back to the real first one
      var back = function () {
        track.removeEventListener("transitionend", back);
        track.classList.add("snap"); i = 0; track.style.setProperty("--i", 0);
        void track.offsetWidth; track.classList.remove("snap");
      };
      track.addEventListener("transitionend", back);
    }
  }
  var h1 = wrap.closest("h1");
  if (h1) { h1.addEventListener("pointerenter", function () { paused = true; }); h1.addEventListener("pointerleave", function () { paused = false; }); }
  setInterval(go, 3600);
})();

/* Interactive building overview: pick a window, see the room. */
(function () {
  "use strict";
  var root = document.getElementById("bd");
  if (!root) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var tiles = Array.prototype.slice.call(root.querySelectorAll(".bd-rm"));
  var floors = Array.prototype.slice.call(root.querySelectorAll(".bd-floor"));
  var facade = root.querySelector(".bd-building");
  var segs = Array.prototype.slice.call(root.querySelectorAll("[data-bd-filter]"));

  var hint = root.querySelector(".bd-hint");
  var detail = root.querySelector(".bd-detail");
  var thumb = root.querySelector(".bd-thumb");
  var img = thumb.querySelector("img");
  var title = root.querySelector(".bd-title");
  var badge = root.querySelector(".bd-badge");
  var meta = root.querySelector(".bd-meta");
  var rent = root.querySelector(".bd-rent");
  var view = root.querySelector(".bd-view");
  var list = root.querySelector(".bd-list");
  var next = root.querySelector(".bd-next");
  var current = null;

  /* 1. Windows switch on from the ground floor up */
  floors.forEach(function (f, fi) {
    var fromBottom = floors.length - 1 - fi;
    Array.prototype.forEach.call(f.querySelectorAll(".bd-rm"), function (t, j) {
      t.style.setProperty("--d", ((450 + fromBottom * 170 + j * 70) / 1000).toFixed(2) + "s");
    });
  });

  /* Once the load-in has finished, mark the building ready so the entrance animation can never replay */
  var lastDelay = 0;
  tiles.forEach(function (t) { lastDelay = Math.max(lastDelay, parseFloat(t.style.getPropertyValue("--d")) || 0); });
  setTimeout(function () { root.classList.add("ready"); }, (lastDelay + 1.4) * 1000);

  /* 3. Show a room in the panel */
  function showHint() { hint.hidden = false; detail.hidden = true; }

  function select(t, quiet) {
    if (current) current.setAttribute("aria-pressed", "false");
    current = t;
    if (!t) { showHint(); return; }
    t.setAttribute("aria-pressed", "true");
    var d = t.dataset, open = d.open === "1";

    title.textContent = "Room " + d.number;
    badge.textContent = open ? "Available" : "Occupied";
    badge.className = "bd-badge" + (open ? "" : " busy");
    meta.textContent = d.floorName + (d.type ? " · " + d.type : "");
    rent.textContent = "₱" + d.rent;

    if (d.photo) {
      img.onerror = function () { thumb.classList.remove("has"); };
      img.src = d.photo; img.alt = "Room " + d.number; thumb.classList.add("has");
      img.classList.remove("swap"); void img.offsetWidth; img.classList.add("swap");
    } else { thumb.classList.remove("has"); img.removeAttribute("src"); }

    view.hidden = !open;
    view.href = d.url;
    next.hidden = open || !tiles.some(function (x) { return x.dataset.open === "1"; });
    list.setAttribute("data-go", d.number);

    hint.hidden = true; detail.hidden = false;
    detail.style.animation = "none"; void detail.offsetWidth; detail.style.animation = "";

    // on phones the panel can sit below the fold: bring it into view
    if (!quiet && window.matchMedia("(max-width: 820px)").matches) {
      root.querySelector(".bd-panel").scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
  }

  /* 4. "All / Open" filter */
  function setFilter(mode) {
    root.classList.toggle("only-open", mode === "open");
    segs.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-bd-filter") === mode ? "true" : "false"); });
    tiles.forEach(function (t) {
      var off = mode === "open" && t.dataset.open !== "1";
      t.tabIndex = off ? -1 : 0;
      t.setAttribute("aria-disabled", off ? "true" : "false");
    });
    if (current && mode === "open" && current.dataset.open !== "1") select(nearestOpen(current), true);
  }

  function nearestOpen(from) {
    var a = from.getBoundingClientRect(), best = null, bd = Infinity;
    tiles.forEach(function (t) {
      if (t.dataset.open !== "1") return;
      var r = t.getBoundingClientRect();
      var dist = Math.hypot(r.left - a.left, (r.top - a.top) * 1.6);
      if (dist < bd) { bd = dist; best = t; }
    });
    return best;
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest(".bd-rm");
    if (t) { if (t.getAttribute("aria-disabled") !== "true") select(t); return; }
    var f = e.target.closest("[data-bd-filter]");
    if (f) { setFilter(f.getAttribute("data-bd-filter")); return; }
    if (e.target.closest(".bd-next") && current) {
      var from = current;          // setFilter clears the selection, so remember where we were
      setFilter("open");
      var n = nearestOpen(from);
      if (n) { select(n); n.focus({ preventScroll: true }); }
    }
  });

  /* Start on the first open room, so the panel always matches the highlighted window */
  var firstOpen = tiles.filter(function (x) { return x.dataset.open === "1"; })[0];
  if (firstOpen) select(firstOpen, true);

  /* 5. Keyboard: arrow keys move between windows, Escape clears */
  root.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && current) { var c = current; select(null); c.focus({ preventScroll: true }); return; }
    var t = e.target.closest && e.target.closest(".bd-rm");
    var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!t || !dir) return;
    var a = t.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, bestScore = Infinity;
    tiles.forEach(function (o) {
      if (o === t || o.tabIndex < 0) return;
      var r = o.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      var along = dir[0] ? dx * dir[0] : dy * dir[1];
      var across = dir[0] ? Math.abs(dy) : Math.abs(dx);
      if (along < 10) return;
      if (dir[0] && across > a.height / 2) return;
      var score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = o; }
    });
    if (best) { e.preventDefault(); best.focus(); }
  });
})();
