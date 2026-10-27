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

// Pacchetto = servizio con package_service_ids (i servizi che comprende). Lo fa solo chi sa fare TUTTI quei servizi.
function isPackage(service) {
  return !!(service && Array.isArray(service.package_service_ids) && service.package_service_ids.length);
}

// Chi ha la lista servizi (nessuna riga = fa tutto) puo' fare questo servizio o pacchetto?
function canDo(svc, service) {
  if (!svc || !svc.length || !service) return true;
  if (isPackage(service)) return service.package_service_ids.every((id) => svc.indexOf(id) !== -1);
  return svc.indexOf(service.id) !== -1;
}

// Un pacchetto con un servizio incluso non piu' attivo non si puo' prenotare: lo si toglie dall'elenco.
function dropBrokenPackages(biz) {
  const live = {};
  (biz.services || []).forEach((s) => { if (!isPackage(s)) live[s.id] = true; });
  biz.services = (biz.services || []).filter((s) => !isPackage(s) || s.package_service_ids.every((id) => live[id]));
  return biz;
}

// Questa risorsa puo' fare questo servizio in questo giorno (data locale YYYY-MM-DD)?
function resourceOk(biz, res, service, dateStr) {
  const svc = biz.__svc && biz.__svc[res.id];
  if (!canDo(svc, service)) return false;
  return !(biz.__off || []).some(
    (o) => o.resource_id === res.id && String(o.date_from) <= dateStr && String(o.date_to) >= dateStr
  );
}

// Le persone che possono fare quel servizio (per sapere se ha senso chiedere "con chi?")
function eligibleStaff(biz, service) {
  if (!biz.__teamMode) return [];
  return (biz.resources || []).filter((r) => {
    return canDo(biz.__svc && biz.__svc[r.id], service);
  });
}

// Ore (blocchi) prenotabili di fila in un solo appuntamento: il titolare imposta il massimo per servizio
// (colonna services.max_units; senza colonna o senza valore e' 1, quindi tutto resta com'e'). I pacchetti non la usano.
function maxUnits(service) {
  const v = Number(service && service.max_units);
  return Number.isInteger(v) && v >= 2 && v <= 8 && !isPackage(service) ? v : 1;
}
// Durate prenotabili di un servizio, come multipli della durata minima (units).
// Senza mezz'ore: 1, 2, 3... fino a max_units. Con la spunta "anche a mezz'ore": dalla durata minima a passi di 30 minuti,
// fino al massimo del servizio o, se non e' piu' alto, a 2 ore oltre la durata minima. Il prezzo e' proporzionale al tempo.
function unitSteps(service) {
  const d = Number(service && service.duration_min) || 0;
  const mx = maxUnits(service);
  if (!(service && service.half_hour === true) || isPackage(service) || d < 5) {
    const out = [];
    for (let k = 1; k <= mx; k++) out.push(k);
    return out;
  }
  const top = Math.max(d * mx, d + 120), out = [];
  for (let m = d; m <= top; m += 30) out.push(Math.round((m / d) * 100) / 100);
  return out;
}
// Minuti totali di un appuntamento con quel numero di "units" (sempre un numero intero).
function minutesOf(service, units) { return Math.round((Number(service && service.duration_min) || 0) * (Number(units) || 1)); }

// Controlla quanti blocchi chiede il cliente (vuoto = 1) e restituisce { units } oppure { error }.
function unitsOf(service, raw) {
  if (raw === undefined || raw === null || raw === "") return { units: 1 };
  const n = Number(raw);
  const hit = Number.isFinite(n) ? unitSteps(service).find((u) => Math.abs(u - n) < 0.011) : undefined;
  if (hit === undefined) return { error: "Durata non valida per questo servizio." };
  return { units: hit };
}

// Quanti blocchi dura un appuntamento gia' salvato (colonna appointments.units; vuoto = 1). Serve a moltiplicare il prezzo del servizio.
function apptUnits(a) {
  const n = Number(a && a.units);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? Math.round(n * 100) / 100 : 1;
}

module.exports = { attachStaff, resourceOk, eligibleStaff, isPackage, canDo, dropBrokenPackages, maxUnits, unitsOf, apptUnits, unitSteps, minutesOf };
