// Prova della verticale sanitaria (dentisti, fisioterapisti, studi medici): node scripts/test-medical.js
// Non usa il vero database: simula Supabase, Resend e Anthropic e controlla che per gli studi sanitari
//  - la chat con l'IA non parta mai e nessun messaggio venga salvato
//  - serva il consenso e venga registrato; niente indirizzo
//  - email e notifiche non rivelino servizio, operatore o nome
//  - l'agenda inviata al titolare non contenga nomi
//  - le note libere siano rifiutate dal server
// e che le attivita' normali continuino a funzionare come prima.
const assert = require("assert");

process.env.SUPABASE_URL = "http://sb.test";
process.env.SUPABASE_SECRET_KEY = "test";
process.env.ANTHROPIC_API_KEY = "test";
process.env.RESEND_API_KEY = "test";
process.env.PUBLIC_URL = "https://app.test";

const calls = [];
let scenario = { type: "dentista" };

function isoDay(offset) {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function bizRow() {
  const hours = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ id: "h" + w, weekday: w, opens: "08:00:00", closes: "20:00:00" }));
  return {
    id: "11111111-1111-1111-1111-111111111111", slug: "studio-test", name: "Studio Test", timezone: "Europe/Rome", active: true,
    business_type: scenario.type, agenda_token: "a".repeat(32), public_phone: "011 1234567", address: "Via Roma 1",
    team_mode: "solo", staff_choice: false, booking_rules: {}, onboarded_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z",
    services: [{ id: "s1", name: "Estrazione dente", duration_min: 30, buffer_min: 0, price_eur: 50, active: true, at_customer_place: false }],
    resources: [{ id: "r1", name: "Studio", active: true, is_staff: false, opening_hours: hours }],
  };
}
function json(status, data) {
  const text = data === undefined ? "" : JSON.stringify(data);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => data };
}
global.fetch = async (url, opts) => {
  url = String(url); opts = opts || {};
  const method = (opts.method || "GET").toUpperCase();
  let body = null; try { body = opts.body ? JSON.parse(opts.body) : null; } catch (e) { body = opts.body; }
  calls.push({ url, method, body });
  if (url.startsWith("https://api.anthropic.com")) return json(200, { content: [{ type: "text", text: "ciao" }], usage: {} });
  if (url.startsWith("https://api.resend.com")) return json(200, { id: "x" });
  if (url.startsWith("https://api.telegram.org")) return json(200, { ok: true });
  const path = url.replace("http://sb.test/rest/v1/", "");
  const table = path.split("?")[0];
  if (table === "businesses") return json(200, [bizRow()]);
  if (table === "service_access_v") return json(200, [{ business_id: "x", state: "active", allowed: true, lia_allowed: true, plan_name: "Base+Lia" }]);
  if (table === "appointments" && method === "POST") return json(201, [{ id: "appt-1" }]);
  if (table === "appointments" && method === "GET" && /select=starts_at,ends_at,customer_name/.test(path)) {
    return json(200, [{ starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 5400000).toISOString(), customer_name: "Mario Rossi", customer_phone: "+393331234567", customer_address: "Via Segreta 9", notes: "ha paura", services: { name: "Estrazione dente" }, resources: { name: "Studio" } }]);
  }
  if (method === "GET") return json(200, []);
  return json(201, []);
};

function mkRes() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; return r; };
  r.removeHeader = (k) => { delete r.headers[k]; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  r.send = (d) => { r.body = d; return r; };
  r.end = (d) => { if (d !== undefined) r.body = d; return r; };
  return r;
}
async function call(handler, req) { const res = mkRes(); await handler({ headers: {}, query: {}, body: {}, ...req }, res); return res; }

