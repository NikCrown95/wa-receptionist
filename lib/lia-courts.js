// lib/lia-courts.js  (Lia per i circoli e i centri sportivi: prenotazione dei campi in chat)
// Lia controlla gli orari liberi dei campi, chiede quanti giocano e quanti sono soci, ricorda tessera FIT e certificato
// (solo nei circoli affiliati FIT) e prenota. Le regole sono quelle della pagina di prenotazione: stesso codice (lib/courts.js).
// Viene chiamata da lib/lia.js quando l'attivita' e' di tipo "campi".

const courtsLib = require("./courts.js");

const DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const FIT_REMINDER = "Ricorda di portare la tessera FIT e il certificato medico valido di tutti i giocatori.";

function priceText(c) {
  if (c.price_member_eur == null && c.price_guest_eur == null) return "prezzo non indicato";
  const e = (n) => (n == null ? "0" : String(Math.round(n * 100) / 100).replace(".", ",")) + " €";
  return "a testa: soci " + e(c.price_member_eur) + ", non soci " + e(c.price_guest_eur) + " (il totale e' la somma dei prezzi di chi gioca)";
}

const TOOLS = [
  {
    name: "court_availability",
    description: "Controlla gli orari liberi dei campi in un giorno preciso. Usalo SEMPRE prima di proporre orari o di dire che un campo è libero o occupato.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Giorno nel formato AAAA-MM-GG" },
        part_of_day: { type: "string", enum: ["mattina", "pomeriggio", "sera", "tutto"], description: "Fascia della giornata richiesta (sera = dalle 18)" },
        court_name: { type: "string", description: "Solo se il cliente vuole un campo preciso: il suo nome" },
      },
      required: ["date"],
    },
  },
  {
    name: "find_free_days",
    description: "Elenca i prossimi giorni che hanno almeno un campo libero. Usalo quando il cliente non ha detto un giorno preciso o il giorno scelto è pieno.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Facoltativo: parti da questo giorno (AAAA-MM-GG). Se manca, da oggi." },
        part_of_day: { type: "string", enum: ["mattina", "pomeriggio", "sera", "tutto"] },
      },
    },
  },
  {
    name: "book_court",
    description: "Prenota un campo. Usalo solo quando il cliente ha scelto campo, giorno e orario e ti ha detto nome e cognome, quanti giocano e quanti sono soci. Non inventare nessun dato.",
    input_schema: {
      type: "object",
      properties: {
        court_name: { type: "string", description: "Nome del campo, come nell'elenco dei campi" },
        date: { type: "string", description: "AAAA-MM-GG" },
        time: { type: "string", description: "Orario di inizio HH:MM, uno di quelli restituiti da court_availability" },
        customer_name: { type: "string", description: "Nome e cognome di chi prenota (il referente), come li ha scritti il cliente" },
        customer_phone: { type: "string", description: "Numero di telefono scritto dal cliente. Serve solo quando scrive dal sito o da Telegram; su WhatsApp non serve." },
        customer_email: { type: "string", description: "Email, SOLO se l'ha scritta lui in questa conversazione (per mandargli la conferma). Altrimenti non indicarla." },
        players: { type: "integer", description: "Quanti giocatori sono in tutto, chi prenota compreso. Nel tennis e nel padel solo 2 (singolo) o 4 (doppio), mai 1 o 3" },
        members: { type: "integer", description: "Quanti dei giocatori sono soci del circolo (0 se nessuno)" },
        fit_confirmed: { type: "boolean", description: "Solo nei circoli affiliati FIT: true se il cliente ha risposto di sì alla domanda se tutti i giocatori hanno tessera FIT e certificato medico valido. Mai true se non l'ha detto." },
      },
      required: ["court_name", "date", "time", "customer_name", "players", "members"],
    },
  },
];
TOOLS[TOOLS.length - 1].cache_control = { type: "ephemeral" };

function hoursText(hours) {
  const parts = [];
  let i = 1;
  const key = (d) => JSON.stringify((hours && hours[String(d)]) || []);
  while (i <= 7) {
    let j = i;
    while (j < 7 && key(j + 1) === key(i)) j++;
    const rg = (hours && hours[String(i)]) || [];
    const label = i === j ? DAYS[i - 1] : DAYS[i - 1] + "-" + DAYS[j - 1];
    parts.push(label + ": " + (rg.length ? rg.map((r) => r[0] + "-" + r[1]).join(" e ") : "chiuso"));
    i = j + 1;
  }
  return parts.join("; ");
}
const durLabel = (m) => (m < 60 ? m + " minuti" : m === 60 ? "1 ora" : m % 60 === 0 ? m / 60 + " ore" : Math.floor(m / 60) + " ora e " + (m % 60) + " minuti");
const eur = (n) => (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : Number(n).toFixed(2).replace(".", ",")) + " €";

