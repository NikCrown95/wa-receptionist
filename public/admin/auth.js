// auth.js - accesso alla dashboard admin (login di Supabase Auth). Un solo file per tutte le pagine.
// La chiave qui sotto e' la chiave PUBBLICA di Supabase: e' fatta per stare nelle pagine. Non da' accesso a nulla da sola.
(function () {
  var SUPA = 'https://trtjbktdvupckyayxqli.supabase.co', KEY = 'sb_publishable_phiqv5lfE4j_2ag2jLSsbA_NLSWm623', SKEY = 'lia_session';

  function read() { try { var s = JSON.parse(localStorage.getItem(SKEY) || 'null'); return s && s.access_token && s.refresh_token ? s : null; } catch (e) { return null; } }
  function write(s) { localStorage.setItem(SKEY, JSON.stringify(s)); }
  function clear() { localStorage.removeItem(SKEY); localStorage.removeItem('lia_admin_key'); }
  function toLogin() { var next = location.pathname + (location.search || ''); location.href = '/admin/login.html?next=' + encodeURIComponent(next); return new Promise(function () {}); }
  function fromAuth(j) { return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), email: (j.user && j.user.email) || '' }; }

  var refreshing = null;
  function fresh(s) {
    if (!refreshing) {
      refreshing = fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
        .then(function (r) { if (!r.ok) throw new Error('refresh'); return r.json(); })
        .then(function (j) { var n = fromAuth(j); if (!n.email) n.email = s.email; write(n); return n; })
        .then(function (n) { refreshing = null; return n; }, function (e) { refreshing = null; throw e; });
    }
    return refreshing;
  }

  // Entra con email e password. In caso di errore lancia un messaggio comprensibile.
  window.liaLogin = function (email, password) {
    return fetch(SUPA + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') }) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 429) throw new Error('Troppi tentativi: aspetta qualche minuto e riprova.');
          if (r.status === 400 || r.status === 401 || r.status === 422) throw new Error('Email o password non corretti.');
          if (!r.ok || !j.access_token) throw new Error('Accesso non riuscito (codice ' + r.status + ').');
          var s = fromAuth(j); write(s); return s;
        });
      });
  };
  window.liaSession = { read: read, clear: clear };
  window.liaLogout = function () {
    var s = read(); clear();
    if (s) { try { fetch(SUPA + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(function () {}); } catch (e) {} }
    location.href = '/admin/login.html';
  };

  // Chiamata alle API admin: aggiunge l'accesso, lo rinnova da solo, e rimanda al login se serve.
  window.liaApi = function (path, opts, retried) {
    var s = read();
    if (!s) return toLogin();
    var expiring = s.expires_at - Math.floor(Date.now() / 1000) < 60;
    var ready = expiring ? fresh(s).catch(function () { clear(); return toLogin(); }) : Promise.resolve(s);
    return ready.then(function (sess) {
      opts = opts || {};
      var headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' });
      return fetch(path, Object.assign({}, opts, { headers: headers })).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401) {
            if (!retried) return fresh(sess).then(function () { return window.liaApi(path, opts, true); }, function () { clear(); return toLogin(); });
            clear(); return toLogin();
          }
          if (r.status === 403) throw new Error(j.detail || 'Permesso negato.');
          if (r.status === 503) throw new Error(j.detail || 'Servizio momentaneamente non disponibile: riprova tra poco.');
          if (!r.ok) throw new Error((j.error || r.status) + (j.detail ? ' – ' + j.detail : ''));
          return j;
        });
      });
    });
  };

  window.liaBanner = function (msg) {
    var el = document.getElementById('liaBanner');
    if (!el) {
      el = document.createElement('div'); el.id = 'liaBanner';
      el.style.cssText = 'background:#3a1c1c;color:#ffb4b4;padding:12px 16px;border-radius:12px;margin:0 0 14px;font-size:.92rem;line-height:1.45;';
      var wrap = document.querySelector('.wrap'); if (wrap) wrap.insertBefore(el, wrap.firstChild);
    }
    el.textContent = msg;
  };
})();