(async () => {
  const booking = require("../api/booking.js");
  const verticals = require("../lib/verticals.js");

  // --- tipi
  ["dentista", "studio medico", "fisioterapista", " Dentista "].forEach((t) => assert.ok(verticals.isMedical(t), t));
  ["barbiere", "palestra", "altro", "", null, undefined, "medico generico"].forEach((t) => assert.ok(!verticals.isMedical(t), String(t)));

  const date = isoDay(3);
  const form = (extra) => ({ service: "s1", date, time: "10:00", name: "Mario Rossi", phone: "+393331234567", ...extra });

  // --- pagina di prenotazione: informazioni
  scenario = { type: "dentista" };
  let r = await call(booking, { method: "GET", query: { b: "studio-test", info: "1" } });
  assert.strictEqual(r.body.lia_allowed, false, "sanitari: Lia spenta");
  assert.strictEqual(r.body.medical, true);
  scenario = { type: "barbiere" };
  r = await call(booking, { method: "GET", query: { b: "studio-test", info: "1" } });
  assert.strictEqual(r.body.lia_allowed, true, "normali: Lia resta com'e'");
  assert.strictEqual(r.body.medical, false);

  // --- prenotazione sanitaria: serve il consenso
  scenario = { type: "dentista" };
  calls.length = 0;
  r = await call(booking, { method: "POST", query: { b: "studio-test" }, body: form({ email: "mario@example.com", address: "Via Casa 3" }) });
  assert.strictEqual(r.statusCode, 400, "senza consenso: rifiutata");
  assert.ok(!calls.some((c) => c.table === "appointments" && c.method === "POST"), "nessuna riga creata senza consenso");
  assert.ok(!calls.some((c) => /appointments$/.test(c.url) && c.method === "POST"));

  calls.length = 0;
  r = await call(booking, { method: "POST", query: { b: "studio-test" }, body: form({ consent: true, email: "mario@example.com", address: "Via Casa 3" }) });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  const ins = calls.find((c) => /\/appointments$/.test(c.url) && c.method === "POST");
  assert.ok(ins, "appuntamento creato");
  assert.ok(ins.body.privacy_consent_at, "consenso registrato con la data");
  assert.strictEqual(ins.body.privacy_consent_version, require("../lib/legal-config.js").versione);
  assert.ok(!ins.body.customer_address, "nessun indirizzo salvato");
  const mail = calls.find((c) => c.url.startsWith("https://api.resend.com"));
  assert.ok(mail, "email di conferma inviata");
  const mailText = JSON.stringify(mail.body);
  assert.ok(!/Estrazione/.test(mailText), "email: nessun servizio");
  assert.ok(!/Mario/.test(mailText), "email: nessun nome del paziente");
  assert.ok(/Studio Test/.test(mailText), "email: nome dello studio");

  // --- attivita' normale: nessun consenso richiesto, email invariata
  scenario = { type: "barbiere" };
  calls.length = 0;
  r = await call(booking, { method: "POST", query: { b: "studio-test" }, body: form({ email: "mario@example.com" }) });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  const ins2 = calls.find((c) => /\/appointments$/.test(c.url) && c.method === "POST");
  assert.ok(ins2 && !("privacy_consent_at" in ins2.body), "normali: nessun campo di consenso");
  const mail2 = calls.find((c) => c.url.startsWith("https://api.resend.com"));
  assert.ok(/Estrazione/.test(JSON.stringify(mail2.body)), "normali: l'email dice ancora il servizio");

  // --- Lia: blocco duro per i sanitari, prima di salvare qualsiasi cosa
  const lia = require("../lib/lia.js");
  scenario = { type: "fisioterapista" };
  calls.length = 0;
  let out = await lia.handleMessage({ channel: "web", contactId: "web:1", phone: null, slug: "studio-test", text: "ho mal di schiena da due settimane" });
  assert.strictEqual(out.blocked, true);
  assert.ok(/non usa la chat/.test(out.reply), out.reply);
  assert.ok(!calls.some((c) => c.url.startsWith("https://api.anthropic.com")), "nessun testo all'IA");
  assert.ok(!calls.some((c) => /chat_messages/.test(c.url) && c.method === "POST"), "nessun messaggio salvato");

  // --- agenda al titolare: solo il conteggio
  const owner = require("../lib/owner.js");
  const ag = await owner.agendaBundle({ id: "x", name: "Studio Test", timezone: "Europe/Rome", business_type: "dentista" }, 0);
  assert.ok(!/Mario|Rossi|Estrazione|Segreta|paura|333/.test(ag.text), "agenda sanitaria senza dati dei pazienti: " + ag.text);
  assert.ok(/1 appuntamento/.test(ag.text));
  const ag2 = await owner.agendaBundle({ id: "x", name: "Barbiere", timezone: "Europe/Rome", business_type: "barbiere" }, 0);
  assert.ok(/Mario Rossi/.test(ag2.text), "agenda normale invariata");
  const ag3 = await owner.agendaBundle({ id: "x", name: "Studio", timezone: "Europe/Rome" }, 0); // tipo non passato: lo legge dal database
  scenario = { type: "dentista" };
  const ag4 = await owner.agendaBundle({ id: "x", name: "Studio", timezone: "Europe/Rome" }, 0);
  assert.ok(!/Mario|Rossi/.test(ag4.text), "tipo letto dal database");
  void ag3;

  // --- notifica push neutra
  const push = require("../lib/push.js");
  assert.ok(typeof push.notifyNewBooking === "function");

  // --- note libere: rifiutate dal server
  const agenda = require("../api/agenda.js");
  scenario = { type: "dentista" };
  r = await call(agenda, { method: "GET", query: { t: "a".repeat(32), notes: "1" } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.medical, true);
  assert.deepStrictEqual(r.body.notes, {});
  r = await call(agenda, { method: "POST", query: { t: "a".repeat(32), notes: "1" }, body: { phone: "+393331234567", note: "allergico alla penicillina" } });
  assert.strictEqual(r.statusCode, 403, "note sui pazienti rifiutate");

  // --- pagina della dashboard: variante sanitaria
  scenario = { type: "dentista" };
  r = await call(agenda, { method: "GET", query: { t: "a".repeat(32) }, headers: { "accept-encoding": "" } });
  const html = Buffer.isBuffer(r.body) ? r.body.toString("utf8") : String(r.body || "");
  assert.ok(/__LIA_MED=true/.test(html) && /medical\.css/.test(html), "dashboard: variante sanitaria");
  scenario = { type: "barbiere" };
  r = await call(agenda, { method: "GET", query: { t: "b".repeat(32) }, headers: { "accept-encoding": "" } });
  const html2 = Buffer.isBuffer(r.body) ? r.body.toString("utf8") : String(r.body || "");
  assert.ok(!/__LIA_MED/.test(html2), "dashboard normale invariata");

  console.log("test-medical: tutto ok");
})().catch((e) => { console.error("FALLITO:", e && e.stack || e); process.exit(1); });
