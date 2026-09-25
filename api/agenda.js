// api/agenda.js  (Lia: agenda del titolare)
// Un solo file: serve sia la pagina (HTML) sia i dati (JSON).\n// Preview V3: redeploy verificato dopo controllo sintassi server.
// Link di accesso: https://TUO-SITO.vercel.app/api/agenda?t=CODICE_SEGRETO
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY.

const PAGE = require("../lib/agenda-page");

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}

async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method: method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  return { ok: res.ok, status: res.status, data: data };
}

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

function zonedTimeToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

function formatHmInTz(value, tz) {
  return new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));
}

function isFullDayBlock(block, tz) {
  return formatHmInTz(block.starts_at,tz)==="00:00" && formatHmInTz(block.ends_at,tz)==="00:00" && String(block.date) !== new Intl.DateTimeFormat("en-CA",{timeZone:tz}).format(new Date(block.ends_at));
}

function todayStr(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

async function getBusinessByToken(token) {
  if (!/^[a-f0-9]{32,128}$/.test(token)) return null;
  const r = await sb("GET", "businesses?agenda_token=eq." + token + "&active=eq.true&select=id,name,timezone");
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  return r.data[0];
}

// Come getBusinessByToken, ma con anche servizi, risorse e orari (serve per calcolare gli orari liberi)
async function getBusinessFullByToken(token) {
  if (!/^[a-f0-9]{32,128}$/.test(token)) return { __agendaError: "Token agenda non valido" };
  const r = await sb(
    "GET",
    "businesses?agenda_token=eq." + token +
      "&active=eq.true&select=id,name,timezone,services(*),resources(*,opening_hours(*))"
  );
  if (!r.ok) {
    const detail = r.data && typeof r.data === "object"
      ? (r.data.message || r.data.hint || r.data.code || "")
      : String(r.data || "");
    return { __agendaError: "Supabase " + r.status + (detail ? " — " + detail : "") };
  }
  if (!Array.isArray(r.data) || !r.data.length) return null;
  const b = r.data[0];
  b.services = (b.services || []).filter((x) => x.active);
  b.resources = (b.resources || []).filter((x) => x.active);
  return b;
}

function hmToMin(hm) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
function minToHm(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return h + ":" + m;
}
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow; // 1 = lunedì ... 7 = domenica
}
function findService(biz, name) {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return null;
  return (
    biz.services.find((s) => s.name.toLowerCase() === n) ||
    biz.services.find((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase())) ||
    null
  );
}

// Orari liberi per un servizio in un giorno preciso, su tutte le risorse dell'attività.
// (Stessa logica usata dal cervello di Lia in lib/lia.js: il vincolo vero è nel database, questo è solo il calcolo per proporre gli orari.)
const SLOT_STEP_MIN = 15;
const MIN_LEAD_MIN = 15;
async function getBusinessBlocks(businessId, dateStr) {
  const r = await sb("GET", "business_blocks?business_id=eq." + businessId + "&date=eq." + dateStr + "&select=starts_at,ends_at");
  if (r.status === 404) return [];
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura chiusure");
  return r.data;
}

