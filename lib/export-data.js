// lib/export-data.js — raccoglie i dati del titolare in tabelle neutre (le stesse per Excel, PDF e CSV).
// Ogni sezione = una tabella: { id, name, note, columns:[{header,type,width}], rows:[[...]] }
// Tipi di colonna: text | wrap | date ("YYYY-MM-DD") | time ("HH:MM") | money | int

const { readAll, phoneKey } = require("./export.js");
const { apptUnits } = require("./staff.js");
const promos = require("./promos.js");

const STATUS = { confirmed: "Confermato", cancelled: "Annullato", no_show: "Non presentato" };
const CHANNEL = { selfservice: "Pagina di prenotazione", web: "Sito", webchat: "Chat Lia sul sito", telegram: "Telegram", whatsapp: "WhatsApp", manuale: "Inserito dal titolare" };
const DAYS = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

// sezioni disponibili per tipo di attività (l'ordine è quello della schermata)
const SECTIONS = {
  normal: [
    { id: "clienti", name: "Clienti", desc: "Nome, telefono, email, visite, totale speso, note" },
    { id: "appuntamenti", name: "Appuntamenti", desc: "Tutti, anche annullati e non presentati", period: true },
    { id: "servizi", name: "Servizi e prezzi", desc: "Durata, prezzo, pausa, a domicilio" },
    { id: "orari", name: "Orari di apertura", desc: "Giorni e fasce, per ogni persona" },
  ],
  gym: [
    { id: "iscritti", name: "Iscritti", desc: "Contatti, certificato medico, note" },
    { id: "abbonamenti", name: "Abbonamenti", desc: "Piano, date, ingressi rimasti, importo pagato" },
    { id: "lezioni", name: "Prenotazioni lezioni", desc: "Chi ha prenotato quale lezione, anche disdette", period: true },
    { id: "pt", name: "Personal training", desc: "Sedute prenotate e assenze", period: true },
    { id: "affitti", name: "Affitto sala", desc: "Richieste e prenotazioni della sala", period: true },
    { id: "corsi", name: "Corsi e orari", desc: "Corsi, posti e calendario settimanale" },
    { id: "piani", name: "Tipi di abbonamento", desc: "Piani in vendita, durata, prezzo, limiti" },
  ],
};
function sectionsFor(biz) { return biz.business_type === "palestra" ? SECTIONS.gym : SECTIONS.normal; }

function localizer(tz) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return function (iso) {
    if (!iso) return { ymd: "", hm: "" };
    const p = {};
    f.formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
    return { ymd: p.year + "-" + p.month + "-" + p.day, hm: p.hour + ":" + p.minute };
  };
}
const hm5 = (t) => (t ? String(t).slice(0, 5) : "");
const price = (v) => (v == null || v === "" ? null : Number(v));
const yn = (v) => (v === false ? "No" : "Sì");
const fullName = (m) => (m ? [m.first_name, m.last_name].filter(Boolean).join(" ") : "");
const inRange = (ymd, from, to) => !ymd || ((!from || ymd >= from) && (!to || ymd <= to));

function phoneOut(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  const d = s.replace(/[\s\-().]/g, "");
  let m = d.match(/^(?:\+|00)?39(\d{8,11})$/);
  if (m) return "+39 " + m[1];
  if (/^\+\d{8,15}$/.test(d)) return d.slice(0, 3) + " " + d.slice(3);
  if (/^\d{8,15}$/.test(d)) return d.slice(0, 3) + " " + d.slice(3);
  return s;
}

const C = (header, type, width) => ({ header, type: type || "text", width: width || 16 });

