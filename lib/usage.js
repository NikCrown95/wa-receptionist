// lib/usage.js  (Lia: registro dei costi AI)
//
// Dopo ogni chiamata a Claude salva quanti token sono stati usati, per quale
// attivita' e su quale canale. La dashboard admin ne ricava costi e margine.
//
// REGOLA D'ORO: registrare i costi non deve MAI rallentare troppo ne' rompere una
// risposta. Errori e ritardi vengono ignorati (si scrive solo un avviso nei log).
//
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY (le stesse di sempre).

const TIMEOUT_MS = 1500;

function headers() {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key; // solo per chiavi vecchie
  return h;
}

const int = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// usage = il campo "usage" della risposta di Anthropic
async function logAiUsage(opts) {
  try {
    const usage = (opts && opts.usage) || null;
    if (!usage || !process.env.SUPABASE_URL) return;
    const row = {
      business_id: opts.businessId || null,
      channel: opts.channel || null,
      model: String(opts.model || "sconosciuto").slice(0, 80),
      input_tokens: int(usage.input_tokens),
      output_tokens: int(usage.output_tokens),
      cache_write_tokens: int(usage.cache_creation_input_tokens),
      cache_read_tokens: int(usage.cache_read_input_tokens),
      source: opts.source || "chat",
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/ai_usage", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(row),
        signal: ctrl.signal,
      });
      if (!res.ok) console.error("Registro costi AI non scritto: HTTP " + res.status);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error("Registro costi AI non riuscito (ignoro):", e && e.message);
  }
}

module.exports = { logAiUsage };