function weekdayName(dateStr) { return DAYS[(new Date(dateStr + "T00:00:00Z").getUTCDay() + 6) % 7]; }

function systemPromptStatic(biz, channel, inf) {
  const club = inf.club, today = inf.today;
  const channelLabel = channel === "whatsapp" ? "WhatsApp" : channel === "telegram" ? "Telegram" : "la chat del sito";
  const days = [];
  for (let i = 0; i < 15; i++) { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + i); const s = d.toISOString().slice(0, 10); days.push(weekdayName(s) + " " + s); }
  const courts = inf.courts.map((c) => "- " + c.name + (c.surface ? " (" + c.surface + (c.indoor ? ", coperto" : "") + ")" : c.indoor ? " (coperto)" : "") + ": slot da " + durLabel(c.slot_min) + ", " + priceText(c) + ". Orari: " + hoursText(c.hours)).join("\n");
  const lim = club.member_daily_limit_min;
  return `Sei Lia, l'assistente virtuale di ${biz.name}, un circolo sportivo. Parli con i clienti su ${channelLabel} e li aiuti a conoscere il circolo e a prenotare un campo. Scrivi in italiano, dando del tu, con tono cordiale e frasi brevi (due o tre righe). Niente elenchi lunghi e niente markdown: testo semplice.

Il cliente ha già letto un messaggio di benvenuto in cui ti presenti: non salutare di nuovo e non ripresentarti. Rispondi subito a ciò che chiede.

Informazioni sul circolo (sono tutte e sole quelle che hai: se ti chiedono altro, dì che non lo sai e rimanda al circolo${biz.public_phone ? " al " + biz.public_phone : ""}):
- Nome: ${biz.name}${biz.address ? "\n- Indirizzo: " + biz.address : ""}${biz.public_phone ? "\n- Telefono: " + biz.public_phone : ""}
- Campi:
${courts}
- Si prenota da oggi fino al ${inf.last_day}.
- ${club.open_to === "members" ? "Prenotano i soci: serve almeno un socio tra i giocatori." : "Possono prenotare sia i soci sia i non soci: comunicalo sempre quando serve."}
- Il pagamento si fa direttamente al circolo, di persona. Non esiste pagamento online.${lim ? "\n- I soci possono prenotare al massimo " + durLabel(lim) + " di campo al giorno." : ""}${club.fit ? "\n- Il circolo è affiliato FIT: per giocare servono la tessera FIT e il certificato medico valido, per tutti i giocatori." : ""}

Giorni di oggi e dei prossimi 14 (usa questa lista per tradurre "domani", "sabato", "venerdì prossimo" in una data):
${days.join("\n")}

Come lavori:
- Prima di proporre orari o dire se un campo è libero, usa SEMPRE court_availability (o find_free_days se non c'è un giorno preciso). Non inventare mai orari, prezzi o disponibilità. Proponi al massimo 4-5 orari, distribuiti nella giornata, e dì che ce ne sono altri se è così.
- Per prenotare ti servono: campo (se sono liberi più campi, proponi quelli liberi e lascia scegliere), giorno e orario, nome e cognome di chi prenota${channel === "whatsapp" ? "" : ", il suo numero di telefono"}, quanti giocatori sono in tutto${""} e quanti di loro sono soci del circolo (chiedilo sempre: se nessuno, 0). Chi prenota è il referente. Chiedi le cose una alla volta o poche insieme, senza fare un interrogatorio.
- L'email è facoltativa: se il cliente vuole la conferma via email, chiedila; altrimenti non insistere.${club.fit ? `
- Prima di prenotare chiedi in modo chiaro: "Tutti i giocatori hanno la tessera FIT e il certificato medico valido?". Se non confermano, NON prenotare e spiega gentilmente che per giocare servono. Passa fit_confirmed=true solo dopo un sì esplicito.
- Dopo ogni prenotazione riuscita scrivi che devono portare tessera FIT e certificato medico valido.` : ""}
- Quando la prenotazione riesce, riepiloga in poche righe: campo, giorno, orario, giocatori e soci, quanto si paga al circolo (se il prezzo è indicato) e che si paga al circolo. Se non hai chiamato book_court con esito ok, NON dire mai che è prenotato.
- Se l'orario è appena stato preso, proponi alternative con court_availability.
- Non puoi annullare né spostare prenotazioni: per questo il cliente deve chiamare il circolo${biz.public_phone ? " al " + biz.public_phone : ""}.
- Se il cliente scrive di cose che non c'entrano con il circolo, rispondi gentilmente che puoi aiutare solo con il circolo e le prenotazioni dei campi.`;
}

