/* Room video tour: plays (muted) when it scrolls into view, pauses when it leaves.
   Browsers only allow autoplay when muted, so visitors tap the speaker icon for sound. */
(function () {
  var frame = document.querySelector(".video iframe");
  if (!frame) return;
  // Respect people who ask their device for less motion
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var player = null, ready = false, visible = false, userPaused = false, wantPlay = false;

  function sync() {
    if (!ready) return;
    var state = player.getPlayerState ? player.getPlayerState() : -1;
    if (visible && !userPaused) {
      if (state !== 1 && state !== 3) player.playVideo();
    } else if (!visible && (state === 1 || state === 3)) {
      player.pauseVideo();
    }
  }

  function setup() {
    player = new YT.Player(frame, {
      events: {
        onReady: function () { ready = true; player.mute(); sync(); },
        onStateChange: function (e) {
          // If the visitor pauses it themselves while it is on screen, leave it paused
          if (e.data === 2 && visible) userPaused = true;
          if (e.data === 1) userPaused = false;
        }
      }
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      visible = en.isIntersecting && en.intersectionRatio >= 0.5;
      if (!visible) userPaused = false;   // next time it scrolls in, autoplay again
      sync();
    });
  }, { threshold: [0, 0.5, 1] });
  io.observe(frame);

  // Load YouTube's player API
  var prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () { if (prev) prev(); setup(); };
  var s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
})();
