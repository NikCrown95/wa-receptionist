#!/usr/bin/env node
/* Aggiorna il numero di versione (?v=...) dei file statici citati in api/agenda.js
   cosi' i browser scaricano la versione nuova. Da lanciare dopo ogni modifica ai file in public/:
   node scripts/bump-assets.js */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..");
const file = path.join(root, "api", "agenda.js");
let src = fs.readFileSync(file, "utf8"), changed = 0;
src = src.replace(/(["'])(\/(?:dash|gym|campi|estetista|cartomanzia)?\/?[A-Za-z0-9_.\-]+\.(?:js|css))\?v=([A-Za-z0-9]+)\1/g, (m, q, p, v) => {
  const f = path.join(root, "public", p);
  if (!fs.existsSync(f)) return m;
  const h = crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
  if (h !== v) changed++;
  return q + p + "?v=" + h + q;
});
/* le stesse citazioni dentro la pagina (attributi href/src tra virgolette escapate) */
src = src.replace(/(\\")(\/(?:dash|gym|campi|estetista|cartomanzia)?\/?[A-Za-z0-9_.\-]+\.(?:js|css))\?v=([A-Za-z0-9]+)\\"/g, (m, q, p, v) => {
  const f = path.join(root, "public", p);
  if (!fs.existsSync(f)) return m;
  const h = crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
  if (h !== v) changed++;
  return q + p + "?v=" + h + q;
});
fs.writeFileSync(file, src);
console.log(changed ? "aggiornate " + changed + " versioni" : "nessuna versione da aggiornare");