function partFilter(times, part) {
  if (part === "mattina") return times.filter((t) => t < "13:00");
  if (part === "pomeriggio") return times.filter((t) => t >= "13:00" && t < "18:00");
  if (part === "sera") return times.filter((t) => t >= "18:00");
  return times;
}
function spread(times, max) {
  if (times.length <= max) return times;
  const out = [];
  for (let i = 0; i < max; i++) out.push(times[Math.round((i * (times.length - 1)) / (max - 1))]);
  return Array.from(new Set(out));
}
function findCourt(courts, name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return { error: "Dimmi quale campo: " + courts.map((c) => c.name).join(", ") + "." };
  let r = courts.filter((c) => c.name.toLowerCase() === n);
  if (!r.length) r = courts.filter((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  if (r.length === 1) return { court: r[0] };
  return { error: r.length ? "Più campi corrispondono: " + r.map((c) => c.name).join(", ") + "." : "Campo non trovato. I campi sono: " + courts.map((c) => c.name).join(", ") + "." };
}

async function runTool(name, input, ctx, deps) {
  const { sb, biz, inf } = ctx;
  try {
    if (name === "court_availability") {
      const date = String(input.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data non valida: usa il formato AAAA-MM-GG." };
      if (date < inf.today || date > inf.last_day) return { error: "Questo giorno non è prenotabile: si prenota da " + inf.today + " fino al " + inf.last_day + "." };
      let courts = inf.courts;
      if (input.court_name) { const f = findCourt(courts, input.court_name); if (f.error) return { error: f.error }; courts = [f.court]; }
      const fd = await courtsLib.freeDay(sb, biz, date);
      if (fd.status !== 200) return { error: fd.body.error || "Non riesco a leggere gli orari." };
      const rows = courts.map((c) => {
        const fc = fd.body.courts.find((x) => x.id === c.id);
        const times = partFilter((fc ? fc.slots : []).map((s) => s.time), input.part_of_day);
        return { campo: c.name, durata: durLabel(c.slot_min), prezzo: priceText(c), orari_liberi: spread(times, 8), totale_orari_liberi: times.length };
      });
      const any = rows.some((r) => r.totale_orari_liberi > 0);
      return { giorno: weekdayName(date) + " " + date, campi: rows, ...(any ? {} : { nessun_orario_libero: true, suggerimento: "Proponi un altro giorno o usa find_free_days." }) };
    }
    if (name === "find_free_days") {
      let from = /^\d{4}-\d{2}-\d{2}$/.test(String(input.from_date || "")) ? input.from_date : inf.today;
      if (from < inf.today) from = inf.today;
      const days = [];
      let d = from, scanned = 0;
      while (d <= inf.last_day && scanned < 10 && days.length < 5) {
        const fd = await courtsLib.freeDay(sb, biz, d);
        if (fd.status === 200) {
          const all = [];
          fd.body.courts.forEach((c) => c.slots.forEach((s) => all.push(s.time)));
          const times = partFilter(Array.from(new Set(all)).sort(), input.part_of_day);
          if (times.length) days.push({ giorno: weekdayName(d) + " " + d, orari_esempio: spread(times, 4), totale: times.length });
        }
        const nx = new Date(d + "T00:00:00Z"); nx.setUTCDate(nx.getUTCDate() + 1); d = nx.toISOString().slice(0, 10); scanned++;
      }
      return days.length ? { giorni_liberi: days } : { nessun_giorno_libero: true, controllato_fino_al: d };
    }
    if (name === "book_court") {
      const f = findCourt(inf.courts, input.court_name); if (f.error) return { error: f.error };
      const court = f.court, lower = ctx.userTexts || [];
      const nameStr = String(input.customer_name || "").trim().replace(/\s+/g, " ");
      const parts = nameStr.split(" ");
      if (parts.length < 2) return { error: "Mi servono nome e cognome di chi prenota. Chiedili al cliente." };
      if (!lower.some((t) => t.includes(parts[0].toLowerCase()))) return { error: "Il nome deve scriverlo il cliente. Chiedi nome e cognome." };
      const first = parts[0], last = parts.slice(1).join(" ");
      let phone = ctx.phone || String(input.customer_phone || "").trim();
      if (!ctx.phone) {
        const digits = (s) => String(s || "").replace(/\D/g, "");
        const p = digits(phone);
        if (!phone) return { error: "Mi serve il numero di telefono di chi prenota. Chiedilo al cliente." };
        if (p.length < 8 || !lower.some((t) => digits(t).includes(p.slice(-8)))) return { error: "Il numero di telefono deve scriverlo il cliente. Chiedilo." };
      } else phone = "+" + String(ctx.phone).replace(/^\+/, "");
      let email = String(input.customer_email || "").trim();
      if (email && !lower.some((t) => t.includes(email.toLowerCase()))) email = "";
      const o = await courtsLib.book(sb, biz, { court_id: court.id, date: input.date, time: input.time, first_name: first, last_name: last, phone, email, players: input.players, members: input.members, fit_ok: input.fit_confirmed === true });
      if (o.status !== 200) {
        const msg = (o.body && o.body.error) || "Non sono riuscito a prenotare.";
        return { error: /non e' disponibile|appena stato preso/.test(msg) ? msg + " Richiama court_availability e proponi alternative." : msg };
      }
      const emailSent = await courtsLib.afterBook(biz, o);
      const b = o.body.booking, m = o._mail;
      return {
        ok: true, campo: b.court, giorno: weekdayName(b.date) + " " + b.date, dalle: b.start, alle: b.end, giocatori: b.players, soci: b.members,
        prezzo_da_pagare_al_circolo: b.price_eur != null ? eur(b.price_eur) : null, pagamento: "al circolo",
        email_di_conferma_inviata: !!emailSent,
        ...(inf.club.fit ? { reminder_obbligatorio: FIT_REMINDER } : {}),
        calendar: { title: b.court + " - " + biz.name, start: m.startsAt.toISOString(), end: m.endsAt.toISOString(), location: String(biz.address || ""), description: "Prenotazione confermata con " + biz.name },
      };
    }
    return { error: "Strumento sconosciuto." };
  } catch (e) {
    console.error("lia-courts " + name + ":", e && e.message);
    return { error: "Errore temporaneo. Riprova tra un attimo." };
  }
}

// Stesso schema di conversa() in lib/lia.js: giri con il modello, esecuzione degli strumenti, reti di sicurezza.
async function conversa(biz, base, messages, deps) {
  const info = await courtsLib.info(deps.sb, biz);
  if (info.status !== 200) return { text: "Scusa, in questo momento non riesco a leggere i campi. Riprova tra poco o chiama il circolo" + (biz.public_phone ? " al " + biz.public_phone : "") + ".", calendar: null };
  const inf = info.body;
  const systemStatic = systemPromptStatic(biz, base.channel, inf);
  const userTexts = messages.filter((m) => m.role === "user" && typeof m.content === "string").map((m) => m.content.toLowerCase());
  const msgs = messages.slice();
  let calendar = null, bookedOk = false, nudged = false;
  for (let i = 0; i < 6; i++) {
    const now = new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: biz.timezone || "Europe/Rome" }).format(new Date());
    const data = await deps.callClaude(systemStatic, "Adesso: " + now + " (Italia).", msgs, TOOLS);
    await deps.logAiUsage({ businessId: biz.id, channel: base.channel, model: data.model || deps.MODEL, usage: data.usage });
    if (data.stop_reason !== "tool_use") {
      let finalText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (!bookedOk && !nudged && finalText && /(ti ho (prenotat|riservat|fissat)|prenotazione (è |e' )?confermat|è tutto confermat|campo (è |e' )?prenotat|ti aspettiamo)/i.test(finalText)) {
        nudged = true;
        console.error("Conferma senza prenotazione salvata (campi, canale " + base.channel + "): correggo il modello");
        msgs.push({ role: "assistant", content: data.content });
        msgs.push({ role: "user", content: "(Messaggio di sistema, non del cliente: NON hai ancora prenotato, book_court non è stata eseguita con successo. Non dire che è confermato. Se hai tutti i dati chiama book_court, altrimenti chiedi quello che manca.)" });
        continue;
      }
      // Rete di sicurezza: nei circoli FIT il promemoria dopo una prenotazione c'e' sempre.
      if (bookedOk && inf.club.fit && finalText && !/tessera|FIT/i.test(finalText)) finalText += "\n\n" + FIT_REMINDER;
      return { text: finalText, calendar };
    }
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const block of data.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(block.name, block.input || {}, { sb: deps.sb, biz, inf, phone: base.phone, userTexts }, deps);
      if (out && out.calendar) calendar = out.calendar;
      if (block.name === "book_court" && out && out.ok === true) bookedOk = true;
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out), is_error: !!out.error });
    }
    msgs.push({ role: "user", content: results });
  }
  return { text: "", calendar };
}

module.exports = { conversa, TOOLS, systemPromptStatic, runTool, FIT_REMINDER };
