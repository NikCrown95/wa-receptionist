// api/business-auth.js
// Accesso delle attività (titolari): login, "rimani connesso", recupero password,
// verifica in due passaggi (app di autenticazione) e cambio password.
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY, RESEND_API_KEY.
// Opzionali: BUSINESS_SESSION_SECRET, PUBLIC_URL, RESEND_FROM.
const crypto = require("crypto");

const COOKIE = "lia_business_session";
const SHORT_SESSION_MS = 12 * 3600 * 1000;          // 12 ore
const LONG_SESSION_MS = 30 * 24 * 3600 * 1000;      // 30 giorni ("rimani connesso")
const CHALLENGE_MS = 5 * 60 * 1000;                 // tempo per inserire il codice a 6 cifre
const RESET_MS = 30 * 60 * 1000;                    // validità del link di recupero
const CONFIRM_MS = 24 * 3600 * 1000;                // validità del link di conferma registrazione
const SIGNUP_TYPES = ["parrucchiere", "barbiere", "estetista", "personal trainer", "idraulico", "altro"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function slugify(name) {
  return String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "attivita";
}
const esc = (v) => String(v || "").replace(/[<>&"']/g, "");
const PUBLIC_URL = process.env.PUBLIC_URL || "https://wa-receptionist-sigma.vercel.app";

/* ---------- Supabase ---------- */
function headers(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}
async function sb(method, path, body, prefer) {
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: r.ok, status: r.status, data };
}
const rpc = (name, args) => sb("POST", "rpc/" + name, args);
const enc = encodeURIComponent;

/* ---------- firma e cookie ---------- */
function secret() { return process.env.BUSINESS_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || ""; }
function b64(v) { return Buffer.from(v).toString("base64url"); }
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + sig;
}
function unsign(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const expected = crypto.createHmac("sha256", secret()).update(parts[0]).digest("base64url");
    const a = Buffer.from(parts[1]), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!p || !p.business_id || !p.agenda_token || !p.exp || Date.now() > p.exp) return null;
    return p;
  } catch (e) { return null; }
}
// La sessione vera non ha il campo "t": un token del passaggio "codice a 6 cifre" non vale come sessione.
function verify(token) { const p = unsign(token); return p && !p.t ? p : null; }
function cookie(req, name) {
  const raw = String(req.headers.cookie || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}
function startSession(res, row, remember) {
  const ms = remember ? LONG_SESSION_MS : SHORT_SESSION_MS;
  const token = sign({ business_id: row.business_id, agenda_token: row.agenda_token, business_name: row.business_name, exp: Date.now() + ms });
  res.setHeader("Set-Cookie", COOKIE + "=" + enc(token) + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + Math.floor(ms / 1000));
}

/* ---------- password ---------- */
const COMMON = ["password", "password1", "password123", "password1!", "qwerty123", "12345678", "123456789", "1234567890", "admin123", "prenolia", "prenolia1", "ciao1234", "benvenuto1"];
function passwordProblem(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "Servono almeno 8 caratteri.";
  if (!/[0-9]/.test(pw)) return "Aggiungi almeno un numero.";
  if (!/[^A-Za-z0-9À-ÿ\s]/.test(pw)) return "Aggiungi un carattere speciale, ad esempio ! ? @ # €.";
  if (pw.length > 200) return "La password è troppo lunga.";
  const plain = pw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COMMON.some((c) => plain === c.replace(/[^a-z0-9]/g, ""))) return "Questa password è troppo prevedibile. Provane un'altra.";
  return "";
}