// ---------- attività normali ----------
async function normal(biz, sb, tz, want, range) {
  const id = biz.id, L = localizer(tz), nowMs = Date.now(), out = {};
  const needAppts = want.has("clienti") || want.has("appuntamenti");
  const pcol = needAppts && (await promos.hasCol(sb)) ? ",promo_price_eur" : "";
  const [appts, services, resources, custNotes, apptNotes] = await Promise.all([
    needAppts ? readAll(sb, "appointments?business_id=eq." + id + "&order=starts_at.asc,id.asc&select=id,starts_at,ends_at,status,channel,units,customer_name,customer_phone,customer_email,customer_address,notes,created_at" + pcol + ",services(name,price_eur,duration_min),resources(name)") : [],
    want.has("servizi") ? readAll(sb, "services?business_id=eq." + id + "&order=name.asc&select=name,duration_min,buffer_min,price_eur,at_customer_place,active", 4) : [],
    want.has("orari") ? readAll(sb, "resources?business_id=eq." + id + "&order=sort_order.asc&select=name,active,is_staff,is_owner,opening_hours(weekday,opens,closes)", 4) : [],
    want.has("clienti") ? readAll(sb, "customer_notes?business_id=eq." + id + "&select=customer_phone,note", 4) : [],
    want.has("appuntamenti") ? readAll(sb, "appointment_notes?business_id=eq." + id + "&select=appointment_id,note", 4) : [],
  ]);

  if (want.has("appuntamenti")) {
    const an = {}; apptNotes.forEach((n) => { an[n.appointment_id] = n.note; });
    const rows = [];
    appts.forEach((a) => {
      const s = L(a.starts_at);
      if (!inRange(s.ymd, range.from, range.to)) return;
      const sv = a.services || {};
      rows.push([s.ymd, s.hm, L(a.ends_at).hm, sv.name || "", price((a.promo_price_eur != null ? a.promo_price_eur : sv.price_eur) == null ? null : Number(a.promo_price_eur != null ? a.promo_price_eur : sv.price_eur) * apptUnits(a)), a.resources && a.resources.name || "", a.customer_name || "", phoneOut(a.customer_phone), a.customer_email || "", a.customer_address || "",
        STATUS[a.status] || a.status || "", CHANNEL[a.channel] || a.channel || "", [a.notes, an[a.id]].filter(Boolean).join(" | "), L(a.created_at).ymd]);
    });
    out.appuntamenti = { name: "Appuntamenti", note: "Tutti, anche annullati e non presentati", rows,
      columns: [C("Data", "date", 13), C("Inizio", "time", 9), Object.assign(C("Fine", "time", 9), { noPdf: true }), C("Servizio", "text", 22), C("Prezzo", "money", 12), C("Operatore", "text", 14), C("Cliente", "text", 22), C("Telefono", "text", 23), C("Email", "text", 26), Object.assign(C("Indirizzo", "text", 24), { noPdf: true }), C("Stato", "text", 16), C("Canale", "text", 22), C("Note", "wrap", 44), Object.assign(C("Prenotato il", "date", 14), { noPdf: true })] };
  }

  if (want.has("clienti")) {
    const cn = {}; custNotes.forEach((n) => { cn[phoneKey(n.customer_phone)] = n.note; });
    const by = new Map();
    appts.forEach((a) => {
      const k = phoneKey(a.customer_phone) || ("n:" + String(a.customer_name || "").trim().toLowerCase());
      if (k === "n:") return;
      let c = by.get(k);
      if (!c) { c = { name: "", phone: "", email: "", visits: 0, cancelled: 0, noshow: 0, first: null, last: null, next: null, spent: 0 }; by.set(k, c); }
      if (a.customer_name) c.name = a.customer_name;
      if (a.customer_phone) c.phone = a.customer_phone;
      if (a.customer_email) c.email = a.customer_email;
      const t = new Date(a.starts_at).getTime();
      if (a.status === "cancelled") c.cancelled++;
      else if (a.status === "no_show") c.noshow++;
      else if (t < nowMs) { c.visits++; if (!c.first) c.first = a.starts_at; c.last = a.starts_at; if (a.services && a.services.price_eur != null) c.spent += promos.unitPrice(a) * apptUnits(a) || 0; }
      else if (!c.next) c.next = a.starts_at;
    });
    const list = Array.from(by.entries()).sort((x, y) => String(x[1].name).localeCompare(String(y[1].name), "it"));
    out.clienti = { name: "Clienti", note: "Un cliente per riga, con visite e totale speso",
      columns: [C("Nome", "text", 24), C("Telefono", "text", 23), C("Email", "text", 28), C("Visite fatte", "int", 13), C("Annullati", "int", 12), C("Non presentati", "int", 16), C("Prima visita", "date", 14), C("Ultima visita", "date", 14), C("Prossimo appuntamento", "date", 22), C("Totale speso", "money", 15), C("Note", "wrap", 40)],
      rows: list.map(([k, c]) => [c.name, phoneOut(c.phone), c.email, c.visits, c.cancelled, c.noshow, c.first ? L(c.first).ymd : "", c.last ? L(c.last).ymd : "", c.next ? L(c.next).ymd : "", c.spent ? Math.round(c.spent * 100) / 100 : null, cn[k] || ""]) };
  }

  if (want.has("servizi")) {
    out.servizi = { name: "Servizi e prezzi", note: "Durata, prezzo e pausa di ogni servizio",
      columns: [C("Servizio", "text", 28), C("Durata (min)", "int", 14), C("Pausa dopo (min)", "int", 17), C("Prezzo", "money", 12), C("A domicilio", "text", 13), C("Attivo", "text", 10)],
      rows: services.map((s) => [s.name, s.duration_min, s.buffer_min || 0, price(s.price_eur), s.at_customer_place ? "Sì" : "No", yn(s.active)]) };
  }

  if (want.has("orari")) {
    const rows = [];
    resources.forEach((r) => (r.opening_hours || []).slice().sort((a, b) => a.weekday - b.weekday || String(a.opens).localeCompare(String(b.opens))).forEach((h) => rows.push([r.name, DAYS[h.weekday] || h.weekday, hm5(h.opens), hm5(h.closes)])));
    out.orari = { name: "Orari di apertura", note: "Giorni e fasce di ogni persona", rows, columns: [C("Persona", "text", 24), C("Giorno", "text", 16), C("Apre", "text", 10), C("Chiude", "text", 10)] };
  }
  return out;
}

