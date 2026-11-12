/* Arrows and "1 / 2" counter for the Where you'll sleep / Restroom rows */
(function () {
  document.querySelectorAll("[data-sp]").forEach(function (box) {
    var track = box.querySelector(".sp-track");
    if (!track) return;
    var prev = box.querySelector(".sp-prev"), next = box.querySelector(".sp-next"), count = box.querySelector(".sp-count"), ctl = box.querySelector(".sp-ctl");
    function pages() { return Math.max(1, Math.ceil((track.scrollWidth - 2) / track.clientWidth)); }
    function sync() {
      var n = pages(), end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      var i = end ? n : Math.min(n, Math.round(track.scrollLeft / track.clientWidth) + 1);
      if (ctl) ctl.hidden = n < 2;
      if (count) count.textContent = i + " / " + n;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = end;
    }
    function go(d) { track.scrollBy({ left: d * track.clientWidth, behavior: "smooth" }); }
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });
})();
