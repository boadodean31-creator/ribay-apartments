/* Photo mosaic: any tile opens the big photo viewer on that photo */
(function () {
  var tiles = document.querySelectorAll(".rd-mosaic [data-k]");
  if (!tiles.length) return;
  tiles.forEach(function (t) {
    t.addEventListener("click", function () {
      var k = parseInt(t.dataset.k, 10) || 0;
      var thumbs = document.querySelectorAll(".thumbs button");
      if (thumbs[k]) thumbs[k].click();      // keeps the hidden slider on the same photo
      var z = document.querySelector(".g-zoom");
      if (z) z.click();                      // opens the existing viewer
    });
  });
})();
