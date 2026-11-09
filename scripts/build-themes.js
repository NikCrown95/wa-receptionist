#!/usr/bin/env node
/* Temi extra della dashboard dei personal trainer: "Nero" e "Rosa".
   Il tema scuro di base e' turchese/blu. Qui si genera, dagli stessi file CSS, una copia con i colori rimappati
   (stessa luminosita', quindi stessa leggibilita' del tema scuro, ma altra tinta):
     public/dash/theme-rosa.css   public/dash/theme-nero.css
   La copia mantiene identico l'ordine delle regole, quindi la cascata resta quella del tema scuro.
   I file si caricano solo quando il titolare sceglie quel tema (public/dash/themes.js).
   Va rigenerato a ogni modifica dei CSS: lo fa gia' scripts/bump-assets.js.  Uso: node scripts/build-themes.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public");

/* ---------- colori ---------- */
function hex2rgb(h) { h = h.replace("#", ""); if (h.length <= 4) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
function toHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); } if (h < 0) h += 360; return [h, s, l]; }
function fromHsl(h, s, l) { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; let r, g, b; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
function lum(r, g, b) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
/* stessa luminosita' dell'originale con la nuova tinta */
function sameLum(h, s, targetY) { let lo = 0, hi = 1; for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; const [r, g, b] = fromHsl(h, s, mid); if (lum(r, g, b) < targetY) lo = mid; else hi = mid; } return fromHsl(h, s, (lo + hi) / 2); }

const h2 = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
/* Tinte: turchese/ciano 175-205, blu 205-245. Il verde (<175) e il viola (>245) restano. */
const THEMES = {
  rosa: {
    label: "Rosa", attr: "rosa",
    teal: 336, blue: 306, surfaceSat: 0.30, surfaceHue: 338,
    vars: {
      "--bg": "#0B0709", "--bg2": "#110B0F", "--card": "#170F14", "--card2": "#1E141A", "--line": "#2B1B24", "--line2": "#402835",
      "--ink": "#F8F2F5", "--muted": "#AE9CA6",
      "--accent": "#D63B7C", "--on-accent": "#FFFFFF", "--accent-soft": "#3A1526", "--accent-ink": "#FF8CB8",
      "--accent-grad": "linear-gradient(135deg,#E5508F 0%,#C42E6E 100%)",
      "--sec": "#C58BFF", "--sec-soft": "#2A1840", "--danger": "#FF6B57",
      "--teal": "#FF7FB3", "--teal-soft": "#FFA9CB", "--sel-glow": "rgba(255,127,179,.30)", "--track": "rgba(255,255,255,.12)", "--out": "rgba(248,238,243,.24)",
      "--sx1": "#F0689C", "--sx5": "#C58BFF",
      "--occ-lo": "#9A4468", "--occ-mid": "#D9669A", "--occ-hi": "#FF9CC4",
      "--wk-a-bg": "#4A1E39", "--wk-a-bd": "#C25A8C",
    },
  },
  nero: { label: "Nero", attr: "nero", teal: 40, blue: 40, surfaceSat: 0, surfaceHue: 0, accentSat: 0.55, vars: {} },
};

/* Nero: nero vero e grigi neutri; l'accento si sceglie tra alcune tinte (variabile NERO_ACCENT, di base "oro") */
const NERO_ACCENTS = { oro: [40, 0.58], argento: [215, 0.07], rosso: [355, 0.68] };
function neroVars(name) {
  const [h, sat] = NERO_ACCENTS[name] || NERO_ACCENTS.oro;
  const hx = (rgb) => "#" + rgb.map((v) => h2(Math.round(v))).join("");
  const at = (Y, k) => hx(sameLum(h, Math.min(1, sat * (k || 1)), Y));
  const rgba = (Y, a) => { const c = sameLum(h, sat, Y).map(Math.round); return "rgba(" + c.join(",") + "," + a + ")"; };
  return {
    "--bg": "#050505", "--bg2": "#0B0B0B", "--card": "#121212", "--card2": "#191919", "--line": "#242424", "--line2": "#363636",
    "--ink": "#F5F5F5", "--muted": "#9C9C9C",
    "--accent": at(0.19), "--on-accent": "#FFFFFF", "--accent-soft": hx(fromHsl(h, sat * 0.5, 0.11)), "--accent-ink": at(0.62, 0.9),
    "--accent-grad": "linear-gradient(135deg," + at(0.25) + " 0%," + at(0.15) + " 100%)",
    "--sec": "#D8D8D8", "--sec-soft": "#222222", "--danger": "#FF6B6B",
    "--teal": at(0.50), "--teal-soft": at(0.62), "--sel-glow": rgba(0.50, 0.30), "--track": "rgba(255,255,255,.12)", "--out": "rgba(240,240,240,.24)",
    "--sx1": at(0.40), "--sx5": "#C9C9C9",
    "--occ-lo": at(0.12), "--occ-mid": at(0.34), "--occ-hi": at(0.60),
    "--wk-a-bg": "#2C2C2C", "--wk-a-bd": "#8A8A8A",
  };
}
THEMES.nero.vars = neroVars(process.env.NERO_ACCENT || "oro");
THEMES.nero.accentColor = THEMES.nero.vars["--accent"];

