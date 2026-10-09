// lib/tgbots.js  (Prenolia: un bot Telegram per ogni attività)
// Variabili su Vercel: TELEGRAM_MANAGER_TOKEN e TELEGRAM_MANAGER_USERNAME (il bot "gestore" di Prenolia),
// più TELEGRAM_WEBHOOK_SECRET (già presente).

const crypto = require("crypto");
const { sb } = require("./owner.js");

const API = "https://api.telegram.org/bot";

function managerToken() { return process.env.TELEGRAM_MANAGER_TOKEN || ""; }
function managerUsername() { return String(process.env.TELEGRAM_MANAGER_USERNAME || "").replace(/^@/, ""); }

// Parola segreta che Telegram rimanda a ogni messaggio: serve a sapere che arriva davvero da lui.
function secretFor(key) {
  const base = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  return crypto.createHmac("sha256", base).update("prenolia:" + key).digest("hex").slice(0, 40);
}

async function tgCall(token, method, payload) {
  try {
    const r = await fetch(API + token + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: "Telegram non raggiungibile" };
  }
}

function hostOf(req) {
  const h = req.headers["x-forwarded-host"] || req.headers.host;
  return "https://" + h;
}

// Username suggerito per il bot dell'attività: prenolia_<nome>_bot (5-32 caratteri, solo lettere/numeri/_)
function suggestUsername(slug, salt) {
  let body = String(slug || "attivita").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!body) body = "attivita";
  const tail = salt ? "_" + salt : "";
  const max = 32 - "prenolia_".length - "_bot".length - tail.length;
  body = body.slice(0, Math.max(3, max)).replace(/_+$/g, "");
  return "prenolia_" + body + tail + "_bot";
}

async function getBotRow(bizId) {
  const r = await sb("GET", "business_bots?business_id=eq." + bizId + "&select=*");
  return r.ok && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
}

async function saveBotRow(bizId, fields) {
  const row = Object.assign({ business_id: bizId, updated_at: new Date().toISOString() }, fields);
  return sb("POST", "business_bots?on_conflict=business_id", row, "resolution=merge-duplicates,return=representation");
}

// Collega un bot (già creato) all'attività: webhook + salvataggio.
async function attachBot(req, bizId, token) {
  const me = await tgCall(token, "getMe", {});
  if (!me.ok || !me.result || !me.result.is_bot) return { ok: false, error: "Questo codice non sembra valido." };
  const hook = await tgCall(token, "setWebhook", {
    url: hostOf(req) + "/api/telegram?b=" + bizId,
    secret_token: secretFor(bizId),
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  if (!hook.ok) return { ok: false, error: "Telegram non ha accettato il collegamento. Riprova tra poco." };
  const saved = await saveBotRow(bizId, { username: me.result.username, token: token, bot_id: me.result.id, pending_username: null });
  if (!saved.ok) return { ok: false, error: "Non riesco a salvare il bot. Riprova." };
  await tgCall(token, "setMyCommands", { commands: [{ command: "start", description: "Inizia" }] });
  return { ok: true, username: me.result.username };
}

// Il bot gestore deve ricevere gli avvisi "bot creato": si imposta da solo, una volta.
async function ensureManagerHook(req) {
  const t = managerToken();
  if (!t) return false;
  const want = hostOf(req) + "/api/telegram?manager=1";
  const info = await tgCall(t, "getWebhookInfo", {});
  if (info.ok && info.result && info.result.url === want) return true;
  const r = await tgCall(t, "setWebhook", { url: want, secret_token: secretFor("manager"), allowed_updates: ["managed_bot", "message"] });
  return !!r.ok;
}

async function claimManagedBot(req, botUser) {
  const t = managerToken();
  if (!t || !botUser || !botUser.id) return { ok: false };
  const uname = String(botUser.username || "").toLowerCase();
  const row = await sb("GET", "business_bots?pending_username=eq." + encodeURIComponent(uname) + "&select=business_id");
  if (!row.ok || !Array.isArray(row.data) || !row.data.length) return { ok: false, error: "nessuna attività in attesa per questo bot" };
  const tk = await tgCall(t, "getManagedBotToken", { user_id: botUser.id });
  if (!tk.ok || !tk.result) return { ok: false, error: "token non disponibile" };
  return attachBot(req, row.data[0].business_id, String(tk.result));
}

module.exports = { managerToken, managerUsername, secretFor, tgCall, hostOf, suggestUsername, getBotRow, saveBotRow, attachBot, ensureManagerHook, claimManagedBot };
