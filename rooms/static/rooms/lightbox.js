// Photo viewer: click the room photo (or the enlarge button) and it opens big over a blurred page.
// Arrows, swipe and the keyboard (left/right, Esc) change photos; clicking outside the photo closes it.
(function () {
  const box = document.querySelector(".rd .main");
  if (!box) return;
  const thumbs = Array.prototype.slice.call(document.querySelectorAll(".thumbs button"));
  const play = box.querySelector(".g-play");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const title = (document.querySelector(".rd-book h1") || {}).textContent || "Room";
  const ICON = {
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };

  // a small "enlarge" button on the photo, so it is obvious the photo can be opened
  const zoomBtn = document.createElement("button");
  zoomBtn.type = "button"; zoomBtn.className = "g-zoom"; zoomBtn.setAttribute("aria-label", "View photo larger");
  zoomBtn.innerHTML = ICON.expand;
  box.appendChild(zoomBtn);

  // ---- the viewer (built once, reused)
  const lb = document.createElement("div");
  lb.className = "lb"; lb.hidden = true;
  lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", title + " photos");
  lb.innerHTML =
    '<button type="button" class="lb-close" aria-label="Close photo viewer">' + ICON.close + '</button>' +
    '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo">' + ICON.prev + '</button>' +
    '<button type="button" class="lb-nav lb-next" aria-label="Next photo">' + ICON.next + '</button>' +
    '<figure class="lb-stage"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>' +
    '<div class="lb-strip" role="tablist" aria-label="Choose a photo"></div>';
  document.body.appendChild(lb);
  const img = lb.querySelector(".lb-img"), cap = lb.querySelector(".lb-cap"), strip = lb.querySelector(".lb-strip");
  const closeBtn = lb.querySelector(".lb-close"), prevBtn = lb.querySelector(".lb-prev"), nextBtn = lb.querySelector(".lb-next");

  let urls = [], cur = 0, openFrom = null, lastFocus = null, pausedByUs = false, closing = false;

  function currentIndex() {
    for (let k = 0; k < thumbs.length; k++) if (thumbs[k].getAttribute("aria-current") === "true") return k;
    return 0;
  }
  function collect() {
    urls = thumbs.length ? thumbs.map(function (b) { return b.dataset.src; }) : [(box.querySelector("img") || {}).src].filter(Boolean);
  }
  function render(animate) {
    const src = urls[cur];
    cap.textContent = title + (urls.length > 1 ? "  ·  " + (cur + 1) + " / " + urls.length : "");
    prevBtn.hidden = nextBtn.hidden = strip.hidden = urls.length < 2;
    Array.prototype.forEach.call(strip.children, function (b, k) { b.setAttribute("aria-selected", k === cur); });
    if (animate && !reduce) img.animate([{ opacity: 0, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
    img.src = src; img.alt = title + " photo " + (cur + 1);
    [cur + 1, cur - 1].forEach(function (n) { const u = urls[(n + urls.length) % urls.length]; if (u) { const im = new Image(); im.src = u; } });
  }
  function go(n) {
    if (urls.length < 2) return;
    cur = (n + urls.length) % urls.length;
    render(true);
    if (thumbs[cur]) thumbs[cur].click();   // keeps the page's own gallery on the same photo
  }

  function open() {
    if (!lb.hidden) return;
    collect(); if (!urls.length) return;
    cur = Math.min(currentIndex(), urls.length - 1);
    openFrom = box.querySelector("img");
    lastFocus = document.activeElement;
    strip.innerHTML = urls.map(function (u, k) { return '<button type="button" role="tab" aria-label="Photo ' + (k + 1) + '"><img src="' + u + '" alt=""></button>'; }).join("");
    Array.prototype.forEach.call(strip.children, function (b, k) { b.addEventListener("click", function () { go(k); }); });
    render(false);
    // stop the page's slideshow while the viewer is open (and remember to restart it)
    pausedByUs = !!(play && play.getAttribute("aria-pressed") === "false"); if (pausedByUs) play.click();
    // lock page scroll without the page jumping sideways
    const sb = innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden"; if (sb > 0) document.body.style.paddingRight = sb + "px";
    lb.hidden = false; closing = false;
    void lb.offsetWidth; lb.classList.add("open");
    // the photo grows out of the spot where it was clicked
    if (!reduce && openFrom) {
      const f = openFrom.getBoundingClientRect(), run = function () {
        const t = img.getBoundingClientRect(); if (!t.width || !f.width) return;
        const s = f.width / t.width, dx = f.left + f.width / 2 - (t.left + t.width / 2), dy = f.top + f.height / 2 - (t.top + t.height / 2);
        img.animate([{ transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")", opacity: .4 }, { transform: "none", opacity: 1 }], { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)" });
      };
      if (img.complete && img.naturalWidth) run(); else img.addEventListener("load", run, { once: true });
    }
    closeBtn.focus({ preventScroll: true });
  }
  function close() {
    if (lb.hidden || closing) return;
    closing = true; lb.classList.remove("open");
    setTimeout(function () {
      lb.hidden = true; closing = false; img.removeAttribute("src");
      document.documentElement.style.overflow = ""; document.body.style.paddingRight = "";
      if (pausedByUs && play && play.getAttribute("aria-pressed") === "true") play.click();
      pausedByUs = false;
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }, reduce ? 0 : 260);
  }

  // ---- how it opens: click the photo (a drag or swipe on the photo does not count), or the enlarge button
  let down = null;
  box.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
  box.addEventListener("click", function (e) {
    if (e.target.closest(".g-nav, .g-play")) return;
    if (e.target.closest(".g-zoom") || e.target.tagName === "IMG") {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
      open();
    }
  });

  // ---- how it closes and moves
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", function () { go(cur - 1); });
  nextBtn.addEventListener("click", function () { go(cur + 1); });
  lb.addEventListener("click", function (e) { if (!e.target.closest("button, .lb-img, .lb-cap")) close(); });   // empty space around the photo
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "Tab") {   // keep keyboard focus inside the viewer
      const f = Array.prototype.filter.call(lb.querySelectorAll("button"), function (b) { return !b.hidden && b.offsetParent !== null; });
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // swipe on phones
  let x0 = null;
  lb.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") x0 = e.clientX; });
  lb.addEventListener("pointerup", function (e) {
    if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  });
})();
