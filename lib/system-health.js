// lib/system-health.js  (Prenolia: regole dei "problemi" della Super Dashboard)
//
// Funzioni pure: ricevono dati gia' letti dal database e restituiscono numeri e problemi.
// Nessuna chiama la rete, cosi' si possono provare con un semplice script (scripts/test-system-health.js).

const DAY = 86400000;

function romeDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(d));
}
// giorni interi tra due date "YYYY-MM-DD" (b - a)
function daysBetween(a, b) {
  const pa = String(a).split("-").map(Number), pb = String(b).split("-").map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / DAY);
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;

// ----- credito AI -----
// balance: saldo scritto da te al momento setAt. costs: [{ at, cost }] costi AI (euro) di quel periodo.
// Il saldo scende da solo: saldo inserito meno la spesa registrata da quel momento.
function creditState(o, now) {
  now = new Date(now || Date.now());
  if (o.balance == null || !o.setAt) return { configured: false };
  const setAt = new Date(o.setAt);
  const costs = (o.costs || []).map((c) => ({ at: new Date(c.at), cost: num(c.cost) }));
  const spent = costs.filter((c) => c.at >= setAt).reduce((s, c) => s + c.cost, 0);
  const remaining = round2(num(o.balance) - spent);
  const win = costs.filter((c) => c.at >= new Date(now.getTime() - 14 * DAY));
  let avg = 0;
  if (win.length) {
    const oldest = Math.min.apply(null, win.map((c) => c.at.getTime()));
    const span = Math.min(14, Math.max(1, Math.ceil((now.getTime() - oldest) / DAY)));
    avg = win.reduce((s, c) => s + c.cost, 0) / span;
  }
  avg = round2(avg);
  let daysLeft = null, runsOutOn = null;
  if (remaining <= 0) { daysLeft = 0; runsOutOn = romeDay(now); }
  else if (avg > 0) { daysLeft = Math.floor(remaining / avg); runsOutOn = romeDay(new Date(now.getTime() + daysLeft * DAY)); }
  return { configured: true, balance: round2(num(o.balance)), set_at: setAt.toISOString(), spent_since: round2(spent), remaining, avg_daily: avg, days_left: daysLeft, runs_out_on: runsOutOn };
}

// ----- email Resend -----
function resendState(o, now) {
  now = new Date(now || Date.now());
  const today = romeDay(now), dom = Number(today.slice(8, 10));
  const dim = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const month = num(o.monthSent), limit = num(o.limitMonth) || 3000, limitDay = num(o.limitDay) || 100;
  const projected = Math.round((month / Math.max(1, dom)) * dim);
  let exhaustOn = null;
  if (month >= limit) exhaustOn = today;
  else if (month > 0) {
    const perDay = month / Math.max(1, dom);
    const dayN = Math.ceil(limit / perDay);
    if (dayN <= dim) exhaustOn = today.slice(0, 8) + String(Math.max(dom, dayN)).padStart(2, "0");
  }
  return { month_sent: month, today_sent: num(o.todaySent), limit_month: limit, limit_day: limitDay, pct: Math.round((month / limit) * 100), projected, exhaust_on: exhaustOn };
}

const itDate = (s) => { const p = String(s).slice(0, 10).split("-").map(Number); return p[2] + "/" + p[1]; };
const inDays = (n) => (n === 0 ? "oggi" : n === 1 ? "domani" : "tra " + n + " giorni");

