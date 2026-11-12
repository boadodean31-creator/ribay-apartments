// For administrators only: keeps the "Manage site" badge up to date and pops up a notice
// when a new "Book a viewing" request arrives. Checks every 20 seconds while the tab is open.
(function () {
  const tag = document.currentScript;
  const pollUrl = tag && tag.dataset.poll, listUrl = tag && tag.dataset.list;
  if (!pollUrl) return;
  const KEY = "aw_seen_id";
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const put = v => { try { localStorage.setItem(KEY, String(v)); } catch (e) {} };
  const onRequestsPage = location.pathname.indexOf("/manage/requests") === 0;

  function badges(n) {
    document.querySelectorAll("[data-aw-count]").forEach(el => { el.textContent = n; el.hidden = !n; });
  }

  function toast(text) {
    const old = document.querySelector(".aw-toast"); if (old) old.remove();
    const a = document.createElement("a");
    a.className = "aw-toast"; a.href = listUrl + "?status=new"; a.setAttribute("role", "status");
    a.innerHTML = '<span class="aw-bell" aria-hidden="true">🔔</span><span><b>New viewing request</b><br><span class="aw-txt"></span></span>';
    a.querySelector(".aw-txt").textContent = text;
    document.body.appendChild(a);
    setTimeout(() => { a.classList.add("out"); setTimeout(() => a.remove(), 400); }, 9000);
  }

  async function check() {
    if (document.hidden) return;
    try {
      const r = await fetch(pollUrl, { credentials: "same-origin", headers: { "Accept": "application/json" } });
      if (!r.ok) return;
      const d = await r.json();
      badges(d.new);
      const seen = get();
      if (onRequestsPage || seen === null) { put(d.latest_id); return; }
      if (d.latest_id > Number(seen)) {
        put(d.latest_id);
        if (d.latest) toast(d.latest.name + " wants to see Room " + d.latest.room);
      }
    } catch (e) {}
  }
  check();
  setInterval(check, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
})();
