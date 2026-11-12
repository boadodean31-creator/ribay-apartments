// Room page: builds the short street label shown on the map ("Kagandahan Street, Cainta")
// from the full address, so nothing extra has to be typed in settings.
(function () {
  const pill = document.querySelector(".rd-street");
  const addr = document.querySelector(".rd-loc .locaddr");
  if (!pill || !addr || !addr.firstChild) return;
  const full = (addr.firstChild.nodeValue || "").trim();
  const parts = full.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return;
  const isStreet = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|boulevard|blvd\.?)\b/i;
  let street = parts.find(p => isStreet.test(p)) || parts[0];
  street = street.replace(/^((blk|block|lot|unit|bldg|building)\.?\s*\d+[a-z]?\s+)+/i, "");   // "Lot 9 Kagandahan Street" -> "Kagandahan Street"
  // "..., Cainta, Rizal 1900": a last part with a zip code is the province, so the city is the part before it
  const last = parts[parts.length - 1];
  const city = parts.length < 2 ? "" : (/\d/.test(last) && parts.length >= 3 ? parts[parts.length - 2] : last);
  pill.querySelector("b").textContent = street + (city && city !== street ? ", " + city : "");
  pill.title = full;
  pill.hidden = false;
})();


// While a card opens or closes, nudge the page so the card stays in view
// (the bottom of the card follows the screen down; the top never slides under the sticky header).
let followId = 0;
function follow(el) {
  const id = ++followId, t0 = performance.now(), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stop = function () { followId++; };
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  function step() {
    if (id !== followId) return;
    const hd = document.querySelector("header"), top = (hd ? hd.getBoundingClientRect().bottom : 0) + 12;
    const r = el.getBoundingClientRect(), bottomGap = 16;
    let dy = 0;
    if (r.bottom > innerHeight - bottomGap) dy = Math.min(r.bottom - (innerHeight - bottomGap), r.top - top);  // follow down, but keep the top visible
    else if (r.top < top) dy = r.top - top;                                                                       // card top slipped above the header (e.g. after closing)
    if (dy) window.scrollBy(0, dy);
    if (!reduce && performance.now() - t0 < 750) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// "Good to know": click the header to open or close it (animated in CSS).
(function () {
  document.querySelectorAll(".acc").forEach(function (acc) {
    const btn = acc.querySelector(".acc-btn");
    if (!btn) return;
    function set(open) { btn.setAttribute("aria-expanded", open ? "true" : "false"); acc.classList.toggle("open", open); follow(acc); }
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    if (location.hash === "#" + acc.id) set(true);
  });
})();

// Staff contact card: admins edit it in place. (Visitors never get the edit button or form.)
(function () {
  const card = document.getElementById("contact");
  const toggle = card && card.querySelector(".rc-edit");
  const panel = card && card.querySelector(".rc-panel");
  if (!toggle || !panel) return;
  const form = panel.querySelector("form"), err = panel.querySelector(".rc-err"), save = panel.querySelector(".rc-save");
  function open(on) {
    panel.classList.toggle("open", on);
    follow(card);
    toggle.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) setTimeout(function () { const f = form.querySelector("input"); if (f) f.focus({ preventScroll: true }); }, 250);
  }
  function toast(msg) {
    const o = document.getElementById("toast"); if (!o) return;
    o.textContent = msg; o.classList.add("on"); clearTimeout(o._t); o._t = setTimeout(function () { o.classList.remove("on"); }, 2400);
  }
  toggle.addEventListener("click", function () { open(!panel.classList.contains("open")); });
  panel.querySelector(".rc-cancel").addEventListener("click", function () { err.hidden = true; open(false); toggle.focus(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true; save.disabled = true;
    fetch(card.dataset.saveUrl, { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok && d.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          const errs = (res.d && res.d.errors) || {};
          const first = Object.keys(errs).map(function (k) { return errs[k][0]; })[0];
          err.textContent = first || "Could not save. Please try again."; err.hidden = false; return;
        }
        const c = res.d.contact;
        document.querySelectorAll("[data-c]").forEach(function (el) { if (c[el.dataset.c] != null) el.textContent = c[el.dataset.c]; });
        ["contact_name:name", "contact_role:role", "contact_phone:phone", "contact_hours:hours", "contact_reply:reply", "contact_languages:languages"].forEach(function (p) {
          const kv = p.split(":"), inp = form.elements[kv[0]]; if (inp) inp.value = c[kv[1]];
        });
        open(false); toast("Contact card saved");
      })
      .catch(function () { err.textContent = "No connection. Please try again."; err.hidden = false; })
      .then(function () { save.disabled = false; });
  });
})();


// Quick nav: highlights the section you are reading; clicking a link also opens its dropdown.
// (Sections sit in different columns, so we order them by where they are on the page.)
(function () {
  const links = Array.prototype.slice.call(document.querySelectorAll(".rd-qnav a, .rn-links a[href^='#']"));
  if (!links.length) return;
  const items = links.map(function (a) { return { a: a, el: document.querySelector(a.getAttribute("href")) }; }).filter(function (i) { return i.el; });
  let locked = null, lockY = null;   // the link just clicked stays highlighted until you scroll away from where it landed
  function mark(a) { links.forEach(function (l) { l.classList.toggle("on", l === a); }); }
  function top(i) { return i.el.getBoundingClientRect().top; }
  function spy() {
    if (locked) { if (lockY === null || Math.abs(scrollY - lockY) < 160) { mark(locked.a); return; } locked = null; }
    const byPos = items.slice().sort(function (x, y) { return top(x) - top(y); });
    let cur = byPos[0];
    byPos.forEach(function (i) { if (top(i) <= 150) cur = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = byPos[byPos.length - 1];
    mark(cur && cur.a);
  }
  let ticking = false;
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; spy(); }); } }, { passive: true });
  addEventListener("resize", spy);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function flash(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 2600);
  }
  // scroll so the section sits in the middle of the screen (or at the top, if it is taller than the screen)
  function bring(el) {
    const tall = el.getBoundingClientRect().height > innerHeight - 160;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: tall ? "start" : "center" });
  }
  items.forEach(function (i) {
    i.a.addEventListener("click", function (e) {
      locked = i; lockY = null; mark(i.a);
      setTimeout(function () { lockY = scrollY; }, 1100);
      const id = i.el.id;
      if (id === "photos") {                     // photos: open this room's photos, very big
        e.preventDefault();
        const z = document.querySelector(".g-zoom"); if (z) z.click();
      } else if (id === "pricing") {             // pricing: go to the price and flash it
        e.preventDefault(); bring(i.el);
        setTimeout(function () { flash(i.el.querySelector(".price.big"), "hl-price"); }, reduce ? 0 : 500);
      } else if (id === "location") {            // location: go to the map card and flash it
        e.preventDefault(); bring(i.el);
        setTimeout(function () { flash(i.el, "hl-loc"); }, reduce ? 0 : 500);
      } else if (i.el.classList.contains("acc") && !i.el.classList.contains("open")) {
        const b = i.el.querySelector(".acc-btn"); if (b) b.click();
      }
    });
  });
  spy();
})();


