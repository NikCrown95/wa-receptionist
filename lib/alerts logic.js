// lib/alerts_logic.js  (Lia: regole degli allarmi della Super Dashboard)
//
// Funzioni pure: prendono dati gia' letti dal database e restituiscono la lista
// di allarmi da mandare, ciascuno con una "chiave" univoca per il giorno.
// Nessuna di queste funzioni chiama la rete: e' quello che rende facile provarle.

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

const money = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");

// businesses: [{ id, name, plan_name, service_state, grace_ends }]  (dalla vista service_access_v)
function suspensionAlerts(businesses, today) {
  const key = dayKey(today);
  const out = [];
  (businesses || []).forEach((b) => {
    if (b.service_state === 'grace') {
      out.push({
        alert_key: `grace:${b.id}:${key}`, kind: 'grace', business_id: b.id,
        text: `⚠️ ${b.name} è scaduto e ora è in tolleranza${b.grace_ends ? ` fino al ${new Date(b.grace_ends).toLocaleDateString('it-IT')}` : ''}. Se non paga, verrà sospeso.`,
        details: { plan: b.plan_name },
      });
    } else if (b.service_state === 'suspended') {
      out.push({
        alert_key: `suspended:${b.id}:${key}`, kind: 'suspended', business_id: b.id,
        text: `🔴 ${b.name} è stato sospeso per mancato pagamento: Lia e la prenotazione online sono spente per i suoi clienti.`,
        details: { plan: b.plan_name },
      });
    }
  });
  return out;
}

// daily: [{ day: 'YYYY-MM-DD', cost }] ordinato per data crescente, l'ultimo e' "oggi"
// Regola: serve un minimo di storico (7 giorni) e una spesa minima (altrimenti oscilla per nulla).
// Scatta se il giorno costa piu' del doppio della media dei 7 giorni precedenti, con un margine (>= 2 EUR di differenza).
function aiCostSpikeAlert(daily, opts) {
  const minHistoryDays = 7;
  const minEur = (opts && opts.minEur) != null ? opts.minEur : 2;
  const multiplier = (opts && opts.multiplier) != null ? opts.multiplier : 2;
  if (!daily || daily.length < minHistoryDays + 1) return null;
  const sorted = daily.slice().sort((a, b) => (a.day < b.day ? -1 : 1));
  const today = sorted[sorted.length - 1];
  const history = sorted.slice(-1 - minHistoryDays, -1);
  const avg = history.reduce((s, d) => s + d.cost, 0) / history.length;
  if (today.cost < minEur) return null;
  if (avg > 0 && today.cost < avg * multiplier) return null;
  if (avg === 0 && today.cost < minEur * multiplier) return null;
  return {
    alert_key: `ai_cost_spike:${today.day}`, kind: 'ai_cost_spike', business_id: null,
    text: `📈 Il costo AI di oggi è ${money(today.cost)}€, contro una media di ${money(avg)}€ nei 7 giorni prima. Vale la pena controllare la pagina Costi.`,
    details: { today: today.cost, avg },
  };
}

// subs: [{ id, business_id, name, plan_name, status, current_period_end }]
// Avviso il giorno prima della scadenza (una volta sola), per dare il tempo di reagire prima della sospensione.
function upcomingRenewalAlerts(items, today) {
  const key = dayKey(today);
  const tomorrow = dayKey(new Date(new Date(today).getTime() + 86400000));
  const out = [];
  (items || []).forEach((i) => {
    if (i.status !== 'active' || !i.current_period_end) return;
    if (dayKey(i.current_period_end) !== tomorrow) return;
    out.push({
      alert_key: `renewal_due:${i.business_id}:${key}`, kind: 'renewal_due', business_id: i.business_id,
      text: `📅 ${i.name} rinnova domani (${i.plan_name === 'Base+Lia' ? 'Base + Lia' : 'Base'}). Se non paga, tra qualche giorno entra in tolleranza.`,
      details: { plan: i.plan_name },
    });
  });
  return out;
}

function buildAlerts(data, today) {
  const list = []
    .concat(suspensionAlerts(data.businesses, today))
    .concat(upcomingRenewalAlerts(data.subscriptions, today));
  const spike = aiCostSpikeAlert(data.aiDaily, data.spikeOpts);
  if (spike) list.push(spike);
  return list;
}

module.exports = { suspensionAlerts, aiCostSpikeAlert, upcomingRenewalAlerts, buildAlerts, dayKey };
