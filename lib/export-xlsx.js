// lib/export-xlsx.js — scrive file Excel (.xlsx) curati, senza dipendenze.
// Un file = un "Riepilogo" + un foglio per ogni tipo di dato. Si apre bene con Excel, Numbers e Fogli Google.
//
// buildXlsx({ title, business, generatedAt, kpis:[{label,value}], sheets:[
//   { name, note, columns:[{ header, type:'text'|'wrap'|'date'|'time'|'money'|'int', width }], rows:[[...]] } ] }) -> Buffer
// Valori: text/wrap = stringa; date = "YYYY-MM-DD"; time = "HH:MM"; money/int = numero (o null/"" = cella vuota).

const { zip } = require("./export.js");

const BRAND = "0E3B43";   // verde petrolio scuro (intestazioni)
const ACCENT = "2B8A94";
const ZEBRA = "F2F7F8";
const LINE = "DCE6E8";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function colName(i) { // 0 -> A
  let s = ""; i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
function safeSheetName(n, used) {
  let s = String(n || "Foglio").replace(/[\\\/\?\*\[\]:]/g, " ").trim().slice(0, 31) || "Foglio";
  let k = 2, base = s;
  while (used.has(s.toLowerCase())) s = base.slice(0, 28) + " " + k++;
  used.add(s.toLowerCase());
  return s;
}
function dateSerial(ymd) { // "2026-10-19" -> numero seriale Excel
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}
function timeFrac(hm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ""));
  return m ? (+m[1] * 60 + +m[2]) / 1440 : null;
}

