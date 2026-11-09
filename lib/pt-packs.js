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

// Pacchetti di un iscritto (per telefono) con ingressi usati e rimasti. Piu' vecchio per primo: si consuma quello.
async function packsOf(sb, bizId, phone) {
  const pn = phoneNorm(phone);
  if (pn.length < 6) return [];
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&select=id,customer_name,customer_phone,service_id,pack_name,entries_total,price_eur,created_at&order=created_at.asc&limit=1000");
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

module.exports = { isTrainer, phoneNorm, sameName, packsOf, withUsage, pickPack, TRAINER_TYPE };
