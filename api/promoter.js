// api/promoter.js
//
// Pagina "Promoter" (prenolia.it/promoter): le persone che portano attivita' a Prenolia vedono quante ne hanno
// portate, a che punto e' ognuna (prova, pagamenti mese per mese) e quanto spetta loro.
//
//   GET  /api/promoter                              -> dati del promoter collegato (401 se non ha fatto l'accesso)
//   POST /api/promoter {action:'login', name, code} -> accesso con nome e cognome + codice (imposta il cookie)
//   POST /api/promoter {action:'logout'}            -> esce
//
// Il promoter e' sempre una persona (tabella referral_partners), mai un'attivita'. Vede solo nome, tipo e stato
// di pagamento delle attivita' arrivate dal suo codice: niente contatti, niente dati dei clienti.

const crypto = require('crypto');
const promoter = require('../lib/promoter.js');
const referral = require('../lib/referral.js');

const COOKIE = 'prenolia_promoter';
const SESSION_MS = 30 * 86400000;
const DEFAULT_URL = 'https://trtjbktdvupckyayxqli.supabase.co';
const GENERIC = 'Nome o codice non corretti.';
const TOO_MANY = 'Troppi tentativi. Riprova tra qualche minuto.';

// ---------- database ----------
function cfg() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;
  return { url, key };
}
async function sb(path, { method = 'GET', body, prefer, range } = {}) {
  const { url, key } = cfg();
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  if (range) { headers['Range-Unit'] = 'items'; headers.Range = range; }
  const resp = await fetch(url + '/rest/v1/' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  if (!resp.ok) { const err = new Error((json && (json.message || json.hint)) || text || 'HTTP ' + resp.status); err.status = resp.status; throw err; }
  return json;
}
async function get(path) {
  const PAGE = 1000; let all = [];
  for (let i = 0; i < 100; i++) {
    const rows = (await sb(path, { range: i * PAGE + '-' + (i * PAGE + PAGE - 1) })) || [];
    all = all.concat(rows);
    if (rows.length < PAGE) return all;
  }
  return all;
}
const send = (method, path, body, prefer) => sb(path, { method, body, prefer });

// ---------- sessione (cookie firmato) ----------
function secret() { return process.env.BUSINESS_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || ''; }
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret()).update('promoter.' + body).digest('base64url');
}
function unsign(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !secret()) return null;
    const expected = crypto.createHmac('sha256', secret()).update('promoter.' + parts[0]).digest('base64url');
    const a = Buffer.from(parts[1]), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return p && p.pid && p.code && p.exp && Date.now() < p.exp ? p : null;
  } catch (e) { return null; }
}
function readCookie(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}
function setSession(res, partner) {
  const token = sign({ pid: partner.id, code: partner.code, exp: Date.now() + SESSION_MS });
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + Math.floor(SESSION_MS / 1000));
}
function clearSession(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

// ---------- limite tentativi (stessa tabella dell'accesso delle attivita') ----------
const WINDOW_MS = 15 * 60 * 1000;
const enc = encodeURIComponent;
async function isLocked(key) {
  try {
    const r = await sb('auth_throttle?key=eq.' + enc(key) + '&select=locked_until');
    const row = Array.isArray(r) ? r[0] : null;
    return !!(row && row.locked_until && new Date(row.locked_until).getTime() > Date.now());
  } catch (e) { return false; }
}
async function recordFail(key, max, lockMin) {
  try {
    const r = await sb('auth_throttle?key=eq.' + enc(key) + '&select=fails,updated_at');
    const row = Array.isArray(r) ? r[0] : null;
    let fails = row && Date.now() - new Date(row.updated_at).getTime() < WINDOW_MS ? row.fails : 0;
    fails += 1;
    const locked = fails >= max ? new Date(Date.now() + lockMin * 60000).toISOString() : null;
    await sb('auth_throttle?on_conflict=key', { method: 'POST', body: { key, fails: locked ? 0 : fails, locked_until: locked, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) { console.error('promoter throttle:', e && e.message); }
}
async function clearFails(key) { try { await sb('auth_throttle?key=eq.' + enc(key), { method: 'DELETE' }); } catch (e) { /* niente */ } }
function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'; }

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method === 'POST') {
      const b = body(req);

      if (b.action === 'logout') { clearSession(res); return res.status(200).json({ ok: true }); }

      if (b.action === 'login') {
        const ip = clientIp(req);
        const code = promoter.cleanCode(b.code);
        const ipKey = 'promoter:ip:' + ip, codeKey = 'promoter:code:' + (code || 'x');
        if ((await isLocked(ipKey)) || (await isLocked(codeKey))) return res.status(429).json({ error: TOO_MANY });
        const name = String(b.name || '').slice(0, 120);
        let partner = null;
        if (code && promoter.nameKey(name)) {
          const rows = await get('referral_partners?code=eq.' + enc(code) + '&select=id,name,code,reward_eur,active&limit=1');
          if (rows[0] && promoter.sameName(rows[0].name, name)) partner = rows[0];
        }
        if (!partner) {
          await recordFail(ipKey, 8, 15);
          if (code) await recordFail(codeKey, 12, 15);
          return res.status(401).json({ error: GENERIC });
        }
        await clearFails(ipKey);
        setSession(res, partner);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Richiesta non valida.' });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito.' });

    const s = unsign(readCookie(req));
    if (!s) return res.status(401).json({ error: 'Accesso richiesto.' });
    const rows = await get('referral_partners?id=eq.' + enc(s.pid) + '&select=id,name,code,reward_eur,active&limit=1');
    const partner = rows[0];
    // se il codice viene cambiato o la persona eliminata, la sessione smette di valere
    if (!partner || partner.code !== s.code) { clearSession(res); return res.status(401).json({ error: 'Accesso richiesto.' }); }

    const tdays = await referral.trialDays(get);
    await promoter.settle(get, send, { partnerId: partner.id, trialDays: tdays });
    const data = await promoter.viewFor(partner, get, { trialDays: tdays });
    return res.status(200).json(data);
  } catch (e) {
    console.error('promoter:', e && e.message);
    return res.status(500).json({ error: 'Non riesco a caricare i dati. Riprova tra poco.' });
  }
};