// ---- stili ----
// indici cellXfs: 0 base | 1 intestazione | 2 titolo | 3 grigio | 4 etichetta | 5 link | 6 numero grande | 7 etichetta kpi
// poi, per ogni tipo e zebra (0/1): 8 + tipo*2 + zebra
const TYPES = ["text", "wrap", "date", "time", "money", "int"];
const DATA0 = 8;
function stylesXml() {
  const numFmts = [[164, "dd/mm/yyyy"], [165, "hh:mm"], [166, '#,##0.00\\ "€"'], [167, "#,##0"]];
  const fonts = [
    '<font><sz val="11"/><color rgb="FF1B2A2F"/><name val="Calibri"/><family val="2"/></font>',                                  // 0 base
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',                              // 1 intestazione
    '<font><b/><sz val="20"/><color rgb="FF' + BRAND + '"/><name val="Calibri"/><family val="2"/></font>',                      // 2 titolo
    '<font><sz val="10"/><color rgb="FF6B7F85"/><name val="Calibri"/><family val="2"/></font>',                                 // 3 grigio
    '<font><b/><sz val="11"/><color rgb="FF1B2A2F"/><name val="Calibri"/><family val="2"/></font>',                             // 4 grassetto
    '<font><u/><sz val="11"/><color rgb="FF' + ACCENT + '"/><name val="Calibri"/><family val="2"/></font>',                     // 5 link
    '<font><b/><sz val="18"/><color rgb="FF' + BRAND + '"/><name val="Calibri"/><family val="2"/></font>',                      // 6 numero grande
  ];
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF' + BRAND + '"/><bgColor indexed="64"/></patternFill></fill>',  // 2 header
    '<fill><patternFill patternType="solid"><fgColor rgb="FF' + ZEBRA + '"/><bgColor indexed="64"/></patternFill></fill>',   // 3 zebra
  ];
  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FF' + LINE + '"/></bottom><diagonal/></border>',
  ];
  const xf = (num, font, fill, border, h, v, wrap, indent) =>
    '<xf numFmtId="' + num + '" fontId="' + font + '" fillId="' + fill + '" borderId="' + border + '" xfId="0"' +
    (num ? ' applyNumberFormat="1"' : "") + ' applyFont="1"' + (fill ? ' applyFill="1"' : "") + (border ? ' applyBorder="1"' : "") + ' applyAlignment="1">' +
    '<alignment horizontal="' + h + '" vertical="' + v + '"' + (wrap ? ' wrapText="1"' : "") + (indent ? ' indent="' + indent + '"' : "") + "/></xf>";
  const xfs = [
    xf(0, 0, 0, 0, "left", "center"),                  // 0
    xf(0, 1, 2, 0, "left", "center", true, 1),         // 1 intestazione
    xf(0, 2, 0, 0, "left", "center"),                  // 2 titolo
    xf(0, 3, 0, 0, "left", "center"),                  // 3 grigio
    xf(0, 4, 0, 1, "left", "center", false, 1),        // 4 etichetta
    xf(0, 5, 0, 1, "left", "center", false, 1),        // 5 link
    xf(167, 6, 0, 1, "right", "center", false, 1),     // 6 numero grande
    xf(0, 0, 0, 1, "left", "center", false, 1),        // 7 testo riga riepilogo
  ];
  const spec = { text: [0, "left", false], wrap: [0, "left", true], date: [164, "center", false], time: [165, "center", false], money: [166, "right", false], int: [167, "right", false] };
  TYPES.forEach((t) => {
    [0, 1].forEach((z) => {
      const s = spec[t];
      xfs.push(xf(s[0], 0, z ? 3 : 0, 1, s[1], s[2] ? "top" : "center", s[2], 1));
    });
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="' + numFmts.length + '">' + numFmts.map((n) => '<numFmt numFmtId="' + n[0] + '" formatCode="' + esc(n[1]) + '"/>').join("") + "</numFmts>" +
    '<fonts count="' + fonts.length + '">' + fonts.join("") + "</fonts>" +
    '<fills count="' + fills.length + '">' + fills.join("") + "</fills>" +
    '<borders count="' + borders.length + '">' + borders.join("") + "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normale" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

function strCell(ref, s, style) {
  const t = String(s == null ? "" : s);
  if (t === "") return '<c r="' + ref + '" s="' + style + '"/>';
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + esc(t) + "</t></is></c>";
}
function numCell(ref, n, style) {
  return n == null || n === "" || !isFinite(n) ? '<c r="' + ref + '" s="' + style + '"/>' : '<c r="' + ref + '" s="' + style + '"><v>' + n + "</v></c>";
}

function dataSheetXml(sh) {
  const cols = sh.columns, nC = cols.length, rows = sh.rows;
  const lastCol = colName(nC - 1), lastRow = rows.length + 1;
  const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
  out.push('<sheetPr><tabColor rgb="FF' + ACCENT + '"/><pageSetUpPr fitToPage="1"/></sheetPr>');
  out.push('<dimension ref="A1:' + lastCol + lastRow + '"/>');
  out.push('<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>');
  out.push('<sheetFormatPr defaultRowHeight="20" customHeight="1"/>');
  out.push("<cols>" + cols.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.width || 16) + '" customWidth="1"/>').join("") + "</cols>");
  out.push("<sheetData>");
  out.push('<row r="1" ht="30" customHeight="1">' + cols.map((c, i) => strCell(colName(i) + "1", c.header, 1)).join("") + "</row>");
  rows.forEach((r, ri) => {
    const rn = ri + 2, z = ri % 2;
    const cells = cols.map((c, i) => {
      const ref = colName(i) + rn, v = r[i], ti = TYPES.indexOf(c.type || "text"), st = DATA0 + (ti < 0 ? 0 : ti) * 2 + z;
      if (c.type === "date") return numCell(ref, dateSerial(v), st);
      if (c.type === "time") return numCell(ref, timeFrac(v), st);
      if (c.type === "money" || c.type === "int") return numCell(ref, v === "" || v == null ? null : Number(v), st);
      return strCell(ref, v, st);
    });
    out.push('<row r="' + rn + '">' + cells.join("") + "</row>");
  });
  out.push("</sheetData>");
  out.push('<autoFilter ref="A1:' + lastCol + lastRow + '"/>');
  out.push('<pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>');
  out.push('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
  out.push('<headerFooter><oddFooter>&amp;L' + esc(sh.name) + '&amp;RPagina &amp;P di &amp;N</oddFooter></headerFooter>');
  out.push("</worksheet>");
  return out.join("");
}

function summarySheetXml(o, sheetNames) {
  const rows = [];
  const r = (n, h, inner) => rows.push('<row r="' + n + '"' + (h ? ' ht="' + h + '" customHeight="1"' : "") + ">" + inner + "</row>");
  let n = 1;
  r(n++, 14, "");
  r(n++, 34, strCell("B2", o.business || "La tua attività", 2));
  r(n++, 20, strCell("B3", "Esportazione dati · " + (o.generatedAt || ""), 3));
  r(n++, 14, "");
  const kpis = o.kpis || [];
  if (kpis.length) {
    // numeri grandi (uno per riga: leggibili anche da telefono)
    kpis.forEach((k) => {
      r(n, 30, strCell("B" + n, k.label, 7) + (typeof k.value === "number" ? numCell("C" + n, k.value, 6) : strCell("C" + n, k.value, 4)));
      n++;
    });
    r(n++, 14, "");
  }
  r(n, 24, strCell("B" + n, "Cosa trovi in questo file", 4) + strCell("C" + n, "", 4) + strCell("D" + n, "", 4));
  n++;
  const links = [];
  o.sheets.forEach((s, i) => {
    const ref = "B" + n;
    r(n, 26, strCell(ref, sheetNames[i], 5) + strCell("C" + n, s.note || "", 7) + numCell("D" + n, s.rows.length, DATA0 + TYPES.indexOf("int") * 2));
    links.push('<hyperlink ref="' + ref + '" location="\'' + sheetNames[i].replace(/'/g, "''") + '\'!A1" display="' + esc(sheetNames[i]) + '"/>');
    n++;
  });
  r(n++, 14, "");
  if (o.footer) { r(n, 20, strCell("B" + n, o.footer, 3)); n++; }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><tabColor rgb="FF' + BRAND + '"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0" tabSelected="1"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="20" customHeight="1"/>' +
    '<cols><col min="1" max="1" width="3" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="56" customWidth="1"/><col min="4" max="4" width="12" customWidth="1"/></cols>' +
    "<sheetData>" + rows.join("") + "</sheetData>" +
    (links.length ? "<hyperlinks>" + links.join("") + "</hyperlinks>" : "") +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';
}

function buildXlsx(o) {
  const used = new Set(["riepilogo"]);
  const names = o.sheets.map((s) => safeSheetName(s.name, used));
  const all = ["Riepilogo"].concat(names);
  const files = [];
  files.push({ name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    all.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + "</Types>" });
  files.push({ name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' });
  files.push({ name: "docProps/core.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(o.title || "Esportazione dati") + "</dc:title><dc:creator>Prenolia</dc:creator><dcterms:created xsi:type=\"dcterms:W3CDTF\">" + new Date().toISOString() + "</dcterms:created></cp:coreProperties>" });
  files.push({ name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
    all.map((n, i) => '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets><definedNames>" +
    names.map((n, i) => '<definedName name="_xlnm._FilterDatabase" localSheetId="' + (i + 1) + '" hidden="1">\'' + n.replace(/'/g, "''") + "'!$A$1:$" + colName(o.sheets[i].columns.length - 1) + "$" + (o.sheets[i].rows.length + 1) + "</definedName>" +
      '<definedName name="_xlnm.Print_Titles" localSheetId="' + (i + 1) + '">\'' + n.replace(/'/g, "''") + "'!$1:$1</definedName>").join("") + "</definedNames></workbook>" });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    all.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId' + (all.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
  files.push({ name: "xl/styles.xml", data: stylesXml() });
  files.push({ name: "xl/worksheets/sheet1.xml", data: summarySheetXml(o, names) });
  o.sheets.forEach((s, i) => files.push({ name: "xl/worksheets/sheet" + (i + 2) + ".xml", data: dataSheetXml(Object.assign({}, s, { name: names[i] })) }));
  return zip(files);
}

module.exports = { buildXlsx };
