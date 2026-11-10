/* Oryx Mainland Logistics: nav toggle + forms (booking + contact). No libraries. */
(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^[0-9+().\-\s]{7,40}$/;
  var FAIL = "Sorry, that didn't send. Please email admin@oryxmainland.ca directly.";

  function valid(name, value, required) {
    value = (value || "").trim();
    if (value === "") return !required;
    switch (name) {
      case "name": return value.length >= 2;
      case "email": return EMAIL_RE.test(value);
      case "phone": return PHONE_RE.test(value);
      case "message": return value.length >= 10;
      case "date": return /^\d{4}-\d{2}-\d{2}$/.test(value);
      default: return true;
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".js-form"), function (form) {
    var card = form.parentNode;
    var status = form.querySelector(".form__status");
    var success = card.querySelector(".form-success");
    var required = (form.getAttribute("data-required") || "").split(/\s+/);
    var checked = ["name", "email", "phone", "date", "message", "pickup", "dropoff"];
    var ts = form.querySelector(".js-ts");
    if (ts) ts.value = String(Math.floor(Date.now() / 1000));

    function isReq(n) { return required.indexOf(n) !== -1; }
    function setError(n, bad) {
      var f = form.querySelector('[data-field="' + n + '"]');
      if (!f) return;
      var el = f.querySelector("input, select, textarea");
      f.classList.toggle("has-error", bad);
      if (el) el.setAttribute("aria-invalid", bad ? "true" : "false");
    }
    function validate() {
      var first = null;
      checked.forEach(function (n) {
        var el = form.elements[n];
        if (!el || !el.name) return;
        var bad = !valid(n, el.value, isReq(n));
        setError(n, bad);
        if (bad && !first) first = el;
      });
      return first;
    }
    function show(msg) { status.textContent = msg; status.classList.add("is-visible"); status.focus(); }

    form.addEventListener("blur", function (e) {
      var n = e.target.name;
      if (checked.indexOf(n) !== -1 && e.target.value !== "") setError(n, !valid(n, e.target.value, isReq(n)));
    }, true);
    form.addEventListener("input", function (e) {
      var f = e.target.closest(".field");
      if (f && f.classList.contains("has-error") && valid(e.target.name, e.target.value, isReq(e.target.name))) setError(e.target.name, false);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.classList.remove("is-visible");
      var bad = validate();
      if (bad) { show("Please fix the highlighted fields."); bad.focus(); return; }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.setAttribute("aria-busy", "true");
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data && data.ok) { form.hidden = true; success.classList.add("is-visible"); success.focus(); return; }
          if (data && data.errors) Object.keys(data.errors).forEach(function (n) { setError(n, true); });
          show((data && data.message) || FAIL);
        })
        .catch(function () { show(FAIL); })
        .then(function () { btn.disabled = false; btn.removeAttribute("aria-busy"); });
    });

    if (/[?&]status=error/.test(location.search)) show("Sorry, something was missing or it didn't send. Please check the form and try again.");
  });
})();
