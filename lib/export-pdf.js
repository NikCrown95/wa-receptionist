// lib/export-pdf.js — PDF ordinato (A4 orizzontale) con copertina, indice e una tabella per ogni sezione. Senza dipendenze.
// buildPdf({ business, generatedAt, sheets:[{ name, note, columns:[{header,type,width,noPdf}], rows }] }) -> Buffer

const zlib = require("zlib");

// ---- larghezze dei caratteri (Helvetica, unità 1/1000 di corpo) per 32..126 ----
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const BASE = { à:"a",á:"a",â:"a",ã:"a",ä:"a",å:"a",è:"e",é:"e",ê:"e",ë:"e",ì:"i",í:"i",î:"i",ï:"i",ò:"o",ó:"o",ô:"o",õ:"o",ö:"o",ù:"u",ú:"u",û:"u",ü:"u",ç:"c",ñ:"n",À:"A",Á:"A",Â:"A",Ã:"A",Ä:"A",Å:"A",È:"E",É:"E",Ê:"E",Ë:"E",Ì:"I",Í:"I",Î:"I",Ï:"I",Ò:"O",Ó:"O",Ô:"O",Õ:"O",Ö:"O",Ù:"U",Ú:"U",Û:"U",Ü:"U",Ç:"C",Ñ:"N" };
const EXTRA = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };
const EXTRA_W = { "€": 556, "…": 1000, "‘": 222, "’": 222, "“": 333, "”": 333, "•": 350, "–": 556, "—": 1000 };

function chW(ch, bold) {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return (bold ? W_BLD : W_REG)[c - 32];
  if (EXTRA_W[ch]) return EXTRA_W[ch];
  if (BASE[ch]) return chW(BASE[ch], bold);
  return 556;
}
function textW(s, size, bold) { let w = 0; for (const ch of s) w += chW(ch, bold); return (w * size) / 1000; }
function clean(s) { return String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim(); }
function pdfStr(s) { // stringa letterale PDF in WinAnsi
  const b = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    let v = EXTRA[ch] != null ? EXTRA[ch] : (c >= 32 && c <= 255 ? c : 63);
    if (v === 40 || v === 41 || v === 92) b.push(92);
    b.push(v);
  }
  return Buffer.from(b);
}

// ---- formati dei valori ----
function fmtVal(v, type) {
  if (v == null || v === "") return "";
  if (type === "date") { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v)); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(v); }
  if (type === "money") { const n = Number(v); return isFinite(n) ? n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €" : ""; }
  if (type === "int") { const n = Number(v); return isFinite(n) ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""; }
  return clean(v);
}

function wrap(text, width, size, maxLines) {
  const words = clean(text).split(" ").filter(Boolean), lines = [];
  let cur = "";
  const push = () => { lines.push(cur); cur = ""; };
  for (let w of words) {
    // parola più larga della cella: spezzala
    while (textW(w, size) > width) {
      let k = w.length; while (k > 1 && textW(w.slice(0, k), size) > width) k--;
      if (cur) push();
      cur = w.slice(0, k); w = w.slice(k); push();
    }
    const t = cur ? cur + " " + w : w;
    if (textW(t, size) <= width) cur = t; else { if (cur) push(); cur = w; }
  }
  if (cur || !lines.length) lines.push(cur);
  if (lines.length > maxLines) {
    const l = lines.slice(0, maxLines);
    let last = l[maxLines - 1];
    while (last && textW(last + "…", size) > width) last = last.slice(0, -1);
    l[maxLines - 1] = last.replace(/\s+$/, "") + "…";
    return l;
  }
  return lines;
}

// ---- pagina ----
const PW = 841.89, PH = 595.28, MX = 30, TOP = 40, BOT = 38;
const COL = { brand: [14, 59, 67], accent: [43, 138, 148], ink: [27, 42, 47], mute: [107, 127, 133], zebra: [242, 247, 248], line: [220, 230, 232], white: [1, 1, 1] };
const rg = (c) => c.map((x) => (x > 1 ? (x / 255).toFixed(3) : x)).join(" ");

