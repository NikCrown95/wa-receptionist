// Sconti e promozioni: prezzo scontato di un servizio in un periodo.
// Tollerante: se la tabella/colonna non esiste ancora (SQL non eseguito) il sito funziona come prima.
"use strict";

function todayIn(tz, now) {
  const d = now || new Date();
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

// La colonna appointments.promo_price_eur esiste? (true: per sempre; false: ricontrolla dopo 60 s)
let colState = { ok: false, at: 0 };
async function hasCol(sb) {
  if (colState.ok) return true;
  if (Date.now() - colState.at < 60000) return false;
  let ok = false;
  try {
    const r = await sb("GET", "appointments?select=promo_price_eur&limit=1");
    ok = !!r.ok;
  } catch (e) {}
  colState = { ok, at: Date.now() };
  return ok;
}

// Promozioni del locale con fine >= oggi (attive e programmate). Tabella assente -> [].
async function list(sb, bizId, tz) {
  try {
    const r = await sb("GET", "promotions?business_id=eq." + encodeURIComponent(bizId) + "&ends_on=gte." + todayIn(tz) + "&order=starts_on.asc&select=id,service_id,promo_price_eur,starts_on,ends_on");
    return r.ok && Array.isArray(r.data) ? r.data : [];
  } catch (e) {
    return [];
  }
}

function fmtUntil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return Number(m[3]) + " " + mesi[Number(m[2]) - 1];
}

// Applica le promozioni attive oggi ai servizi (in place): price_eur diventa il prezzo scontato.
async function attach(biz, sb) {
  if (!biz || !Array.isArray(biz.services) || !biz.services.length) return biz;
  const tz = biz.timezone || "Europe/Rome";
  const today = todayIn(tz);
  const rows = (await list(sb, biz.id, tz)).filter((p) => p.starts_on <= today && p.ends_on >= today);
  if (!rows.length) return biz;
  const by = {};
  rows.forEach((p) => { by[p.service_id] = p; });
  biz.services.forEach((s) => {
    const p = by[s.id];
    if (!p || (Array.isArray(s.package_service_ids) && s.package_service_ids.length)) return;
    const orig = Number(s.price_eur), now = Number(p.promo_price_eur);
    if (!(orig > 0) || !(now >= 0) || now >= orig) return;
    s.__orig_price_eur = orig;
    s.price_eur = now;
    s.__promo = { id: p.id, price: now, orig: orig, pct: Math.round((1 - now / orig) * 100), until: p.ends_on, untilLabel: fmtUntil(p.ends_on) };
  });
  return biz;
}

// Promozioni attive oggi per servizio: { serviceId: prezzoScontato } (solo se piu' basso del listino).
async function activeMap(sb, biz) {
  const tz = biz.timezone || "Europe/Rome", today = todayIn(tz), out = {};
  (await list(sb, biz.id, tz)).forEach((p) => {
    if (p.starts_on > today || p.ends_on < today) return;
    const s = (biz.services || []).find((x) => x.id === p.service_id);
    if (!s || (Array.isArray(s.package_service_ids) && s.package_service_ids.length)) return;
    if (Number(p.promo_price_eur) < Number(s.price_eur)) out[s.id] = Number(p.promo_price_eur);
  });
  return out;
}

// Per l'insert di un appuntamento: aggiunge lo snapshot solo se serve.
function snapshot(row, svc) {
  if (svc && svc.__promo) row.promo_price_eur = svc.__promo.price;
  return row;
}

// Prezzo realmente incassato di un appuntamento (unita' escluse).
function unitPrice(a) {
  if (a && a.promo_price_eur != null && a.promo_price_eur !== "") return Number(a.promo_price_eur) || 0;
  return Number(a && a.services && a.services.price_eur) || 0;
}

module.exports = { activeMap, todayIn, hasCol, list, attach, snapshot, unitPrice, fmtUntil };
