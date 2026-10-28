// lib/legal.js  (Prenolia: pagine privacy, termini e informativa per i clienti delle attività)
// Il testo è una bozza ben fatta, non una consulenza legale: va fatta rivedere prima del lancio.

const CFG = require("./legal-config.js");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const todo = (label) => '<mark class="todo">[da compilare: ' + esc(label) + "]</mark>";
const val = (v, label) => (v && String(v).trim() ? esc(v) : todo(label));

const CSS = `:root{--bg:#050608;--card:#0E131B;--card2:#161D29;--line:#1C2532;--line2:#2A3648;--ink:#F9F6F0;--muted:#9BA6B5;--accent:#2DD2DC;--accent-ink:#B5F1F5;--todo:#EBCB9F;--todo-bg:rgba(235,203,159,.12);color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg);scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding-inline:20px;padding-block:calc(28px + env(safe-area-inset-top,0px)) calc(56px + env(safe-area-inset-bottom,0px));-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto}
h1,h2,h3,p,ul{margin:0}
.hd{padding-block:12px 24px}
.logo{display:block;width:150px;height:36px;background:url("/brand/prenolia-dark.png") left center/contain no-repeat;margin-bottom:28px}
.eyebrow{font-size:.74rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
h1{margin-top:6px;font-size:clamp(1.7rem,5.5vw,2.3rem);line-height:1.15;letter-spacing:-.03em;text-wrap:balance}
.lead{margin-top:12px;color:var(--muted);font-size:1.04rem;max-width:60ch}
.meta{margin-top:12px;color:var(--muted);font-size:.86rem}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin-block:4px 28px}
.toc a{padding:7px 12px;border-radius:99px;border:1px solid var(--line2);background:var(--card);color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:600}
.toc a:hover,.toc a:focus-visible{color:var(--ink);border-color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:8px}
section{padding-block:26px;border-top:1px solid var(--line);scroll-margin-top:16px}
h2{font-size:1.28rem;letter-spacing:-.02em;margin-bottom:12px;text-wrap:balance}
h3{font-size:1rem;margin-bottom:6px}
p+p,p+ul,ul+p,p+.tw,.tw+p,.cols+p,p+.cols{margin-top:12px}
ul,ol{padding-left:1.2em;margin:0}li+li{margin-top:8px}
li::marker{color:var(--accent)}
.sum{border-top:0;padding:20px;border-radius:20px;background:linear-gradient(160deg,#0f2b34,var(--card));border:1px solid #1e4a58}
.sum h2{font-size:1.1rem}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{padding:16px;border-radius:16px;border:1px solid var(--line2);background:var(--card)}
.box p{color:var(--muted);font-size:.94rem}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:16px;background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:560px}
th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line)}
th{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);background:var(--card2)}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:600;white-space:nowrap}
code{font:.84rem ui-monospace,Menlo,monospace;background:var(--card2);padding:2px 6px;border-radius:6px}
.note{padding:12px 14px;border-left:3px solid var(--accent);background:var(--card);border-radius:0 12px 12px 0;color:var(--muted);font-size:.93rem}
.note b{color:var(--ink)}
a{color:var(--accent-ink)}
mark.todo{background:var(--todo-bg);color:var(--todo);padding:1px 6px;border-radius:6px;font-size:.88em;font-weight:600}
.ft{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}
.ft nav{display:flex;gap:16px;flex-wrap:wrap}
@media(max-width:560px){.cols{grid-template-columns:1fr}td:first-child{white-space:normal}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;

function shell(title, eyebrow, h1, lead, toc, body, extraMeta) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title>
<link rel="icon" type="image/png" sizes="512x512" href="/brand/favicon-512.png?v=2"><link rel="icon" type="image/png" sizes="64x64" href="/brand/favicon.png?v=2">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header class="hd">
  <a class="logo" href="/" aria-label="Prenolia"></a>
  <p class="eyebrow">${esc(eyebrow)}</p>
  <h1>${esc(h1)}</h1>
  <p class="lead">${lead}</p>
  <p class="meta">${extraMeta || ""}Ultimo aggiornamento: ${val(CFG.aggiornato, "data")} · Versione ${val(CFG.versione, "versione")}</p>
</header>
<nav class="toc" aria-label="Indice">${toc.map((t) => '<a href="#' + t[0] + '">' + esc(t[1]) + "</a>").join("")}</nav>
<main>
${body}
</main>
<footer class="ft"><span>© Prenolia</span><nav><a href="/privacy">Privacy e cookie</a><a href="/termini">Termini e responsabile del trattamento</a></nav></footer>
</div>
</body>
</html>`;
}

const PROVIDERS = `<div class="tw"><table>
<thead><tr><th>Fornitore</th><th>A cosa serve</th><th>Dove</th></tr></thead>
<tbody>
<tr><td>Supabase</td><td>Database</td><td>Unione Europea (Irlanda)</td></tr>
<tr><td>Vercel</td><td>Hosting dell'applicazione</td><td>Stati Uniti e Unione Europea</td></tr>
<tr><td>Anthropic</td><td>Intelligenza artificiale di Lia</td><td>Stati Uniti</td></tr>
<tr><td>Twilio e Meta</td><td>Messaggi WhatsApp</td><td>Stati Uniti e Unione Europea</td></tr>
<tr><td>Telegram</td><td>Chat Telegram</td><td>Fuori dall'Unione Europea</td></tr>
<tr><td>Resend</td><td>Email di servizio (accesso, conferme e promemoria degli appuntamenti)</td><td>Stati Uniti</td></tr>
<tr><td>Apple, Google, Mozilla</td><td>Notifiche push sul telefono del titolare</td><td>Stati Uniti</td></tr>
</tbody></table></div>
<p class="note"><b>Trasferimenti fuori dall'Unione Europea.</b> Quando un fornitore ha sede fuori dallo Spazio economico europeo, il trasferimento avviene con le garanzie previste dal GDPR: decisione di adeguatezza (EU-US Data Privacy Framework) o clausole contrattuali standard.</p>`;

const IA = `<ul>
<li>Lia è un assistente virtuale basato su intelligenza artificiale. Le risposte non sono scritte da una persona.</li>
<li>Per rispondere, il testo dei messaggi viene inviato al fornitore del modello (Anthropic), che lo tratta per fornirci il servizio e, secondo i suoi termini commerciali, non lo usa per addestrare i modelli.</li>
<li>Lia non prende decisioni che producono effetti legali sul cliente: propone orari e registra le prenotazioni richieste.</li>
<li>Chi preferisce non usarla può prenotare con "Prenota da solo", oppure contattare direttamente l'attività.</li>
</ul>`;

const DIRITTI = (contact) => `<p>In ogni momento puoi chiedere l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del trattamento, la portabilità e opporti al trattamento basato sul legittimo interesse. Se hai dato un consenso, puoi revocarlo quando vuoi.</p>
<p>${contact} Rispondiamo entro un mese. Se ritieni che il trattamento violi la legge, puoi presentare reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener">garanteprivacy.it</a>).</p>`;

