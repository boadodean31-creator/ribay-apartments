/* Share and Save on the room page */
(function () {
  var boxes = document.querySelectorAll(".rd-acts");
  if (!boxes.length) return;
  var room = boxes[0].dataset.room || "";
  var KEY = "ribay.saved";

  function toast(msg) {
    var o = document.getElementById("toast");
    if (!o) return;
    o.textContent = msg; o.classList.add("on");
    clearTimeout(o._t); o._t = setTimeout(function () { o.classList.remove("on"); }, 2200);
  }
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

  var saves = document.querySelectorAll(".rd-act-save");
  function paint() {
    var on = read().indexOf(room) !== -1;
    saves.forEach(function (save) {
      save.setAttribute("aria-pressed", on ? "true" : "false");
      save.querySelector("span").textContent = on ? "Saved" : "Save";
    });
  }
  paint();
  saves.forEach(function (save) {
    save.addEventListener("click", function () {
      var list = read(), i = list.indexOf(room);
      if (i === -1) list.push(room); else list.splice(i, 1);
      if (!write(list)) { toast("Could not save on this device"); return; }
      paint();
      toast(i === -1 ? "Saved to this device" : "Removed from saved");
    });
  });

  function doShare() {
    var url = location.origin + location.pathname;
    var data = { title: document.title, text: "Room " + room + " at Ribay Apartments", url: url };
    function copy() {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { toast("Could not copy the link"); });
      } else {
        var ta = document.createElement("textarea"); ta.value = url; ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta); toast(ok ? "Link copied" : "Could not copy the link");
      }
    }
    if (navigator.share) { navigator.share(data).catch(function (e) { if (!e || e.name !== "AbortError") copy(); }); }
    else copy();
  }
  document.querySelectorAll(".rd-act-share").forEach(function (b) { b.addEventListener("click", doShare); });
})();
