// "Book a viewing" window: open/close, day picker, send the request without leaving the page.
(function () {
  const dlg = document.getElementById("bk");
  if (!dlg) return;
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

  function openDlg() {
    if (dlg.open) return;
    dlg.classList.remove("closing");
    dlg.showModal();
    html.classList.add("bk-lock");
  }
  function closeDlg() {
    if (!dlg.open || dlg.classList.contains("closing")) return;
    dlg.classList.add("closing");
    setTimeout(() => { dlg.close(); dlg.classList.remove("closing"); }, reduce ? 0 : 260);
  }
  dlg.addEventListener("close", () => html.classList.remove("bk-lock"));
  dlg.addEventListener("cancel", e => { e.preventDefault(); closeDlg(); });      // Esc key
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest("[data-bk-close]")) closeDlg();   // backdrop or X button
  });
  document.addEventListener("click", e => { if (e.target.closest("[data-book]")) openDlg(); });

  // Coming back from the sign-in page: ?book=1 opens the window again
  if (/[?&]book=1\b/.test(location.search)) {
    openDlg();
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }

  const form = document.getElementById("bk-form");
  if (!form) return;

  form.querySelectorAll(":scope > .bk-field").forEach((el, i) => el.style.setProperty("--d", i));

  // ----- Day picker: the next 7 days as buttons, plus the normal date box -----
  const dateInput = document.getElementById("bk-date");
  const days = document.getElementById("bk-days");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const start = parse(form.dataset.min);
  const maxDate = parse(form.dataset.max);
  const wk = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const mo = new Intl.DateTimeFormat(undefined, { month: "short" });

  function syncDays() {
    days.querySelectorAll(".bk-day").forEach(b => b.setAttribute("aria-checked", b.dataset.date === dateInput.value));
  }
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > maxDate) break;
    const b = document.createElement("button");
    b.type = "button"; b.className = "bk-day"; b.dataset.date = iso(d);
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
    b.innerHTML = "<small>" + (i === 0 ? "Tomorrow" : wk.format(d)) + "</small><b>" + d.getDate() + "</b><small>" + mo.format(d) + "</small>";
    b.addEventListener("click", () => { dateInput.value = b.dataset.date; syncDays(); clearError("preferred_date"); });
    days.appendChild(b);
  }
  dateInput.addEventListener("change", () => { syncDays(); clearError("preferred_date"); });

  // ----- Errors -----
  const errBox = document.getElementById("bk-error");
  function setError(field, msg) {
    const small = form.querySelector('.bk-err[data-for="' + field + '"]');
    if (!small) return false;
    small.textContent = msg;
    small.closest(".bk-field").classList.add("bad");
    return true;
  }
  function clearError(field) {
    const small = form.querySelector('.bk-err[data-for="' + field + '"]');
    if (small) { small.textContent = ""; small.closest(".bk-field").classList.remove("bad"); }
  }
  function clearAll() {
    form.querySelectorAll(".bk-err").forEach(s => { s.textContent = ""; s.closest(".bk-field").classList.remove("bad"); });
    errBox.hidden = true;
  }
  form.addEventListener("input", e => { if (e.target.name) clearError(e.target.name); });
  form.addEventListener("change", e => { if (e.target.name) clearError(e.target.name); });

  function showErrors(errors) {
    let first = null;
    Object.keys(errors).forEach(field => {
      const msg = errors[field][0];
      if (field === "__all__" || !setError(field, msg)) { errBox.textContent = msg; errBox.hidden = false; }
      else if (!first) first = form.querySelector('[name="' + field + '"]');
    });
    if (first && first.focus) first.focus({ preventScroll: false });
  }

  // ----- Send -----
  const submit = form.querySelector(".bk-submit");
  const lbl = submit.querySelector(".bk-lbl");
  function busy(on) {
    submit.disabled = on;
    submit.setAttribute("aria-busy", on);
    lbl.textContent = on ? "Sending…" : "Send request";
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    clearAll();
    const local = {};
    const need = (name, msg) => { const f = form.elements[name]; const v = f && (f.value || (f.length && form.querySelector('[name="' + name + '"]:checked'))); if (!v) local[name] = [msg]; };
    need("name", "Please enter your name.");
    need("phone", "Please enter a contact number.");
    need("preferred_date", "Choose the day you want to visit.");
    need("preferred_slot", "Choose a time that works for you.");
    if (Object.keys(local).length) { showErrors(local); return; }

    busy(true);
    try {
      const res = await fetch(form.action, {
        method: "POST", body: new FormData(form), credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
      });
      let data = {};
      try { data = await res.json(); } catch (err) {}
      if (res.status === 401 && data.login) { location.href = data.login; return; }
      if (res.ok && data.ok) { showDone(); return; }
      showErrors(data.errors || { __all__: ["Something went wrong. Please try again, or call us."] });
    } catch (err) {
      showErrors({ __all__: ["No connection. Check your internet and try again."] });
    }
    busy(false);
  });

  function showDone() {
    const slot = form.querySelector('[name="preferred_slot"]:checked');
    document.getElementById("bk-d-name").textContent = form.elements.namedItem("name").value.trim().split(" ")[0];
    document.getElementById("bk-d-date").textContent = parse(dateInput.value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    document.getElementById("bk-d-slot").textContent = slot ? slot.nextElementSibling.textContent : "";
    form.hidden = true;
    const done = document.getElementById("bk-done");
    done.hidden = false;
    done.focus({ preventScroll: true });
    done.closest(".bk-main").scrollTop = 0;
  }
})();
