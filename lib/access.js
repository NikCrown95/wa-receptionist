// lib/access.js  (Lia: blocco del servizio se l'abbonamento non e' rinnovato)
//
// UNICO punto che decide se un'attivita' puo' usare il servizio.
// La regola vera sta nel database (vista service_access_v): qui la si legge soltanto.
//
// Stati: active | grace (tolleranza) | unmanaged (nessun abbonamento registrato) -> tutto funziona
//        suspended | cancelled -> bloccato
//
// REGOLA D'ORO: se il controllo stesso non riesce (database giu', rete, dati strani),
// si lascia passare. Meglio non spegnere un cliente che paga.
//
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY (le stesse di sempre).

const PUBLIC_URL = process.env.PUBLIC_URL || "https://wa-receptionist-sigma.vercel.app";
const CACHE_MS = 60 * 1000; // dopo un rinnovo o una sospensione, al massimo 1 minuto per vederlo
const TIMEOUT_MS = 2500; // il controllo non deve mai rallentare una risposta

const OPEN = { state: "unknown", allowed: true, lia_allowed: true, plan_name: null, checked: false };
const cache = new Map();

function headers() {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key; // solo per chiavi vecchie
  return h;
}

async function fetchAccess(bizId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      process.env.SUPABASE_URL + "/rest/v1/service_access_v?business_id=eq." + encodeURIComponent(bizId) +
        "&select=state,allowed,lia_allowed,plan_name,paid_until,grace_ends&limit=1",
      { headers: headers(), signal: ctrl.signal }
    );
    if (!res.ok) throw new Error("service_access_v HTTP " + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error("attivita' non presente in service_access_v");
    return rows[0];
  } finally {
    clearTimeout(timer);
  }
}

// Restituisce sempre un oggetto: { allowed, lia_allowed, state, plan_name, ... }
async function getAccess(bizId) {
  if (!bizId) return OPEN;
  const hit = cache.get(bizId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const row = await fetchAccess(bizId);
    const value = {
      state: String(row.state || "unknown"),
      // solo un "false" esplicito blocca: qualsiasi altro valore lascia passare
      allowed: row.allowed !== false,
      lia_allowed: row.lia_allowed !== false,
      plan_name: row.plan_name || null,
      paid_until: row.paid_until || null,
      grace_ends: row.grace_ends || null,
      checked: true,
    };
    cache.set(bizId, { at: Date.now(), value: value });
    return value;
  } catch (e) {
    console.error("Controllo abbonamento non riuscito, lascio passare:", e && e.message);
    return OPEN;
  }
}

// Messaggio gentile per il cliente finale (mai silenzio: danneggerebbe l'attivita')
function customerBlockedMessage(biz, acc) {
  const name = (biz && biz.name) || "questa attività";
  if (acc && acc.allowed) {
    // servizio attivo ma il piano non comprende Lia: si indirizza al calendario online
    const link = biz && biz.slug ? PUBLIC_URL + "/api/booking?b=" + biz.slug : "";
    return (
      "Ciao! Su questo canale non posso prenotare per " + name + "." +
      (link ? " Puoi prenotare dal calendario online: " + link : "") +
      " Oppure contatta direttamente l'attività."
    );
  }
  return (
    "Ciao! Al momento " + name + " non può ricevere prenotazioni da qui. " +
    "Per favore contatta direttamente l'attività. Grazie e scusa il disturbo!"
  );
}

const BOOKING_BLOCKED_MESSAGE =
  "Le prenotazioni online di questa attività non sono al momento disponibili. Per prenotare contatta direttamente l'attività.";

function _clearCache() {
  cache.clear();
}

module.exports = { getAccess, customerBlockedMessage, BOOKING_BLOCKED_MESSAGE, _clearCache };