/* ---------------- informativa generale ---------------- */
function privacyPage() {
  const mail = CFG.emailPrivacy && CFG.emailPrivacy.trim() ? '<a href="mailto:' + esc(CFG.emailPrivacy) + '">' + esc(CFG.emailPrivacy) + "</a>" : todo("email privacy");
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li><b>Nessun tracciamento.</b> Non usiamo cookie di profilazione, pubblicità o strumenti di analisi. Per questo non compare nessun banner dei cookie.</li>
    <li><b>I dati dei clienti sono dell'attività.</b> Se prenoti da un'attività, il titolare del trattamento è quell'attività. Prenolia li gestisce per suo conto e non li usa per altri scopi.</li>
    <li><b>Lia è un'intelligenza artificiale.</b> La chat è gestita da un assistente virtuale, non da una persona. Puoi sempre prenotare senza usarla.</li>
    <li><b>Puoi chiedere tutto.</b> Accesso, correzione, cancellazione: scrivi a ${mail}.</li>
  </ul>
</section>

<section id="ruoli">
  <h2>1. Chi è il titolare del trattamento</h2>
  <p>Il servizio coinvolge due tipi di persone e, di conseguenza, due ruoli diversi.</p>
  <div class="cols">
    <div class="box"><h3>Prenolia è titolare</h3><p>Per i dati di chi apre un account: titolari delle attività e loro collaboratori, visitatori del sito. Il titolare è ${val(CFG.ragioneSociale, "ragione sociale")}, ${val(CFG.sede, "sede legale")}, P. IVA ${val(CFG.piva, "partita IVA")}.</p></div>
    <div class="box"><h3>Prenolia è responsabile</h3><p>Per i dati dei clienti che prenotano presso un'attività. Il titolare è l'attività scelta; Prenolia agisce solo su sue istruzioni, ai sensi dell'art. 28 del Regolamento (UE) 2016/679 (GDPR).</p></div>
  </div>
  <p>Se sei cliente di un'attività e vuoi esercitare i tuoi diritti, scrivi prima all'attività: la sua informativa, con i recapiti, è raggiungibile dal link "Informativa privacy" nella pagina di prenotazione. Prenolia la aiuta a rispondere entro i termini di legge.</p>
</section>

<section id="dati">
  <h2>2. Quali dati trattiamo, perché e su quale base</h2>
  <div class="tw"><table>
    <thead><tr><th>Chi</th><th>Dati</th><th>Perché</th><th>Base giuridica</th></tr></thead>
    <tbody>
      <tr><td>Titolari e collaboratori</td><td>Email, password (conservata cifrata), nome dell'attività, indirizzo, telefono, link social, dati dell'abbonamento</td><td>Creare l'account, far funzionare il servizio, assistenza, fatturazione</td><td>Contratto (art. 6.1.b); obblighi fiscali (art. 6.1.c)</td></tr>
      <tr><td>Clienti che prenotano</td><td>Nome, telefono, email (facoltativa), indirizzo (solo per i servizi a domicilio), servizio, data e ora</td><td>Registrare la prenotazione, avvisare l'attività, gestire modifiche e annullamenti, inviare la conferma e il promemoria dell'appuntamento via email (solo se l'email è stata lasciata)</td><td>Esecuzione del contratto o misure precontrattuali richieste dall'interessato (art. 6.1.b)</td></tr>
      <tr><td>Clienti che scrivono a Lia</td><td>Testo dei messaggi, numero di telefono o identificativo Telegram, data e ora</td><td>Rispondere, proporre orari, completare la prenotazione</td><td>Esecuzione del contratto o misure precontrattuali (art. 6.1.b)</td></tr>
      <tr><td>Iscritti alle palestre</td><td>Nome, cognome e telefono; tipo, date e ingressi dell'abbonamento e importo pagato; prenotazioni di lezioni e di Personal, presenze, assenze e annullamenti; date di rilascio e di scadenza del certificato medico sportivo</td><td>Gestire iscrizioni, abbonamenti e prenotazioni della palestra e sapere se l'iscritto può frequentare</td><td>Esecuzione del contratto (art. 6.1.b). Per le date del certificato, il consenso esplicito dell'iscritto o un'altra base prevista dall'art. 9.2 GDPR, a cura della palestra</td></tr>
      <tr><td>Chi affitta una sala (palestre)</td><td>Nome, cognome, telefono, email, giorno e ora prenotati</td><td>Registrare la prenotazione e inviare la conferma, con la possibilità di annullarla</td><td>Esecuzione del contratto (art. 6.1.b)</td></tr>
      <tr><td>Chi prenota un campo (tennis, padel, calcio, pallavolo e altri sport)</td><td>Nome, cognome, telefono, email (facoltativa), campo, giorno e ora, numero dei giocatori e quanti sono soci, importo da pagare al centro, eventuali note scritte da chi prenota</td><td>Registrare la prenotazione del campo, avvisare il centro, inviare la conferma con il link per annullarla, gestire annullamenti e ricordare cosa portare (per esempio tessera federale o certificato medico, se il centro li richiede)</td><td>Esecuzione del contratto o misure precontrattuali richieste dall'interessato (art. 6.1.b)</td></tr>
      <tr><td>Chi usa il sito</td><td>Indirizzo IP e dati tecnici nei registri del server</td><td>Sicurezza, prevenzione di abusi e malfunzionamenti</td><td>Legittimo interesse (art. 6.1.f)</td></tr>
    </tbody>
  </table></div>
  <p class="note"><b>Dati sulla salute.</b> Prenolia non chiede diagnosi, referti o altre informazioni sanitarie. Ti invitiamo a non scrivere allergie, patologie o altri dati sanitari nei messaggi o nelle note: se un trattamento richiede di conoscerli, l'attività li raccoglierà di persona e con le garanzie previste dalla legge.</p>
  <p class="note"><b>Certificato medico nelle palestre.</b> È l'unica eccezione. La palestra può registrare, per ogni iscritto, soltanto la data di rilascio e quella di scadenza del certificato medico sportivo, per sapere se può frequentare. Il certificato non viene caricato né conservato su Prenolia. Il titolare di questo trattamento è la palestra, che prima di registrare le date raccoglie il consenso esplicito dell'iscritto o verifica di avere un'altra base prevista dalla legge (art. 9 GDPR). Il consenso si può revocare in qualsiasi momento.</p>
  <p class="note"><b>Studi sanitari.</b> Per dentisti, fisioterapisti e studi medici Prenolia applica garanzie rafforzate: nessuna intelligenza artificiale, nessun testo libero, consenso esplicito del paziente, email e notifiche senza dettagli sulla visita, conservazione di 12 mesi. Sono descritte nell'<a href="/accordo-sanitari">Accordo per gli studi sanitari</a>.</p>
  <p class="note"><b>Marketing.</b> Non inviamo comunicazioni promozionali ai clienti delle attività. Se in futuro un'attività volesse farlo, servirà un consenso separato e facoltativo, mai legato alla prenotazione.</p>
</section>

<section id="ia">
  <h2>3. Lia e l'intelligenza artificiale</h2>
  ${IA}
</section>

<section id="fornitori">
  <h2>4. A chi comunichiamo i dati</h2>
  <p>Usiamo fornitori selezionati, vincolati da un accordo sul trattamento dei dati. Non vendiamo i dati a nessuno.</p>
  ${PROVIDERS}
</section>

<section id="conservazione">
  <h2>5. Per quanto tempo conserviamo i dati</h2>
  <div class="tw"><table>
    <thead><tr><th>Dati</th><th>Conservazione</th></tr></thead>
    <tbody>
      <tr><td>Account e dati dell'attività</td><td>Finché l'account è attivo; dopo la cancellazione, solo ciò che la legge impone</td></tr>
      <tr><td>Dati di fatturazione</td><td>10 anni, come previsto dalla normativa fiscale</td></tr>
      <tr><td>Prenotazioni e chat dei clienti</td><td>Il tempo necessario a gestire l'appuntamento e gli obblighi di legge, secondo le istruzioni dell'attività; si possono cancellare su richiesta in qualsiasi momento</td></tr>
      <tr><td>Iscritti, abbonamenti e prenotazioni delle palestre</td><td>Finché la palestra li tiene nel proprio elenco: li cancella lei, oppure spariscono con la chiusura dell'account. Le date del certificato medico servono solo finché l'iscritto frequenta e si cancellano a richiesta</td></tr>
      <tr><td>Chi affitta una sala</td><td>Come le prenotazioni dei clienti: il tempo necessario a gestire la prenotazione, secondo le istruzioni della palestra</td></tr>
      <tr><td>Prenotazioni dei campi</td><td>Il tempo necessario a gestire la prenotazione e gli obblighi di legge, secondo le istruzioni del centro sportivo; si possono cancellare su richiesta in qualsiasi momento</td></tr>
      <tr><td>Registri tecnici del server</td><td>Un periodo limitato, stabilito dal fornitore di hosting</td></tr>
    </tbody>
  </table></div>
</section>

<section id="diritti">
  <h2>6. I tuoi diritti</h2>
  ${DIRITTI("Scrivi a " + mail + ".")}
</section>

<section id="cookie">
  <h2>7. Cookie e dati salvati sul dispositivo</h2>
  <p>Prenolia usa solo strumenti tecnici, necessari al funzionamento. Non usa cookie di profilazione, pubblicità o analisi, quindi non serve il tuo consenso e non vedi nessun banner.</p>
  <div class="tw"><table>
    <thead><tr><th>Nome</th><th>Cosa fa</th><th>Durata</th></tr></thead>
    <tbody>
      <tr><td><code>lia_business_session</code></td><td>Cookie di sessione dell'area riservata ai titolari</td><td>12 ore, oppure 30 giorni con "rimani connesso"</td></tr>
      <tr><td><code>lia_cust</code></td><td>Solo se lo scegli: ricorda nome e telefono su questo dispositivo per precompilare la prossima prenotazione</td><td>Finché non lo cancelli</td></tr>
      <tr><td>Chat con Lia</td><td>Conserva i messaggi sul dispositivo per non perdere la conversazione</td><td>Finché non lo cancelli</td></tr>
      <tr><td>Pagina di prenotazione della palestra</td><td>Nome, cognome e telefono dell'iscritto e una copia dei dati della sua tessera (abbonamento, ingressi, scadenza, certificato), per riaprire la pagina più in fretta senza reinserirli</td><td>Finché non li cancelli</td></tr>
      <tr><td>Tema, sezione aperta, preferenze del calendario</td><td>Ricordano le impostazioni di visualizzazione dei titolari</td><td>Finché non le cancelli</td></tr>
    </tbody>
  </table></div>
  <p class="note">Per eliminare i dati salvati su questo dispositivo, cancella i dati del sito dalle impostazioni del browser. Nella pagina di prenotazione, "Cancella" accanto a "Abbiamo ricordato i tuoi dati" fa la stessa cosa per nome e telefono.</p>
</section>

<section id="sicurezza">
  <h2>8. Come proteggiamo i dati</h2>
  <p>Le connessioni sono cifrate (HTTPS), le password sono conservate in forma cifrata, l'area riservata si può proteggere con la verifica in due passaggi e ogni attività vede soltanto i propri dati. Nelle palestre la tessera dell'iscritto si apre solo con nome, cognome e telefono registrati dalla palestra: è bene non comunicarli ad altri. Nessun sistema è sicuro al cento per cento: in caso di violazione dei dati avvisiamo le attività interessate e, se necessario, il Garante entro i termini di legge.</p>
</section>

<section id="contatti">
  <h2>9. Contatti e modifiche</h2>
  <p>Per qualsiasi domanda sui dati personali: ${mail}. Se cambiamo questa informativa in modo rilevante, lo segnaliamo qui e aggiorniamo la data in alto.</p>
</section>`;
  return shell("Privacy e cookie · Prenolia", "Informativa", "Privacy, dati personali e cookie",
    "Come Prenolia e Lia trattano i dati di chi usa il servizio e dei clienti che prenotano. Scritto per essere letto, senza giri di parole.",
    [["brevemente", "In breve"], ["ruoli", "Chi è il titolare"], ["dati", "Quali dati"], ["ia", "Lia e l'intelligenza artificiale"], ["fornitori", "Fornitori"], ["conservazione", "Conservazione"], ["diritti", "I tuoi diritti"], ["cookie", "Cookie"], ["sicurezza", "Sicurezza"], ["contatti", "Contatti"]], body);
}

/* ---------------- termini + nomina a responsabile ---------------- */
function termsPage() {
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li>Prenolia è un servizio per gestire appuntamenti, con prenotazione online e l'assistente Lia.</li>
    <li>Tu resti titolare dei dati dei tuoi clienti: noi li trattiamo solo per fornirti il servizio.</li>
    <li>Ti chiediamo di informare i tuoi clienti: Prenolia genera per te la pagina "Informativa privacy" e la collega alla tua pagina di prenotazione.</li>
  </ul>
</section>

<section id="servizio">
  <h2>1. Il servizio</h2>
  <p>Prenolia (${val(CFG.ragioneSociale, "ragione sociale")}, ${val(CFG.sede, "sede legale")}, P. IVA ${val(CFG.piva, "partita IVA")}) mette a disposizione delle attività una piattaforma per gestire agenda, servizi, orari, chiusure e prenotazioni, con pagina di prenotazione pubblica e, nel piano che la prevede, l'assistente virtuale Lia.</p>
  <p>Creando un account dichiari di avere almeno 18 anni e di agire per la tua attività professionale. Sei responsabile della riservatezza delle tue credenziali.</p>
</section>

<section id="uso">
  <h2>2. Come puoi usarlo</h2>
  <ul>
    <li>Inserisci dati veri e aggiornati, in particolare quelli che compaiono ai clienti (nome, indirizzo, telefono, orari).</li>
    <li>Non usare il servizio per attività illecite, per inviare messaggi indesiderati o per raccogliere dati sulla salute dei clienti. Le uniche eccezioni sono le palestre (sezione 5) e gli studi sanitari, che seguono l'<a href="/accordo-sanitari">Accordo per gli studi sanitari</a>.</li>
    <li>Non cercare di accedere ai dati di altre attività né di compromettere il funzionamento della piattaforma.</li>
    <li>Sei tu a stabilire servizi, prezzi e disponibilità: le prenotazioni dei clienti sono un contratto tra loro e la tua attività.</li>
  </ul>
</section>

<section id="abbonamento">
  <h2>3. Abbonamento, prova e recesso</h2>
  <p>I piani, i prezzi e la durata della prova gratuita sono quelli indicati al momento della scelta nell'area riservata. Puoi chiedere la disdetta in qualsiasi momento dalle Impostazioni: il piano resta attivo fino alla fine del periodo già pagato.</p>
  <p>Se l'abbonamento non viene rinnovato, le nuove prenotazioni online si fermano. I dati restano disponibili per il periodo indicato nell'area riservata, poi sono cancellati come descritto nella sezione 6.</p>
</section>

<section id="responsabilita">
  <h2>4. Responsabilità</h2>
  <p>Facciamo il possibile perché il servizio sia sempre disponibile, ma non possiamo garantire assenza di interruzioni. Lia è un'intelligenza artificiale e può sbagliare: controlla le prenotazioni in agenda. Nei limiti consentiti dalla legge, la responsabilità di Prenolia è limitata ai danni diretti e, in ogni caso, al corrispettivo pagato negli ultimi dodici mesi.</p>
</section>

<section id="dpa">
  <h2>5. Nomina a responsabile del trattamento (art. 28 GDPR)</h2>
  <p>Per i dati personali dei tuoi clienti (nome, telefono, indirizzo, prenotazioni, messaggi di chat e, per le palestre, iscritti, abbonamenti e presenze) tu sei il titolare del trattamento e nomini Prenolia responsabile del trattamento. Accettando questi termini accetti anche questa nomina, che vale per tutta la durata del servizio.</p>
  <h3 style="margin-top:16px">Cosa fa Prenolia</h3>
  <ul>
    <li>Tratta i dati solo per fornire il servizio e secondo le tue istruzioni documentate, che sono le funzioni stesse della piattaforma e le richieste che ci invii.</li>
    <li>Garantisce che le persone autorizzate al trattamento siano vincolate alla riservatezza.</li>
    <li>Adotta misure di sicurezza adeguate: connessioni cifrate, password cifrate, verifica in due passaggi per l'area riservata, separazione dei dati tra attività.</li>
    <li>Può avvalersi di altri responsabili (sub-responsabili) elencati nella pagina <a href="/privacy#fornitori">Privacy e cookie</a>, con i quali ha un accordo equivalente. Ti avvisiamo di eventuali cambiamenti rilevanti e puoi opporti.</li>
    <li>Ti assiste nel rispondere alle richieste dei tuoi clienti (accesso, rettifica, cancellazione) e negli obblighi di sicurezza e di notifica.</li>
    <li>Ti avvisa senza ingiustificato ritardo, e comunque entro 48 ore da quando ne ha conoscenza, di una violazione dei dati personali.</li>
    <li>Al termine del servizio cancella i dati o te li restituisce, a tua scelta, salvo obblighi di legge.</li>
    <li>Mette a disposizione le informazioni necessarie a dimostrare il rispetto di questi obblighi e consente verifiche ragionevoli.</li>
  </ul>
  <h3 style="margin-top:16px">Cosa fai tu come titolare</h3>
  <ul>
    <li>Informi i tuoi clienti: la pagina "Informativa privacy" generata da Prenolia è collegata alla tua pagina di prenotazione. Completa nelle Impostazioni i dati della tua attività (ragione sociale, partita IVA, email per la privacy) perché compaiano correttamente.</li>
    <li>Raccogli solo i dati necessari e non inserisci dati sulla salute o altre categorie particolari di dati. L'unica eccezione, per le palestre, è il caso descritto qui sotto.</li>
    <li>Se vuoi usare i dati dei clienti per promozioni, ottieni prima un consenso separato e facoltativo: Prenolia non lo fa per te.</li>
    <li>Rispondi alle richieste di accesso e cancellazione dei tuoi clienti; noi ti aiutiamo a farlo.</li>
  </ul>
  <h3 style="margin-top:16px">Se gestisci una palestra</h3>
  <ul>
    <li>Per ogni iscritto registri soltanto la data di rilascio e quella di scadenza del certificato medico sportivo. Non carichi il certificato, non inserisci diagnosi, referti o altre informazioni sanitarie, nemmeno nelle note.</li>
    <li>Prima di registrare quelle date raccogli il consenso esplicito dell'iscritto (art. 9.2.a GDPR) o verifichi di avere un'altra base prevista dalla legge. Se l'iscritto revoca il consenso o chiede la cancellazione, elimini le date (e l'iscritto, se lo chiede).</li>
    <li>Se tra gli iscritti ci sono minorenni, i dati sono forniti, e il consenso è dato, da chi esercita la responsabilità genitoriale.</li>
    <li>Decidi tu per quanto tempo tenere gli iscritti che non rinnovano e cancelli quelli che non ti servono più: Prenolia non lo fa in automatico.</li>
    <li>Conservi l'eventuale certificato, cartaceo o digitale, fuori da Prenolia e con le tue misure di sicurezza.</li>
    <li>Sei titolare anche dei dati di chi affitta la sala (nome, cognome, telefono, email): valgono le stesse regole delle prenotazioni dei clienti.</li>
    <li>Per l'informativa agli iscritti usi la pagina "Informativa privacy" generata da Prenolia per la tua palestra, collegata alla pagina di prenotazione.</li>
  </ul>
  <h3 style="margin-top:16px">Se gestisci un centro sportivo con campi</h3>
  <ul>
    <li>Vale per ogni sport: tennis, padel, calcio e calcetto, pallavolo, basket e gli altri che aggiungerai. Le regole sono le stesse, cambia solo il nome del campo.</li>
    <li>Registri soltanto nome, cognome, telefono ed eventualmente email di chi prenota, il numero dei giocatori e quanti sono soci. Non chiedi i dati degli altri giocatori e non inserisci informazioni sanitarie, nemmeno nelle note.</li>
    <li>Se richiedi la tessera federale o il certificato medico, lo comunichi ai giocatori come promemoria: Prenolia non raccoglie né conserva né le tessere né i certificati, e non registra le date di scadenza. Il controllo, se lo fai, lo fai di persona al campo.</li>
    <li>Se tra i giocatori ci sono minorenni, la prenotazione è fatta da un maggiorenne, che risponde per loro. Se vuoi trattare dati dei minorenni, per esempio per corsi o scuole sport, ne rispondi tu come titolare con il consenso di chi esercita la responsabilità genitoriale.</li>
    <li>I pagamenti dei campi avvengono presso il centro: Prenolia mostra l'importo ma non incassa e non conserva dati di pagamento dei giocatori.</li>
    <li>Per l'informativa a chi prenota usi la pagina "Informativa privacy" generata da Prenolia per il tuo centro, collegata alla pagina di prenotazione dei campi.</li>
  </ul>
  <p class="note"><b>Natura dei dati e durata.</b> Dati comuni di contatto e prenotazione dei clienti finali e, per le palestre, di abbonamento e presenza. Per le sole palestre, le date del certificato medico sportivo, che sono un dato relativo alla salute (art. 9 GDPR). Il trattamento dura quanto il servizio e fino alla cancellazione secondo la sezione 6.</p>
</section>

<section id="cancellazione">
  <h2>6. Cancellazione dei dati</h2>
  <p>Se chiudi l'account, i dati della tua attività e dei tuoi clienti sono cancellati, tranne ciò che dobbiamo conservare per legge (per esempio i dati di fatturazione). Puoi chiedere la cancellazione anticipata scrivendo a ${CFG.emailPrivacy && CFG.emailPrivacy.trim() ? '<a href="mailto:' + esc(CFG.emailPrivacy) + '">' + esc(CFG.emailPrivacy) + "</a>" : todo("email privacy")}.</p>
</section>

<section id="legge">
  <h2>7. Legge applicabile e modifiche</h2>
  <p>Questi termini sono regolati dalla legge italiana. Per le controversie con chi agisce per scopi professionali è competente il Foro di ${val(CFG.foro, "foro competente")}. Se li modifichiamo in modo rilevante ti avvisiamo prima nell'area riservata o per email.</p>
</section>`;
  return shell("Termini e responsabile del trattamento · Prenolia", "Termini", "Termini di servizio e nomina a responsabile del trattamento",
    "Le regole del servizio per le attività che usano Prenolia e gli impegni reciproci sulla gestione dei dati dei clienti.",
    [["brevemente", "In breve"], ["servizio", "Il servizio"], ["uso", "Come usarlo"], ["abbonamento", "Abbonamento"], ["responsabilita", "Responsabilità"], ["dpa", "Responsabile del trattamento"], ["cancellazione", "Cancellazione"], ["legge", "Legge"]], body);
}

/* ---------------- informativa per i clienti di una attività ---------------- */
function customerPage(biz) {
  if (require("./verticals.js").areaOf(biz.business_type) === "palestra") return gymCustomerPage(biz);
  if (require("./verticals.js").areaOf(biz.business_type) === "campi") return courtsCustomerPage(biz);
  if (require("./verticals.js").isMedical(biz.business_type)) return medicalCustomerPage(biz);
  const name = biz.name || "l'attività";
  const titolare = biz.legal_name && biz.legal_name.trim() ? biz.legal_name : name;
  const contactBits = [];
  if (biz.privacy_email && biz.privacy_email.trim()) contactBits.push('email <a href="mailto:' + esc(biz.privacy_email) + '">' + esc(biz.privacy_email) + "</a>");
  if (biz.public_phone && String(biz.public_phone).trim()) contactBits.push("telefono " + esc(biz.public_phone));
  const contact = contactBits.length ? contactBits.join(", ") : "i recapiti indicati nella pagina di prenotazione";
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li><b>${esc(name)}</b> usa i tuoi dati solo per gestire la tua prenotazione.</li>
    <li>Ti chiediamo nome e telefono (e l'indirizzo solo per i servizi a domicilio): senza, non possiamo registrare l'appuntamento.</li>
    <li>Nessuna pubblicità e nessuna comunicazione promozionale legata alla prenotazione.</li>
    <li>Puoi chiedere accesso, correzione o cancellazione dei tuoi dati in qualsiasi momento.</li>
  </ul>
</section>

<section id="titolare">
  <h2>1. Chi tratta i tuoi dati</h2>
  <p><b>Titolare del trattamento:</b> ${esc(titolare)}${biz.address ? ", " + esc(biz.address) : ""}${biz.vat_number && biz.vat_number.trim() ? ", P. IVA " + esc(biz.vat_number) : ""}.</p>
  <p><b>Contatti per la privacy:</b> ${contact}.</p>
  <p><b>Responsabile del trattamento:</b> Prenolia (${val(CFG.ragioneSociale, "ragione sociale")}), che fornisce la piattaforma di prenotazione e agisce solo su istruzioni di ${esc(name)}.</p>
</section>

<section id="dati">
  <h2>2. Quali dati e perché</h2>
  <div class="tw"><table>
    <thead><tr><th>Dati</th><th>Perché</th><th>Base giuridica</th></tr></thead>
    <tbody>
      <tr><td>Nome e telefono</td><td>Registrare la prenotazione, contattarti se serve, gestire modifiche e annullamenti</td><td>Esecuzione del contratto o misure precontrattuali richieste da te (art. 6.1.b GDPR)</td></tr>
      <tr><td>Indirizzo</td><td>Solo per i servizi a domicilio: sapere dove recarsi</td><td>Art. 6.1.b</td></tr>
      <tr><td>Servizio, data e ora</td><td>Mantenere l'agenda e inviare i promemoria dell'appuntamento</td><td>Art. 6.1.b</td></tr>
      <tr><td>Messaggi con Lia</td><td>Rispondere alle tue richieste e completare la prenotazione</td><td>Art. 6.1.b</td></tr>
    </tbody>
  </table></div>
  <p class="note"><b>Dati sulla salute.</b> Non chiediamo informazioni sulla salute: ti invitiamo a non scriverle nei messaggi.</p>
</section>

<section id="ia">
  <h2>3. Lia, l'assistente virtuale</h2>
  ${IA}
</section>

<section id="destinatari">
  <h2>4. A chi sono comunicati</h2>
  <p>Solo a ${esc(name)} e a Prenolia, che si avvale di fornitori tecnici per database, hosting, intelligenza artificiale e messaggistica. L'elenco completo, con il luogo dove operano, è nella pagina <a href="/privacy#fornitori">Privacy e cookie</a>. I dati non sono venduti né usati per pubblicità.</p>
</section>

<section id="conservazione">
  <h2>5. Per quanto tempo</h2>
  <p>Per il tempo necessario a gestire l'appuntamento e a rispettare gli obblighi di legge. Puoi chiedere la cancellazione in qualsiasi momento, salvo ciò che l'attività deve conservare per legge.</p>
</section>

<section id="dispositivo">
  <h2>6. Cosa resta sul tuo dispositivo</h2>
  <p>Se scegli "Ricorda i miei dati su questo dispositivo", nome e telefono restano salvati nel tuo browser per precompilare la prossima prenotazione; li puoi cancellare con "Cancella" nella pagina di prenotazione. La conversazione con Lia resta salvata nel browser per non perderla. Non usiamo cookie di profilazione o pubblicità.</p>
</section>

<section id="diritti">
  <h2>7. I tuoi diritti</h2>
  ${DIRITTI("Per esercitarli contatta " + esc(name) + ": " + contact + ".")}
</section>`;
  return shell("Informativa privacy · " + name, "Informativa privacy", "Privacy per i clienti di " + name,
    "Come vengono trattati i tuoi dati quando prenoti da " + esc(name) + ", anche tramite la chat con Lia.",
    [["brevemente", "In breve"], ["titolare", "Chi tratta i dati"], ["dati", "Quali dati"], ["ia", "Lia"], ["destinatari", "Destinatari"], ["conservazione", "Conservazione"], ["dispositivo", "Sul tuo dispositivo"], ["diritti", "I tuoi diritti"]], body);
}

/* ---------------- informativa per gli iscritti di una palestra ---------------- */
function gymCustomerPage(biz) {
  const name = biz.name || "la palestra";
  const titolare = biz.legal_name && biz.legal_name.trim() ? biz.legal_name : name;
  const contactBits = [];
  if (biz.privacy_email && biz.privacy_email.trim()) contactBits.push('email <a href="mailto:' + esc(biz.privacy_email) + '">' + esc(biz.privacy_email) + "</a>");
  if (biz.public_phone && String(biz.public_phone).trim()) contactBits.push("telefono " + esc(biz.public_phone));
  const contact = contactBits.length ? contactBits.join(", ") : "i recapiti indicati nella pagina di prenotazione";
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li><b>${esc(name)}</b> usa i tuoi dati per gestire la tua iscrizione, il tuo abbonamento e le tue prenotazioni.</li>
    <li>Ti chiediamo nome, cognome e telefono. La palestra registra anche l'abbonamento, gli ingressi e, con il tuo consenso, le <b>date</b> del tuo certificato medico: mai il certificato né informazioni sulla tua salute.</li>
    <li>Nessuna pubblicità e nessuna comunicazione promozionale legata alle prenotazioni.</li>
    <li>Puoi chiedere accesso, correzione o cancellazione dei tuoi dati in qualsiasi momento.</li>
  </ul>
</section>

<section id="titolare">
  <h2>1. Chi tratta i tuoi dati</h2>
  <p><b>Titolare del trattamento:</b> ${esc(titolare)}${biz.address ? ", " + esc(biz.address) : ""}${biz.vat_number && biz.vat_number.trim() ? ", P. IVA " + esc(biz.vat_number) : ""}.</p>
  <p><b>Contatti per la privacy:</b> ${contact}.</p>
  <p><b>Responsabile del trattamento:</b> Prenolia (${val(CFG.ragioneSociale, "ragione sociale")}), che fornisce la piattaforma di gestione e prenotazione e agisce solo su istruzioni di ${esc(name)}.</p>
</section>

<section id="dati">
  <h2>2. Quali dati e perché</h2>
  <div class="tw"><table>
    <thead><tr><th>Dati</th><th>Perché</th><th>Base giuridica</th></tr></thead>
    <tbody>
      <tr><td>Nome, cognome e telefono</td><td>Riconoscerti come iscritto, farti prenotare e contattarti se una lezione cambia</td><td>Esecuzione del contratto (art. 6.1.b GDPR)</td></tr>
      <tr><td>Abbonamento: tipo, date, ingressi usati e rimasti, importo pagato</td><td>Sapere se puoi prenotare, gestire scadenze e rinnovi, tenere i conti della palestra</td><td>Art. 6.1.b e obblighi contabili (art. 6.1.c)</td></tr>
      <tr><td>Prenotazioni di lezioni e di Personal, presenze, assenze, annullamenti</td><td>Gestire i posti, i limiti settimanali e le regole di prenotazione</td><td>Art. 6.1.b</td></tr>
      <tr><td>Data di rilascio e di scadenza del certificato medico sportivo</td><td>Verificare che tu possa frequentare e avvisare la palestra quando sta per scadere</td><td>Il tuo consenso esplicito (art. 9.2.a GDPR), che puoi revocare quando vuoi, o un'altra base prevista dalla legge</td></tr>
      <tr><td>Se affitti la sala: nome, cognome, telefono, email, giorno e ora</td><td>Registrare la prenotazione e inviarti la conferma, con il link per annullarla</td><td>Art. 6.1.b</td></tr>
    </tbody>
  </table></div>
  <p class="note"><b>Certificato medico.</b> La palestra registra soltanto le date, non il certificato né diagnosi o altre informazioni sulla tua salute: non scriverle nei messaggi. Puoi non acconsentire alla registrazione delle date, ma la palestra potrebbe richiederla per ammetterti ai corsi.</p>
  <p class="note"><b>Minorenni.</b> Se l'iscritto è minorenne, i dati sono forniti, e il consenso è dato, da chi esercita la responsabilità genitoriale.</p>
</section>

<section id="destinatari">
  <h2>3. A chi sono comunicati</h2>
  <p>Solo a ${esc(name)} e a Prenolia, che si avvale di fornitori tecnici per database, hosting e invio delle email. L'elenco completo, con il luogo dove operano, è nella pagina <a href="/privacy#fornitori">Privacy e cookie</a>. I dati non sono venduti né usati per pubblicità.</p>
</section>

<section id="conservazione">
  <h2>4. Per quanto tempo</h2>
  <p>Finché sei iscritto e, dopo, per il tempo che la palestra ritiene necessario a gestire il rapporto e gli obblighi di legge. Le date del certificato servono solo finché frequenti. Puoi chiedere la cancellazione in qualsiasi momento, salvo ciò che la palestra deve conservare per legge.</p>
</section>

<section id="dispositivo">
  <h2>5. Cosa resta sul tuo dispositivo</h2>
  <p>Nome, cognome e telefono, e una copia dei dati della tua tessera (abbonamento, ingressi, scadenza, certificato), restano salvati nel tuo browser per riaprire la pagina più in fretta. Per cancellarli, cancella i dati del sito dalle impostazioni del browser. Non usiamo cookie di profilazione o pubblicità.</p>
</section>

<section id="sicurezza">
  <h2>6. Sicurezza</h2>
  <p>La tua tessera si apre solo con nome, cognome e telefono registrati dalla palestra: non comunicarli ad altri. Le connessioni sono cifrate e ogni palestra vede soltanto i propri dati.</p>
</section>

<section id="diritti">
  <h2>7. I tuoi diritti</h2>
  ${DIRITTI("Per esercitarli contatta " + esc(name) + ": " + contact + ".")}
</section>`;
  return shell("Informativa privacy · " + name, "Informativa privacy", "Privacy per gli iscritti di " + name,
    "Come vengono trattati i tuoi dati quando ti iscrivi, prenoti le lezioni o affitti la sala da " + esc(name) + ".",
    [["brevemente", "In breve"], ["titolare", "Chi tratta i dati"], ["dati", "Quali dati"], ["destinatari", "Destinatari"], ["conservazione", "Conservazione"], ["dispositivo", "Sul tuo dispositivo"], ["sicurezza", "Sicurezza"], ["diritti", "I tuoi diritti"]], body);
}


/* ---------------- centri sportivi con campi: informativa per chi prenota ---------------- */
function courtsCustomerPage(biz) {
  const name = biz.name || "il centro sportivo";
  const titolare = biz.legal_name && biz.legal_name.trim() ? biz.legal_name : name;
  const contactBits = [];
  if (biz.privacy_email && biz.privacy_email.trim()) contactBits.push('email <a href="mailto:' + esc(biz.privacy_email) + '">' + esc(biz.privacy_email) + "</a>");
  if (biz.public_phone && String(biz.public_phone).trim()) contactBits.push("telefono " + esc(biz.public_phone));
  const contact = contactBits.length ? contactBits.join(", ") : "i recapiti indicati nella pagina di prenotazione";
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li><b>${esc(name)}</b> usa i tuoi dati solo per gestire la prenotazione del campo.</li>
    <li>Ti chiediamo nome, cognome e telefono, e se vuoi l'email per ricevere la conferma. Chiediamo quanti siete a giocare e quanti sono soci, ma non i nomi degli altri giocatori.</li>
    <li>Nessun dato sulla salute: la tessera federale e il certificato medico, se richiesti, si controllano di persona al campo.</li>
    <li>Nessuna pubblicità e nessuna comunicazione promozionale legata alla prenotazione.</li>
    <li>Puoi chiedere accesso, correzione o cancellazione dei tuoi dati in qualsiasi momento.</li>
  </ul>
</section>

<section id="titolare">
  <h2>1. Chi tratta i tuoi dati</h2>
  <p><b>Titolare del trattamento:</b> ${esc(titolare)}${biz.address ? ", " + esc(biz.address) : ""}${biz.vat_number && biz.vat_number.trim() ? ", P. IVA " + esc(biz.vat_number) : ""}.</p>
  <p><b>Contatti per la privacy:</b> ${contact}.</p>
  <p><b>Responsabile del trattamento:</b> Prenolia (${val(CFG.ragioneSociale, "ragione sociale")}), che fornisce la piattaforma di prenotazione e agisce solo su istruzioni di ${esc(name)}.</p>
</section>

<section id="dati">
  <h2>2. Quali dati e perché</h2>
  <div class="tw"><table>
    <thead><tr><th>Dati</th><th>Perché</th><th>Base giuridica</th></tr></thead>
    <tbody>
      <tr><td>Nome, cognome e telefono</td><td>Registrare la prenotazione, contattarti se il campo non è più disponibile, gestire modifiche e annullamenti</td><td>Esecuzione del contratto o misure precontrattuali richieste da te (art. 6.1.b GDPR)</td></tr>
      <tr><td>Email (facoltativa)</td><td>Inviarti la conferma, con il link per annullare, e il promemoria</td><td>Art. 6.1.b</td></tr>
      <tr><td>Campo, giorno e ora</td><td>Tenere il calendario dei campi ed evitare sovrapposizioni</td><td>Art. 6.1.b</td></tr>
      <tr><td>Numero dei giocatori e quanti sono soci</td><td>Calcolare la tariffa e verificare le regole del centro (per esempio campi riservati ai soci)</td><td>Art. 6.1.b</td></tr>
      <tr><td>Importo da pagare e note facoltative</td><td>Dirti quanto si paga al centro e tenere conto di tue richieste</td><td>Art. 6.1.b</td></tr>
      <tr><td>Messaggi con Lia</td><td>Rispondere alle tue richieste e completare la prenotazione</td><td>Art. 6.1.b</td></tr>
    </tbody>
  </table></div>
  <p class="note"><b>Pagamenti.</b> Il campo si paga al centro: non raccogliamo carte né altri dati di pagamento.</p>
  <p class="note"><b>Dati sulla salute.</b> Non chiediamo informazioni sulla salute e non registriamo il certificato medico né le sue date. Se il centro richiede tessera federale o certificato, ti viene ricordato di portarli: li può controllare solo di persona. Ti invitiamo a non scrivere dati sanitari nei messaggi o nelle note.</p>
  <p class="note"><b>Minorenni.</b> La prenotazione deve essere fatta da un maggiorenne, che risponde anche dei giocatori minorenni. Non raccogliamo i dati degli altri giocatori.</p>
</section>

<section id="ia">
  <h2>3. Lia, l'assistente virtuale</h2>
  ${IA}
</section>

<section id="destinatari">
  <h2>4. A chi sono comunicati</h2>
  <p>Solo a ${esc(name)} e a Prenolia, che si avvale di fornitori tecnici per database, hosting, intelligenza artificiale, messaggistica e invio delle email. L'elenco completo, con il luogo dove operano, è nella pagina <a href="/privacy#fornitori">Privacy e cookie</a>. I dati non sono venduti né usati per pubblicità.</p>
</section>

<section id="conservazione">
  <h2>5. Per quanto tempo</h2>
  <p>Per il tempo necessario a gestire la prenotazione e a rispettare gli obblighi di legge. Puoi chiedere la cancellazione in qualsiasi momento, salvo ciò che il centro deve conservare per legge.</p>
</section>

<section id="dispositivo">
  <h2>6. Cosa resta sul tuo dispositivo</h2>
  <p>Se scegli "Ricorda i miei dati su questo dispositivo", nome, cognome e telefono restano salvati nel tuo browser per precompilare la prossima prenotazione; li puoi cancellare dalla pagina di prenotazione. La conversazione con Lia resta salvata nel browser per non perderla. Non usiamo cookie di profilazione o pubblicità.</p>
</section>

<section id="diritti">
  <h2>7. I tuoi diritti</h2>
  ${DIRITTI("Per esercitarli contatta " + esc(name) + ": " + contact + ".")}
</section>`;
  return shell("Informativa privacy · " + name, "Informativa privacy", "Privacy per chi prenota da " + name,
    "Come vengono trattati i tuoi dati quando prenoti un campo da " + esc(name) + ", anche tramite la chat con Lia.",
    [["brevemente", "In breve"], ["titolare", "Chi tratta i dati"], ["dati", "Quali dati"], ["ia", "Lia"], ["destinatari", "Destinatari"], ["conservazione", "Conservazione"], ["dispositivo", "Sul tuo dispositivo"], ["diritti", "I tuoi diritti"]], body);
}


/* ---------------- studi sanitari: informativa per i pazienti ---------------- */
function medicalCustomerPage(biz) {
  const name = biz.name || "lo studio";
  const titolare = biz.legal_name && biz.legal_name.trim() ? biz.legal_name : name;
  const contactBits = [];
  if (biz.privacy_email && biz.privacy_email.trim()) contactBits.push('email <a href="mailto:' + esc(biz.privacy_email) + '">' + esc(biz.privacy_email) + "</a>");
  if (biz.public_phone && String(biz.public_phone).trim()) contactBits.push("telefono " + esc(biz.public_phone));
  const contact = contactBits.length ? contactBits.join(", ") : "i recapiti indicati nella pagina di prenotazione";
  const months = require("./verticals.js").MEDICAL_RETENTION_MONTHS;
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li><b>${esc(name)}</b> usa i tuoi dati solo per gestire la tua prenotazione.</li>
    <li>Ti chiediamo nome, telefono e, se vuoi, l'email. <b>Non scrivere mai diagnosi, sintomi o altre informazioni sulla tua salute</b>: questo servizio non le raccoglie.</li>
    <li>Sapere che hai un appuntamento in uno studio sanitario può far capire qualcosa sulla tua salute. Per questo, prima di prenotare, ti chiediamo il <b>consenso esplicito</b>.</li>
    <li>Niente chat con l'intelligenza artificiale, niente note scritte sul tuo conto, niente pubblicità.</li>
    <li>Dopo ${months} mesi i tuoi dati personali di prenotazione vengono resi anonimi.</li>
  </ul>
</section>

<section id="titolare">
  <h2>1. Chi tratta i tuoi dati</h2>
  <p><b>Titolare del trattamento:</b> ${esc(titolare)}${biz.address ? ", " + esc(biz.address) : ""}${biz.vat_number && biz.vat_number.trim() ? ", P. IVA " + esc(biz.vat_number) : ""}.</p>
  <p><b>Contatti per la privacy:</b> ${contact}.</p>
  <p><b>Responsabile del trattamento:</b> Prenolia (${val(CFG.ragioneSociale, "ragione sociale")}), che fornisce la piattaforma di prenotazione e agisce solo su istruzioni di ${esc(name)}, con le garanzie descritte nell'<a href="/accordo-sanitari">Accordo per gli studi sanitari</a>.</p>
</section>

<section id="dati">
  <h2>2. Quali dati, perché e su quale base</h2>
  <div class="tw"><table>
    <thead><tr><th>Dati</th><th>Perché</th><th>Base giuridica</th></tr></thead>
    <tbody>
      <tr><td>Nome e telefono</td><td>Registrare la prenotazione, contattarti se serve, gestire modifiche e annullamenti</td><td>Misure precontrattuali richieste da te (art. 6.1.b GDPR)</td></tr>
      <tr><td>Email (facoltativa)</td><td>Inviarti la conferma e il promemoria, senza dettagli sulla visita</td><td>Art. 6.1.b</td></tr>
      <tr><td>Servizio scelto, data e ora</td><td>Tenere l'agenda dello studio e permetterti di annullare</td><td>Art. 6.1.b e, poiché da un appuntamento si può dedurre qualcosa sulla salute, il tuo consenso esplicito (art. 9.2.a)</td></tr>
      <tr><td>Data e versione del tuo consenso</td><td>Poter dimostrare che hai acconsentito</td><td>Obbligo di responsabilizzazione (art. 5.2 e 7.1)</td></tr>
    </tbody>
  </table></div>
  <p class="note"><b>Cosa non chiediamo e non raccogliamo.</b> Indirizzo di casa, diagnosi, sintomi, referti, allergie, terapie o altre note sulla tua salute. Non esiste un campo dove scriverli. Le informazioni cliniche, se servono, le raccoglie lo studio di persona, con le garanzie previste dalla legge e fuori da questo servizio.</p>
</section>

<section id="consenso">
  <h2>3. Il tuo consenso</h2>
  <p>Per prenotare devi spuntare la casella di consenso. Se non vuoi acconsentire, puoi prenotare telefonando direttamente allo studio. Puoi revocare il consenso in qualsiasi momento contattando lo studio: la revoca non rende illecito il trattamento già fatto e, salvo obblighi di legge, i dati di prenotazione vengono cancellati o resi anonimi.</p>
</section>

<section id="cosa-non">
  <h2>4. Cosa questo servizio non fa</h2>
  <ul>
    <li>Non usa la chat con l'intelligenza artificiale (Lia è disattivata per gli studi sanitari): nessun tuo testo viene inviato a fornitori di intelligenza artificiale.</li>
    <li>Non ha note libere sul tuo conto e non usa Telegram o WhatsApp per parlare con te.</li>
    <li>Non ti manda comunicazioni promozionali e non ti profila.</li>
    <li>Le email e le notifiche indicano solo il nome dello studio, il giorno e l'ora: non dicono che visita hai prenotato né con quale professionista.</li>
  </ul>
</section>

<section id="destinatari">
  <h2>5. A chi sono comunicati</h2>
  <p>Solo a ${esc(name)} e a Prenolia, che si avvale di fornitori tecnici per database, hosting e invio delle email di servizio. L'elenco, con il luogo dove operano, è nell'<a href="/accordo-sanitari#fornitori">Accordo per gli studi sanitari</a>. I dati non sono venduti né usati per pubblicità.</p>
</section>

<section id="conservazione">
  <h2>6. Per quanto tempo</h2>
  <p>I dati personali della prenotazione (nome, telefono, email) sono resi anonimi automaticamente dopo ${months} mesi dalla data dell'appuntamento. Puoi chiedere la cancellazione anticipata quando vuoi. La cartella clinica e gli obblighi di conservazione sanitari, se ci sono, riguardano lo studio e sono gestiti da lui fuori da questo servizio.</p>
</section>

<section id="dispositivo">
  <h2>7. Cosa resta sul tuo dispositivo</h2>
  <p>Per aiutarti a ritrovare o annullare un appuntamento, il browser conserva per pochi giorni l'elenco delle tue prossime prenotazioni (data, ora e telefono usato), senza il tipo di visita. Per gli studi sanitari non viene mai proposto di ricordare i tuoi dati per le prenotazioni successive. Puoi cancellare questi dati dalle impostazioni del browser. Non usiamo cookie di profilazione o pubblicità.</p>
</section>

<section id="diritti">
  <h2>8. I tuoi diritti</h2>
  ${DIRITTI("Per esercitarli contatta " + esc(name) + ": " + contact + ".")}
</section>`;
  return shell("Informativa privacy · " + name, "Informativa privacy", "Privacy per i pazienti di " + name,
    "Come vengono trattati i tuoi dati quando prenoti da " + esc(name) + ". Scritta per essere letta, senza giri di parole.",
    [["brevemente", "In breve"], ["titolare", "Chi tratta i dati"], ["dati", "Quali dati"], ["consenso", "Il tuo consenso"], ["cosa-non", "Cosa non facciamo"], ["destinatari", "Destinatari"], ["conservazione", "Conservazione"], ["dispositivo", "Sul tuo dispositivo"], ["diritti", "I tuoi diritti"]], body);
}

/* ---------------- studi sanitari: accordo sul trattamento dei dati ---------------- */
function medicalDpaPage() {
  const months = require("./verticals.js").MEDICAL_RETENTION_MONTHS;
  const mail = CFG.emailPrivacy && CFG.emailPrivacy.trim() ? '<a href="mailto:' + esc(CFG.emailPrivacy) + '">' + esc(CFG.emailPrivacy) + "</a>" : todo("email privacy");
  const body = `
<section id="brevemente" class="sum">
  <h2>In breve</h2>
  <ul>
    <li>Questo accordo si aggiunge ai <a href="/termini">Termini e alla nomina a responsabile</a> e vale per dentisti, fisioterapisti e studi medici.</li>
    <li>Anche la sola data di un appuntamento può rivelare la salute di una persona: per questo Prenolia, per gli studi sanitari, raccoglie il minimo e spegne tutto ciò che non serve.</li>
    <li><b>Prenolia non è una cartella clinica.</b> Qui ci sono solo nome, telefono, email facoltativa, servizio, giorno e ora.</li>
    <li>Tu resti titolare del trattamento. Noi siamo responsabili e ti aiutiamo a rispettare il GDPR, ma gli obblighi del titolare restano tuoi.</li>
  </ul>
</section>

<section id="ruoli">
  <h2>1. Ruoli e natura dei dati</h2>
  <p>Lo studio che usa Prenolia (di seguito "tu") è titolare del trattamento dei dati dei propri pazienti. ${val(CFG.ragioneSociale, "ragione sociale")} ("Prenolia") è responsabile del trattamento ai sensi dell'art. 28 GDPR e agisce solo secondo le tue istruzioni documentate, cioè le funzioni della piattaforma e le richieste che ci invii.</p>
  <p>I dati trattati sono nome, telefono, email (facoltativa), servizio prenotato, giorno e ora, data e versione del consenso del paziente. Poiché la prenotazione presso uno studio sanitario può rivelare informazioni sulla salute, li trattiamo <b>come se fossero dati relativi alla salute (art. 9 GDPR)</b>, con le garanzie rafforzate qui sotto.</p>
</section>

<section id="garanzie">
  <h2>2. Cosa fa Prenolia per proteggere i pazienti</h2>
  <ul>
    <li><b>Nessuna intelligenza artificiale.</b> Lia, la chat sul sito, Telegram e WhatsApp sono disattivati per gli studi sanitari: nessun testo dei pazienti arriva a fornitori di IA o di messaggistica.</li>
    <li><b>Nessun testo libero.</b> Non esistono note sui pazienti, né sulle visite, né un campo per l'indirizzo o per motivare la visita. L'interfaccia non permette di inserirli e il server rifiuta le richieste che li contengono.</li>
    <li><b>Consenso esplicito e registrato.</b> Il paziente non può prenotare online senza spuntare il consenso; data e versione sono salvate con la prenotazione. Se il consenso non si riesce a registrare, la prenotazione non viene creata.</li>
    <li><b>Email e notifiche neutre.</b> Conferme e promemoria indicano solo il nome dello studio, il giorno e l'ora, senza il tipo di visita, il professionista o il nome del paziente. Le notifiche sul telefono del titolare non contengono né il nome del paziente né il servizio. L'agenda inviata via messaggio riporta solo il numero di appuntamenti.</li>
    <li><b>Nessun dato "ricordato" sul dispositivo del paziente</b> per le prenotazioni successive.</li>
    <li><b>Chi gestisce Prenolia non vede i pazienti.</b> Nella console di amministrazione i nomi, i telefoni e i servizi dei pazienti degli studi sanitari non sono visibili, né le conversazioni. Si vedono solo numeri aggregati.</li>
    <li><b>Conservazione breve.</b> I dati personali delle prenotazioni sono resi anonimi automaticamente dopo ${months} mesi (24 per le altre attività), compresa l'email.</li>
    <li><b>Sicurezza.</b> Connessioni cifrate, password cifrate, verifica in due passaggi per l'area riservata, separazione dei dati tra attività, dati ospitati in Unione Europea.</li>
    <li><b>Nessun marketing e nessuna profilazione.</b></li>
  </ul>
</section>

<section id="obblighi">
  <h2>3. Cosa fai tu come titolare</h2>
  <ul>
    <li>Non usi Prenolia come cartella clinica e non inserisci diagnosi, sintomi, referti o altre informazioni sanitarie, nemmeno nel nome dei servizi, nel nome dello studio o nelle descrizioni. Le tieni nel tuo gestionale clinico, con le tue misure di sicurezza e i tuoi obblighi di conservazione.</li>
    <li>Compili nelle Impostazioni i dati dello studio (ragione sociale, partita IVA, email per la privacy): compaiono nell'informativa ai pazienti.</li>
    <li>Metti a disposizione dei pazienti l'informativa generata da Prenolia (è collegata alla pagina di prenotazione) e la integri con la tua informativa clinica.</li>
    <li>Verifichi se, per il tuo studio, servono un registro dei trattamenti, una valutazione d'impatto (DPIA) e un responsabile della protezione dei dati (DPO), e li predisponi. Prenolia ti mette a disposizione una scheda descrittiva del trattamento da allegare alla DPIA.</li>
    <li>Per i pazienti minorenni o che non possono decidere da soli, il consenso è dato da chi ne ha la responsabilità.</li>
    <li>Rispondi alle richieste dei pazienti (accesso, rettifica, cancellazione, revoca del consenso); noi ti aiutiamo a farlo.</li>
    <li>Se prenoti a nome del paziente (telefono, di persona), lo informi e raccogli il suo consenso prima di inserire i dati.</li>
  </ul>
</section>

<section id="fornitori">
  <h2>4. Sub-responsabili</h2>
  <p>Per gli studi sanitari Prenolia usa soltanto i fornitori qui sotto. Anthropic (intelligenza artificiale), Twilio e Meta (WhatsApp) e Telegram <b>non ricevono alcun dato</b> perché le relative funzioni sono disattivate.</p>
  <div class="tw"><table>
  <thead><tr><th>Fornitore</th><th>A cosa serve</th><th>Dove</th></tr></thead>
  <tbody>
  <tr><td>Supabase</td><td>Database</td><td>Unione Europea (Irlanda)</td></tr>
  <tr><td>Vercel</td><td>Hosting dell'applicazione (funzioni eseguite in Irlanda)</td><td>Unione Europea e Stati Uniti</td></tr>
  <tr><td>Resend</td><td>Email di conferma e promemoria, solo se il paziente lascia l'email: nome dello studio, giorno e ora</td><td>Stati Uniti</td></tr>
  <tr><td>Apple, Google, Mozilla</td><td>Notifica push al titolare, senza nome del paziente né servizio</td><td>Stati Uniti</td></tr>
  </tbody></table></div>
  <p class="note">Quando un fornitore opera fuori dallo Spazio economico europeo, il trasferimento avviene con le garanzie del GDPR (decisione di adeguatezza EU-US Data Privacy Framework o clausole contrattuali standard). Ti avvisiamo di ogni cambiamento rilevante e puoi opporti.</p>
</section>

<section id="violazioni">
  <h2>5. Violazioni, assistenza e verifiche</h2>
  <ul>
    <li>Ti avvisiamo di una violazione dei dati personali senza ingiustificato ritardo e <b>entro 24 ore</b> da quando ne veniamo a conoscenza, così hai il tempo di valutare la notifica al Garante (entro 72 ore).</li>
    <li>Ti assistiamo nelle richieste dei pazienti, nella valutazione d'impatto e nella consultazione con il Garante.</li>
    <li>Mettiamo a disposizione le informazioni necessarie a dimostrare il rispetto di questi obblighi e consentiamo verifiche ragionevoli, concordate in anticipo.</li>
    <li>Le persone autorizzate al trattamento sono vincolate alla riservatezza.</li>
  </ul>
</section>

<section id="fine">
  <h2>6. Fine del servizio</h2>
  <p>Quando chiudi l'account cancelliamo i dati dello studio e dei pazienti, o te li restituiamo in un file (Excel o PDF) se lo chiedi prima, salvo obblighi di legge. Puoi esportare tutti i tuoi dati in qualsiasi momento da "I tuoi dati". Puoi chiedere la cancellazione anticipata scrivendo a ${mail}.</p>
</section>

<section id="limiti">
  <h2>7. Limiti</h2>
  <p>Prenolia è uno strumento di prenotazione: non offre prestazioni sanitarie, non conserva documentazione clinica e non sostituisce la consulenza di un professionista della privacy o di un legale. Per ogni altro aspetto valgono i <a href="/termini">Termini</a>; in caso di contrasto sul trattamento dei dati degli studi sanitari prevale questo accordo.</p>
</section>`;
  return shell("Accordo per gli studi sanitari · Prenolia", "Accordo", "Accordo sul trattamento dei dati per gli studi sanitari",
    "Le garanzie in più che Prenolia offre a dentisti, fisioterapisti e studi medici, e gli impegni che restano a carico dello studio.",
    [["brevemente", "In breve"], ["ruoli", "Ruoli e dati"], ["garanzie", "Cosa facciamo noi"], ["obblighi", "Cosa fai tu"], ["fornitori", "Sub-responsabili"], ["violazioni", "Violazioni"], ["fine", "Fine del servizio"], ["limiti", "Limiti"]], body);
}

function notFoundPage() {
  return shell("Pagina non trovata · Prenolia", "Privacy", "Pagina non trovata", "Controlla il link della pagina di prenotazione.", [], '<section><p>Non troviamo questa attività.</p></section>');
}

module.exports = { privacyPage, termsPage, customerPage, medicalCustomerPage, medicalDpaPage, notFoundPage };
