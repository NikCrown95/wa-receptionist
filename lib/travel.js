// lib/travel.js  (tempo per spostarsi di chi lavora a domicilio)
// Regola: tra due appuntamenti attaccati, se almeno uno dei due e' a domicilio, servono almeno
// businesses.travel_min minuti. In sede -> in sede: nessun tempo in piu'. Se prima si era liberi, nessun blocco.

function travelMin(biz) {
  const v = Number(biz && biz.travel_min);
  return Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 180) : 0;
}

// Colonne da leggere: il servizio serve solo per sapere se l'appuntamento esistente e' a domicilio.
function apptCols(biz) {
  return "resource_id,starts_at,blocked_until" + (travelMin(biz) > 0 ? ",services(at_customer_place)" : "");
}

// Finestra di lettura allargata: un appuntamento appena fuori dal giorno puo' comunque bloccare l'inizio o la fine.
function padMs(biz) { return travelMin(biz) * 60000; }

// [inizio, fine+pausa, aDomicilio] degli appuntamenti di una risorsa.
function busyOf(rows, resourceId) {
  return rows.filter((b) => b.resource_id === resourceId)
    .map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until), !!(b.services && b.services.at_customer_place)]);
}

// true se il nuovo appuntamento [startMs, blockedMs] (a domicilio o no) cozza con uno esistente.
function clash(busy, startMs, blockedMs, newHome, tMin) {
  return busy.some((b) => {
    const ext = tMin > 0 && (b[2] || newHome) ? tMin * 60000 : 0;
    return startMs < b[1] + ext && blockedMs + ext > b[0];
  });
}

module.exports = { travelMin, apptCols, padMs, busyOf, clash };
