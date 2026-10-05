// lib/staff.js  (Lia: titolare e collaboratori)
//
// Regole condivise da Lia, dal calendario online e dalla dashboard.
//  - businesses.team_mode = 'solo'  -> si prenota con il titolare (la risorsa degli orari di apertura).
//  - businesses.team_mode = 'team'  -> si prenota SOLO con le persone elencate (titolare incluso se
//    "riceve clienti" e almeno un collaboratore): ognuna ha i suoi orari (opening_hours della sua
//    risorsa), i suoi servizi (resource_services: nessuna riga = fa tutto) e i suoi riposi
//    e ferie (resource_time_off).
// Se qualcosa non si legge (tabelle non ancora create, rete) o in modalita' 'team' non c'e' nessuna
// persona attiva, si torna alla risorsa degli orari di apertura: meglio un servizio in piu' che
// spegnere le prenotazioni.

async function attachStaff(biz, sb) {
  const all = biz.resources || [];
  biz.__allResources = all;
  biz.__hoursResource = all.find((r) => !r.is_staff) || all[0] || null;
  biz.__svc = {};
  biz.__off = [];
  const staff = all.filter((r) => r.is_staff);
  const solo = all.filter((r) => !r.is_staff);
  biz.__teamMode = biz.team_mode === "team" && staff.length > 0;
  if (!biz.__teamMode) {
    // solo titolare: contano soltanto le risorse senza nome di collaboratore
    if (solo.length) biz.resources = solo;
    return biz;
  }
  biz.resources = staff;
  try {
    const ids = staff.map((r) => r.id).join(",");
    const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const [sv, off] = await Promise.all([
      sb("GET", "resource_services?resource_id=in.(" + ids + ")&select=resource_id,service_id"),
      sb("GET", "resource_time_off?resource_id=in.(" + ids + ")&date_to=gte." + from + "&select=resource_id,date_from,date_to"),
    ]);
    if (sv.ok && Array.isArray(sv.data)) {
      sv.data.forEach((x) => { (biz.__svc[x.resource_id] = biz.__svc[x.resource_id] || []).push(x.service_id); });
    }
    if (off.ok && Array.isArray(off.data)) biz.__off = off.data;
  } catch (e) {
    console.error("attachStaff: regole non lette", e && e.message);
  }
  return biz;
}

// Questa risorsa puo' fare questo servizio in questo giorno (data locale YYYY-MM-DD)?
function resourceOk(biz, res, service, dateStr) {
  const svc = biz.__svc && biz.__svc[res.id];
  if (svc && svc.length && service && svc.indexOf(service.id) === -1) return false;
  return !(biz.__off || []).some(
    (o) => o.resource_id === res.id && String(o.date_from) <= dateStr && String(o.date_to) >= dateStr
  );
}

// Le persone che possono fare quel servizio (per sapere se ha senso chiedere "con chi?")
function eligibleStaff(biz, service) {
  if (!biz.__teamMode) return [];
  return (biz.resources || []).filter((r) => {
    const svc = biz.__svc && biz.__svc[r.id];
    return !(svc && svc.length && service && svc.indexOf(service.id) === -1);
  });
}

module.exports = { attachStaff, resourceOk, eligibleStaff };