function mapRgb(r, g, b, T) {
  const [h, s, l] = toHsl(r, g, b);
  if (s < 0.05 || h < 175 || h > 245) return null;
  const Y = lum(r, g, b);
  let nh, ns;
  if (s < 0.22 || l < 0.30) { nh = T.surfaceHue; ns = s * T.surfaceSat * (l < 0.30 && s >= 0.22 ? 1 : 1); if (T.surfaceSat === 0) ns = 0; else if (l < 0.30 && s >= 0.22) ns = Math.min(0.5, s) * T.surfaceSat; }
  else { nh = h < 205 ? T.teal : T.blue; ns = T.accentSat != null ? T.accentSat : Math.min(0.9, Math.max(0.58, s * 1.2 + 0.1)); }
  const [nr, ng, nb] = sameLum(nh, ns, Y);
  return [Math.round(nr), Math.round(ng), Math.round(nb)];
}
function mapValue(val, T) {
  /* #rgb / #rrggbb / #rrggbbaa (anche come %23rrggbb dentro i data: URI) */
  val = val.replace(/(#|%23)([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g, (m, p, hx) => {
    const [r, g, b, a] = hex2rgb(hx); const o = mapRgb(r, g, b, T); if (!o) return m;
    return p + h2(o[0]) + h2(o[1]) + h2(o[2]) + (hx.length === 8 || hx.length === 4 ? h2(Math.round(a * 255)) : "");
  });
  /* rgb()/rgba() con virgole o spazi */
  val = val.replace(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(\s*[,/]\s*[\d.%]+)?\s*\)/g, (m, r, g, b, rest) => {
    const o = mapRgb(+r, +g, +b, T); if (!o) return m;
    return (rest ? "rgba(" : "rgb(") + o[0] + "," + o[1] + "," + o[2] + (rest ? "," + rest.replace(/^\s*[,/]\s*/, "") : "") + ")";
  });
  /* hsl() con tinta turchese/blu */
  val = val.replace(/hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%(\s*[,/]\s*[\d.%]+)?\s*\)/g, (m, hh, ss, ll, rest) => {
    const [r, g, b] = fromHsl(+hh, +ss / 100, +ll / 100); const o = mapRgb(r, g, b, T); if (!o) return m;
    return (rest ? "rgba(" : "rgb(") + o[0] + "," + o[1] + "," + o[2] + (rest ? "," + rest.replace(/^\s*[,/]\s*/, "") : "") + ")";
  });
  return val;
}