async function freeSlotsFor(biz, service, dateStr) {
  const tz = biz.timezone;
  const dayStart = zonedTimeToUtc(dateStr, "00:00", tz);
  const dayEnd = zonedTimeToUtc(addDays(dateStr, 1), "00:00", tz);
  const wd = weekdayOf(dateStr);
  const ids = biz.resources.map((r) => r.id);
  if (!ids.length) return [];

  const r = await sb(
    "GET",
    "appointments?resource_id=in.(" + ids.join(",") + ")" +
      "&status=eq.confirmed" +
      "&starts_at=lt." + encodeURIComponent(dayEnd.toISOString()) +
      "&blocked_until=gt." + encodeURIComponent(dayStart.toISOString()) +
      "&select=resource_id,starts_at,blocked_until"
  );
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura appuntamenti");
  const blocks = await getBusinessBlocks(biz.id, dateStr);
  const blockedRanges = blocks.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)]).filter((b) => Number.isFinite(b[0]) && Number.isFinite(b[1]));

  const nowMs = Date.now() + MIN_LEAD_MIN * 60000;
  const out = [];
  for (const res of biz.resources) {
    const intervals = (res.opening_hours || [])
      .filter((h) => h.weekday === wd)
      .sort((a, b) => (a.opens < b.opens ? -1 : 1));
    const busy = r.data
      .filter((b) => b.resource_id === res.id)
      .map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until)]);
    for (const h of intervals) {
      let t = hmToMin(h.opens.slice(0, 5));
      const tEnd = hmToMin(h.closes.slice(0, 5));
      while (t + service.duration_min <= tEnd) {
        const label = minToHm(t);
        const startMs = zonedTimeToUtc(dateStr, label, tz).getTime();
        const endMs = startMs + service.duration_min * 60000;
        const blockedMs = endMs + (service.buffer_min || 0) * 60000;
        const free = startMs >= nowMs && !busy.some((b) => startMs < b[1] && blockedMs > b[0]) && !blockedRanges.some((b) => startMs < b[1] && blockedMs > b[0]);
        if (free) out.push({ time: label, resource_id: res.id });
        t += SLOT_STEP_MIN;
      }
    }
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Referrer-Policy", "no-referrer");

  const q = req.query || {};
  const wantsData = req.method === "POST" || q.format === "json" || q.history === "1" || q.slots === "1" || q.settings === "1";

  // 1) La pagina
  if (!wantsData) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(PAGE, "utf8"));
    res.statusCode = 200;
    return res.end(PAGE);
  }

  try {
    // Diagnostica esplicita: una Preview Vercel può avere variabili ambiente diverse dalla Produzione.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      return res.status(503).json({ error: "Preview Vercel senza configurazione Supabase" });
    }

    // 2) I dati: serve il codice segreto
    // Le richieste che servono all'appuntamento manuale hanno bisogno anche di servizi/orari dell'attività
    const needsFull = true; // ora serve sempre: gli orari di apertura servono anche per gli spazi liberi in agenda
    const biz = needsFull
      ? await getBusinessFullByToken(String(q.t || "").trim())
      : await getBusinessByToken(String(q.t || "").trim());
    if (!biz) return res.status(404).json({ error: "Link non valido" });
    if (biz.__agendaError) return res.status(502).json({ error: biz.__agendaError });
    const tz = biz.timezone || "Europe/Rome";

    // Impostazioni reali della dashboard: servizi e orari condivisi con Lia.
    if (q.settings === "1") {
      const resource = biz.resources[0];
      if (!resource) return res.status(400).json({ error: "Nessuna risorsa attiva configurata" });

      if (req.method === "GET") {
        const hours = (resource.opening_hours || []).slice().sort((a,b) => a.weekday - b.weekday || String(a.opens).localeCompare(String(b.opens)));
        return res.status(200).json({
          business: { name: biz.name, timezone: tz },
          services: biz.services.map(s => ({ id:s.id, name:s.name, duration_min:s.duration_min, buffer_min:s.buffer_min || 0, price_eur:s.price_eur, at_customer_place:!!s.at_customer_place })),
          hours: hours.map(h => ({ id:h.id, weekday:h.weekday, opens:String(h.opens).slice(0,5), closes:String(h.closes).slice(0,5) })),
          blocks: await (async function(){
            const br=await sb("GET","business_blocks?business_id=eq."+biz.id+"&date=gte."+todayStr(tz)+"&order=date.asc&select=id,date,starts_at,ends_at");
            if(br.status===404) return [];
            if(!br.ok||!Array.isArray(br.data)) throw new Error("Errore lettura chiusure");
            return br.data.map(b=>({id:b.id,date:b.date,starts_at:b.starts_at,ends_at:b.ends_at,from:formatHmInTz(b.starts_at,tz),to:isFullDayBlock(b,tz)?null:formatHmInTz(b.ends_at,tz),full_day:isFullDayBlock(b,tz)}));
          })()
        });
      }

      const body = req.body || {};
      const action = String(body.action || "");

      if (action === "business_name") {
        const name = String(body.name || "").trim();
        if (!name || name.length > 120) return res.status(400).json({ error:"Nome non valido" });
        const r = await sb("PATCH","businesses?id=eq."+biz.id,{name},"return=representation");
        if (!r.ok) return res.status(500).json({ error:"Errore nel salvataggio del nome" });
        return res.status(200).json({ok:true});
      }

      if (action === "service_create") {
        const name=String(body.name||"").trim(), duration_min=Number(body.duration_min), price_eur=Number(body.price_eur);
        if(!name || !Number.isInteger(duration_min) || duration_min<=0 || !Number.isFinite(price_eur) || price_eur<0) return res.status(400).json({error:"Servizio non valido"});
        const r=await sb("POST","services",{business_id:biz.id,name,duration_min,buffer_min:0,price_eur,at_customer_place:false,active:true},"return=representation");
        if(!r.ok) return res.status(500).json({error:"Errore nel salvataggio del servizio"});
        return res.status(200).json({ok:true});
      }

      if (action === "service_update") {
        const id=String(body.id||""), name=String(body.name||"").trim(), duration_min=Number(body.duration_min), price_eur=Number(body.price_eur);
        if(!/^[0-9a-f-]{36}$/.test(id)||!name||!Number.isInteger(duration_min)||duration_min<=0||!Number.isFinite(price_eur)||price_eur<0) return res.status(400).json({error:"Servizio non valido"});
        const r=await sb("PATCH","services?id=eq."+id+"&business_id=eq."+biz.id,{name,duration_min,price_eur},"return=representation");
        if(!r.ok||!Array.isArray(r.data)||!r.data.length) return res.status(404).json({error:"Servizio non trovato"});
        return res.status(200).json({ok:true});
      }

      if (action === "service_disable") {
        const id=String(body.id||"");
        if(!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({error:"Servizio non valido"});
        const r=await sb("PATCH","services?id=eq."+id+"&business_id=eq."+biz.id,{active:false},"return=representation");
        if(!r.ok||!Array.isArray(r.data)||!r.data.length) return res.status(404).json({error:"Servizio non trovato"});
        return res.status(200).json({ok:true});
      }

      if (action === "block_create") {
        const date=String(body.date||""), from=body.from?String(body.from):"", to=body.to?String(body.to):"";
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(from&&!/^\d{2}:\d{2}$/.test(from))||(to&&!/^\d{2}:\d{2}$/.test(to))||Boolean(from)!==Boolean(to)|| (from&&from>=to)) return res.status(400).json({error:"Chiusura non valida"});
        const starts_at=zonedTimeToUtc(date,from||"00:00",tz).toISOString(), ends_at=zonedTimeToUtc(from?date:addDays(date,1),to||"00:00",tz).toISOString();
        const r=await sb("POST","business_blocks",{business_id:biz.id,date,starts_at,ends_at},"return=representation");
        if(!r.ok) return res.status(500).json({error:"Errore nel salvataggio della chiusura"});
        return res.status(200).json({ok:true});
      }

      if (action === "block_delete") {
        const id=String(body.id||"");
        if(!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({error:"Chiusura non valida"});
        const r=await sb("DELETE","business_blocks?id=eq."+id+"&business_id=eq."+biz.id,null,"return=representation");
        if(!r.ok||!Array.isArray(r.data)||!r.data.length) return res.status(404).json({error:"Chiusura non trovata"});
        return res.status(200).json({ok:true});
      }

      if (action === "hours_replace") {
        const hours=Array.isArray(body.hours)?body.hours:[];
        if(hours.length>28) return res.status(400).json({error:"Troppi intervalli"});
        const clean=[];
        for(const h of hours){
          const weekday=Number(h.weekday), opens=String(h.opens||""), closes=String(h.closes||"");
          if(!Number.isInteger(weekday)||weekday<1||weekday>7||!/^\d{2}:\d{2}$/.test(opens)||!/^\d{2}:\d{2}$/.test(closes)||opens>=closes) return res.status(400).json({error:"Orari non validi"});
          clean.push({resource_id:resource.id,weekday,opens,closes});
        }
        // Conserva una copia degli orari correnti: se il nuovo inserimento fallisce,
        // ripristina automaticamente la configurazione precedente.
        const previous=(resource.opening_hours||[]).map(h=>({resource_id:resource.id,weekday:h.weekday,opens:String(h.opens).slice(0,5),closes:String(h.closes).slice(0,5)}));
        const del=await sb("DELETE","opening_hours?resource_id=eq."+resource.id,null,"return=minimal");
        if(!del.ok) return res.status(500).json({error:"Errore aggiornamento orari"});
        if(clean.length){
          const ins=await sb("POST","opening_hours",clean,"return=representation");
          if(!ins.ok){
            const rollback=previous.length?await sb("POST","opening_hours",previous,"return=minimal"):{ok:true};
            return res.status(500).json({error:rollback.ok?"Errore salvataggio orari: configurazione precedente ripristinata":"Errore salvataggio orari e ripristino automatico fallito. Ricarica le impostazioni prima di modificarle di nuovo."});
          }
        }
        return res.status(200).json({ok:true});
      }

      return res.status(400).json({error:"Azione impostazioni non valida"});
    }

    // Elenco dei servizi e orari liberi, per il pulsante "+"
    if (q.slots === "1") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(q.date || ""))) return res.status(400).json({ error: "Data non valida" });
      const svcList = biz.services.map((s) => ({ name: s.name, duration_min: s.duration_min, price_eur: s.price_eur, at_customer_place: !!s.at_customer_place }));
      if (!q.service) {
        return res.status(200).json({ services: svcList, times: [] });
      }
      const service = findService(biz, String(q.service));
      if (!service) return res.status(404).json({ error: "Servizio non trovato" });
      const today = todayStr(tz);
      if (q.date < today) return res.status(400).json({ error: "Quella data è già passata" });
      const slots = await freeSlotsFor(biz, service, String(q.date));
      const times = Array.from(new Set(slots.map((s) => s.time))).sort();
      return res.status(200).json({ services: svcList, times: times });
    }

    // Annullare un appuntamento, o crearne uno nuovo a mano
    if (req.method === "POST") {
      const body = req.body || {};

      if (body.create) {
        const service = findService(biz, String(body.service_name || ""));
        if (!service) return res.status(400).json({ error: "Servizio non trovato" });
        const dateStr = String(body.date || "");
        const timeStr = String(body.time || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
          return res.status(400).json({ error: "Data o orario non validi" });
        }
        const name = String(body.customer_name || "").trim();
        if (!name) return res.status(400).json({ error: "Serve il nome del cliente" });
        const today = todayStr(tz);
        if (dateStr < today) return res.status(400).json({ error: "Quella data è già passata" });

        const slots = await freeSlotsFor(biz, service, dateStr);
        const candidates = slots.filter((s) => s.time === timeStr);
        if (!candidates.length) return res.status(409).json({ error: "Quell'orario non è più disponibile" });

        const start = zonedTimeToUtc(dateStr, timeStr, tz);
        const end = new Date(start.getTime() + service.duration_min * 60000);
        const blocked = new Date(end.getTime() + (service.buffer_min || 0) * 60000);

        for (const c of candidates) {
          const rc = await sb(
            "POST",
            "appointments",
            {
              business_id: biz.id,
              resource_id: c.resource_id,
              service_id: service.id,
              customer_name: name,
              customer_phone: String(body.customer_phone || "").trim(),
              customer_address: body.address || null,
              notes: body.notes || null,
              channel: "manuale",
              starts_at: start.toISOString(),
              ends_at: end.toISOString(),
              blocked_until: blocked.toISOString(),
            },
            "return=representation"
          );
          if (rc.ok) {
            return res.status(200).json({ ok: true, id: Array.isArray(rc.data) ? rc.data[0].id : null });
          }
          if (rc.status !== 409) return res.status(500).json({ error: "Errore nel salvataggio" });
        }
        return res.status(409).json({ error: "Quell'orario è appena stato preso" });
      }

      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: "Richiesta non valida" });
      const r = await sb(
        "PATCH",
        "appointments?id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed",
        { status: "cancelled" },
        "return=representation"
      );
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return res.status(404).json({ error: "Appuntamento non trovato" });
      return res.status(200).json({ ok: true });
    }

    const today = todayStr(tz);

    // Storico ampio, per la scheda Clienti e quella Statistiche
    if (q.history === "1") {
      const from = addDays(today, -395);
      const to = addDays(today, 7);
      const start = zonedTimeToUtc(from, "00:00", tz);
      const end = zonedTimeToUtc(to, "00:00", tz);
      const rh = await sb(
        "GET",
        "appointments?business_id=eq." + biz.id +
          "&starts_at=gte." + encodeURIComponent(start.toISOString()) +
          "&starts_at=lt." + encodeURIComponent(end.toISOString()) +
          "&order=starts_at.asc" +
          "&select=id,starts_at,ends_at,customer_name,customer_phone,status,channel,services(name,price_eur)"
      );
      if (!rh.ok || !Array.isArray(rh.data)) return res.status(500).json({ error: "Errore nella lettura dello storico" });
      return res.status(200).json({
        business: biz.name,
        timezone: tz,
        appointments: rh.data.map((a) => ({
          id: a.id,
          starts_at: a.starts_at,
          ends_at: a.ends_at,
          customer_name: a.customer_name,
          customer_phone: a.customer_phone,
          status: a.status,
          channel: a.channel,
          service: a.services ? a.services.name : null,
          price_eur: a.services ? a.services.price_eur : null,
        })),
      });
    }

    // Leggere l'agenda
    const rawOffset = parseInt(q.offset || "0", 10);
    const offset = Number.isFinite(rawOffset) ? Math.min(Math.max(rawOffset, -395), 60) : 0;
    const rawDays = parseInt(q.days || "1", 10);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 42) : 1;
    const date = addDays(today, offset);
    const start = zonedTimeToUtc(date, "00:00", tz);
    const end = zonedTimeToUtc(addDays(date, days), "00:00", tz);

    const r = await sb(
      "GET",
      "appointments?business_id=eq." + biz.id +
        "&status=eq.confirmed" +
        "&starts_at=gte." + encodeURIComponent(start.toISOString()) +
        "&starts_at=lt." + encodeURIComponent(end.toISOString()) +
        "&order=starts_at.asc" +
        "&select=id,starts_at,ends_at,customer_name,customer_phone,customer_address,notes,services(name),resources(name)"
    );
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore nella lettura dell'agenda" });

    // Orari di apertura, un giorno alla volta, per calcolare gli spazi liberi in agenda ("+ Aggiungi")
    // Convertiti già in UTC (invece di lasciarli come "09:00" testuale), così il browser del titolare
    // non deve rifare lui la conversione nel fuso dell'attività: userebbe per sbaglio il proprio fuso locale.
    const hoursByDay = {};
    for (let i = 0; i < days; i++) {
      const d = addDays(date, i);
      const wd = weekdayOf(d);
      const res0 = biz.resources[0];
      const iv = (res0 && res0.opening_hours || [])
        .filter((h) => h.weekday === wd)
        .sort((a, b) => (a.opens < b.opens ? -1 : 1))
        .map((h) => ({
          start: zonedTimeToUtc(d, h.opens.slice(0, 5), tz).toISOString(),
          end: zonedTimeToUtc(d, h.closes.slice(0, 5), tz).toISOString(),
        }));
      hoursByDay[d] = iv;
    }

    return res.status(200).json({
      business: biz.name,
      timezone: tz,
      today: today,
      date: date,
      days: days,
      hours: hoursByDay,
      appointments: r.data.map((a) => ({
        id: a.id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        customer_name: a.customer_name,
        customer_phone: a.customer_phone,
        customer_address: a.customer_address,
        notes: a.notes,
        service: a.services ? a.services.name : null,
        resource: a.resources ? a.resources.name : null,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
