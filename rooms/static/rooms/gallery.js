// Room photo gallery: slides to the next photo by itself.
// Each photo rests for 3 seconds, then the next one slides in from the right.
// Pauses when the mouse is over it, when a button has focus, or when the tab is hidden.
(function () {
  let main = document.getElementById("mainimg");
  if (!main) return;
  const thumbs = Array.from(document.querySelectorAll(".thumbs button"));
  const box = main.closest(".main");
  const prev = box.querySelector(".g-prev"), next = box.querySelector(".g-next");
  const bar = box.querySelector(".g-bar"), count = box.querySelector(".g-count"), play = box.querySelector(".g-play");
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const INTERVAL = 3000;                     // milliseconds each photo rests before the next slide
  const SLIDE = 650;                         // milliseconds the slide itself takes
  let i = 0, userPaused = false, hold = false, settle = null;

  // dir = 1 slides forward (new photo comes from the right), dir = -1 slides back (from the left)
  function show(n, dir) {
    if (!thumbs.length) return;
    if (settle) settle();                    // a slide is still running: finish it first
    const target = (n + thumbs.length) % thumbs.length;
    if (target === i) { restart(); return; }
    dir = dir || 1;
    i = target;
    thumbs.forEach((b, k) => b.setAttribute("aria-current", k === i));
    if (count) count.textContent = (i + 1) + " / " + thumbs.length;
    const src = thumbs[i].dataset.src, alt = "Room photo " + (i + 1);

    if (reduce) { main.src = src; main.alt = alt; restart(); return; }   // no sliding for people who asked for less motion

    if (bar) bar.classList.remove("run");    // the timer bar waits until the slide is over
    const old = main;
    const incoming = new Image();            // the new photo waits just outside the frame...
    incoming.className = "g-slide";
    incoming.alt = alt;
    incoming.src = src;
    incoming.style.transform = "translateX(" + dir * 100 + "%)";   // parked outside the frame right away, so it can never flash on top of the current photo
    box.insertBefore(incoming, old.nextSibling);

    let a1, a2, done = false;
    const finish = () => {
      if (done) return;
      done = true; settle = null;
      incoming.className = ""; incoming.id = "mainimg";   // ...and takes over as the main photo
      incoming.style.transform = "";
      if (a1) a1.cancel();
      if (a2) a2.cancel();
      old.remove();
      main = incoming;
      restart();
    };
    settle = finish;
    const opts = { duration: SLIDE, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" };
    const start = () => {
      if (done) return;
      a1 = incoming.animate([{ transform: "translateX(" + dir * 100 + "%)" }, { transform: "translateX(0)" }], opts);
      a2 = old.animate([{ transform: "translateX(0)" }, { transform: "translateX(" + -dir * 100 + "%)" }], opts);
      a1.onfinish = finish;
    };
    // wait until the new photo is ready, so it never slides in empty
    Promise.resolve(incoming.decode ? incoming.decode() : 0).catch(() => {}).then(start);
  }

  // The progress bar at the bottom of the photo is the timer: when it fills, we slide to the next photo.
  function restart() {
    if (!bar) return;
    bar.classList.remove("run");
    void bar.offsetWidth;                    // restart the animation
    if (!userPaused) bar.classList.add("run");
  }
  function sync() { box.classList.toggle("is-paused", userPaused || hold || document.hidden); }

  thumbs.forEach((b, k) => b.addEventListener("click", () => show(k, k > i ? 1 : -1)));
  if (thumbs.length < 2) return;             // one photo: nothing to slide

  thumbs.forEach(b => { const im = new Image(); im.src = b.dataset.src; });   // load them early
  thumbs.forEach((b, k) => b.setAttribute("aria-current", k === 0));
  prev.addEventListener("click", () => show(i - 1, -1));
  next.addEventListener("click", () => show(i + 1, 1));

  if (reduce) {                              // people who asked their device for less motion: no auto-slide
    userPaused = true;
    if (play) play.remove();
    if (bar) bar.remove();
    return;
  }

  bar.style.setProperty("--ms", INTERVAL + "ms");
  bar.addEventListener("animationend", () => show(i + 1, 1));
  play.addEventListener("click", () => {
    userPaused = !userPaused;
    play.setAttribute("aria-pressed", userPaused);
    play.setAttribute("aria-label", userPaused ? "Play slideshow" : "Pause slideshow");
    if (userPaused) bar.classList.remove("run"); else restart();
    sync();
  });

  // Pause while the mouse is over the photo or a control has keyboard focus
  box.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { hold = true; sync(); } });
  box.addEventListener("pointerleave", () => { hold = false; sync(); });
  box.addEventListener("focusin", () => { hold = true; sync(); });
  box.addEventListener("focusout", () => { hold = false; sync(); });
  document.addEventListener("visibilitychange", sync);

  // Swipe on phones
  let x0 = null;
  box.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") x0 = e.clientX; });
  box.addEventListener("pointerup", e => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  box.addEventListener("pointercancel", () => { x0 = null; });

  restart();
})();
