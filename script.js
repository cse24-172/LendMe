// Lendme front end. Talks to the Lendme backend (see config.js).
(function () {
  var API = (window.LENDME_API || "").replace(/\/$/, "");
  var TK = "lendme_token", UK = "lendme_user";
  var RATE = 30; // yearly interest rate, percent

  function el(id) { return document.getElementById(id); }
  function say(t, ok) { var m = el("msg"); if (m) { m.textContent = t; m.className = "msg" + (ok ? " ok" : ""); } }
  function token() { try { return localStorage.getItem(TK); } catch (e) { return null; } }
  function user() { try { return JSON.parse(localStorage.getItem(UK)); } catch (e) { return null; } }
  function save(r) { try { localStorage.setItem(TK, r.token); localStorage.setItem(UK, JSON.stringify(r.user)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(TK); localStorage.removeItem(UK); } catch (e) {} }
  function h(tag, text, cls) { var n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function money(v) { return "BWP " + Number(v).toFixed(2); }

  function api(path, opts) {
    opts = opts || {}; opts.headers = opts.headers || {};
    var t = token(); if (t) opts.headers["Authorization"] = "Bearer " + t;
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401 && t) { clear(); location.href = "login.html"; throw new Error("Please log in again."); }
      if (r.ok) return r;
      return r.text().then(function (tx) {
        var m = "Something went wrong (" + r.status + ").";
        try { var j = JSON.parse(tx); if (j.message) m = j.message; } catch (e) {}
        if (r.status === 400 && /validation/i.test(m)) m = "Please check your details. The email must be valid and the password needs at least 8 characters.";
        if (r.status === 413) m = "A file is too big. Each file can be up to 5 MB.";
        throw new Error(m);
      });
    }, function () { throw new Error("Cannot reach the Lendme server. Check that the backend is running."); });
  }
  function json(path, method, body) {
    return api(path, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  var page = document.body.getAttribute("data-page");
  var me = token() ? user() : null;

  // navigation
  var nav = el("nav");
  if (nav) {
    var links = [["calculator.html", "Calculator"], ["about.html", "About"]];
    if (me) {
      links = [["dashboard.html", "Dashboard"], ["apply.html", "Apply"]].concat(me.role === "STAFF" ? [["admin.html", "Staff"]] : [], links);
    } else { links = links.concat([["login.html", "Log in"]]); }
    links.forEach(function (l) { var a = h("a", l[1]); a.href = l[0]; nav.appendChild(a); });
    var last = h("a", me ? "Log out" : "Sign up"); last.href = me ? "#" : "register.html"; if (!me) last.className = "pill";
    if (me) last.onclick = function (e) { e.preventDefault(); clear(); location.href = "index.html"; };
    nav.appendChild(last);
  }

  if ((page === "apply" || page === "dashboard") && !me) { location.href = "login.html"; return; }
  if (page === "admin" && (!me || me.role !== "STAFF")) { location.href = "login.html"; return; }

  if (page === "register") {
    el("registerForm").onsubmit = function (e) {
      e.preventDefault(); say("Creating account...", true);
      json("/api/auth/register", "POST", {
        fullName: el("name").value, email: el("email").value, password: el("password").value, institution: el("institution").value
      }).then(function (r) { save(r); location.href = "dashboard.html"; }).catch(function (er) { say(er.message); });
    };
  }

  if (page === "login") {
    el("loginForm").onsubmit = function (e) {
      e.preventDefault(); say("Logging in...", true);
      json("/api/auth/login", "POST", { email: el("email").value, password: el("password").value })
        .then(function (r) { save(r); location.href = r.user.role === "STAFF" ? "admin.html" : "dashboard.html"; })
        .catch(function (er) { say(er.message); });
    };
  }

  if (page === "apply") {
    el("applyForm").onsubmit = function (e) {
      e.preventDefault(); say("Submitting...", true);
      var fd = new FormData();
      fd.append("amount", el("amount").value);
      fd.append("signedName", el("sig").value);
      fd.append("studentId", el("d1").files[0]);
      fd.append("proofOfRegistration", el("d2").files[0]);
      fd.append("results", el("d3").files[0]);
      fd.append("bankStatement", el("d4").files[0]);
      api("/api/applications", { method: "POST", body: fd }).then(function () { location.href = "dashboard.html"; })
        .catch(function (er) { say(er.message); });
    };
  }

  if (page === "dashboard") {
    el("hello").textContent = "Hello, " + me.fullName.split(" ")[0];
    api("/api/applications/me").then(function (r) { return r.json(); }).then(function (list) {
      var box = el("list");
      if (!list.length) { el("empty").hidden = false; return; }
      list.forEach(function (a) {
        var c = h("div", undefined, "card");
        c.appendChild(h("span", a.status.charAt(0) + a.status.slice(1).toLowerCase(), "badge " + a.status.toLowerCase()));
        var dl = h("dl");
        [["Amount requested", money(a.amount)], ["Submitted", new Date(a.submittedAt).toLocaleDateString("en-GB")],
         ["Signed by", a.signedName], ["Documents", a.documents.map(function (d) { return d.fileName; }).join(", ")]]
          .forEach(function (p) { dl.appendChild(h("dt", p[0])); dl.appendChild(h("dd", p[1])); });
        c.appendChild(dl); box.appendChild(c);
      });
    }).catch(function (er) { say(er.message); });
  }

  if (page === "admin") {
    function load() {
      api("/api/admin/applications").then(function (r) { return r.json(); }).then(function (list) {
        var box = el("list"); box.textContent = "";
        if (!list.length) { box.appendChild(h("p", "No applications yet.")); return; }
        list.forEach(function (a) {
          var c = h("div", undefined, "card");
          c.appendChild(h("strong", a.studentName + " (" + a.studentEmail + ")"));
          c.appendChild(h("p", money(a.amount) + " · " + new Date(a.submittedAt).toLocaleDateString("en-GB")));
          c.appendChild(h("span", a.status.charAt(0) + a.status.slice(1).toLowerCase(), "badge " + a.status.toLowerCase()));
          var docs = h("p"); docs.appendChild(h("span", "Documents: "));
          a.documents.forEach(function (d) {
            var b = h("button", d.type.replace(/_/g, " ").toLowerCase(), "link"); b.type = "button";
            b.onclick = function () {
              api("/api/admin/documents/" + d.id).then(function (r) { return r.blob(); }).then(function (bl) {
                var x = document.createElement("a"); x.href = URL.createObjectURL(bl); x.download = d.fileName || "document"; x.click();
              }).catch(function (er) { say(er.message); });
            };
            docs.appendChild(b); docs.appendChild(document.createTextNode(" "));
          });
          c.appendChild(docs);
          var row = h("div", undefined, "row");
          [["APPROVED", "Approve"], ["REJECTED", "Reject"], ["PENDING", "Set pending"]].forEach(function (s) {
            if (a.status === s[0]) return;
            var b = h("button", s[1], "btn small"); b.type = "button";
            b.onclick = function () { json("/api/admin/applications/" + a.id + "/status", "PATCH", { status: s[0] }).then(load).catch(function (er) { say(er.message); }); };
            row.appendChild(b);
          });
          c.appendChild(row); box.appendChild(c);
        });
      }).catch(function (er) { say(er.message); });
    }
    load();
  }

  if (page === "calculator") {
    el("calcForm").onsubmit = function (e) {
      e.preventDefault();
      var P = parseFloat(el("cAmt").value), n = parseInt(el("cMonths").value, 10), r = RATE / 100 / 12;
      if (!(P > 0) || !(n > 0)) { el("cOut").textContent = "Enter an amount and the number of months."; return; }
      var m = P * r / (1 - Math.pow(1 + r, -n));
      el("cOut").textContent = "";
      el("cOut").appendChild(h("p", "Monthly payment: " + money(m)));
      el("cOut").appendChild(h("p", "Total to repay: " + money(m * n)));
      el("cOut").appendChild(h("p", "Total interest: " + money(m * n - P)));
    };
  }
})();