// ---------- palestre ----------
async function gym(biz, sb, tz, want, range) {
  const id = biz.id, L = localizer(tz), out = {};
  const g = (t, sel, order, pages) => readAll(sb, t + "?business_id=eq." + id + (order ? "&order=" + order : "") + "&select=" + sel, pages || 12);
  const [members, mplans, books, pts, rents, courses, sched, plans] = await Promise.all([
    want.has("iscritti") ? g("gym_members", "first_name,last_name,phone,notes,active,created_at,medical_from,medical_until", "last_name.asc,first_name.asc") : [],
    want.has("abbonamenti") ? g("gym_member_plans", "plan_name,kind,starts_on,ends_on,entries_total,entries_left,price_paid,cancelled,created_at,gym_members(first_name,last_name)", "starts_on.desc") : [],
    want.has("lezioni") ? g("gym_bookings", "session_date,starts_at,status,entry_used,no_show,created_at,cancelled_at,gym_members(first_name,last_name,phone),gym_schedule(gym_courses(name))", "starts_at.asc", 40) : [],
    want.has("pt") ? g("gym_pt_bookings", "session_date,starts_at,status,no_show,created_at,gym_members(first_name,last_name,phone)", "starts_at.asc", 20) : [],
    want.has("affitti") ? g("gym_rentals", "session_date,starts_at,ends_at,first_name,last_name,phone,email,price_eur,status,created_at,cancelled_by", "starts_at.asc", 20) : [],
    want.has("corsi") ? g("gym_courses", "id,name,category,description,duration_min,capacity,active", "name.asc", 4) : [],
    want.has("corsi") ? g("gym_schedule", "course_id,weekday,starts_at_time,capacity,active", "weekday.asc,starts_at_time.asc", 6) : [],
    want.has("piani") ? g("gym_plans", "name,kind,days,entries,price_eur,max_entries,max_per_week,active,covers", "name.asc", 4) : [],
  ]);
  const st = (s, noShow) => (s === "cancelled" ? "Annullata" : noShow ? "Assente" : "Confermata");

  if (want.has("iscritti")) out.iscritti = { name: "Iscritti", note: "Un iscritto per riga, con certificato medico",
    columns: [C("Cognome", "text", 18), C("Nome", "text", 16), C("Telefono", "text", 23), C("Certificato dal", "date", 16), C("Certificato fino al", "date", 18), C("Attivo", "text", 10), C("Iscritto il", "date", 14), C("Note", "wrap", 40)],
    rows: members.map((m) => [m.last_name, m.first_name, phoneOut(m.phone), m.medical_from || "", m.medical_until || "", yn(m.active), L(m.created_at).ymd, m.notes || ""]) };

  if (want.has("abbonamenti")) out.abbonamenti = { name: "Abbonamenti", note: "Abbonamenti venduti, dal più recente",
    columns: [C("Iscritto", "text", 24), C("Piano", "text", 24), C("Tipo", "text", 14), C("Dal", "date", 13), C("Al", "date", 13), C("Ingressi totali", "int", 15), C("Ingressi rimasti", "int", 16), C("Importo pagato", "money", 16), C("Stato", "text", 12)],
    rows: mplans.map((p) => [fullName(p.gym_members), p.plan_name, p.kind === "entries" ? "A ingressi" : "A tempo", p.starts_on || "", p.ends_on || "", p.entries_total, p.entries_left, price(p.price_paid), p.cancelled ? "Annullato" : "Valido"]) };

  if (want.has("lezioni")) {
    const rows = [];
    books.forEach((b) => { const s = L(b.starts_at); if (!inRange(s.ymd, range.from, range.to)) return;
      rows.push([s.ymd, s.hm, (b.gym_schedule && b.gym_schedule.gym_courses && b.gym_schedule.gym_courses.name) || "", fullName(b.gym_members), phoneOut(b.gym_members && b.gym_members.phone), st(b.status, b.no_show), b.entry_used ? "Sì" : "No", L(b.created_at).ymd]); });
    out.lezioni = { name: "Prenotazioni lezioni", note: "Chi ha prenotato quale lezione", rows,
      columns: [C("Data", "date", 13), C("Ora", "time", 9), C("Corso", "text", 24), C("Iscritto", "text", 24), C("Telefono", "text", 23), C("Stato", "text", 14), C("Ingresso usato", "text", 15), C("Prenotata il", "date", 14)] };
  }

  if (want.has("pt")) {
    const rows = [];
    pts.forEach((b) => { const s = L(b.starts_at); if (!inRange(s.ymd, range.from, range.to)) return;
      rows.push([s.ymd, s.hm, fullName(b.gym_members), phoneOut(b.gym_members && b.gym_members.phone), st(b.status, b.no_show), L(b.created_at).ymd]); });
    out.pt = { name: "Personal training", note: "Sedute 1:1 prenotate", rows,
      columns: [C("Data", "date", 13), C("Ora", "time", 9), C("Iscritto", "text", 24), C("Telefono", "text", 23), C("Stato", "text", 14), C("Prenotata il", "date", 14)] };
  }

  if (want.has("affitti")) {
    const rows = [];
    rents.forEach((r) => { const s = L(r.starts_at); if (!inRange(s.ymd, range.from, range.to)) return;
      rows.push([s.ymd, s.hm, L(r.ends_at).hm, [r.first_name, r.last_name].filter(Boolean).join(" "), phoneOut(r.phone), r.email || "", price(r.price_eur), r.status === "cancelled" ? "Annullato" : "Confermato", L(r.created_at).ymd]); });
    out.affitti = { name: "Affitto sala", note: "Prenotazioni della sala", rows,
      columns: [C("Data", "date", 13), C("Inizio", "time", 9), Object.assign(C("Fine", "time", 9), { noPdf: true }), C("Cliente", "text", 24), C("Telefono", "text", 23), C("Email", "text", 28), C("Prezzo", "money", 12), C("Stato", "text", 14), C("Richiesta il", "date", 14)] };
  }

  if (want.has("corsi")) {
    const name = {}; courses.forEach((c) => { name[c.id] = c; });
    const rows = [];
    sched.forEach((s) => { const c = name[s.course_id] || {}; rows.push([c.name || "", c.category || "", DAYS[s.weekday] || s.weekday, hm5(s.starts_at_time), c.duration_min, s.capacity || c.capacity, s.active === false || c.active === false ? "No" : "Sì"]); });
    const used = new Set(sched.map((s) => s.course_id));
    courses.filter((c) => !used.has(c.id)).forEach((c) => rows.push([c.name, c.category || "", "", "", c.duration_min, c.capacity, yn(c.active)]));
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "it"));
    out.corsi = { name: "Corsi e orari", note: "Calendario settimanale dei corsi", rows,
      columns: [C("Corso", "text", 24), C("Categoria", "text", 16), C("Giorno", "text", 14), C("Ora", "text", 9), C("Durata (min)", "int", 14), C("Posti", "int", 9), C("Attivo", "text", 10)] };
  }

  if (want.has("piani")) out.piani = { name: "Tipi di abbonamento", note: "I piani che vendi, con durata, prezzo e limiti",
    columns: [C("Piano", "text", 26), C("Tipo", "text", 14), C("Durata (giorni)", "int", 16), C("Ingressi", "int", 11), C("Prezzo", "money", 12), C("Max al mese", "int", 13), C("Max a settimana", "int", 16), C("Copre", "text", 22), C("Attivo", "text", 10)],
    rows: plans.map((p) => [p.name, p.kind === "entries" ? "A ingressi" : "A tempo", p.days, p.entries, price(p.price_eur), p.max_entries, p.max_per_week, (p.covers || []).join(", "), yn(p.active)]) };
  return out;
}

// period: { from, to } ("YYYY-MM-DD" o null). ids: elenco id sezioni voluto.
async function collect(biz, sb, tz, ids, range) {
  const defs = sectionsFor(biz);
  const want = new Set(defs.map((d) => d.id).filter((i) => ids.includes(i)));
  const got = biz.business_type === "palestra" ? await gym(biz, sb, tz, want, range || {}) : await normal(biz, sb, tz, want, range || {});
  return defs.filter((d) => want.has(d.id) && got[d.id]).map((d) => Object.assign({ id: d.id }, got[d.id]));
}

module.exports = { collect, sectionsFor, SECTIONS };
