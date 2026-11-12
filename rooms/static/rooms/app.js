const $ = s => document.querySelector(s);
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

// Toast messages
document.addEventListener("click", e => {
  const t = e.target.closest("[data-toast]");
  if (t) {
    const o = $("#toast");
    o.textContent = t.dataset.toast;
    o.classList.add("on");
    clearTimeout(o._t);
    o._t = setTimeout(() => o.classList.remove("on"), 2200);
  }
});

// Replay the "rise" animation on an element (used when filters change)
function replay(el, i) {
  el.style.setProperty("--i", i);
  el.classList.remove("in");
  void el.offsetWidth;          // force the browser to restart the animation
  el.classList.add("in");
}

// Room filters
let filt = "all";
function applyFilter() {
  let shown = 0;
  document.querySelectorAll("#grid .card").forEach(c => {
    const ok = filt === "all" || (filt === "avail" && c.dataset.avail === "1") || filt === c.dataset.floor;
    c.hidden = !ok;
    if (ok) replay(c, shown++ % 6);
  });
  const none = $("#none");
  if (none) none.hidden = shown > 0;
}
function setFilter(f) {
  filt = f;
  document.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.f === f));
  applyFilter();
}
document.querySelectorAll(".chip").forEach(c => c.onclick = () => setFilter(c.dataset.f));

// Building overview: jump to a room card and flash it
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (!g) return;
  setFilter("all");
  const el = document.getElementById("room-" + g.dataset.go);
  if (el) {
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
    el.style.borderColor = "var(--accent)";
    setTimeout(() => { el.style.borderColor = ""; }, 1400);
  }
});

// Scroll reveal: elements fade and rise as they enter the screen
const targets = document.querySelectorAll(".card,.stat,.ledger,.addr,.map,.head,.main,.info,.video,.sub,.receipt,.amen");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  targets.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--i", i % 6); io.observe(el); });
}

// Cursor spotlight on cards
document.addEventListener("pointermove", e => {
  const c = e.target.closest && e.target.closest(".card");
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", (e.clientX - r.left) + "px");
  c.style.setProperty("--my", (e.clientY - r.top) + "px");
});

// Header shadow after scrolling
const hdr = document.querySelector("header");
const onScroll = () => hdr && hdr.classList.toggle("scrolled", window.scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Dark mode toggle (the button spins each time)
const tb = $("#theme");
let angle = 0;
const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
const sync = () => tb && tb.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
if (tb) tb.onclick = () => {
  const n = isDark() ? "light" : "dark";
  root.dataset.theme = n;
  try { localStorage.setItem("theme", n); } catch (e) {}
  angle += 180;
  tb.style.setProperty("--r", angle + "deg");
  sync();
};
sync();

/* Navbar: highlight the pill for the section / page the visitor is on */
(() => {
  const links = [...document.querySelectorAll("header .navpill, header .portal-link")];
  if (!links.length) return;
  const mark = (el) => links.forEach((a) => { const on = a === el; a.classList.toggle("active", on); on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); });
  const portal = links.find((a) => a.classList.contains("portal-link"));
  if (portal && location.pathname.startsWith(new URL(portal.href).pathname)) { mark(portal); return; }
  const home = links.find((a) => a.classList.contains("navpill"));
  if (!home || location.pathname !== new URL(home.href).pathname) return;
  const spots = links.filter((a) => a.classList.contains("navpill")).map((a) => ({ a, s: document.querySelector(new URL(a.href).hash) })).filter((x) => x.s);
  if (!spots.length || !("IntersectionObserver" in window)) return;
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => seen.set(e.target, e.isIntersecting));
    const cur = spots.find((x) => seen.get(x.s));
    mark(cur ? cur.a : null);
  }, { rootMargin: "-40% 0px -50% 0px" });
  spots.forEach((x) => io.observe(x.s));
})();


/* Phone menu: the burger button opens a panel with every link */
(() => {
  const btn = document.getElementById("menuBtn"), panel = document.getElementById("mnav"), hdr = document.querySelector("header");
  if (!btn || !panel || !hdr) return;
  const set = (open) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    hdr.classList.toggle("menu-open", open);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); set(panel.hidden); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { set(false); btn.focus(); } });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches) set(false); });
})();
