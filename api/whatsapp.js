// api/whatsapp.js
// Riceve un messaggio WhatsApp da Twilio, lo passa a Claude e risponde.
// Passo A: nessun calendario collegato, orari e servizi sono finti (qui sotto).

// ====== CONFIGURAZIONE DEL NEGOZIO DI PROVA (modificala quando vuoi) ======
const SHOP = {
  nome: "Barbiere Mario",
  orari: "Lunedi-Sabato 9:00-13:00 e 15:00-19:30. Domenica chiuso.",
  servizi: [
    { nome: "Capelli", durata: 30, prezzo: 18 },
    { nome: "Barba", durata: 20, prezzo: 10 },
    { nome: "Capelli + Barba", durata: 45, prezzo: 26 },
  ],
};

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// ====== ISTRUZIONI PER L'AI ======
function systemPrompt() {
  const adesso = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date());

  const servizi = SHOP.servizi
    .map((s) => `- ${s.nome}: ${s.durata} min, ${s.prezzo} euro`)
    .join("\n");

  return `Sei la segretaria virtuale di "${SHOP.nome}" e rispondi ai clienti su WhatsApp.

Data e ora attuali: ${adesso} (Italia).

Orari di apertura: ${SHOP.orari}

Servizi:
${servizi}

Come lavori:
- Scrivi in italiano, messaggi brevi e cordiali, come in una chat WhatsApp (2-3 righe al massimo, niente elenchi lunghi).
- Il tuo compito e' prendere appuntamenti. Ti servono: servizio, giorno, ora e nome del cliente. Chiedi una cosa alla volta.
- Se il cliente chiede un orario fuori dall'apertura, proponi l'orario libero piu' vicino dentro gli orari.
- Quando hai tutti i dati, fai un riepilogo breve e chiedi conferma. Dopo la conferma scrivi che l'appuntamento e' registrato.
- Se chiedono cose che non sai (prezzi non in lista, offerte, ecc.), di' che passi la richiesta al titolare.
- Non inventare informazioni sul negozio.

MODALITA' TEST: il calendario non e' ancora collegato, quindi non puoi controllare la disponibilita' reale. Considera libero ogni orario dentro l'apertura. Alla conferma finale aggiungi "(prenotazione di prova)".`;
}

// ====== STORICO DELLA CONVERSAZIONE (letto da Twilio) ======
async function getHistory(userNumber, shopNumber, currentSid) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const auth = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
    const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

    const get = async (from, to) => {
      const url = `${base}?From=${encodeURIComponent(from)}&To=${encodeURIComponent(to)}&PageSize=10`;
      const r = await fetch(url, { headers: { Authorization: auth } });
      const j = await r.json();
      return j.messages || [];
    };

    const [dalCliente, alCliente] = await Promise.all([
      get(userNumber, shopNumber),
      get(shopNumber, userNumber),
    ]);

    return [...dalCliente, ...alCliente]
      .filter((m) => m.sid !== currentSid && m.body)
      .sort((a, b) => Date.parse(a.date_created) - Date.parse(b.date_created))
      .slice(-12)
      .map((m) => ({
        role: m.from === userNumber ? "user" : "assistant",
        content: m.body,
      }));
  } catch (e) {
    console.error("Errore storico:", e);
    return [];
  }
}

// Claude vuole messaggi che alternano user/assistant e iniziano da user
function normalizza(messaggi) {
  const out = [];
  for (const m of messaggi) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === m.role) {
      ultimo.content += "\n" + m.content;
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rispondi(res, testo) {
  res.setHeader("Content-Type", "text/xml");
  res
    .status(200)
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(testo)}</Message></Response>`
    );
}

// ====== FUNZIONE PRINCIPALE ======
module.exports = async (req, res) => {
  const ERRORE = "Scusa, ho avuto un problema. Riprova tra un attimo.";
  try {
    const { Body, From, To, MessageSid } = req.body || {};
    if (!Body) return rispondi(res, "Non ho ricevuto nessun testo.");

    const storico = await getHistory(From, To, MessageSid);
    const messages = normalizza([...storico, { role: "user", content: Body }]);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt(),
        messages,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Errore Anthropic:", JSON.stringify(data));
      return rispondi(res, ERRORE);
    }

    const testo = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return rispondi(res, testo || ERRORE);
  } catch (e) {
    console.error(e);
    return rispondi(res, ERRORE);
  }
};
