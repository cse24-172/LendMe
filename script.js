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


  // ---------- Demo mode (GitHub Pages has no server) ----------
  // On github.io the site runs a small in-browser version of the backend.
  // Data stays in this browser only and files are not uploaded.
  var DEMO = window.LENDME_DEMO === true || (!API && /github\.io$/.test(location.hostname));
  var DK = "lendme_demo_db";
  function ddb() { try { return JSON.parse(localStorage.getItem(DK)) || { users: [], apps: [], n: 1 }; } catch (e) { return { users: [], apps: [], n: 1 }; } }
  function dsave(d) { try { localStorage.setItem(DK, JSON.stringify(d)); } catch (e) {} }
  function sha(t) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("lendme:" + t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  function dres(status, body) {
    return { ok: status < 300, status: status,
      json: function () { return Promise.resolve(body); },
      text: function () { return Promise.resolve(JSON.stringify(body)); },
      blob: function () { return Promise.resolve(new Blob([(body && body.text) || ""], { type: "text/plain" })); } };
  }
  function derr(status, msg) { return dres(status, { message: msg }); }
  function dpub(u) { return { id: u.id, fullName: u.fullName, email: u.email, institution: u.institution, role: u.role }; }
  function dwho(d) {
    var t = token(); if (!t || t.indexOf("demo:") !== 0) return null;
    return d.users.filter(function (u) { return u.email === t.slice(5); })[0] || null;
  }
  function ensureStaff() {
    var d = ddb();
    if (d.users.some(function (u) { return u.role === "STAFF"; })) return Promise.resolve();
    return sha("StaffPass123").then(function (h) {
      d.users.push({ id: d.n++, fullName: "Lendme Staff", email: "staff@lendme.test", institution: "Lendme", role: "STAFF", hash: h });
      dsave(d);
    });
  }
  function demoFetch(path, opts) {
    return ensureStaff().then(function () {
      var m = (opts.method || "GET").toUpperCase(), d = ddb(), body = null, u = dwho(d), mt;
      if (typeof opts.body === "string") { try { body = JSON.parse(opts.body); } catch (e) { body = {}; } }

      if (path === "/api/auth/register" && m === "POST") {
        var email = String(body.email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(body.password || "").length < 8 || !String(body.fullName || "").trim() || !String(body.institution || "").trim())
          return derr(400, "Validation failed");
        if (d.users.some(function (x) { return x.email === email; })) return derr(409, "An account with this email already exists.");
        return sha(body.password).then(function (h) {
          var nu = { id: d.n++, fullName: body.fullName.trim(), email: email, institution: body.institution.trim(), role: "STUDENT", hash: h };
          d.users.push(nu); dsave(d);
          return dres(201, { token: "demo:" + email, user: dpub(nu) });
        });
      }
      if (path === "/api/auth/login" && m === "POST") {
        var em = String(body.email || "").trim().toLowerCase();
        var found = d.users.filter(function (x) { return x.email === em; })[0];
        return sha(String(body.password || "")).then(function (h) {
          if (!found || found.hash !== h) return derr(401, "Wrong email or password.");
          return dres(200, { token: "demo:" + em, user: dpub(found) });
        });
      }
      if (!u) return derr(401, "Please log in.");

      if (path === "/api/applications" && m === "POST") {
        var fd = opts.body, amount = parseFloat(fd.get("amount")), sig = String(fd.get("signedName") || "").trim();
        if (!(amount >= 100)) return derr(400, "The minimum amount is BWP 100.");
        if (sig.toLowerCase() !== u.fullName.toLowerCase()) return derr(400, "Your signature must match your account name.");
        var types = [["studentId", "STUDENT_ID"], ["proofOfRegistration", "PROOF_OF_REGISTRATION"], ["results", "RESULTS"], ["bankStatement", "BANK_STATEMENT"]];
        var docs = [];
        for (var i = 0; i < types.length; i++) {
          var f = fd.get(types[i][0]);
          if (!f || !f.size) return derr(400, "Each document must be a PDF, JPG or PNG file.");
          if (f.size > 5 * 1024 * 1024) return derr(413, "A file is too big.");
          docs.push({ id: d.n++, type: types[i][1], fileName: f.name });
        }
        var a = { id: d.n++, studentName: u.fullName, studentEmail: u.email, amount: amount, status: "PENDING", signedName: sig, submittedAt: new Date().toISOString(), documents: docs };
        d.apps.unshift(a); dsave(d);
        return dres(201, a);
      }
      if (path === "/api/applications/me" && m === "GET") {
        return dres(200, d.apps.filter(function (x) { return x.studentEmail === u.email; }));
      }
      if (path.indexOf("/api/admin/") === 0) {
        if (u.role !== "STAFF") return derr(403, "Staff only.");
        if (path === "/api/admin/applications" && m === "GET") return dres(200, d.apps);
        if ((mt = path.match(/^\/api\/admin\/applications\/(\d+)\/status$/)) && m === "PATCH") {
          var ap = d.apps.filter(function (x) { return x.id === parseInt(mt[1], 10); })[0];
          if (!ap) return derr(404, "Application not found.");
          ap.status = body.status; dsave(d); return dres(200, ap);
        }
        if (path.indexOf("/api/admin/documents/") === 0) return dres(200, { text: "Demo mode: documents are not stored. Run the full backend to keep real files." });
      }
      return derr(404, "Not found.");
    });
  }
  if (DEMO) {
    document.addEventListener("DOMContentLoaded", function () {
      var b = document.createElement("div");
      b.textContent = "Demo mode: your data stays in this browser and files are not uploaded.";
      b.style.cssText = "background:#fff0c2;color:#6b4e00;text-align:center;padding:6px 12px;font-size:.85rem;font-family:system-ui,Arial,sans-serif";
      document.body.insertBefore(b, document.body.firstChild);
    });
  }

  function api(path, opts) {
    opts = opts || {}; opts.headers = opts.headers || {};
    var t = token(); if (t) opts.headers["Authorization"] = "Bearer " + t;
    return (DEMO ? demoFetch(path, opts) : fetch(API + path, opts)).then(function (r) {
      if (r.status === 401 && t && path.indexOf("/api/auth/") !== 0) { clear(); location.href = "login.html"; throw new Error("Please log in again."); }
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
          
