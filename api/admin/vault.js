// api/admin/vault.js  (Prenolia: super dashboard - cassaforte cifrata)
//
//   GET  /api/admin/vault          -> {table, exists, blob, version, updated_at}
//   POST /api/admin/vault {blob, version}   -> salva (version 0 = prima creazione)
//
// Il server riceve e conserva SOLO testo gia' cifrato dal browser (AES-256-GCM, chiave
// derivata dalla password principale che non lascia mai il dispositivo). Solo il titolare.
// Il salvataggio controlla la versione, cosi' due schermate aperte insieme non si sovrascrivono.

const clients = require('./clients.js');
const { sb, authenticate, cfg } = clients;

const MAX_BLOB = 400 * 1024;

function validBlob(s) {
  if (typeof s !== 'string' || s.length < 40 || s.length > MAX_BLOB) return false;
  try {
    const o = JSON.parse(s);
    return o && o.v === 1 && typeof o.salt === 'string' && typeof o.iv === 'string' && typeof o.ct === 'string' && Number.isInteger(o.it) && o.it >= 100000;
  } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  const auth = await authenticate(req);
  if (auth && auth.unavailable) { res.status(503).json({ error: 'auth_unavailable', detail: 'Non riesco a verificare l\'accesso in questo momento. Riprova tra poco.' }); return; }
  if (auth && auth.forbidden) { res.status(403).json({ error: 'forbidden', detail: 'Questo account non è autorizzato ad entrare.' }); return; }
  if (!auth) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (auth.role !== 'owner') { res.status(403).json({ error: 'forbidden', detail: 'Pagina riservata al titolare.' }); return; }
  if (!cfg().key) { res.status(500).json({ error: 'missing_env_vars', detail: 'Manca la service key di Supabase tra le variabili d\'ambiente di Vercel.' }); return; }

  try {
    if (req.method === 'GET') {
      let rows;
      try { rows = await sb('admin_vault?id=eq.main&select=blob,version,updated_at&limit=1'); }
      catch (e) {
        if (e && (e.status === 404 || /admin_vault/.test(String(e.message || '')))) { res.status(200).json({ table: false }); return; }
        throw e;
      }
      const r = rows && rows[0];
      if (!r) { res.status(200).json({ table: true, exists: false, version: 0 }); return; }
      res.status(200).json({ table: true, exists: true, blob: r.blob, version: r.version, updated_at: r.updated_at });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      body = body || {};
      const version = Number.isInteger(body.version) ? body.version : -1;
      if (version < 0) { res.status(400).json({ error: 'bad_version' }); return; }
      if (!validBlob(body.blob)) { res.status(400).json({ error: 'bad_blob', detail: 'Contenuto non valido.' }); return; }
      const now = new Date().toISOString();
      if (version === 0) {
        try {
          const ins = await sb('admin_vault', { method: 'POST', body: { id: 'main', blob: body.blob, version: 1, updated_at: now, updated_by: auth.actor }, prefer: 'return=representation' });
          res.status(200).json({ ok: true, version: (ins && ins[0] && ins[0].version) || 1 });
        } catch (e) {
          if (e && (e.status === 409 || /duplicate|unique/i.test(String(e.message || '')))) { res.status(409).json({ error: 'conflict', detail: 'Il registro esiste già: ricarica la pagina.' }); return; }
          throw e;
        }
        return;
      }
      const upd = await sb(`admin_vault?id=eq.main&version=eq.${version}`, { method: 'PATCH', body: { blob: body.blob, version: version + 1, updated_at: now, updated_by: auth.actor }, prefer: 'return=representation' });
      if (!upd || !upd.length) { res.status(409).json({ error: 'conflict', detail: 'Il registro è stato modificato altrove: ricarica la pagina.' }); return; }
      res.status(200).json({ ok: true, version: upd[0].version });
      return;
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('vault:', e && e.message);
    res.status(500).json({ error: 'server_error', detail: 'Qualcosa non ha funzionato: riprova.' });
  }
};