/* ---------- limite tentativi ---------- */
const WINDOW_MS = 15 * 60 * 1000;
async function isLocked(key) {
  const r = await sb("GET", "auth_throttle?key=eq." + enc(key) + "&select=locked_until");
  const row = r.ok && Array.isArray(r.data) ? r.data[0] : null;
  return !!(row && row.locked_until && new Date(row.locked_until).getTime() > Date.now());
}
async function recordHit(key, max, lockMin) {
  const r = await sb("GET", "auth_throttle?key=eq." + enc(key) + "&select=fails,updated_at");
  const row = r.ok && Array.isArray(r.data) ? r.data[0] : null;
  let fails = row && Date.now() - new Date(row.updated_at).getTime() < WINDOW_MS ? row.fails : 0;
  fails += 1;
  const locked = fails >= max ? new Date(Date.now() + lockMin * 60000).toISOString() : null;
  await sb("POST", "auth_throttle?on_conflict=key",
    { key, fails: locked ? 0 : fails, locked_until: locked, updated_at: new Date().toISOString() },
    "resolution=merge-duplicates,return=minimal");
}
async function clearHits(key) { await sb("DELETE", "auth_throttle?key=eq." + enc(key)); }
function clientIp(req) { return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown"; }
const TOO_MANY = "Troppi tentativi. Riprova tra qualche minuto.";

/* ---------- codici a 6 cifre (TOTP, RFC 6238) ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32enc(buf) {
  let bits = 0, val = 0, out = "";
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    val = (val << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(key, counter) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(b).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}
function totpOk(base32, code, now) {
  code = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const key = b32dec(base32), step = Math.floor((now || Date.now()) / 30000);
  for (let d = -1; d <= 1; d++) {
    const exp = hotp(key, step + d);
    if (crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(code))) return true;
  }
  return false;
}
// Il segreto del codice viene salvato cifrato nel database.
function encKey() { return crypto.createHash("sha256").update("totp:" + secret()).digest(); }
function encrypt(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((x) => x.toString("base64url")).join(".");
}
function decrypt(s) {
  try {
    const [iv, tag, ct] = String(s).split(".").map((x) => Buffer.from(x, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch (e) { return ""; }
}
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");
function newRecoveryCodes() {
  return Array.from({ length: 8 }, () => { const h = crypto.randomBytes(5).toString("hex"); return h.slice(0, 5) + "-" + h.slice(5); });
}
const normCode = (c) => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function getUser(id) {
  const r = await sb("GET", "business_users?business_id=eq." + enc(id) + "&select=email,totp_secret,totp_enabled,recovery_codes&limit=1");
  return r.ok && Array.isArray(r.data) ? r.data[0] || null : null;
}
// Controlla il codice a 6 cifre oppure un codice di emergenza (che poi viene bruciato).
async function checkSecondFactor(id, user, input) {
  if (user.totp_secret && totpOk(decrypt(user.totp_secret), input)) return true;
  const h = sha(normCode(input));
  const list = user.recovery_codes || [];
  if (normCode(input).length === 10 && list.includes(h)) {
    await sb("PATCH", "business_users?business_id=eq." + enc(id), { recovery_codes: list.filter((x) => x !== h) });
    return true;
  }
  return false;
}

/* ---------- email (Resend) ---------- */
async function sendMail(to, subject, html, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error("RESEND_API_KEY mancante"); return false; }
  const from = process.env.RESEND_FROM || "Prenolia <noreply@send.prenolia.it>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!r.ok) console.error("Resend", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("Resend", e && e.message); return false; }
}
function resetMail(name, link) {
  const html = '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0b1220">'
    + '<h2 style="margin:0 0 12px;letter-spacing:-.01em">Scegli la tua nuova password</h2>'
    + '<p style="line-height:1.5">Ciao' + (name ? " " + String(name).replace(/[<>&"]/g, "") : "") + ', hai chiesto di reimpostare la password. Il link vale <b>30 minuti</b> e funziona una sola volta.</p>'
    + '<p style="margin:24px 0"><a href="' + link + '" style="background:#19b8c8;color:#031016;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">Scegli la nuova password</a></p>'
    + '<p style="line-height:1.5;color:#55627a;font-size:14px">Non sei stato tu? Ignora questa email: la tua password non cambia.</p>'
    + '<p style="color:#8793a8;font-size:12px">Prenolia</p></div>';
  const text = "Hai chiesto di reimpostare la password.\nScegli la nuova password da qui (il link vale 30 minuti e funziona una sola volta):\n" + link + "\n\nNon sei stato tu? Ignora questa email: la tua password non cambia.";
  return { html, text };
}

function mailShell(inner) {
  return '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0b1220">' + inner + '<p style="color:#8793a8;font-size:12px;margin-top:28px">Prenolia</p></div>';
}
function mailButton(link, label) {
  return '<p style="margin:24px 0"><a href="' + link + '" style="background:#19b8c8;color:#031016;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">' + label + '</a></p>';
}
function confirmMail(name, link) {
  const html = mailShell('<h2 style="margin:0 0 12px;letter-spacing:-.01em">Benvenuto in Prenolia</h2>'
    + '<p style="line-height:1.5">Ciao ' + esc(name) + ', manca un solo passaggio: conferma il tuo indirizzo e la tua prova gratuita di <b>30 giorni</b> parte subito.</p>'
    + mailButton(link, "Conferma e inizia")
    + '<p style="line-height:1.5;color:#55627a;font-size:14px">Il link vale 24 ore. Non sei stato tu? Ignora questa email: non verrà creato nessun account.</p>');
  const text = "Benvenuto in Prenolia.\nConferma il tuo indirizzo e la prova gratuita di 30 giorni parte subito (il link vale 24 ore):\n" + link + "\n\nNon sei stato tu? Ignora questa email: non verrà creato nessun account.";
  return { html, text };
}
function alreadyMail(name) {
  const login = PUBLIC_URL + "/login.html", reset = PUBLIC_URL + "/reset.html";
  const html = mailShell('<h2 style="margin:0 0 12px;letter-spacing:-.01em">Hai già un account</h2>'
    + '<p style="line-height:1.5">Ciao, qualcuno ha provato a registrare ' + esc(name) + ' con questo indirizzo, ma un account Prenolia esiste già.</p>'
    + mailButton(login, "Accedi")
    + '<p style="line-height:1.5;color:#55627a;font-size:14px">Non ricordi la password? <a href="' + reset + '" style="color:#0aa6b4">Recuperala qui</a>. Non sei stato tu? Puoi ignorare questa email.</p>');
  const text = "Esiste già un account Prenolia con questo indirizzo.\nAccedi: " + login + "\nPassword dimenticata: " + reset + "\n\nNon sei stato tu? Ignora questa email.";
  return { html, text };
}

/* ---------- handler ---------- */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(503).json({ error: "Servizio non disponibile" });
  const action = String((req.query && req.query.action) || "");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const ip = clientIp(req);
  try {
    /* --- sessione --- */
    if (req.method === "DELETE") {
      res.setHeader("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
      return res.status(200).json({ ok: true });
    }
    if (req.method === "GET" && !action) {
      const p = verify(cookie(req, COOKIE));
      if (!p) return res.status(401).json({ authenticated: false });
      return res.status(200).json({ authenticated: true, business_name: p.business_name, agenda_token: p.agenda_token });
    }

    /* --- login: email + password (+ "rimani connesso") --- */
    if (req.method === "POST" && !action) {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return res.status(400).json({ error: "Inserisci email e password" });
      if ((await isLocked("login:" + email)) || (await isLocked("ip:" + ip))) return res.status(429).json({ error: TOO_MANY });
      const r = await rpc("business_login2", { p_email: email, p_password: password });
      if (!r.ok) return res.status(502).json({ error: "Accesso temporaneamente non disponibile" });
      if (!Array.isArray(r.data) || !r.data.length) {
        await recordHit("login:" + email, 5, 10);
        await recordHit("ip:" + ip, 30, 10);
        return res.status(401).json({ error: "Email o password non corretti" });
      }
      const row = r.data[0], remember = body.remember === true;
      await clearHits("login:" + email);
      if (row.totp_enabled) {
        const challenge = sign({ t: "2fa", business_id: row.business_id, agenda_token: row.agenda_token, business_name: row.business_name, remember, exp: Date.now() + CHALLENGE_MS });
        return res.status(200).json({ need_code: true, challenge });
      }
      startSession(res, row, remember);
      return res.status(200).json({ ok: true, business_name: row.business_name, agenda_token: row.agenda_token });
    }

    /* --- login: secondo passaggio --- */
    if (req.method === "POST" && action === "verify2fa") {
      const c = unsign(body.challenge);
      if (!c || c.t !== "2fa") return res.status(401).json({ error: "Sessione scaduta. Accedi di nuovo.", restart: true });
      const key = "2fa:" + c.business_id;
      if (await isLocked(key)) return res.status(429).json({ error: TOO_MANY });
      const user = await getUser(c.business_id);
      if (!user || !user.totp_enabled || !(await checkSecondFactor(c.business_id, user, body.code))) {
        await recordHit(key, 5, 10);
        return res.status(401).json({ error: "Codice non corretto" });
      }
      await clearHits(key);
      startSession(res, c, c.remember === true);
      return res.status(200).json({ ok: true, business_name: c.business_name, agenda_token: c.agenda_token });
    }

    /* --- recupero password: richiesta del link --- */
    if (req.method === "POST" && action === "forgot") {
      const email = String(body.email || "").trim().toLowerCase();
      const generic = { ok: true };
      if (!email || email.length > 200) return res.status(200).json(generic);
      const blocked = (await isLocked("forgot-ip:" + ip)) || (await isLocked("forgot:" + email));
      await recordHit("forgot-ip:" + ip, 8, 15);
      await recordHit("forgot:" + email, 3, 15);
      if (blocked) return res.status(200).json(generic);
      const u = await sb("GET", "business_users?email=eq." + enc(email) + "&active=eq.true&select=business_id&limit=1");
      const id = u.ok && Array.isArray(u.data) && u.data[0] ? u.data[0].business_id : null;
      if (!id) return res.status(200).json(generic);
      const b = await sb("GET", "businesses?id=eq." + enc(id) + "&active=eq.true&select=name&limit=1");
      if (!b.ok || !Array.isArray(b.data) || !b.data[0]) return res.status(200).json(generic);
      await sb("PATCH", "auth_tokens?business_id=eq." + enc(id) + "&kind=eq.reset&used_at=is.null", { used_at: new Date().toISOString() });
      const raw = crypto.randomBytes(32).toString("hex");
      const ins = await sb("POST", "auth_tokens", { business_id: id, kind: "reset", token_hash: sha(raw), expires_at: new Date(Date.now() + RESET_MS).toISOString() }, "return=minimal");
      if (ins.ok) {
        const m = resetMail(b.data[0].name, PUBLIC_URL + "/reset.html?token=" + raw);
        await sendMail(email, "La tua nuova password per Prenolia", m.html, m.text);
      }
      return res.status(200).json(generic);
    }

    /* --- recupero password: nuova password --- */
    if (req.method === "POST" && action === "reset") {
      const token = String(body.token || ""), password = String(body.password || "");
      if (!/^[0-9a-f]{64}$/.test(token)) return res.status(400).json({ error: "Link non valido o scaduto." });
      if (await isLocked("reset-ip:" + ip)) return res.status(429).json({ error: TOO_MANY });
      const problem = passwordProblem(password);
      if (problem) return res.status(400).json({ error: problem });
      const t = await sb("GET", "auth_tokens?token_hash=eq." + sha(token) + "&kind=eq.reset&used_at=is.null&expires_at=gt." + enc(new Date().toISOString()) + "&select=id,business_id&limit=1");
      const row = t.ok && Array.isArray(t.data) ? t.data[0] : null;
      if (!row) { await recordHit("reset-ip:" + ip, 10, 15); return res.status(400).json({ error: "Questo link non è più valido. Richiedine uno nuovo." }); }
      const s = await rpc("business_set_password", { p_business: row.business_id, p_password: password });
      if (!s.ok) return res.status(502).json({ error: "Non siamo riusciti a cambiare la password. Riprova." });
      await sb("PATCH", "auth_tokens?business_id=eq." + enc(row.business_id) + "&kind=eq.reset&used_at=is.null", { used_at: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }

    /* --- registrazione --- */
    const signupOpen = process.env.SIGNUP_ENABLED === "1";
    if (req.method === "GET" && action === "signup-status") return res.status(200).json({ open: signupOpen });

    if (req.method === "POST" && action === "signup") {
      if (!signupOpen) return res.status(403).json({ error: "Le registrazioni aprono a breve." });
      if (body.hp) return res.status(200).json({ ok: true }); // campo trappola per i bot
      const name = String(body.name || "").trim().replace(/\s+/g, " ");
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rawType = String(body.type || "").trim().toLowerCase();
      const type = SIGNUP_TYPES.includes(rawType) ? rawType : "altro";
      if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Scrivi il nome della tua attività (da 2 a 80 caratteri)." });
      if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: "Controlla l'indirizzo email." });
      if (!/^[+\d][\d\s().-]{4,29}$/.test(phone)) return res.status(400).json({ error: "Controlla il numero di telefono." });
      const problem = passwordProblem(password);
      if (problem) return res.status(400).json({ error: problem });
      if ((await isLocked("signup-ip:" + ip)) || (await isLocked("signup:" + email))) return res.status(429).json({ error: TOO_MANY });
      await recordHit("signup-ip:" + ip, 6, 60);
      await recordHit("signup:" + email, 3, 30);
      const exists = await sb("GET", "business_users?email=eq." + enc(email) + "&select=business_id&limit=1");
      if (exists.ok && Array.isArray(exists.data) && exists.data.length) {
        const m = alreadyMail(name);
        await sendMail(email, "Hai già un account Prenolia", m.html, m.text);
        return res.status(200).json({ ok: true });
      }
      const raw = crypto.randomBytes(32).toString("hex");
      const slug = slugify(name) + "-" + crypto.randomBytes(2).toString("hex");
      const r = await rpc("signup_start", { p_email: email, p_password: password, p_name: name, p_slug: slug, p_type: type, p_phone: phone, p_token_hash: sha(raw), p_expires: new Date(Date.now() + CONFIRM_MS).toISOString() });
      if (!r.ok) return res.status(502).json({ error: "Non siamo riusciti a completare la registrazione. Riprova tra poco." });
      const m = confirmMail(name, PUBLIC_URL + "/conferma.html?token=" + raw);
      await sendMail(email, "Conferma la tua email per iniziare con Prenolia", m.html, m.text);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST" && action === "confirm") {
      const token = String(body.token || "");
      if (!/^[0-9a-f]{64}$/.test(token)) return res.status(400).json({ error: "Questo link non è valido." });
      if (await isLocked("confirm-ip:" + ip)) return res.status(429).json({ error: TOO_MANY });
      const r = await rpc("signup_confirm", { p_token_hash: sha(token) });
      if (!r.ok) return res.status(502).json({ error: "Non siamo riusciti ad attivare l'account. Riprova." });
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (!row) { await recordHit("confirm-ip:" + ip, 10, 15); return res.status(400).json({ error: "Questo link non è più valido. Se hai già confermato, accedi con la tua email." }); }
      startSession(res, row, false);
      return res.status(200).json({ ok: true, business_name: row.business_name, agenda_token: row.agenda_token });
    }

    /* --- da qui in poi serve essere dentro --- */
    const me = verify(cookie(req, COOKIE));
    if (!action || !/^(2fa-|change-password)/.test(action)) {
      res.setHeader("Allow", "GET, POST, DELETE");
      return res.status(405).json({ error: "Metodo non consentito" });
    }
    if (!me) return res.status(401).json({ error: "Accedi di nuovo", authenticated: false });
    const user = await getUser(me.business_id);
    if (!user) return res.status(401).json({ error: "Accedi di nuovo", authenticated: false });
    const tfaKey = "2fa:" + me.business_id;

    if (req.method === "GET" && action === "2fa-status") {
      return res.status(200).json({ enabled: !!user.totp_enabled, recovery_left: (user.recovery_codes || []).length, email: user.email });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

    if (action === "2fa-setup") {
      if (user.totp_enabled) return res.status(400).json({ error: "La verifica in due passaggi è già attiva." });
      const sec = b32enc(crypto.randomBytes(20));
      const u = await sb("PATCH", "business_users?business_id=eq." + enc(me.business_id), { totp_secret: encrypt(sec) });
      if (!u.ok) return res.status(502).json({ error: "Riprova tra poco." });
      const uri = "otpauth://totp/" + enc("Prenolia:" + user.email) + "?secret=" + sec + "&issuer=Prenolia&algorithm=SHA1&digits=6&period=30";
      return res.status(200).json({ secret: sec.match(/.{1,4}/g).join(" "), uri });
    }
    if (action === "2fa-enable") {
      if (user.totp_enabled) return res.status(400).json({ error: "La verifica in due passaggi è già attiva." });
      if (!user.totp_secret) return res.status(400).json({ error: "Ricomincia dall'inizio." });
      if (await isLocked(tfaKey)) return res.status(429).json({ error: TOO_MANY });
      if (!totpOk(decrypt(user.totp_secret), body.code)) { await recordHit(tfaKey, 5, 10); return res.status(400).json({ error: "Codice non corretto. Controlla l'app e riprova." }); }
      const codes = newRecoveryCodes();
      const u = await sb("PATCH", "business_users?business_id=eq." + enc(me.business_id), { totp_enabled: true, recovery_codes: codes.map((c) => sha(normCode(c))) });
      if (!u.ok) return res.status(502).json({ error: "Riprova tra poco." });
      await clearHits(tfaKey);
      return res.status(200).json({ ok: true, codes });
    }
    if (action === "2fa-disable") {
      if (!user.totp_enabled) return res.status(400).json({ error: "La verifica in due passaggi non è attiva." });
      if (await isLocked(tfaKey)) return res.status(429).json({ error: TOO_MANY });
      const pw = await rpc("business_check_password", { p_business: me.business_id, p_password: String(body.password || "") });
      if (!pw.ok || pw.data !== true || !(await checkSecondFactor(me.business_id, user, body.code))) {
        await recordHit(tfaKey, 5, 10);
        return res.status(400).json({ error: "Password o codice non corretti." });
      }
      await sb("PATCH", "business_users?business_id=eq." + enc(me.business_id), { totp_enabled: false, totp_secret: null, recovery_codes: [] });
      await clearHits(tfaKey);
      return res.status(200).json({ ok: true });
    }
    if (action === "change-password") {
      if (await isLocked(tfaKey)) return res.status(429).json({ error: TOO_MANY });
      const problem = passwordProblem(body.password);
      if (problem) return res.status(400).json({ error: problem });
      const pw = await rpc("business_check_password", { p_business: me.business_id, p_password: String(body.current || "") });
      if (!pw.ok || pw.data !== true) { await recordHit(tfaKey, 5, 10); return res.status(400).json({ error: "La password attuale non è corretta." }); }
      const s = await rpc("business_set_password", { p_business: me.business_id, p_password: String(body.password) });
      if (!s.ok) return res.status(502).json({ error: "Non siamo riusciti a cambiare la password. Riprova." });
      await clearHits(tfaKey);
      return res.status(200).json({ ok: true });
    }
    return res.status(404).json({ error: "Non trovato" });
  } catch (e) {
    console.error("business-auth", e && e.message);
    return res.status(500).json({ error: "Errore temporaneo. Riprova." });
  }
};
module.exports.verifyBusinessSession = verify;
module.exports.readBusinessCookie = cookie;
module.exports.passwordProblem = passwordProblem;
module.exports._test = { slugify, b32enc, b32dec, hotp, totpOk, encrypt, decrypt, sign, unsign };
