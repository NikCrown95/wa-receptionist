// lib/export.js — esportazione dei dati del titolare (ZIP con CSV)
// Nessuna dipendenza: lo ZIP si costruisce qui. I CSV usano ";" e BOM UTF-8 così si aprono bene in Excel, Numbers e Fogli.

const zlib = require("zlib");

// ---------- ZIP minimale (deflate) ----------
const CRC_T = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
function zip(files) {
  const now = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, "utf8");
    const comp = zlib.deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // nomi in UTF-8
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(now.time, 10);
    lh.writeUInt16LE(now.date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(now.time, 12);
    ch.writeUInt16LE(now.date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat(centrals, [end]));
}

// ---------- CSV ----------
const PHONE_OK = /^\+?[0-9 ]+$/;
function cell(v) {
  let s = v == null ? "" : String(v);
  s = s.replace(/\r\n|\r|\n/g, " ").trim();
  // Un testo che inizia con = + - @ verrebbe letto come formula da Excel/Fogli: lo si neutralizza.
  if (/^[=+\-@\t]/.test(s) && !PHONE_OK.test(s)) s = "'" + s;
  if (/[;"]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csv(headers, rows) {
  const out = [headers.map(cell).join(";")];
  for (const r of rows) out.push(r.map(cell).join(";"));
  return "﻿" + out.join("\r\n") + "\r\n";
}
// "+393331234567" -> "+39 3331234567": con lo spazio nessun programma lo trasforma in numero (e non perde il +).
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
function phoneKey(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length > 10 && d.startsWith("39") ? d.slice(2) : d;
}

// ---------- date nel fuso dell'attività ----------
function fmt(tz) {
  const d = new Intl.DateTimeFormat("it-IT", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return function (iso) {
    if (!iso) return { date: "", time: "" };
    const p = {};
    d.formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
    return { date: p.day + "/" + p.month + "/" + p.year, time: p.hour + ":" + p.minute };
  };
}

const STATUS = { confirmed: "Confermato", cancelled: "Annullato", no_show: "Non presentato" };
const CHANNEL = { selfservice: "Pagina di prenotazione", web: "Sito", webchat: "Chat Lia sul sito", telegram: "Telegram", whatsapp: "WhatsApp", manuale: "Inserito dal titolare" };

// ---------- lettura a pagine (Supabase dà al massimo 1000 righe per richiesta) ----------
async function readAll(sb, base, maxPages) {
  const rows = [];
  for (let wave = 0; wave < Math.ceil((maxPages || 40) / 4); wave++) {
    const pages = await Promise.all([0, 1, 2, 3].map((k) => sb("GET", base + "&limit=1000&offset=" + (wave * 4 + k) * 1000)));
    let done = false;
    for (const p of pages) {
      if (!p.ok || !Array.isArray(p.data)) throw new Error("lettura dati non riuscita");
      for (const r of p.data) rows.push(r);
      if (p.data.length < 1000) { done = true; break; }
    }
    if (done) break;
  }
  return rows;
}

// ---------- costruzione dei file ----------
async function buildExport(biz, sb, tz) {
  const id = biz.id;
  const f = fmt(tz || "Europe/Rome");
  const nowMs = Date.now();

  const [appts, services, resources, custNotes, apptNotes] = await Promise.all([
    readAll(sb, "appointments?business_id=eq." + id + "&order=starts_at.asc,id.asc&select=id,starts_at,ends_at,status,channel,customer_name,customer_phone,customer_email,customer_address,notes,created_at,services(name,price_eur,duration_min),resources(name)"),
    readAll(sb, "services?business_id=eq." + id + "&order=name.asc&select=name,duration_min,buffer_min,price_eur,at_customer_place,active", 4),
    readAll(sb, "resources?business_id=eq." + id + "&order=sort_order.asc&select=name,active,is_staff,is_owner,opening_hours(weekday,opens,closes)", 4),
    readAll(sb, "customer_notes?business_id=eq." + id + "&select=customer_phone,note", 4),
    readAll(sb, "appointment_notes?business_id=eq." + id + "&select=appointment_id,note", 4),
  ]);

  const apptNote = {};
  apptNotes.forEach((n) => { apptNote[n.appointment_id] = n.note; });
  const custNote = {};
  custNotes.forEach((n) => { custNote[phoneKey(n.customer_phone)] = n.note; });

  // Appuntamenti
  const aRows = appts.map((a) => {
    const s = f(a.starts_at);
    const sv = a.services || {};
    const notes = [a.notes, apptNote[a.id]].filter(Boolean).join(" | ");
    return [s.date, s.time, f(a.ends_at).time, sv.name || "", sv.price_eur != null ? String(sv.price_eur).replace(".", ",") : "", a.resources && a.resources.name || "",
      a.customer_name || "", phoneOut(a.customer_phone), a.customer_email || "", a.customer_address || "",
      STATUS[a.status] || a.status || "", CHANNEL[a.channel] || a.channel || "", notes, f(a.created_at).date];
  });
  const aCsv = csv(["Data", "Ora inizio", "Ora fine", "Servizio", "Prezzo (€)", "Operatore", "Cliente", "Telefono", "Email", "Indirizzo", "Stato", "Canale", "Note", "Prenotato il"], aRows);

  // Clienti (uno per telefono; se manca il telefono, per nome)
  const byKey = new Map();
  appts.forEach((a) => {
    const k = phoneKey(a.customer_phone) || ("n:" + String(a.customer_name || "").trim().toLowerCase());
    if (k === "n:") return;
    let c = byKey.get(k);
    if (!c) { c = { name: "", phone: "", email: "", visits: 0, cancelled: 0, noshow: 0, first: null, last: null, next: null, spent: 0 }; byKey.set(k, c); }
    // gli appuntamenti sono in ordine di data: l'ultimo valore compilato e' il piu' recente
    if (a.customer_name) c.name = a.customer_name;
    if (a.customer_phone) c.phone = a.customer_phone;
    if (a.customer_email) c.email = a.customer_email;
    const t = new Date(a.starts_at).getTime();
    if (a.status === "cancelled") c.cancelled++;
    else if (a.status === "no_show") c.noshow++;
    else if (t < nowMs) {
      c.visits++;
      if (!c.first) c.first = a.starts_at;
      c.last = a.starts_at;
      if (a.services && a.services.price_eur != null) c.spent += Number(a.services.price_eur) || 0;
    } else if (!c.next) c.next = a.starts_at;
  });
  const cList = Array.from(byKey.entries()).map(([k, c]) => ({ k, c })).sort((x, y) => String(x.c.name).localeCompare(String(y.c.name), "it"));
  const cCsv = csv(["Nome", "Telefono", "Email", "Visite fatte", "Annullati", "Non presentati", "Prima visita", "Ultima visita", "Prossimo appuntamento", "Totale speso (€)", "Note"],
    cList.map(({ k, c }) => [c.name, phoneOut(c.phone), c.email, c.visits, c.cancelled, c.noshow, c.first ? f(c.first).date : "", c.last ? f(c.last).date : "", c.next ? f(c.next).date + " " + f(c.next).time : "",
      c.spent ? String(Math.round(c.spent * 100) / 100).replace(".", ",") : "", custNote[k] || ""]));

  // Servizi
  const sCsv = csv(["Servizio", "Durata (min)", "Pausa dopo (min)", "Prezzo (€)", "A domicilio", "Attivo"],
    services.map((s) => [s.name, s.duration_min, s.buffer_min || 0, s.price_eur != null ? String(s.price_eur).replace(".", ",") : "", s.at_customer_place ? "Sì" : "No", s.active === false ? "No" : "Sì"]));

  // Orari
  const DAYS = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const hRows = [];
  resources.forEach((r) => {
    (r.opening_hours || []).slice().sort((a, b) => a.weekday - b.weekday || String(a.opens).localeCompare(String(b.opens))).forEach((h) => {
      hRows.push([r.name, DAYS[h.weekday] || h.weekday, String(h.opens).slice(0, 5), String(h.closes).slice(0, 5)]);
    });
  });
  const hCsv = csv(["Persona", "Giorno", "Apre", "Chiude"], hRows);

  const files = [
    { name: "clienti.csv", data: cCsv },
    { name: "appuntamenti.csv", data: aCsv },
    { name: "servizi.csv", data: sCsv },
    { name: "orari.csv", data: hCsv },
  ];

  // Palestra: anche gli iscritti
  if (biz.business_type === "palestra") {
    try {
      const mem = await readAll(sb, "gym_members?business_id=eq." + id + "&order=last_name.asc&select=first_name,last_name,phone,notes,active,created_at", 8);
      files.push({ name: "iscritti.csv", data: csv(["Nome", "Cognome", "Telefono", "Note", "Attivo", "Iscritto il"], mem.map((m) => [m.first_name, m.last_name, phoneOut(m.phone), m.notes || "", m.active === false ? "No" : "Sì", f(m.created_at).date])) });
    } catch (e) { /* senza iscritti il resto del file e' comunque valido */ }
  }

  const today = f(new Date().toISOString()).date;
  files.push({
    name: "LEGGIMI.txt",
    data: "Esportazione dati - " + (biz.name || "la tua attività") + "\r\nGenerata il " + today + " da Prenolia.\r\n\r\n" +
      "clienti.csv: un cliente per riga, con telefono, email (se l'ha lasciata), visite, annullamenti e assenze.\r\n" +
      "appuntamenti.csv: tutti gli appuntamenti, anche annullati e non presentati.\r\n" +
      "servizi.csv e orari.csv: la configurazione della tua attività.\r\n\r\n" +
      "I file usano il punto e virgola come separatore. Si aprono con Excel, Numbers e Fogli Google.\r\n" +
      "Contengono dati personali dei tuoi clienti: conservali con cura.\r\n",
  });

  return { zip: zip(files), counts: { appointments: appts.length, customers: cList.length, services: services.length } };
}

module.exports = { buildExport, zip, csv, crc32, readAll, phoneKey };
