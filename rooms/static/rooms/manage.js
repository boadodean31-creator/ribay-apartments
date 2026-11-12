// Show small previews of the photos chosen in the room form, before saving.
(function () {
  const input = document.getElementById("photos");
  const box = document.getElementById("preview");
  if (!input || !box) return;
  input.addEventListener("change", () => {
    box.innerHTML = "";
    Array.from(input.files).forEach(f => {
      if (!f.type.startsWith("image/")) return;
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = f.name;
      img.onload = () => URL.revokeObjectURL(img.src);
      box.appendChild(img);
    });
  });
})();

// Pop-up notifications: close button, and remove them once they have faded out.
document.addEventListener("click", e => {
  const x = e.target.closest(".m-x");
  if (x) x.closest(".m-toast").remove();
});
document.querySelectorAll(".m-toast:not(.error)").forEach(t => {
  t.addEventListener("animationend", ev => { if (ev.animationName === "toastout") t.remove(); });
});

// While saving, show "Saving…" so a second click can't send the form twice.
(function () {
  const form = document.getElementById("roomform");
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.textContent;
  form.addEventListener("submit", () => {
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Saving…";
    setTimeout(() => { btn.disabled = true; }, 0);
  });
  window.addEventListener("pageshow", () => {     // coming back with the Back button
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    btn.textContent = label;
  });
})();