// ----- elenco dei problemi (per la campanella) -----
// o: { credit, aiDown:[{kind,at}], expiries:[{id,name,note,due_date}], access:[{name,state,grace_ends}],
//      trials:[{name,trial_ends_at}], renewals:[{name,current_period_end}], resend, failedPayments:[{at}], supportNew:[{id,business_name,message,topic}] }
const RANK = { crit: 0, warn: 1, info: 2 };
function buildProblems(o, now) {
  now = new Date(now || Date.now());
  const today = romeDay(now), out = [];
  const add = (severity, key, title, detail, href) => out.push({ severity, key, title, detail: detail || "", href: href || "" });

  const c = o.credit;
  if (c && !c.configured) add("info", "credit_unset", "Imposta il credito AI", "Scrivi il saldo di Anthropic nella pagina Sistema: da lì ti avviso prima che finisca.", "/admin/sistema.html");
  else if (c) {
    if (c.remaining <= 0) add("crit", "credit", "Credito AI esaurito", "Lia smette di rispondere ai clienti. Ricarica da console.anthropic.com, in Billing.", "/admin/sistema.html");
    else if (c.days_left != null && c.days_left <= 3) add("crit", "credit", "Credito AI: " + (c.days_left === 0 ? "finisce oggi" : "circa " + c.days_left + (c.days_left === 1 ? " giorno" : " giorni")), "Restano " + String(c.remaining).replace(".", ",") + " € al ritmo di " + String(c.avg_daily).replace(".", ",") + " € al giorno.", "/admin/sistema.html");
    else if (c.days_left != null && c.days_left <= 7) add("warn", "credit", "Credito AI: circa " + c.days_left + " giorni", "Restano " + String(c.remaining).replace(".", ",") + " € al ritmo di " + String(c.avg_daily).replace(".", ",") + " € al giorno.", "/admin/sistema.html");
  }

  (o.aiDown || []).forEach((a) => {
    const t = { key: "La chiave API di Anthropic non è valida", credit: "Anthropic dice che il credito è finito", model: "Il modello AI configurato non è disponibile" }[a.kind];
    add("crit", "ai_down:" + a.kind, "Lia non riesce a rispondere", (t || "Errore dell'AI") + ". Controlla subito.", "/admin/sistema.html");
  });

  (o.expiries || []).forEach((e) => {
    const d = daysBetween(today, String(e.due_date).slice(0, 10));
    if (d < 0) add("crit", "exp:" + e.id, e.name + " è scaduto", "Scaduto il " + itDate(e.due_date) + (e.note ? " · " + e.note : ""), "/admin/sistema.html");
    else if (d <= 7) add("crit", "exp:" + e.id, e.name + " scade " + inDays(d), "Il " + itDate(e.due_date) + (e.note ? " · " + e.note : ""), "/admin/sistema.html");
    else if (d <= 30) add("warn", "exp:" + e.id, e.name + " scade " + inDays(d), "Il " + itDate(e.due_date) + (e.note ? " · " + e.note : ""), "/admin/sistema.html");
  });

  const r = o.resend;
  if (r) {
    if (r.pct >= 100) add("crit", "resend", "Email Resend esaurite", r.month_sent + " su " + r.limit_month + " questo mese. Le email ai clienti non partono più.", "/admin/sistema.html");
    else if (r.pct >= 80) add("warn", "resend", "Email Resend al " + r.pct + "%", r.month_sent + " su " + r.limit_month + (r.exhaust_on ? ". Di questo passo finiscono il " + itDate(r.exhaust_on) + "." : "."), "/admin/sistema.html");
    else if (r.projected > r.limit_month) add("warn", "resend", "Email Resend: a fine mese sforerai", "Previste circa " + r.projected + " su " + r.limit_month + ".", "/admin/sistema.html");
    if (r.today_sent >= r.limit_day) add("warn", "resend_day", "Limite giornaliero Resend raggiunto", r.today_sent + " email oggi su " + r.limit_day + " consentite.", "/admin/sistema.html");
  }

  const susp = (o.access || []).filter((a) => a.state === "suspended");
  if (susp.length === 1) add("warn", "susp:" + susp[0].id, susp[0].name + " è sospeso", "Per mancato pagamento: Lia e la prenotazione online sono spente.", "/admin/attivita.html?id=" + susp[0].id);
  else if (susp.length > 1) add("warn", "susp", susp.length + " attività sospese", "Per mancato pagamento. Aprile dall'elenco dei clienti per riattivarle.", "/admin/clienti.html");
  (o.access || []).forEach((a) => {
    if (a.state === "grace") add("warn", "grace:" + a.id, a.name + " è in tolleranza", "Scaduto" + (a.grace_ends ? ": ha tempo fino al " + itDate(romeDay(a.grace_ends)) : "") + ". Se non paga viene sospeso.", "/admin/attivita.html?id=" + a.id);
  });
  (o.failedPayments || []).slice(0, 1).forEach(() => add("warn", "pay_failed", "Pagamento non riuscito", "Stripe ha segnalato un pagamento fallito negli ultimi 7 giorni.", "/admin/soldi.html"));
  (o.trials || []).forEach((t) => {
    const d = daysBetween(today, romeDay(t.trial_ends_at));
    if (d >= 0 && d <= 3) add("info", "trial:" + t.id, t.name + ": la prova finisce " + inDays(d), "Se non attiva l'abbonamento entra in tolleranza.", "/admin/attivita.html?id=" + t.id);
  });
  (o.renewals || []).forEach((t) => {
    const d = daysBetween(today, romeDay(t.current_period_end));
    if (d >= 0 && d <= 1) add("info", "ren:" + t.id, t.name + " rinnova " + inDays(d), "Smart, 24,99 €.", "/admin/attivita.html?id=" + t.id);
  });

  // messaggi all'assistenza ancora da leggere (restano finche' non li segni come in corso o fatti)
  const sup = o.supportNew || [];
  if (sup.length) {
    const cut = (t) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > 90 ? t.slice(0, 87) + "…" : t; };
    sup.slice(0, 5).forEach((r) => add("warn", "support:" + r.id, (r.business_name || "Un’attività") + " ti ha scritto", cut(r.message) || (r.topic ? "Argomento: " + r.topic : "Apri la richiesta per leggerla."), "/admin/richieste.html"));
    if (sup.length > 5) add("warn", "support_more", "Altri " + (sup.length - 5) + " messaggi all’assistenza", "Aprili dalla pagina Richieste.", "/admin/richieste.html");
  }

  out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return out;
}

module.exports = { romeDay, daysBetween, creditState, resendState, buildProblems };
