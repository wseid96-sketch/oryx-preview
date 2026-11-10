/* Oryx Mainland Logistics: nav, forms, and motion. No libraries. */
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

/* Page transitions, press, scroll reveal, header. Transform/opacity only. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  var leaving = false;
  var leaveTimer = 0;
  var fallbackTimer = 0;

  function closeNav() {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }

  function settle() {
    leaving = false;
    clearTimeout(leaveTimer);
    clearTimeout(fallbackTimer);
    root.classList.remove("is-leaving");
    root.classList.add("is-settled");
    var bar = document.querySelector(".page-swoosh");
    if (bar) bar.classList.remove("is-on");
  }

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) settle();
  });

  if (toggle && nav) {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeNav();
        toggle.focus();
      }
    });
  }

  if (!reduce) {
    var clip = document.createElement("div");
    clip.className = "page-swoosh-clip";
    clip.setAttribute("aria-hidden", "true");
    var bar = document.createElement("div");
    bar.className = "page-swoosh";
    clip.appendChild(bar);
    document.body.appendChild(clip);

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a");
      if (!a || a.hasAttribute("download")) return;
      if (a.target && a.target.toLowerCase() !== "_self") return;
      var raw = a.getAttribute("href");
      if (!raw || raw.charAt(0) === "#") return;
      if (/^(mailto:|tel:|sms:|javascript:)/i.test(raw)) return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        closeNav();
        return;
      }
      if (leaving) return;
      e.preventDefault();
      leaving = true;
      root.classList.remove("is-settled");
      root.classList.add("is-leaving");
      bar.classList.remove("is-on");
      void bar.offsetWidth;
      bar.classList.add("is-on");
      var href = a.href;
      var from = window.location.href;
      leaveTimer = window.setTimeout(function () { window.location.href = href; }, 230);
      fallbackTimer = window.setTimeout(function () {
        if (window.location.href === from && root.classList.contains("is-leaving")) settle();
      }, 1400);
    });

    document.addEventListener("pointerdown", function (e) {
      var btn = e.target.closest && e.target.closest(".btn");
      if (!btn || btn.disabled || btn.getAttribute("aria-disabled") === "true") return;
      var rect = btn.getBoundingClientRect();
      var host = btn.querySelector(".ripple-host");
      if (!host) {
        host = document.createElement("span");
        host.className = "ripple-host";
        host.setAttribute("aria-hidden", "true");
        btn.insertBefore(host, btn.firstChild);
      }
      var ripple = document.createElement("span");
      ripple.className = "ripple";
      var size = Math.max(rect.width, rect.height) * 1.2;
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
      host.appendChild(ripple);
      ripple.addEventListener("animationend", function () { ripple.remove(); });
    });

    var revealSel = "main .card, main .rate, main .service, main .row, main .areas li, main .steps li, main h2, main .statement";
    var revealVisible = function () {};
    try {
      var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
        });
      }, { rootMargin: "40px 0px", threshold: 0 }) : null;

      function finish(el) {
        el.classList.add("is-shown");
        el.style.removeProperty("--reveal-delay");
      }
      function show(el) {
        if (!el || el.classList.contains("is-in")) return;
        el.classList.add("is-in");
        if (io) io.unobserve(el);
        var raw = el.style.getPropertyValue("--reveal-delay");
        window.setTimeout(function () { finish(el); }, (raw ? parseFloat(raw) : 0) + 620);
      }
      revealVisible = function () {
        document.querySelectorAll(revealSel).forEach(function (el) {
          if (el.classList.contains("is-in")) return;
          var r = el.getBoundingClientRect();
          if (r.bottom > 0 && r.top < window.innerHeight) show(el);
        });
      };
      function arm(el, delay) {
        if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
        el.addEventListener("animationend", function onEnd(ev) {
          if (ev.target !== el || ev.animationName !== "rise-in") return;
          finish(el);
          el.removeEventListener("animationend", onEnd);
        });
        var rect = el.getBoundingClientRect();
        if (!io || (rect.top < window.innerHeight && rect.bottom > 0)) show(el);
        else io.observe(el);
      }
      ["main .card", "main .rate", "main .service", "main .row", "main .areas li", "main .steps li"].forEach(function (sel) {
        var groups = [];
        document.querySelectorAll(sel).forEach(function (el) {
          var list = null;
          for (var i = 0; i < groups.length; i++) {
            if (groups[i][0].parentNode === el.parentNode) list = groups[i];
          }
          if (!list) { list = []; groups.push(list); }
          list.push(el);
        });
        groups.forEach(function (list) {
          list.forEach(function (el, i) { arm(el, i ? Math.min(i, 5) * 45 : 0); });
        });
      });
      document.querySelectorAll("main h2, main .statement").forEach(function (el) {
        if (el.closest(".card, .service, .rate, .row, .steps")) {
          el.classList.add("is-in", "is-shown");
          return;
        }
        arm(el, 0);
      });
      if (window.location.hash.length > 1) {
        try {
          var hashed = document.querySelector(window.location.hash);
          var node = hashed;
          while (node && node !== document.body) {
            if (node.matches && node.matches(revealSel)) node.classList.add("is-in", "is-shown");
            node = node.parentNode;
          }
        } catch (ignore) {}
      }
      document.addEventListener("focusin", function (e) {
        var node = e.target;
        while (node && node !== document.body) {
          if (node.matches && node.matches(revealSel)) show(node);
          node = node.parentNode;
        }
      });
    } catch (err) {
      document.querySelectorAll(revealSel).forEach(function (el) { el.classList.add("is-in", "is-shown"); });
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        if (header) header.classList.toggle("is-scrolled", window.scrollY > 20);
        revealVisible();
      });
    }, { passive: true });
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 20);
    revealVisible();
  }
})();
