// lib/export.js — strumenti di base per l'esportazione dei dati: lettura a pagine, CSV e contenitore ZIP (serve ai file .xlsx).
// Nessuna dipendenza. I CSV usano ";" e BOM UTF-8 così si aprono bene in Excel, Numbers e Fogli.

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
function phoneKey(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length > 10 && d.startsWith("39") ? d.slice(2) : d;
}

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

module.exports = { zip, csv, crc32, readAll, phoneKey };
