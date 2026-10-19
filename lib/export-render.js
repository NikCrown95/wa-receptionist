// lib/export-render.js — dalle tabelle neutre (export-data) al file scelto: Excel, PDF o CSV.

const { csv } = require("./export.js");
const { buildXlsx } = require("./export-xlsx.js");
const { buildPdf } = require("./export-pdf.js");

const FORMATS = {
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { ext: "pdf", mime: "application/pdf" },
  csv: { ext: "csv", mime: "text/csv; charset=utf-8" },
};
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function longDate(tz) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
  return { text: Number(p.day) + " " + MESI[Number(p.month) - 1] + " " + p.year + ", " + p.hour + ":" + p.minute, ymd: p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0") };
}
function slug(s) {
  return String(s || "attivita").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "attivita";
}
function csvCell(v, type) {
  if (v == null || v === "") return "";
  if (type === "date") { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v)); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(v); }
  if (type === "money") { const n = Number(v); return isFinite(n) ? n.toFixed(2).replace(".", ",") : ""; }
  return v;
}

// opts: { format, biz, tz, sheets, range:{from,to} }  ->  { buf, mime, filename }
function render(opts) {
  const f = FORMATS[opts.format];
  const now = longDate(opts.tz || "Europe/Rome");
  const base = "prenolia-" + slug(opts.biz.name);
  let buf, name;
  if (opts.format === "csv") {
    const s = opts.sheets[0];
    buf = Buffer.from(csv(s.columns.map((c) => c.header), s.rows.map((r) => r.map((v, i) => csvCell(v, s.columns[i].type)))), "utf8");
    name = base + "-" + slug(s.name) + "-" + now.ymd + ".csv";
  } else {
    const kpis = opts.sheets.filter((s) => ["clienti", "appuntamenti", "iscritti", "abbonamenti"].includes(s.id)).map((s) => ({ label: s.name, value: s.rows.length }));
    const r = opts.range || {};
    if (r.from || r.to) {
      const d = (x) => (x ? x.slice(8, 10) + "/" + x.slice(5, 7) + "/" + x.slice(0, 4) : "");
      kpis.push({ label: "Periodo dei dati con data", value: r.from && r.to ? d(r.from) + " – " + d(r.to) : r.from ? "dal " + d(r.from) : "fino al " + d(r.to) });
    }
    const spec = { business: opts.biz.name, generatedAt: now.text, kpis, sheets: opts.sheets, title: "Esportazione dati - " + (opts.biz.name || ""), footer: "Contiene dati personali: conservalo con cura." };
    buf = opts.format === "pdf" ? buildPdf(spec) : buildXlsx(spec);
    name = base + "-" + now.ymd + "." + f.ext;
  }
  return { buf, mime: f.mime, filename: name };
}

module.exports = { render, FORMATS };
