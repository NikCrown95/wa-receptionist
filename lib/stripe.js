// lib/stripe.js — Stripe senza librerie esterne: chiamate REST e verifica della firma dei webhook.
//
// Variabili su Vercel:
//   STRIPE_SECRET_KEY      chiave segreta (sk_test_... in prova, sk_live_... quando sarai in produzione)
//   STRIPE_WEBHOOK_SECRET  segreto del webhook (whsec_...)
//   STRIPE_PRICE_ID        (facoltativa) prezzo mensile creato su Stripe; se manca si usa il prezzo del piano nel database

const crypto = require("crypto");

const API = process.env.STRIPE_API_BASE || "https://api.stripe.com/v1"; // l'indirizzo cambia solo nei test

function configured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Stripe vuole i parametri come form, con le parentesi per gli oggetti annidati: a[b][0][c]=1
function form(obj) {
  const out = [];
  (function walk(prefix, v) {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(prefix + "[" + i + "]", x));
    else if (typeof v === "object") Object.keys(v).forEach((k) => walk(prefix ? prefix + "[" + k + "]" : k, v[k]));
    else out.push(encodeURIComponent(prefix) + "=" + encodeURIComponent(String(v)));
  })("", obj);
  return out.join("&");
}

async function call(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error("Stripe non configurato"), { code: "not_configured" });
  const opts = { method, headers: { Authorization: "Bearer " + key } };
  let url = API + path;
  if (params && method === "GET") url += "?" + form(params);
  else if (params) { opts.body = form(params); opts.headers["Content-Type"] = "application/x-www-form-urlencoded"; }
  const r = await fetch(url, opts);
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!r.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : "Errore Stripe " + r.status;
    throw Object.assign(new Error(msg), { status: r.status, stripe: data && data.error });
  }
  return data;
}

// Verifica l'intestazione "Stripe-Signature" sul testo ESATTO ricevuto (non sul JSON riletto).
// Restituisce true solo se la firma e' valida e recente (5 minuti).
function verifySignature(rawBody, header, secret, toleranceSec, nowSec) {
  if (!rawBody || !header || !secret) return false;
  const parts = String(header).split(",").map((s) => s.trim());
  let t = null;
  const sigs = [];
  parts.forEach((p) => {
    const i = p.indexOf("=");
    if (i < 0) return;
    const k = p.slice(0, i), v = p.slice(i + 1);
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  });
  if (!t || !sigs.length) return false;
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  if (!/^\d+$/.test(t) || Math.abs(now - Number(t)) > (toleranceSec || 300)) return false;
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex");
  const eb = Buffer.from(expected, "utf8");
  return sigs.some((s) => {
    const sb = Buffer.from(s, "utf8");
    return sb.length === eb.length && crypto.timingSafeEqual(sb, eb);
  });
}

module.exports = { configured, call, form, verifySignature };
