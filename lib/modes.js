// lib/modes.js  (modalita' dei servizi: in sede, a domicilio, online)
// Ogni modalita' di un servizio e' una riga in "services" (con il suo prezzo); le righe dello stesso servizio
// condividono group_id. Le colonne mode/group_id/half_hour arrivano da supabase/migrations/20261102_service_modes.sql:
// finche' mancano, tutto funziona come prima (mode derivata da at_customer_place).

const MODES = ["sede", "domicilio", "online"];
const SUFFIX = { sede: " (in sede)", domicilio: " (a domicilio)", online: " (online)" };

function modeOf(s) {
  const m = s && s.mode;
  if (MODES.includes(m)) return m;
  return s && s.at_customer_place ? "domicilio" : "sede";
}

// id -> nome da mostrare: se lo stesso servizio ha piu' modalita' attive, il nome porta la modalita'.
function labels(list) {
  const count = {};
  (list || []).forEach((s) => { if (s.group_id) count[s.group_id] = (count[s.group_id] || 0) + 1; });
  const out = {};
  (list || []).forEach((s) => { const raw = s.__rawName || s.name;
    out[s.id] = s.group_id && count[s.group_id] > 1 ? raw + SUFFIX[modeOf(s)] : raw; });
  return out;
}

// Per la pagina di prenotazione e per Lia: ogni riga prende il nome con la modalita' e il campo __mode.
function attach(biz) {
  const list = (biz.services || []).filter((s) => !(Array.isArray(s.package_service_ids) && s.package_service_ids.length));
  const lab = labels(list);
  (biz.services || []).forEach((s) => {
    s.__mode = modeOf(s);
    if (lab[s.id] && lab[s.id] !== s.name) { if (!s.__rawName) s.__rawName = s.name; s.name = lab[s.id]; }
  });
  return biz;
}

function cleanModes(arr) {
  const out = [];
  for (const m of Array.isArray(arr) ? arr : []) {
    const mode = String((m && m.mode) || "");
    const price = Number(m && m.price_eur);
    if (!MODES.includes(mode) || out.some((o) => o.mode === mode) || !Number.isFinite(price) || price < 0) return null;
    out.push({ mode, price_eur: Math.round(price * 100) / 100 });
  }
  return out.length ? out : null;
}

// Quali modalita' puo' usare l'attivita': a domicilio se ha zone o servizi a domicilio, online e mezz'ore se le ha scelte
// in registrazione (o le usava gia'). Un parrucchiere con il suo salone non vede e non puo' aggiungere altro.
function allowed(biz, services) {
  const sv = Array.isArray(services) ? services : [];
  const areas = Array.isArray(biz && biz.service_areas) ? biz.service_areas.length : 0;
  return {
    domicilio: areas > 0 || sv.some((x) => modeOf(x) === "domicilio"),
    online: !!(biz && biz.offers_online) || sv.some((x) => x.mode === "online"),
    half: !!(biz && biz.half_hour_ok) || sv.some((x) => x.half_hour === true),
  };
}
// null se va bene, altrimenti il messaggio da mostrare
function violation(biz, services, ms, half) {
  const a = allowed(biz, services);
  for (const m of ms || []) {
    if (m.mode === "domicilio" && !a.domicilio) return "Questa attivita' non fa servizi a domicilio.";
    if (m.mode === "online" && !a.online) return "Questa attivita' non offre servizi online.";
  }
  if (half && !a.half) return "Questa attivita' non prenota a mezz'ore.";
  return null;
}

module.exports = { MODES, modeOf, labels, attach, cleanModes, allowed, violation };