// Available rooms list: a soft fade at the bottom tells you there is more to scroll.
(function () {
  const wrap = document.querySelector(".sim-wrap"), list = wrap && wrap.querySelector(".sim-list");
  if (!list) return;
  function upd() {
    const can = list.scrollHeight > list.clientHeight + 4;
    wrap.classList.toggle("can-scroll", can);
    wrap.classList.toggle("at-end", !can || list.scrollTop + list.clientHeight >= list.scrollHeight - 4);
  }
  list.addEventListener("scroll", upd, { passive: true });
  addEventListener("resize", upd); addEventListener("load", upd);
  upd();
})();


// "Show map" links (under the title and in the booking card): bring the map card into view if needed, then flash it.
(function () {
  const loc = document.getElementById("location");
  const links = document.querySelectorAll("[data-loc-link]");
  if (!loc || !links.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      const hd = document.querySelector("header"), top = (hd ? hd.getBoundingClientRect().bottom : 0) + 12;
      const r = loc.getBoundingClientRect();
      const visible = r.top >= top && r.bottom <= innerHeight - 12;
      if (!visible) loc.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      setTimeout(function () {
        loc.classList.remove("hl-loc"); void loc.offsetWidth; loc.classList.add("hl-loc");
        setTimeout(function () { loc.classList.remove("hl-loc"); }, 2600);
      }, visible || reduce ? 0 : 450);
    });
  });
})();
