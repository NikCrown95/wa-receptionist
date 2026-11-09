// lib/pt-packs.js  (Prenolia: personal trainer)
// Il personal trainer e' un'attivita' "normale" (calendario, Disponibilita', Statistiche) con due differenze:
//  - i servizi sono PACCHETTI: una lezione di durata fissa e un numero di ingressi (services.entries);
//  - ogni iscritto ha i suoi pacchetti (pt_packs) e ogni lezione prenotata ne scala un ingresso (appointments.pt_pack_id).
// Un ingresso e' "usato" finche' la lezione non e' annullata. Senza ingressi rimasti non si puo' prenotare.

const TRAINER_TYPE = "personal trainer";
const isTrainer = (biz) => !!biz && String(biz.business_type || "").toLowerCase().trim() === TRAINER_TYPE;

// Numero confrontato per intero: l'unica tolleranza e' il prefisso internazionale (+39, 0039 o 39 davanti)
function phoneNorm(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0039")) d = d.slice(4); else if (d.startsWith("39") && d.length > 10) d = d.slice(2);
  return d;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Nome e cognome si confrontano senza badare all'ordine, alle maiuscole e agli accenti
function sameName(a, b) { const x = norm(a).split(" ").filter(Boolean).sort().join(" "), y = norm(b).split(" ").filter(Boolean).sort().join(" "); return !!x && x === y; }

// Codice di accesso: lettere e/o numeri, 4-20 caratteri. Si confronta senza badare a maiuscole e spazi.
const codeNorm = (c) => String(c || "").replace(/\s+/g, "").toLowerCase();
const codeValid = (c) => /^[A-Za-z0-9]{4,20}$/.test(String(c || "").replace(/\s+/g, ""));
// L'iscritto e' riconosciuto solo se nome, telefono (gia' filtrato in packsOf) e codice coincidono
function codeOk(packs, code) {
  const c = codeNorm(code);
  return !!c && packs.some((p) => p.access_code && codeNorm(p.access_code) === c);
}
// Tentativi sbagliati per telefono (condiviso da pagina web e Lia): dopo 8 errori in 10 minuti si blocca
const CODE_FAILS = new Map();
const ckey = (x) => (String(x).startsWith("n|") ? String(x) : phoneNorm(x));
function codeBlocked(phone) {
  const k = ckey(phone), r = CODE_FAILS.get(k);
  return !!r && Date.now() - r.t < 600000 && r.n >= 8;
}
function codeFail(phone) {
  const k = ckey(phone), r = CODE_FAILS.get(k);
  if (!r || Date.now() - r.t >= 600000) CODE_FAILS.set(k, { n: 1, t: Date.now() }); else r.n++;
  if (CODE_FAILS.size > 5000) CODE_FAILS.clear();
}
const codeReset = (phone) => CODE_FAILS.delete(ckey(phone));
// Chiave anti-abuso per nome (si entra con nome, cognome e codice, senza telefono)
const nameKey = (bizId, name) => "n|" + bizId + "|" + String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
// Codice gia' usato da un altro iscritto dell'attivita'?
async function codeTaken(sb, bizId, code, phone) {
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&access_code=not.is.null&select=customer_phone,access_code&limit=2000");
  const pn = phoneNorm(phone);
  return (r.ok && Array.isArray(r.data) ? r.data : []).some((p) => codeNorm(p.access_code) === codeNorm(code) && phoneNorm(p.customer_phone) !== pn);
}

// L'iscritto che ha quel codice (e quel nome): tutti i suoi pacchetti, oppure [] se non coincide
async function packsByCode(sb, bizId, code, name) {
  const c = codeNorm(code);
  if (!c) return [];
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&access_code=not.is.null&select=id,customer_name,customer_phone,service_id,pack_name,entries_total,price_eur,created_at,access_code&order=created_at.asc&limit=2000");
  const hit = r.ok && Array.isArray(r.data) ? r.data.filter((p) => codeNorm(p.access_code) === c) : [];
  if (!hit.length) return [];
  const pn = phoneNorm(hit[0].customer_phone);
  const mine = hit.filter((p) => phoneNorm(p.customer_phone) === pn);
  if (!mine.some((p) => sameName(p.customer_name, name))) return [];
  return withUsage(sb, await packsOf(sb, bizId, hit[0].customer_phone));
}

// Pacchetti di un iscritto (per telefono) con ingressi usati e rimasti. Piu' vecchio per primo: si consuma quello.
async function packsOf(sb, bizId, phone) {
  const pn = phoneNorm(phone);
  if (pn.length < 6) return [];
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&select=id,customer_name,customer_phone,service_id,pack_name,entries_total,price_eur,created_at,access_code&order=created_at.asc&limit=1000");
  const all = r.ok && Array.isArray(r.data) ? r.data.filter((p) => phoneNorm(p.customer_phone) === pn) : [];
  return withUsage(sb, all);
}
async function withUsage(sb, packs) {
  if (!packs.length) return [];
  const ids = packs.map((p) => p.id).join(",");
  const u = await sb("GET", "appointments?pt_pack_id=in.(" + ids + ")&status=neq.cancelled&select=pt_pack_id&limit=5000");
  const used = {};
  (u.ok && Array.isArray(u.data) ? u.data : []).forEach((a) => { used[a.pt_pack_id] = (used[a.pt_pack_id] || 0) + 1; });
  return packs.map((p) => Object.assign({}, p, { used: used[p.id] || 0, left: Math.max(0, p.entries_total - (used[p.id] || 0)) }));
}
// Il pacchetto da cui scalare una lezione di quel servizio: il piu' vecchio con ingressi rimasti
function pickPack(packs, serviceId) {
  return packs.find((p) => p.left > 0 && (!serviceId || p.service_id === serviceId)) || null;
}

// Elenco degli iscritti: chi ha almeno un pacchetto assegnato dal trainer (diverso dall'elenco clienti, che nasce dagli appuntamenti)
async function rosterOf(sb, bizId) {
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&select=id,customer_name,customer_phone,service_id,pack_name,entries_total,price_eur,created_at,access_code&order=created_at.asc&limit=2000");
  const packs = await withUsage(sb, r.ok && Array.isArray(r.data) ? r.data : []);
  const by = {};
  packs.forEach((p) => {
    const k = phoneNorm(p.customer_phone);
    const m = by[k] || (by[k] = { name: p.customer_name, phone: p.customer_phone, left: 0, total: 0, code: "", packs: [] });
    if (p.access_code && !m.code) m.code = p.access_code;
    m.name = p.customer_name; m.phone = p.customer_phone; m.left += p.left; m.total += p.entries_total;
    m.packs.push({ id: p.id, name: p.pack_name, total: p.entries_total, used: p.used, left: p.left, price_eur: p.price_eur, created_at: p.created_at });
  });
  return Object.keys(by).map((k) => by[k]);
}

module.exports = { packsByCode, nameKey, codeNorm, codeValid, codeOk, codeBlocked, codeFail, codeReset, codeTaken, rosterOf, isTrainer, phoneNorm, sameName, packsOf, withUsage, pickPack, TRAINER_TYPE };