class Page {
  constructor() { this.ops = []; }
  fill(c) { this.ops.push(rg(c) + " rg"); }
  stroke(c) { this.ops.push(rg(c) + " RG"); }
  rect(x, y, w, h, c) { this.fill(c); this.ops.push(x.toFixed(2) + " " + y.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re f"); }
  line(x1, y1, x2, y2, c, lw) { this.stroke(c); this.ops.push((lw || 0.5) + " w " + x1.toFixed(2) + " " + y1.toFixed(2) + " m " + x2.toFixed(2) + " " + y2.toFixed(2) + " l S"); }
  text(x, y, s, size, bold, c) { if (!s) return; this.fill(c || COL.ink); this.ops.push({ t: s, x, y, size, bold }); }
  textRight(x, y, s, size, bold, c) { this.text(x - textW(s, size, bold), y, s, size, bold, c); }
  textCenter(x, y, s, size, bold, c) { this.text(x - textW(s, size, bold) / 2, y, s, size, bold, c); }
}
function pageStream(p) {
  const parts = [];
  for (const o of p.ops) {
    if (typeof o === "string") parts.push(Buffer.from(o + "\n", "latin1"));
    else parts.push(Buffer.from("BT /" + (o.bold ? "F2" : "F1") + " " + o.size + " Tf " + o.x.toFixed(2) + " " + o.y.toFixed(2) + " Td (", "latin1"), pdfStr(o.t), Buffer.from(") Tj ET\n", "latin1"));
  }
  return Buffer.concat(parts);
}

function buildPdf(o) {
  const sheets = o.sheets, pages = [], starts = [];
  let pg = null, y = 0;
  const newPage = () => { pg = new Page(); pages.push(pg); y = PH - TOP; return pg; };

  sheets.forEach((sh, si) => {
    const cols = sh.columns.map((c, i) => ({ c, i })).filter((x) => !x.c.noPdf);
    const usable = PW - MX * 2, sum = cols.reduce((n, x) => n + (x.c.width || 14), 0);
    const widths = cols.map((x) => ((x.c.width || 14) / sum) * usable);
    const size = cols.length > 11 ? 7 : cols.length > 8 ? 7.6 : 8.4, lh = size * 1.28, padX = 4, padY = 3.4;
    const maxLines = (c) => (c.type === "wrap" ? 6 : 3);
    const alignOf = (c) => (c.type === "money" || c.type === "int" ? "r" : c.type === "date" || c.type === "time" ? "c" : "l");

    const header = () => {
      const hh = lh + padY * 2 + 3;
      pg.rect(MX, y - hh, usable, hh, COL.brand);
      let x = MX;
      cols.forEach((cc, k) => {
        const lines = wrap(cc.c.header, widths[k] - padX * 2, size, 2);
        const ty = y - padY - size + (hh - lines.length * lh - padY) / 2;
        lines.forEach((ln, li) => {
          const yy = y - (hh + lines.length * lh) / 2 + (lines.length - 1 - li) * lh + (lh - size) / 2 + 1;
          const a = alignOf(cc.c);
          if (a === "r") pg.textRight(x + widths[k] - padX, yy, ln, size, true, COL.white);
          else if (a === "c") pg.textCenter(x + widths[k] / 2, yy, ln, size, true, COL.white);
          else pg.text(x + padX, yy, ln, size, true, COL.white);
        });
        x += widths[k];
      });
      y -= hh;
    };

    const n = sh.rows.length;
    if (!n) { starts.push(null); return; } // niente pagina vuota: in copertina compare "nessun dato"
    newPage(); starts.push(pages.length);
    pg.text(MX, y - 14, sh.name, 17, true, COL.brand);
    pg.text(MX, y - 30, (sh.note ? sh.note + " · " : "") + n + (n === 1 ? " riga" : " righe"), 9, false, COL.mute);
    y -= 44;
    header();
    sh.rows.forEach((r, ri) => {
      const cells = cols.map((cc, k) => wrap(fmtVal(r[cc.i], cc.c.type), widths[k] - padX * 2, size, maxLines(cc.c)));
      const nl = Math.max(1, ...cells.map((l) => l.length)), rh = nl * lh + padY * 2;
      if (y - rh < BOT + 4) { newPage(); header(); }
      if (ri % 2) pg.rect(MX, y - rh, usable, rh, COL.zebra);
      let x = MX;
      cols.forEach((cc, k) => {
        const a = alignOf(cc.c);
        cells[k].forEach((ln, li) => {
          const yy = y - padY - size - li * lh + (lh - size) / 2 + 0.6;
          if (a === "r") pg.textRight(x + widths[k] - padX, yy, ln, size, false);
          else if (a === "c") pg.textCenter(x + widths[k] / 2, yy, ln, size, false);
          else pg.text(x + padX, yy, ln, size, false);
        });
        x += widths[k];
      });
      pg.line(MX, y - rh, MX + usable, y - rh, COL.line, 0.4);
      y -= rh;
    });
  });

  // ---- copertina (pagina 1) ----
  const cover = new Page();
  cover.rect(0, PH - 150, PW, 150, COL.brand);
  cover.text(MX + 10, PH - 62, "Esportazione dati", 13, false, [159, 215, 218]);
  cover.text(MX + 10, PH - 100, clean(o.business || "La tua attività"), 28, true, COL.white);
  cover.text(MX + 10, PH - 128, "Generata il " + clean(o.generatedAt || ""), 11, false, [200, 224, 227]);
  let cy = PH - 200;
  cover.text(MX + 10, cy, "Cosa trovi in questo file", 13, true, COL.brand);
  cy -= 14;
  cover.line(MX + 10, cy, PW - MX - 10, cy, COL.line, 0.8);
  sheets.forEach((sh, i) => {
    cy -= 28;
    cover.text(MX + 10, cy, sh.name, 12, true);
    cover.text(MX + 190, cy, clean(sh.note || ""), 10, false, COL.mute);
    cover.textRight(PW - MX - 90, cy, String(sh.rows.length), 12, true, COL.accent);
    cover.textRight(PW - MX - 10, cy, starts[i] == null ? "nessun dato" : "pag. " + (starts[i] + 1), 10, false, COL.mute);
    cy -= 8;
    cover.line(MX + 10, cy, PW - MX - 10, cy, COL.line, 0.4);
  });
  if (o.footer) cover.text(MX + 10, 60, clean(o.footer), 9.5, false, COL.mute);
  pages.unshift(cover);

  // ---- piè di pagina ----
  const total = pages.length;
  pages.forEach((p, i) => {
    if (i > 0) {
      p.line(MX, BOT - 6, PW - MX, BOT - 6, COL.line, 0.5);
      p.text(MX, BOT - 20, clean(o.business || "") + " · Esportazione dati", 8, false, COL.mute);
      p.textRight(PW - MX, BOT - 20, "Pagina " + (i + 1) + " di " + total, 8, false, COL.mute);
    }
  });

  // ---- serializzazione ----
  const objs = []; // Buffer per ogni oggetto, indice = numero-1
  const add = (b) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1")); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>");           // 1
  add("");                                            // 2 (pagine, riempito dopo)
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");       // 3
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");  // 4
  const kids = [];
  pages.forEach((p) => {
    const data = zlib.deflateSync(pageStream(p));
    const cid = add(Buffer.concat([Buffer.from("<< /Length " + data.length + " /Filter /FlateDecode >>\nstream\n", "latin1"), data, Buffer.from("\nendstream", "latin1")]));
    const pid = add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW.toFixed(2) + " " + PH.toFixed(2) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + cid + " 0 R >>");
    kids.push(pid + " 0 R");
  });
  objs[1] = Buffer.from("<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>", "latin1");
  const infoId = add("<< /Title (" + pdfStr("Esportazione dati - " + clean(o.business || "")).toString("latin1") + ") /Producer (Prenolia) >>");

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")], offs = [];
  let pos = chunks[0].length;
  objs.forEach((b, i) => {
    offs.push(pos);
    const head = Buffer.from((i + 1) + " 0 obj\n", "latin1"), tail = Buffer.from("\nendobj\n", "latin1");
    chunks.push(head, b, tail); pos += head.length + b.length + tail.length;
  });
  let xref = "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  offs.forEach((x) => { xref += String(x).padStart(10, "0") + " 00000 n \n"; });
  xref += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R /Info " + infoId + " 0 R >>\nstartxref\n" + pos + "\n%%EOF\n";
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

module.exports = { buildPdf, textW };
