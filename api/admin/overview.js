// api/admin/overview.js
//
// Endpoint per la Super Dashboard Prenolia Admin.
// Legge dati REALI da Supabase (businesses, subscriptions, plans) e
// restituisce numeri gia' aggregati, pronti per KPI e grafici.
//
// NON usa il pacchetto @supabase/supabase-js (non era tra le dipendenze
// del progetto) - parla direttamente con l'API REST di Supabase (PostgREST)
// usando fetch nativo, gia' disponibile in Node su Vercel. Nessuna
// installazione necessaria.
//
// SICUREZZA: usa la SERVICE ROLE KEY di Supabase (bypassa la RLS), quindi
// va chiamato SOLO dal tuo backend/dashboard con una chiave admin nota
// solo a te. Non esporre mai la service key nel browser.
//
// Variabili d'ambiente richieste su Vercel:
//   SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_KEY)
//   ADMIN_API_KEY   <- stringa segreta scelta da te

module.exports = async function handler(req, res) {
  // --- auth minima con header segreto ---
  const adminKey = req.headers['x-admin-key'];
  if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({
      error: 'missing_env_vars',
      detail: 'Mancano le variabili SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY su Vercel.',
      have: {
        SUPABASE_URL: Boolean(SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_KEY),
      },
    });
    return;
  }

  try {
    // select con espansione delle relazioni (sintassi PostgREST, come fa supabase-js)
    const query = 'select=id,status,started_at,cancelled_at,plans(name,price_eur),businesses(name,business_type,active)';
    const restUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/subscriptions?${query}`;

    const resp = await fetch(restUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(500).json({ error: 'supabase_rest_error', status: resp.status, detail: text });
      return;
    }

    const rows = await resp.json();

    // --- costruzione della serie mensile (da primo mese con dati a mese corrente) ---
    const monthKey = (d) => {
      const dt = new Date(d);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    const monthLabelIt = (key) => {
      const [y, m] = key.split('-').map(Number);
      const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
      return `${mesi[m - 1]} ${String(y).slice(2)}`;
    };

    const starts = rows.map((r) => new Date(r.started_at));
    const firstMonth = new Date(Math.min(...starts));
    const now = new Date();

    const months = [];
    let cursor = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cursor <= last) {
      months.push(monthKey(cursor));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }

    const history = months.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const monthEnd = new Date(Date.UTC(y, m, 1));

      const newThisMonth = rows.filter((r) => monthKey(r.started_at) === key).length;
      const lostThisMonth = rows.filter((r) => r.cancelled_at && monthKey(r.cancelled_at) === key).length;

      const activeAtEnd = rows.filter((r) => {
        const started = new Date(r.started_at);
        const cancelled = r.cancelled_at ? new Date(r.cancelled_at) : null;
        return started < monthEnd && (!cancelled || cancelled >= monthEnd) && r.status !== 'trial';
      });

      const mrr = activeAtEnd.reduce((sum, r) => sum + Number((r.plans && r.plans.price_eur) || 0), 0);
      const base = activeAtEnd.filter((r) => r.plans && r.plans.name === 'Base').length;
      const ai = activeAtEnd.filter((r) => r.plans && r.plans.name === 'Base+Lia').length;

      return {
        m: monthLabelIt(key),
        new: newThisMonth,
        lost: lostThisMonth,
        active: activeAtEnd.length,
        mrr: Math.round(mrr * 100) / 100,
        base,
        ai,
      };
    });

    const activeNow = rows.filter((r) => r.status === 'active');
    const trialNow = rows.filter((r) => r.status === 'trial');

    const byType = {};
    activeNow.forEach((r) => {
      const t = (r.businesses && r.businesses.business_type) || 'altro';
      byType[t] = (byType[t] || 0) + 1;
    });

    const planSplit = {
      base: activeNow.filter((r) => r.plans && r.plans.name === 'Base').length,
      ai: activeNow.filter((r) => r.plans && r.plans.name === 'Base+Lia').length,
    };

    res.status(200).json({
      generated_at: new Date().toISOString(),
      history,
      byType,
      planSplit,
      trialCount: trialNow.length,
      totalBusinesses: rows.length,
    });
  } catch (err) {
    console.error('admin/overview error', err);
    res.status(500).json({ error: 'internal_error', detail: String((err && err.message) || err) });
  }
};