/* ---------- lettura del CSS ---------- */
function skipString(s, i) { const q = s[i]; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\") i++; i++; } return i + 1; }
function parseBlocks(s) {
  const out = []; let i = 0, start = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "/" && s[i + 1] === "*") { const e = s.indexOf("*/", i + 2); if (e < 0) break; s = s.slice(0, i) + s.slice(e + 2); continue; }
    if (c === '"' || c === "'") { i = skipString(s, i); continue; }
    if (c === "(") { let d = 1; i++; while (i < s.length && d) { if (s[i] === "(") d++; else if (s[i] === ")") d--; else if (s[i] === '"' || s[i] === "'") { i = skipString(s, i); continue; } i++; } continue; }
    if (c === ";" ) { const stmt = s.slice(start, i).trim(); if (stmt) out.push({ stmt }); i++; start = i; continue; }
    if (c === "{") {
      const head = s.slice(start, i).trim(); let d = 1, j = i + 1;
      while (j < s.length && d) { const cj = s[j]; if (cj === "\\") { j += 2; continue; } if (cj === "/" && s[j + 1] === "*") { const e = s.indexOf("*/", j + 2); j = e < 0 ? s.length : e + 2; continue; } if (cj === '"' || cj === "'") { j = skipString(s, j); continue; } if (cj === "(") { let dd = 1; j++; while (j < s.length && dd) { if (s[j] === "(") dd++; else if (s[j] === ")") dd--; else if (s[j] === '"' || s[j] === "'") { j = skipString(s, j); continue; } j++; } continue; } if (cj === "{") d++; else if (cj === "}") d--; j++; }
      out.push({ head, body: s.slice(i + 1, j - 1) }); i = j; start = i; continue;
    }
    i++;
  }
  return out;
}
function splitSel(sel) { const parts = []; let d = 0, cur = ""; for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === "(" || c === "[") d++; else if (c === ")" || c === "]") d--; if (c === "," && d === 0) { parts.push(cur.trim()); cur = ""; } else cur += c; } if (cur.trim()) parts.push(cur.trim()); return parts; }
/* anteprime fisse (le miniature Scuro/Chiaro nelle Impostazioni): non cambiano col tema */
const KEEP = /\.tp-(dark|light|auto)\b/;
const isLight = (s) => /data-theme\s*=\s*["']?light["']?/.test(s);
function retarget(sel, T) { return sel.replace(/data-theme\s*=\s*(["']?)dark\1/g, 'data-theme="' + T.attr + '"'); }

function decls(body, T) {
  /* elenco di dichiarazioni: rimappa i colori; nei blocchi di variabili applica la palette del tema */
  const parts = []; let i = 0, start = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === "\\") { i += 2; continue; }
    if (c === '"' || c === "'") { i = skipString(body, i); continue; }
    if (c === "(") { let d = 1; i++; while (i < body.length && d) { if (body[i] === "(") d++; else if (body[i] === ")") d--; else if (body[i] === '"' || body[i] === "'") { i = skipString(body, i); continue; } i++; } continue; }
    if (c === ";") { parts.push(body.slice(start, i)); i++; start = i; continue; }
    i++;
  }
  if (body.slice(start).trim()) parts.push(body.slice(start));
  return parts.map((p) => {
    const k = p.indexOf(":"); if (k < 0) return p;
    const prop = p.slice(0, k).trim(), val = p.slice(k + 1);
    if (T.vars[prop] !== undefined && /^--/.test(prop) && !/var\(/.test(val)) return prop + ":" + T.vars[prop] + (/!important/.test(val) ? "!important" : "");
    return prop + ":" + mapValue(val, T);
  }).join(";");
}
function walk(blocks, T) {
  let out = "";
  for (const b of blocks) {
    if (b.stmt !== undefined) { if (/^@(import|charset)/.test(b.stmt)) continue; continue; }
    if (b.head.startsWith("@")) {
      if (/^@font-face/.test(b.head)) continue;
      if (/^@(media|supports|layer)/.test(b.head)) { const inner = walk(parseBlocks(b.body), T); if (inner) out += b.head + "{" + inner + "}\n"; continue; }
      if (/^@(-webkit-)?keyframes/.test(b.head)) { const kf = parseBlocks(b.body).map((k) => k.head + "{" + decls(k.body, T) + "}").join(""); out += b.head + "{" + kf + "}\n"; continue; }
      continue;
    }
    const sels = splitSel(b.head).filter((s) => !isLight(s) && !KEEP.test(s)).map((s) => retarget(s, T));
    if (!sels.length) continue;
    out += sels.join(",") + "{" + decls(b.body, T) + "}\n";
  }
  return out;
}

/* ---------- sorgenti, nello stesso ordine in cui la dashboard le carica ---------- */
const FILES = ["gym/members.css", "dash/trainer-members.css", "recap.css", "share.css", "dash/avail.css", "export.css", "dash/app.css", "dash/profile-ref.css", "dash/registry.css", "dash/promos.css"];
function pageStyles() {
  const src = fs.readFileSync(path.join(ROOT, "api", "agenda.js"), "utf8");
  const line = src.split("\n").find((l) => l.startsWith("const PAGE = "));
  const page = vm.runInNewContext(line.replace(/^const PAGE = /, "(") .replace(/;\s*$/, ")"));
  const res = []; page.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (m, css) => { res.push(css); return m; });
  return res;
}
function build() {
  const base = FILES.map((f) => fs.readFileSync(path.join(PUB, f), "utf8"));
  const inline = pageStyles();
  const sources = [base[0], base[1], ...inline, ...base.slice(2)];
  const report = {}, vers = {};
  for (const T of Object.values(THEMES)) {
    let css = "/* generato da scripts/build-themes.js: non modificare a mano */\n";
    for (const s of sources) css += walk(parseBlocks(s), T);
    css += extra(T);
    const file = path.join(PUB, "dash", "theme-" + T.attr + ".css");
    fs.writeFileSync(file, css); report[T.attr] = css.length;
    vers[T.attr] = require("crypto").createHash("sha1").update(css).digest("hex").slice(0, 8);
  }
  const tj = path.join(PUB, "dash", "themes.js"); let t = fs.readFileSync(tj, "utf8");
  t = t.replace(/\.stTp\.tp-nero i:nth-child\(2\)\{background:#[0-9A-Fa-f]{6}\}/, ".stTp.tp-nero i:nth-child(2){background:" + THEMES.nero.accentColor + "}");
  t = t.replace(/var V = \{[^}]*\};/, "var V = { rosa: '" + vers.rosa + "', nero: '" + vers.nero + "' };"); fs.writeFileSync(tj, t);
  return report;
}
/* ritocchi a mano per il tema, applicati dopo la copia */
function extra(T) {
  /* l'icona di Lia e' un'immagine turchese: se ne ruota la tinta (non quella rossa degli avvisi, che ha altro nome file) */
  const target = T.attr === "rosa" ? 336 : (NERO_ACCENTS[process.env.NERO_ACCENT || "oro"] || NERO_ACCENTS.oro)[0];
  const sat = T.attr === "nero" && (NERO_ACCENTS[process.env.NERO_ACCENT || "oro"] || NERO_ACCENTS.oro)[1] < 0.15;
  const f = sat ? "grayscale(1) brightness(1.25)" : "hue-rotate(" + Math.round(target - 190) + "deg) saturate(1.05)";
  return '\nimg[src*="/lia-a.png"]{filter:' + f + '}\n:root{--avc:var(--accent)}\n';
}
if (require.main === module) { const r = build(); console.log("temi generati:", JSON.stringify(r)); }
module.exports = { build, THEMES, mapValue };
